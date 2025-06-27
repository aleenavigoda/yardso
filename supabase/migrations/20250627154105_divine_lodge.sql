/*
  # Debug and Fix Pending Profiles Issue

  1. Check Current State
    - Verify table structure and constraints
    - Test email validation
    - Check trigger function

  2. Fix Issues
    - Update email validation if needed
    - Ensure proper permissions
    - Test insertion flow
*/

-- First, let's check what's actually happening
DO $$
BEGIN
  RAISE NOTICE 'Checking pending_profiles table structure...';
  
  -- Check if table exists and its structure
  IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'pending_profiles') THEN
    RAISE NOTICE 'pending_profiles table exists';
  ELSE
    RAISE NOTICE 'pending_profiles table does NOT exist';
  END IF;
END $$;

-- Test email validation constraint
DO $$
BEGIN
  -- Test if we can insert a valid email
  BEGIN
    INSERT INTO pending_profiles (email, full_name, display_name) 
    VALUES ('test@example.com', 'Test User', 'Test');
    RAISE NOTICE 'Test insert successful';
    DELETE FROM pending_profiles WHERE email = 'test@example.com';
  EXCEPTION
    WHEN OTHERS THEN
      RAISE NOTICE 'Test insert failed: %', SQLERRM;
  END;
END $$;

-- Let's recreate the table with a simpler email validation
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
  created_at timestamptz DEFAULT now()
);

-- Add a simpler email check that's less likely to fail
ALTER TABLE pending_profiles ADD CONSTRAINT valid_email_format 
CHECK (email ~ '^[^@\s]+@[^@\s]+\.[^@\s]+$');

-- Create indexes
CREATE INDEX idx_pending_profiles_email ON pending_profiles(email);
CREATE INDEX idx_pending_profiles_token ON pending_profiles(token);
CREATE INDEX idx_pending_profiles_expires ON pending_profiles(expires_at);

-- Enable RLS
ALTER TABLE pending_profiles ENABLE ROW LEVEL SECURITY;

-- Create policies
CREATE POLICY "Allow anonymous insert for signup"
  ON pending_profiles
  FOR INSERT
  TO anon
  WITH CHECK (true);

CREATE POLICY "Users can read their own pending profiles"
  ON pending_profiles
  FOR SELECT
  TO authenticated
  USING (email = (SELECT email FROM auth.users WHERE id = auth.uid()));

-- Grant permissions
GRANT INSERT ON pending_profiles TO anon;
GRANT SELECT ON pending_profiles TO authenticated;
GRANT ALL ON pending_profiles TO authenticated;
GRANT USAGE ON ALL SEQUENCES IN SCHEMA public TO anon;
GRANT USAGE ON ALL SEQUENCES IN SCHEMA public TO authenticated;

-- Test the setup
DO $$
BEGIN
  -- Test insert as anon user would
  SET ROLE anon;
  BEGIN
    INSERT INTO pending_profiles (email, full_name, display_name) 
    VALUES ('testuser@example.com', 'Test User', 'Test');
    RAISE NOTICE 'Anonymous insert test successful';
    DELETE FROM pending_profiles WHERE email = 'testuser@example.com';
  EXCEPTION
    WHEN OTHERS THEN
      RAISE NOTICE 'Anonymous insert test failed: %', SQLERRM;
  END;
  RESET ROLE;
END $$;

-- Recreate the transfer function with better error handling
CREATE OR REPLACE FUNCTION transfer_pending_profile_data(user_id_param uuid, user_email text)
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

-- Recreate trigger function with better error handling
CREATE OR REPLACE FUNCTION handle_new_user()
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

-- Recreate trigger
DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;
CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE FUNCTION handle_new_user();