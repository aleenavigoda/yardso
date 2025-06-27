/*
  # Fix profiles table INSERT policy

  1. Security Changes
    - Drop the existing INSERT policy that uses incorrect `uid()` function
    - Create new INSERT policy using correct `auth.uid()` function
    - This allows authenticated users to insert their own profile data

  The issue was that `uid()` function doesn't exist in Supabase.
  The correct function is `auth.uid()` to get the authenticated user's ID.
*/

-- Drop the existing incorrect policy
DROP POLICY IF EXISTS "Allow authenticated users to insert their profile" ON profiles;

-- Create the correct policy using auth.uid()
CREATE POLICY "Allow authenticated users to insert their profile"
  ON profiles
  FOR INSERT
  TO authenticated
  WITH CHECK (auth.uid() = user_id);