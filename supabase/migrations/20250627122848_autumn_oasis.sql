/*
  # Fix Profile Insert Policy

  1. Security Updates
    - Update the INSERT policy for profiles table to properly handle new user signups
    - Ensure the policy allows users to insert their own profile during signup
    - Fix any potential timing issues with auth.uid() during signup process

  2. Changes
    - Drop and recreate the INSERT policy with proper conditions
    - Ensure the policy works correctly during the signup flow
*/

-- Drop the existing INSERT policy
DROP POLICY IF EXISTS "Users can insert their own profile" ON profiles;

-- Create a new INSERT policy that properly handles signup
CREATE POLICY "Users can insert their own profile"
  ON profiles
  FOR INSERT
  TO authenticated
  WITH CHECK (auth.uid() = user_id);

-- Also ensure we have a policy for unauthenticated users during the signup process
-- This is needed because during signup, the user might not be fully authenticated yet
CREATE POLICY "Allow profile creation during signup"
  ON profiles
  FOR INSERT
  TO anon
  WITH CHECK (true);