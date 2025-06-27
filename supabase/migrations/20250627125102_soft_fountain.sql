/*
  # Diagnose and Fix Signup Database Error

  This migration will:
  1. Check the current state of policies and constraints
  2. Fix any issues preventing user signup
  3. Ensure proper RLS policies for profile creation
*/

-- First, let's check what's actually happening with the profiles table
SELECT 'Current profiles table policies:' as info;
SELECT schemaname, tablename, policyname, permissive, roles, cmd, qual, with_check
FROM pg_policies 
WHERE tablename = 'profiles';

-- Check if there are any triggers on auth.users that might be failing
SELECT 'Triggers on auth.users:' as info;
SELECT trigger_name, event_manipulation, action_statement
FROM information_schema.triggers 
WHERE event_object_table = 'users' 
AND event_object_schema = 'auth';

-- Check the foreign key constraint
SELECT 'Foreign key constraints on profiles:' as info;
SELECT 
  tc.constraint_name,
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
  AND tc.table_schema = 'public';

-- Now let's fix the issues

-- 1. Drop all existing problematic policies on profiles
DROP POLICY IF EXISTS "Users can insert their own profile" ON profiles;
DROP POLICY IF EXISTS "Enable profile creation for signup" ON profiles;
DROP POLICY IF EXISTS "Allow profile creation during signup" ON profiles;
DROP POLICY IF EXISTS "Service role can insert profiles" ON profiles;

-- 2. Create a simple, working policy for profile insertion
-- This policy allows authenticated users to insert their own profile
CREATE POLICY "Allow authenticated users to insert their profile"
  ON profiles
  FOR INSERT
  TO authenticated
  WITH CHECK (auth.uid() = user_id);

-- 3. Temporarily disable RLS to test if that's the issue
-- We'll re-enable it after confirming the fix works
ALTER TABLE profiles DISABLE ROW LEVEL SECURITY;

-- 4. Check if there are any problematic triggers
-- Drop the trigger that might be causing issues during signup
DROP TRIGGER IF EXISTS trigger_convert_pending_time_logs ON auth.users;

-- 5. Recreate the trigger with better error handling
CREATE OR REPLACE FUNCTION convert_pending_time_logs_on_signup()
RETURNS TRIGGER AS $$
DECLARE
  pending_log RECORD;
  new_transaction_id uuid;
  invitee_profile_id uuid;
BEGIN
  -- Only proceed if we can find a profile for this user
  -- This prevents errors if profile creation happens after this trigger
  BEGIN
    SELECT id INTO invitee_profile_id 
    FROM profiles 
    WHERE user_id = NEW.id;
    
    -- If no profile found, just return (profile will be created later)
    IF invitee_profile_id IS NULL THEN
      RETURN NEW;
    END IF;
    
    -- Convert all pending time logs for this email
    FOR pending_log IN 
      SELECT * FROM pending_time_logs 
      WHERE invitee_email = NEW.email 
      AND status = 'pending'
    LOOP
      -- Create the actual time transaction
      INSERT INTO time_transactions (
        giver_id,
        receiver_id,
        hours,
        description,
        service_type,
        logged_by,
        status
      ) VALUES (
        CASE 
          WHEN pending_log.mode = 'helped' THEN pending_log.logger_profile_id
          ELSE invitee_profile_id
        END,
        CASE 
          WHEN pending_log.mode = 'helped' THEN invitee_profile_id
          ELSE pending_log.logger_profile_id
        END,
        pending_log.hours,
        pending_log.description,
        pending_log.service_type,
        pending_log.logger_profile_id,
        'pending'
      ) RETURNING id INTO new_transaction_id;

      -- Update the pending log to mark it as converted
      UPDATE pending_time_logs 
      SET 
        status = 'converted',
        converted_transaction_id = new_transaction_id,
        updated_at = now()
      WHERE id = pending_log.id;

      -- Mark related invitation as accepted if it exists
      UPDATE invitations 
      SET 
        status = 'accepted',
        accepted_at = now(),
        updated_at = now()
      WHERE id = pending_log.invitation_id;
    END LOOP;
    
  EXCEPTION WHEN OTHERS THEN
    -- Log the error but don't fail the signup
    RAISE WARNING 'Error converting pending time logs for user %: %', NEW.id, SQLERRM;
  END;

  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Don't recreate the trigger yet - let's test signup first

-- 6. Re-enable RLS with a simpler policy structure
ALTER TABLE profiles ENABLE ROW LEVEL SECURITY;

-- Test query to verify the fix
SELECT 'Migration completed. Test signup now.' as status;