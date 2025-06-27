/*
  # Fix Authentication Flow and Profile Creation

  1. Database Functions
    - Drop and recreate transfer_pending_profile function with proper return type
    - Update handle_new_user trigger function with better error handling
    - Add debugging and testing functions

  2. Triggers
    - Recreate trigger on auth.users table
    - Ensure proper profile creation flow

  3. Testing Functions
    - Add functions to test and debug profile creation
    - Add function to check pending profiles status
*/

-- First, let's check if there are any pending profiles and clean up the functions
DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;

-- Drop the existing function completely to avoid return type conflicts
DROP FUNCTION IF EXISTS transfer_pending_profile(uuid, text);

-- Recreate the transfer function with better debugging
CREATE OR REPLACE FUNCTION transfer_pending_profile(user_id_param uuid, user_email text)
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

-- Drop and recreate the trigger function with better error handling and logging
DROP FUNCTION IF EXISTS handle_new_user();

CREATE OR REPLACE FUNCTION handle_new_user()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  transfer_result jsonb;
BEGIN
  -- Transfer pending profile data if it exists
  SELECT transfer_pending_profile(NEW.id, NEW.email) INTO transfer_result;
  
  -- Log the result for debugging (this will show in Supabase logs)
  RAISE NOTICE 'Profile transfer result for %: %', NEW.email, transfer_result;
  
  RETURN NEW;
EXCEPTION
  WHEN OTHERS THEN
    -- Log the error but don't prevent user creation
    RAISE WARNING 'Error in handle_new_user for %: %', NEW.email, SQLERRM;
    
    -- Ensure a basic profile exists
    INSERT INTO profiles (user_id, email, full_name, display_name)
    VALUES (NEW.id, NEW.email, '', '')
    ON CONFLICT (user_id) DO NOTHING;
    
    RETURN NEW;
END;
$$;

-- Recreate trigger on auth.users
CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE FUNCTION handle_new_user();

-- Function to manually test the profile creation (for debugging)
CREATE OR REPLACE FUNCTION test_profile_creation(test_email text)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  test_user_id uuid := gen_random_uuid();
  result jsonb;
BEGIN
  -- Simulate the trigger function
  SELECT transfer_pending_profile(test_user_id, test_email) INTO result;
  
  -- Clean up test data
  DELETE FROM profiles WHERE user_id = test_user_id;
  
  RETURN result;
END;
$$;

-- Add a function to check pending profiles
CREATE OR REPLACE FUNCTION check_pending_profiles()
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