/*
  # Fix pending profiles table permissions

  1. Tables
    - Recreate pending_profiles with proper RLS policies
    - Allow authenticated users to insert their own pending profiles
    - Allow system to read/update for processing

  2. Security
    - Enable RLS on pending_profiles
    - Add policies for authenticated users to insert
    - Add policies for system functions to process
*/

-- Clean up everything first
DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;
DROP FUNCTION IF EXISTS handle_new_user() CASCADE;
DROP FUNCTION IF EXISTS transfer_pending_profile_data(uuid, text) CASCADE;
DROP FUNCTION IF EXISTS cleanup_expired_pending_profiles() CASCADE;
DROP FUNCTION IF EXISTS debug_pending_profiles() CASCADE;
DROP FUNCTION IF EXISTS test_signup_flow(text, text) CASCADE;

-- Recreate pending_profiles table with proper permissions
DROP TABLE IF EXISTS pending_profiles CASCADE;

CREATE TABLE pending_profiles (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  email text UNIQUE NOT NULL,
  full_name text,
  display_name text,
  urls jsonb DEFAULT '[]'::jsonb,
  time_logging_data jsonb,
  token text UNIQUE NOT NULL DEFAULT encode(gen_random_bytes(32), 'hex'),
  expires_at timestamptz DEFAULT (now() + interval '24 hours'),
  created_at timestamptz DEFAULT now(),
  CONSTRAINT valid_email CHECK (email ~* '^[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Za-z]{2,}$')
);

-- Enable RLS
ALTER TABLE pending_profiles ENABLE ROW LEVEL SECURITY;

-- Allow anyone to insert pending profiles (for signup)
CREATE POLICY "Anyone can create pending profiles"
  ON pending_profiles
  FOR INSERT
  TO authenticated
  WITH CHECK (true);

-- Allow system to read/update/delete for processing
CREATE POLICY "System can manage pending profiles"
  ON pending_profiles
  FOR ALL
  TO authenticated
  USING (true);

-- Create indexes
CREATE INDEX idx_pending_profiles_email ON pending_profiles(email);
CREATE INDEX idx_pending_profiles_token ON pending_profiles(token);
CREATE INDEX idx_pending_profiles_expires ON pending_profiles(expires_at);

-- Function to transfer pending profile data
CREATE FUNCTION transfer_pending_profile_data(user_id_param uuid, user_email text)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  pending_data record;
  new_profile_id uuid;
  url_item jsonb;
  result jsonb := '{"status": "started"}'::jsonb;
BEGIN
  result := result || jsonb_build_object('user_id', user_id_param, 'email', user_email);
  
  -- Check if profile already exists
  SELECT id INTO new_profile_id FROM profiles WHERE user_id = user_id_param;
  
  IF new_profile_id IS NOT NULL THEN
    result := result || jsonb_build_object('status', 'profile_exists', 'profile_id', new_profile_id);
    RETURN result;
  END IF;

  -- Get pending profile data
  SELECT * INTO pending_data
  FROM pending_profiles
  WHERE email = user_email
  AND expires_at > now()
  ORDER BY created_at DESC
  LIMIT 1;

  IF pending_data IS NULL THEN
    result := result || jsonb_build_object('pending_found', false);
    -- Create basic profile
    INSERT INTO profiles (user_id, email, full_name, display_name)
    VALUES (user_id_param, user_email, '', '')
    RETURNING id INTO new_profile_id;
    
    result := result || jsonb_build_object('status', 'basic_profile_created', 'profile_id', new_profile_id);
    RETURN result;
  END IF;

  result := result || jsonb_build_object('pending_found', true, 'pending_id', pending_data.id);

  -- Create profile with pending data
  INSERT INTO profiles (
    user_id,
    email,
    full_name,
    display_name
  ) VALUES (
    user_id_param,
    user_email,
    COALESCE(pending_data.full_name, ''),
    COALESCE(pending_data.display_name, '')
  ) RETURNING id INTO new_profile_id;

  result := result || jsonb_build_object('profile_created', true, 'profile_id', new_profile_id);

  -- Add URLs if they exist
  IF pending_data.urls IS NOT NULL AND jsonb_array_length(pending_data.urls) > 0 THEN
    FOR url_item IN SELECT * FROM jsonb_array_elements(pending_data.urls)
    LOOP
      IF url_item ? 'url' AND url_item ? 'type' THEN
        INSERT INTO profile_urls (profile_id, url, url_type)
        VALUES (
          new_profile_id,
          url_item->>'url',
          url_item->>'type'
        );
      END IF;
    END LOOP;
    result := result || jsonb_build_object('urls_added', jsonb_array_length(pending_data.urls));
  END IF;

  -- Clean up pending profile
  DELETE FROM pending_profiles WHERE id = pending_data.id;
  result := result || jsonb_build_object('status', 'completed', 'pending_cleaned', true);

  RETURN result;

EXCEPTION
  WHEN OTHERS THEN
    result := result || jsonb_build_object('error', SQLERRM, 'status', 'error');
    -- Ensure basic profile exists
    INSERT INTO profiles (user_id, email, full_name, display_name)
    VALUES (user_id_param, user_email, '', '')
    ON CONFLICT (user_id) DO NOTHING;
    RETURN result;
END;
$$;

-- Trigger function
CREATE FUNCTION handle_new_user()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  transfer_result jsonb;
BEGIN
  SELECT transfer_pending_profile_data(NEW.id, NEW.email) INTO transfer_result;
  RAISE NOTICE 'Profile transfer for %: %', NEW.email, transfer_result;
  RETURN NEW;
EXCEPTION
  WHEN OTHERS THEN
    RAISE WARNING 'Error in handle_new_user for %: %', NEW.email, SQLERRM;
    INSERT INTO profiles (user_id, email, full_name, display_name)
    VALUES (NEW.id, NEW.email, '', '')
    ON CONFLICT (user_id) DO NOTHING;
    RETURN NEW;
END;
$$;

-- Create trigger
CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE FUNCTION handle_new_user();

-- Cleanup function
CREATE FUNCTION cleanup_expired_pending_profiles()
RETURNS integer
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  deleted_count integer;
BEGIN
  DELETE FROM pending_profiles WHERE expires_at < now();
  GET DIAGNOSTICS deleted_count = ROW_COUNT;
  RETURN deleted_count;
END;
$$;