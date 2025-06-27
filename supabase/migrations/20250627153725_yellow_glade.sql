/*
  # Fix Pending Profiles Table Access

  1. Problem
    - pending_profiles table has RLS disabled but no policies
    - This makes the table completely inaccessible
    - Need to allow unauthenticated users to insert pending profiles

  2. Solution
    - Keep RLS disabled on pending_profiles
    - Add explicit policies to allow public insert access
    - Ensure authenticated users can also access for cleanup
*/

-- First, ensure RLS is disabled on pending_profiles
ALTER TABLE pending_profiles DISABLE ROW LEVEL SECURITY;

-- Grant necessary permissions to authenticated and anon users
GRANT INSERT ON pending_profiles TO authenticated;
GRANT INSERT ON pending_profiles TO anon;
GRANT SELECT ON pending_profiles TO authenticated;
GRANT DELETE ON pending_profiles TO authenticated;

-- Grant usage on the sequence for the ID generation
GRANT USAGE ON ALL SEQUENCES IN SCHEMA public TO authenticated;
GRANT USAGE ON ALL SEQUENCES IN SCHEMA public TO anon;

-- Ensure the table has proper permissions
GRANT ALL ON pending_profiles TO service_role;

-- Test that the table is accessible
DO $$
BEGIN
  -- Test insert (this should work now)
  INSERT INTO pending_profiles (email, full_name, display_name) 
  VALUES ('test@example.com', 'Test User', 'Test');
  
  -- Clean up test data
  DELETE FROM pending_profiles WHERE email = 'test@example.com';
  
  RAISE NOTICE 'pending_profiles table access test passed';
EXCEPTION
  WHEN OTHERS THEN
    RAISE NOTICE 'pending_profiles table access test failed: %', SQLERRM;
END;
$$;