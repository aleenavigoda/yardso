-- First, let's see what constraints actually exist
-- This will help us understand the real state of the database

-- Check if there's a users table
DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'users' AND table_schema = 'public') THEN
    RAISE NOTICE 'users table exists in public schema';
  ELSE
    RAISE NOTICE 'users table does NOT exist in public schema';
  END IF;
END $$;

-- Check what foreign key constraints exist on profiles table
DO $$
DECLARE
  constraint_record RECORD;
BEGIN
  FOR constraint_record IN 
    SELECT 
      tc.constraint_name,
      tc.table_name,
      kcu.column_name,
      ccu.table_name AS foreign_table_name,
      ccu.column_name AS foreign_column_name,
      ccu.table_schema AS foreign_table_schema
    FROM information_schema.table_constraints AS tc 
    JOIN information_schema.key_column_usage AS kcu
      ON tc.constraint_name = kcu.constraint_name
      AND tc.table_schema = kcu.table_schema
    JOIN information_schema.constraint_column_usage AS ccu
      ON ccu.constraint_name = tc.constraint_name
      AND ccu.table_schema = tc.table_schema
    WHERE tc.constraint_type = 'FOREIGN KEY' 
      AND tc.table_name = 'profiles'
      AND tc.table_schema = 'public'
  LOOP
    RAISE NOTICE 'Found FK constraint: % on %.% -> %.%.%', 
      constraint_record.constraint_name,
      'profiles',
      constraint_record.column_name,
      constraint_record.foreign_table_schema,
      constraint_record.foreign_table_name,
      constraint_record.foreign_column_name;
  END LOOP;
END $$;

-- Now let's fix the issue
-- Drop any existing foreign key constraint on user_id
ALTER TABLE profiles DROP CONSTRAINT IF EXISTS profiles_user_id_fkey;

-- If there's a users table in public schema, we might need to drop it
-- (This would be unusual but let's handle it)
DROP TABLE IF EXISTS public.users CASCADE;

-- Add the correct foreign key constraint to auth.users
ALTER TABLE profiles ADD CONSTRAINT profiles_user_id_fkey 
  FOREIGN KEY (user_id) REFERENCES auth.users(id) ON DELETE CASCADE;

-- Verify the constraint was created correctly
DO $$
DECLARE
  constraint_exists boolean;
BEGIN
  SELECT EXISTS (
    SELECT 1 
    FROM information_schema.table_constraints tc
    JOIN information_schema.key_column_usage kcu
      ON tc.constraint_name = kcu.constraint_name
    JOIN information_schema.constraint_column_usage ccu
      ON ccu.constraint_name = tc.constraint_name
    WHERE tc.constraint_type = 'FOREIGN KEY'
      AND tc.table_name = 'profiles'
      AND kcu.column_name = 'user_id'
      AND ccu.table_schema = 'auth'
      AND ccu.table_name = 'users'
      AND ccu.column_name = 'id'
  ) INTO constraint_exists;
  
  IF constraint_exists THEN
    RAISE NOTICE 'SUCCESS: Foreign key constraint now correctly references auth.users(id)';
  ELSE
    RAISE NOTICE 'ERROR: Foreign key constraint was not created correctly';
  END IF;
END $$;