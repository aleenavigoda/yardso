/*
  # Fix Sign-up Flow and Database Issues

  1. Clean Setup
    - Drop all existing functions and triggers cleanly
    - Recreate pending_profiles table
    - Set up proper transfer mechanism

  2. Functions
    - transfer_pending_profile_data: Moves data from pending to profiles
    - handle_new_user: Trigger function for auth.users
    - cleanup_expired_pending_profiles: Maintenance function
    - debug helpers for troubleshooting

  3. Security
    - No RLS on pending_profiles (temporary data)
    - Proper error handling and logging
*/

-- Clean up ALL existing functions and triggers first
DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;
DROP FUNCTION IF EXISTS handle_new_user() CASCADE;
DROP FUNCTION IF EXISTS transfer_pending_profile(uuid, text) CASCADE;
DROP FUNCTION IF EXISTS transfer_pending_profile_data(uuid, text) CASCADE;
DROP FUNCTION IF EXISTS cleanup_expired_pending_profiles() CASCADE;
DROP FUNCTION IF EXISTS debug_pending_profiles() CASCADE;
DROP FUNCTION IF EXISTS test_signup_flow(text, text) CASCADE;
DROP FUNCTION IF EXISTS check_pending_profiles() CASCADE;
DROP FUNCTION IF EXISTS test_profile_creation(text) CASCADE;

-- Recreate pending_profiles table with correct structure
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

-- No RLS on pending_profiles - it's a temporary table
-- Create indexes for performance
CREATE INDEX idx_pending_profiles_email ON pending_profiles(email);
CREATE INDEX idx_pending_profiles_token ON pending_profiles(token);
CREATE INDEX idx_pending_profiles_expires ON pending_profiles(expires_at);

-- Function to transfer pending profile data to profiles table
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
  -- Log the start
  result := result || jsonb_build_object('user_id', user_id_param, 'email', user_email, 'timestamp', now());
  
  -- Check if profile already exists
  SELECT id INTO new_profile_id FROM profiles WHERE user_id = user_id_param;
  
  IF new_profile_id IS NOT NULL THEN
    result := result || jsonb_build_object('status', 'profile_already_exists', 'profile_id', new_profile_id);
    RETURN result;
  END IF;

  -- Get the most recent pending profile data for this email
  SELECT * INTO pending_data
  FROM pending_profiles
  WHERE email = user_email
  AND expires_at > now()
  ORDER BY created_at DESC
  LIMIT 1;

  IF pending_data IS NULL THEN
    result := result || jsonb_build_object('pending_found', false);
    -- No pending profile found, create basic profile
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

  -- Store time logging data in a way the app can access it
  IF pending_data.time_logging_data IS NOT NULL THEN
    result := result || jsonb_build_object('time_logging_data', pending_data.time_logging_data);
  END IF;

  -- Clean up the pending profile
  DELETE FROM pending_profiles WHERE id = pending_data.id;
  result := result || jsonb_build_object('status', 'completed', 'pending_cleaned', true);

  RETURN result;

EXCEPTION
  WHEN OTHERS THEN
    result := result || jsonb_build_object('error', SQLERRM, 'status', 'error');
    -- Ensure basic profile exists as fallback
    INSERT INTO profiles (user_id, email, full_name, display_name)
    VALUES (user_id_param, user_email, '', '')
    ON CONFLICT (user_id) DO NOTHING;
    RETURN result;
END;
$$;

-- Trigger function to handle new user creation
CREATE FUNCTION handle_new_user()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  transfer_result jsonb;
BEGIN
  -- Transfer pending profile data if it exists
  SELECT transfer_pending_profile_data(NEW.id, NEW.email) INTO transfer_result;
  
  -- Log the result for debugging (this will show in Supabase logs)
  RAISE NOTICE 'Profile transfer result for user % (email: %): %', NEW.id, NEW.email, transfer_result;
  
  RETURN NEW;
EXCEPTION
  WHEN OTHERS THEN
    -- Log the error but don't prevent user creation
    RAISE WARNING 'Error in handle_new_user for user % (email: %): %', NEW.id, NEW.email, SQLERRM;
    
    -- Ensure a basic profile exists as absolute fallback
    INSERT INTO profiles (user_id, email, full_name, display_name)
    VALUES (NEW.id, NEW.email, '', '')
    ON CONFLICT (user_id) DO NOTHING;
    
    RETURN NEW;
END;
$$;

-- Create the trigger
CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE FUNCTION handle_new_user();

-- Function to clean up expired pending profiles
CREATE FUNCTION cleanup_expired_pending_profiles()
RETURNS integer
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  deleted_count integer;
BEGIN
  DELETE FROM pending_profiles
  WHERE expires_at < now();
  
  GET DIAGNOSTICS deleted_count = ROW_COUNT;
  RETURN deleted_count;
END;
$$;

-- Helper function to check pending profiles (for debugging)
CREATE FUNCTION debug_pending_profiles()
RETURNS TABLE(
  id uuid,
  email text,
  full_name text,
  display_name text,
  urls_count bigint,
  has_time_logging boolean,
  created_at timestamptz,
  expires_at timestamptz,
  is_expired boolean
)
LANGUAGE sql
SECURITY DEFINER
AS $$
  SELECT 
    p.id,
    p.email,
    p.full_name,
    p.display_name,
    CASE 
      WHEN p.urls IS NULL THEN 0
      ELSE jsonb_array_length(p.urls)
    END as urls_count,
    p.time_logging_data IS NOT NULL as has_time_logging,
    p.created_at,
    p.expires_at,
    p.expires_at < now() as is_expired
  FROM pending_profiles p
  ORDER BY p.created_at DESC;
$$;

-- Test function to verify the flow works
CREATE FUNCTION test_signup_flow(test_email text, test_name text)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  test_user_id uuid := gen_random_uuid();
  result jsonb;
BEGIN
  -- First, create a pending profile (simulating frontend)
  INSERT INTO pending_profiles (email, full_name, display_name, urls)
  VALUES (
    test_email, 
    test_name, 
    split_part(test_name, ' ', 1),
    '[{"url": "https://github.com/test", "type": "github"}]'::jsonb
  );
  
  -- Then simulate the trigger function
  SELECT transfer_pending_profile_data(test_user_id, test_email) INTO result;
  
  -- Clean up test data
  DELETE FROM profiles WHERE user_id = test_user_id;
  DELETE FROM pending_profiles WHERE email = test_email;
  
  RETURN result;
END;
$$;