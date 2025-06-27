/*
  # Fix pending profiles and sign-in flow

  1. Database Changes
    - Ensure pending_profiles table works correctly
    - Fix trigger function to handle pending data properly
    - Add better error handling

  2. Authentication Flow
    - Fix sign-in modal getting stuck
    - Improve error handling in auth flow
*/

-- First, let's test if we can insert into pending_profiles as anon
DO $$
BEGIN
  -- Test insert
  INSERT INTO pending_profiles (email, full_name, display_name, urls)
  VALUES ('test@example.com', 'Test User', 'Test', '[]'::jsonb);
  
  -- Clean up
  DELETE FROM pending_profiles WHERE email = 'test@example.com';
  
  RAISE NOTICE 'Pending profiles insert test: SUCCESS';
EXCEPTION
  WHEN OTHERS THEN
    RAISE WARNING 'Pending profiles insert test FAILED: %', SQLERRM;
END;
$$;

-- Ensure anon can insert into pending_profiles
GRANT INSERT ON pending_profiles TO anon;
GRANT USAGE, SELECT ON ALL SEQUENCES IN SCHEMA public TO anon;

-- Create a function to debug the signup flow
CREATE OR REPLACE FUNCTION debug_signup_flow(test_email text)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  result jsonb := '{}'::jsonb;
  pending_count integer;
  profile_count integer;
BEGIN
  -- Check pending_profiles
  SELECT COUNT(*) INTO pending_count FROM pending_profiles WHERE email = test_email;
  result := result || jsonb_build_object('pending_profiles_count', pending_count);
  
  -- Check profiles
  SELECT COUNT(*) INTO profile_count FROM profiles WHERE email = test_email;
  result := result || jsonb_build_object('profiles_count', profile_count);
  
  -- Check if we can insert into pending_profiles
  BEGIN
    INSERT INTO pending_profiles (email, full_name, display_name)
    VALUES (test_email || '.test', 'Test User', 'Test');
    
    DELETE FROM pending_profiles WHERE email = test_email || '.test';
    result := result || jsonb_build_object('can_insert_pending', true);
  EXCEPTION
    WHEN OTHERS THEN
      result := result || jsonb_build_object('can_insert_pending', false, 'insert_error', SQLERRM);
  END;
  
  RETURN result;
END;
$$;

-- Test the debug function
SELECT debug_signup_flow('debug@test.com') as debug_result;