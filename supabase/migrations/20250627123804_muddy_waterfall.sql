/*
  # Check Migration Status

  This migration contains diagnostic queries to check if the profiles table
  foreign key constraint is properly configured to reference auth.users instead
  of a non-existent public.users table.

  1. Check Foreign Key Constraints
     - Verify profiles.user_id references auth.users(id)
  
  2. Check Table Existence
     - Confirm no public.users table exists
     - Confirm auth.users table exists
  
  3. Check Migration History
     - Review recent schema changes
*/

-- 1. Check if the foreign key constraint is correct
SELECT 
  tc.constraint_name,
  tc.table_name,
  kcu.column_name,
  ccu.table_schema AS foreign_table_schema,
  ccu.table_name AS foreign_table_name,
  ccu.column_name AS foreign_column_name
FROM information_schema.table_constraints AS tc 
JOIN information_schema.key_column_usage AS kcu
  ON tc.constraint_name = kcu.constraint_name
JOIN information_schema.constraint_column_usage AS ccu
  ON ccu.constraint_name = tc.constraint_name
WHERE tc.constraint_type = 'FOREIGN KEY' 
  AND tc.table_name = 'profiles'
  AND kcu.column_name = 'user_id';

-- 2. Check if there's a public.users table (there shouldn't be)
SELECT EXISTS (
  SELECT 1 FROM information_schema.tables 
  WHERE table_name = 'users' 
  AND table_schema = 'public'
) AS public_users_table_exists;

-- 3. Check if auth.users exists (it should)
SELECT EXISTS (
  SELECT 1 FROM information_schema.tables 
  WHERE table_name = 'users' 
  AND table_schema = 'auth'
) AS auth_users_table_exists;

-- 4. Check recent migrations (using correct column name)
SELECT version, name 
FROM supabase_migrations.schema_migrations 
ORDER BY version DESC 
LIMIT 5;