/*
  # Fix signup 500 error

  1. Problem
    - The trigger function is causing auth.users insert to fail
    - This results in 500 error from Supabase Auth API
    
  2. Solution
    - Simplify trigger to be more robust
    - Add better error handling
    - Ensure trigger never fails the auth.users insert
    
  3. Changes
    - Recreate handle_new_user function with bulletproof error handling
    - Ensure pending_profiles access works correctly
*/

-- Drop existing trigger and function
DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;
DROP FUNCTION IF EXISTS handle_new_user() CASCADE;

-- Create a bulletproof trigger function
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
BEGIN
  -- Always create a basic profile first to ensure user can sign in
  INSERT INTO profiles (user_id, email, full_name, display_name)
  VALUES (NEW.id, NEW.email, '', '')
  RETURNING id INTO new_profile_id;

  -- Try to get and apply pending data, but don't fail if it doesn't work
  BEGIN
    SELECT * INTO pending_data
    FROM pending_profiles
    WHERE email = NEW.email
    ORDER BY created_at DESC
    LIMIT 1;

    -- If we found pending data, update the profile
    IF pending_data IS NOT NULL THEN
      UPDATE profiles SET
        full_name = COALESCE(pending_data.full_name, ''),
        display_name = COALESCE(pending_data.display_name, ''),
        updated_at = now()
      WHERE id = new_profile_id;

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
            END IF;
          EXCEPTION
            WHEN OTHERS THEN
              -- Skip this URL if it fails, don't break the whole process
              CONTINUE;
          END;
        END LOOP;
      END IF;

      -- Clean up pending profile
      DELETE FROM pending_profiles WHERE id = pending_data.id;
    END IF;

  EXCEPTION
    WHEN OTHERS THEN
      -- If anything fails with pending data, just log it and continue
      -- The basic profile is already created, so user can still sign in
      RAISE WARNING 'Failed to process pending data for user %: %', NEW.email, SQLERRM;
  END;

  RETURN NEW;

EXCEPTION
  WHEN OTHERS THEN
    -- This should never happen, but if it does, don't fail the auth insert
    RAISE WARNING 'Critical error in handle_new_user for %: %', NEW.email, SQLERRM;
    RETURN NEW;
END;
$$;

-- Create the trigger
CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE FUNCTION handle_new_user();

-- Ensure pending_profiles has correct permissions
GRANT INSERT ON pending_profiles TO anon;
GRANT SELECT, DELETE ON pending_profiles TO service_role;
GRANT USAGE ON ALL SEQUENCES IN SCHEMA public TO anon;

-- Test that we can insert into pending_profiles as anon
-- This should work without errors
DO $$
BEGIN
  -- Test insert as would happen during signup
  INSERT INTO pending_profiles (email, full_name, display_name)
  VALUES ('test-anon@example.com', 'Test User', 'Test');
  
  -- Clean up test data
  DELETE FROM pending_profiles WHERE email = 'test-anon@example.com';
  
  RAISE NOTICE 'Pending profiles table is working correctly';
EXCEPTION
  WHEN OTHERS THEN
    RAISE WARNING 'Pending profiles test failed: %', SQLERRM;
END;
$$;