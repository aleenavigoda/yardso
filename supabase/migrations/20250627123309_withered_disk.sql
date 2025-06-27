/*
  # Fix profiles table foreign key constraint

  1. Changes
    - Drop the existing foreign key constraint that references users(id)
    - Add a new foreign key constraint that references auth.users(id)
    - This allows new user profiles to be created successfully after signup

  2. Security
    - Maintains existing RLS policies
    - No changes to table structure or data
*/

-- Drop the existing foreign key constraint
ALTER TABLE profiles DROP CONSTRAINT IF EXISTS profiles_user_id_fkey;

-- Add the correct foreign key constraint referencing auth.users
ALTER TABLE profiles ADD CONSTRAINT profiles_user_id_fkey 
  FOREIGN KEY (user_id) REFERENCES auth.users(id) ON DELETE CASCADE;