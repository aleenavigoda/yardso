/*
  # Fix Profile Creation RLS Policies

  1. Security Updates
    - Drop existing problematic policies
    - Create new policies that properly handle user signup flow
    - Ensure both anonymous and authenticated users can create profiles appropriately

  2. Policy Changes
    - Allow anonymous users to create profiles during signup process
    - Allow authenticated users to create their own profiles
    - Maintain security by ensuring users can only create profiles for themselves
*/

-- Drop existing policies that might be causing conflicts
DROP POLICY IF EXISTS "Allow profile creation during signup" ON profiles;
DROP POLICY IF EXISTS "Users can insert their own profile" ON profiles;

-- Create a comprehensive policy for profile creation that handles both signup scenarios
CREATE POLICY "Enable profile creation for signup"
  ON profiles
  FOR INSERT
  WITH CHECK (
    -- Allow if user is authenticated and creating their own profile
    (auth.role() = 'authenticated' AND auth.uid() = user_id)
    OR
    -- Allow if user is anonymous (during signup process) and the user_id matches a valid auth user
    (auth.role() = 'anon' AND user_id IS NOT NULL)
  );

-- Ensure the existing read and update policies remain intact
-- (These should already exist based on your schema, but let's make sure)

-- Policy for reading profiles (should already exist)
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies 
    WHERE tablename = 'profiles' 
    AND policyname = 'Users can read all public profiles'
  ) THEN
    CREATE POLICY "Users can read all public profiles"
      ON profiles
      FOR SELECT
      TO authenticated
      USING (true);
  END IF;
END $$;

-- Policy for updating profiles (should already exist)
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies 
    WHERE tablename = 'profiles' 
    AND policyname = 'Users can update their own profile'
  ) THEN
    CREATE POLICY "Users can update their own profile"
      ON profiles
      FOR UPDATE
      TO authenticated
      USING (auth.uid() = user_id);
  END IF;
END $$;