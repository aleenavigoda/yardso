/*
  # Fix Profile Data Transfer from Pending Profiles

  1. Issues Fixed
    - Profile data not being transferred from pending_profiles to profiles table
    - Handle_new_user trigger not working properly
    - Better error handling and logging

  2. Changes
    - Fix the handle_new_user trigger function
    - Add better debugging and error handling
    - Ensure profile data is properly transferred on email confirmation
*/

-- Drop and recreate the handle_new_user function with better logic
DROP FUNCTION IF EXISTS handle_new_user() CASCADE;

CREATE OR REPLACE FUNCTION handle_new_user()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  pending_data record;
  new_profile_id uuid;
  url_item jsonb;
  urls_added integer := 0;
BEGIN
  RAISE NOTICE 'handle_new_user triggered for user: % with email: %', NEW.id, NEW.email;

  -- Check if profile already exists (shouldn't happen, but let's be safe)
  SELECT id INTO new_profile_id FROM profiles WHERE user_id = NEW.id;
  
  IF new_profile_id IS NOT NULL THEN
    RAISE NOTICE 'Profile already exists for user %, skipping creation', NEW.id;
    RETURN NEW;
  END IF;

  -- Get the most recent pending profile data for this email
  SELECT * INTO pending_data
  FROM pending_profiles
  WHERE email = NEW.email
  AND expires_at > now()
  ORDER BY created_at DESC
  LIMIT 1;

  IF pending_data IS NULL THEN
    RAISE NOTICE 'No pending profile found for %, creating basic profile', NEW.email;
    -- Create basic profile
    INSERT INTO profiles (user_id, email, full_name, display_name)
    VALUES (NEW.id, NEW.email, '', '')
    RETURNING id INTO new_profile_id;
    
    RAISE NOTICE 'Basic profile created with ID: %', new_profile_id;
  ELSE
    RAISE NOTICE 'Found pending profile % for %, transferring data', pending_data.id, NEW.email;
    
    -- Create profile with pending data
    INSERT INTO profiles (
      user_id,
      email,
      full_name,
      display_name
    ) VALUES (
      NEW.id,
      NEW.email,
      COALESCE(pending_data.full_name, ''),
      COALESCE(pending_data.display_name, '')
    ) RETURNING id INTO new_profile_id;

    RAISE NOTICE 'Profile created with pending data, ID: %, name: %', new_profile_id, pending_data.full_name;

    -- Add URLs if they exist
    IF pending_data.urls IS NOT NULL AND jsonb_array_length(pending_data.urls) > 0 THEN
      RAISE NOTICE 'Processing % URLs from pending data', jsonb_array_length(pending_data.urls);
      
      FOR url_item IN SELECT * FROM jsonb_array_elements(pending_data.urls)
      LOOP
        BEGIN
          IF url_item ? 'url' AND url_item ? 'type' THEN
            INSERT INTO profile_urls (profile_id, url, url_type)
            VALUES (
              new_profile_id,
              url_item->>'url',
              url_item->>'type'
            );
            urls_added := urls_added + 1;
            RAISE NOTICE 'Added URL: % (type: %)', url_item->>'url', url_item->>'type';
          END IF;
        EXCEPTION
          WHEN OTHERS THEN
            RAISE WARNING 'Failed to add URL %: %', url_item->>'url', SQLERRM;
        END;
      END LOOP;
      
      RAISE NOTICE 'Successfully added % URLs', urls_added;
    END IF;

    -- Clean up pending profile
    DELETE FROM pending_profiles WHERE id = pending_data.id;
    RAISE NOTICE 'Cleaned up pending profile %', pending_data.id;
  END IF;

  RETURN NEW;

EXCEPTION
  WHEN OTHERS THEN
    RAISE WARNING 'Error in handle_new_user for %: %', NEW.email, SQLERRM;
    -- Ensure basic profile exists as fallback
    INSERT INTO profiles (user_id, email, full_name, display_name)
    VALUES (NEW.id, NEW.email, '', '')
    ON CONFLICT (user_id) DO NOTHING;
    RETURN NEW;
END;
$$;

-- Recreate the trigger
DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;
CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE FUNCTION handle_new_user();

-- Function to manually test profile transfer (for debugging)
CREATE OR REPLACE FUNCTION test_profile_transfer(test_email text)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  test_user_id uuid := gen_random_uuid();
  pending_count integer;
  profile_count integer;
  result jsonb := '{}'::jsonb;
BEGIN
  -- Check pending profiles
  SELECT COUNT(*) INTO pending_count FROM pending_profiles WHERE email = test_email;
  result := result || jsonb_build_object('pending_profiles_found', pending_count);
  
  -- Simulate the trigger
  PERFORM handle_new_user() FROM (SELECT test_user_id as id, test_email as email) as NEW;
  
  -- Check if profile was created
  SELECT COUNT(*) INTO profile_count FROM profiles WHERE user_id = test_user_id;
  result := result || jsonb_build_object('profile_created', profile_count > 0);
  
  -- Clean up test data
  DELETE FROM profiles WHERE user_id = test_user_id;
  
  RETURN result;
END;
$$;

-- Add a function to check current state
CREATE OR REPLACE FUNCTION debug_profile_state(check_email text)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  pending_count integer;
  profile_count integer;
  pending_data jsonb;
  profile_data jsonb;
  result jsonb := '{}'::jsonb;
BEGIN
  -- Check pending profiles
  SELECT COUNT(*) INTO pending_count FROM pending_profiles WHERE email = check_email;
  
  -- Get pending profile data
  SELECT to_jsonb(p.*) INTO pending_data 
  FROM pending_profiles p 
  WHERE email = check_email 
  ORDER BY created_at DESC 
  LIMIT 1;
  
  -- Check profiles
  SELECT COUNT(*) INTO profile_count FROM profiles WHERE email = check_email;
  
  -- Get profile data
  SELECT to_jsonb(p.*) INTO profile_data 
  FROM profiles p 
  WHERE email = check_email 
  LIMIT 1;
  
  result := jsonb_build_object(
    'email', check_email,
    'pending_profiles_count', pending_count,
    'profiles_count', profile_count,
    'pending_data', pending_data,
    'profile_data', profile_data
  );
  
  RETURN result;
END;
$$;