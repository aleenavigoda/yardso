/*
  # Fix profiles table INSERT policy

  1. Security Changes
    - Update the INSERT policy for profiles table to properly allow authenticated users to create their own profile
    - Ensure the policy allows inserts where the user_id matches the authenticated user's ID

  This fixes the RLS violation error that occurs during user registration.
*/

-- Drop the existing INSERT policy if it exists
DROP POLICY IF EXISTS "Allow authenticated users to insert their profile" ON profiles;

-- Create a new INSERT policy that allows authenticated users to create their own profile
CREATE POLICY "Allow authenticated users to insert their profile"
  ON profiles
  FOR INSERT
  TO authenticated
  WITH CHECK (auth.uid() = user_id);