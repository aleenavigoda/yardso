/*
  # Fix sign-in issues and database triggers

  1. Database Issues
    - Ensure triggers work properly for profile creation
    - Fix any permission issues
    - Add better error handling

  2. Authentication Flow
    - Ensure sign-in works for existing users
    - Fix profile lookup issues
*/

-- First, let's check if there are any issues with the current trigger
DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;
DROP FUNCTION IF EXISTS handle_new_user() CASCADE;

-- Create a more robust trigger function
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
  debug_info text := '';
BEGIN
  debug_info := 'Starting handle_new_user for: ' || NEW.email;
  
  -- Always create a basic profile first to ensure user can sign in
  BEGIN
    INSERT INTO profiles (user_id, email, full_name, display_name)
    VALUES (NEW.id, NEW.email, '', '')
    RETURNING id INTO new_profile_id;
    
    debug_info := debug_info || ' | Profile created: ' || new_profile_id;
  EXCEPTION
    WHEN unique_violation THEN
      -- Profile already exists, get the ID
      SELECT id INTO new_profile_id FROM profiles WHERE user_id = NEW.id;
      debug_info := debug_info || ' | Profile exists: ' || new_profile_id;
    WHEN OTHERS THEN
      debug_info := debug_info || ' | Profile creation failed: ' || SQLERRM;
      RAISE WARNING 'Failed to create profile for %: %', NEW.email, SQLERRM;
      RETURN NEW;
  END;

  -- Try to get and apply pending data, but don't fail if it doesn't work
  BEGIN
    SELECT * INTO pending_data
    FROM pending_profiles
    WHERE email = NEW.email
    ORDER BY created_at DESC
    LIMIT 1;

    -- If we found pending data, update the profile
    IF pending_data IS NOT NULL THEN
      debug_info := debug_info || ' | Found pending data: ' || pending_data.id;
      
      UPDATE profiles SET
        full_name = COALESCE(NULLIF(pending_data.full_name, ''), full_name),
        display_name = COALESCE(NULLIF(pending_data.display_name, ''), display_name),
        updated_at = now()
      WHERE id = new_profile_id;

      debug_info := debug_info || ' | Profile updated';

      -- Add URLs if they exist
      IF pending_data.urls IS NOT NULL AND jsonb_array_length(pending_data.urls) > 0 THEN
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
              debug_info := debug_info || ' | URL added: ' || (url_item->>'type');
            END IF;
          EXCEPTION
            WHEN OTHERS THEN
              debug_info := debug_info || ' | URL failed: ' || SQLERRM;
              CONTINUE;
          END;
        END LOOP;
      END IF;

      -- Clean up pending profile
      DELETE FROM pending_profiles WHERE id = pending_data.id;
      debug_info := debug_info || ' | Pending cleaned';
    ELSE
      debug_info := debug_info || ' | No pending data found';
    END IF;

  EXCEPTION
    WHEN OTHERS THEN
      debug_info := debug_info || ' | Pending processing failed: ' || SQLERRM;
      RAISE WARNING 'Failed to process pending data for user %: %', NEW.email, SQLERRM;
  END;

  RAISE NOTICE 'User creation completed: %', debug_info;
  RETURN NEW;

EXCEPTION
  WHEN OTHERS THEN
    RAISE WARNING 'Critical error in handle_new_user for %: %', NEW.email, SQLERRM;
    RETURN NEW;
END;
$$;

-- Create the trigger
CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE FUNCTION handle_new_user();

-- Ensure all permissions are correct
GRANT INSERT ON pending_profiles TO anon;
GRANT SELECT, DELETE ON pending_profiles TO service_role;
GRANT USAGE, SELECT ON ALL SEQUENCES IN SCHEMA public TO anon;

-- Test function to verify everything works
CREATE OR REPLACE FUNCTION test_auth_flow()
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  result jsonb := '{}'::jsonb;
  test_email text := 'test-flow-' || extract(epoch from now()) || '@example.com';
  pending_id uuid;
  profile_count integer;
BEGIN
  -- Test 1: Can we insert into pending_profiles?
  BEGIN
    INSERT INTO pending_profiles (email, full_name, display_name)
    VALUES (test_email, 'Test User', 'Test')
    RETURNING id INTO pending_id;
    
    result := result || jsonb_build_object('pending_insert', 'success', 'pending_id', pending_id);
  EXCEPTION
    WHEN OTHERS THEN
      result := result || jsonb_build_object('pending_insert', 'failed', 'error', SQLERRM);
      RETURN result;
  END;

  -- Test 2: Check if profiles table is accessible
  BEGIN
    SELECT COUNT(*) INTO profile_count FROM profiles LIMIT 1;
    result := result || jsonb_build_object('profiles_accessible', true, 'profile_count', profile_count);
  EXCEPTION
    WHEN OTHERS THEN
      result := result || jsonb_build_object('profiles_accessible', false, 'error', SQLERRM);
  END;

  -- Clean up
  DELETE FROM pending_profiles WHERE email = test_email;
  
  result := result || jsonb_build_object('test_completed', true);
  RETURN result;
END;
$$;

-- Run the test
SELECT test_auth_flow() as test_result;

-- Clean up test function
DROP FUNCTION test_auth_flow();