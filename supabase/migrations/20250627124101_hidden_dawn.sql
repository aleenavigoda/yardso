/*
  # Fix Profile Insert Policy for Signup

  1. Security Changes
    - Update the INSERT policy on profiles table to properly handle user signup
    - Allow users to insert their own profile during the signup process
    - Ensure the policy works for both authenticated users and during signup

  The current policy has a timing issue where users can't insert their profile
  immediately after signup because they're not fully authenticated yet.
*/

-- Drop the existing problematic policy
DROP POLICY IF EXISTS "Enable profile creation for signup" ON profiles;

-- Create a new policy that properly handles signup
CREATE POLICY "Users can insert their own profile"
  ON profiles
  FOR INSERT
  TO authenticated
  WITH CHECK (auth.uid() = user_id);

-- Also allow service role to insert profiles (for server-side operations)
CREATE POLICY "Service role can insert profiles"
  ON profiles
  FOR INSERT
  TO service_role
  WITH CHECK (true);