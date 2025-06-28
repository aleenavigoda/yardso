/*
  # Fix Authentication and Profile Transfer

  1. Problem Analysis
    - Pending profiles ARE being created (user confirmed this)
    - The issue is in the trigger function that transfers data after email confirmation
    - The trigger might not be firing or failing silently

  2. Solution
    - Fix the handle_new_user trigger function
    - Add better logging and error handling
    - Ensure RLS policies are correct for the transfer process

  3. Keep RLS enabled but fix the policies
*/

-- First, let's check what's actually happening with the trigger
-- Drop and recreate with much better logging and error handling

DROP FUNCTION IF EXISTS handle_new_user() CASCADE;

CREATE OR REPLACE FUNCTION handle_new_user()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  pending_data record;
  new_profile_id uuid;
  url_item jsonb;
  urls_added integer := 0;
BEGIN
  -- Log that the trigger fired
  RAISE NOTICE 'TRIGGER FIRED: handle_new_user for user % with email %', NEW.id, NEW.email;

  -- Check if profile already exists (shouldn't happen, but let's be safe)
  SELECT id INTO new_profile_id FROM profiles WHERE user_id = NEW.id;
  
  IF new_profile_id IS NOT NULL THEN
    RAISE NOTICE 'Profile already exists for user %, ID: %', NEW.id, new_profile_id;
    RETURN NEW;
  END IF;

  -- Look for pending profile data
  SELECT * INTO pending_data
  FROM pending_profiles
  WHERE email = NEW.email
  ORDER BY created_at DESC
  LIMIT 1;

  IF pending_data IS NULL THEN
    RAISE NOTICE 'No pending profile found for %, creating basic profile', NEW.email;
    -- Create basic profile
    INSERT INTO profiles (user_id, email, full_name, display_name)
    VALUES (NEW.id, NEW.email, '', '')
    RETURNING id INTO new_profile_id;
    
    RAISE NOTICE 'Basic profile created with ID: %', new_profile_id;
  ELSE
    RAISE NOTICE 'Found pending profile % for %, transferring data', pending_data.id, NEW.email;
    RAISE NOTICE 'Pending data: name=%, display_name=%, urls=%', 
      pending_data.full_name, pending_data.display_name, pending_data.urls;
    
    -- Create profile with pending data
    INSERT INTO profiles (
      user_id,
      email,
      full_name,
      display_name
    ) VALUES (
      NEW.id,
      NEW.email,
      COALESCE(pending_data.full_name, ''),
      COALESCE(pending_data.display_name, '')
    ) RETURNING id INTO new_profile_id;

    RAISE NOTICE 'Profile created with ID: %, name: %, display: %', 
      new_profile_id, COALESCE(pending_data.full_name, ''), COALESCE(pending_data.display_name, '');

    -- Add URLs if they exist
    IF pending_data.urls IS NOT NULL AND jsonb_array_length(pending_data.urls) > 0 THEN
      RAISE NOTICE 'Processing % URLs from pending data', jsonb_array_length(pending_data.urls);
      
      FOR url_item IN SELECT * FROM jsonb_array_elements(pending_data.urls)
      LOOP
        BEGIN
          IF url_item ? 'url' AND url_item ? 'type' THEN
            INSERT INTO profile_urls (profile_id, url, url_type)
            VALUES (
              new_profile_id,
              url_item->>'url',
              url_item->>'type'
            );
            urls_added := urls_added + 1;
            RAISE NOTICE 'Added URL: % (type: %)', url_item->>'url', url_item->>'type';
          ELSE
            RAISE NOTICE 'Skipping invalid URL item: %', url_item;
          END IF;
        EXCEPTION
          WHEN OTHERS THEN
            RAISE WARNING 'Failed to add URL %: %', url_item, SQLERRM;
        END;
      END LOOP;
      
      RAISE NOTICE 'Successfully added % URLs out of %', urls_added, jsonb_array_length(pending_data.urls);
    ELSE
      RAISE NOTICE 'No URLs to process in pending data';
    END IF;

    -- Handle time logging data if it exists
    IF pending_data.time_logging_data IS NOT NULL THEN
      RAISE NOTICE 'Time logging data found, will be handled by frontend';
      -- The frontend will check for this after successful auth
    END IF;

    -- Clean up pending profile
    DELETE FROM pending_profiles WHERE id = pending_data.id;
    RAISE NOTICE 'Cleaned up pending profile %', pending_data.id;
  END IF;

  RAISE NOTICE 'handle_new_user completed successfully for %', NEW.email;
  RETURN NEW;

EXCEPTION
  WHEN OTHERS THEN
    RAISE WARNING 'ERROR in handle_new_user for %: %', NEW.email, SQLERRM;
    -- Ensure basic profile exists as fallback
    BEGIN
      INSERT INTO profiles (user_id, email, full_name, display_name)
      VALUES (NEW.id, NEW.email, '', '')
      ON CONFLICT (user_id) DO NOTHING;
      RAISE NOTICE 'Created fallback profile for %', NEW.email;
    EXCEPTION
      WHEN OTHERS THEN
        RAISE WARNING 'Failed to create fallback profile for %: %', NEW.email, SQLERRM;
    END;
    RETURN NEW;
END;
$$;

-- Recreate the trigger
DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;
CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE FUNCTION handle_new_user();

-- Ensure RLS policies are correct for the transfer process
-- The service role needs to be able to read pending_profiles and write to profiles

-- Update pending_profiles policies
DROP POLICY IF EXISTS "Users can read their own pending profiles" ON pending_profiles;
CREATE POLICY "Users can read their own pending profiles"
  ON pending_profiles
  FOR SELECT
  TO authenticated
  USING (email = (SELECT email FROM auth.users WHERE id = auth.uid()));

-- Add service role access for the trigger
CREATE POLICY "Service role can read pending profiles"
  ON pending_profiles
  FOR ALL
  TO service_role
  USING (true);

-- Ensure profiles policies allow the trigger to work
CREATE POLICY "Service role can manage profiles"
  ON profiles
  FOR ALL
  TO service_role
  USING (true);

-- Same for profile_urls
CREATE POLICY "Service role can manage profile URLs"
  ON profile_urls
  FOR ALL
  TO service_role
  USING (true);

-- Function to test the entire flow
CREATE OR REPLACE FUNCTION test_signup_flow_complete(test_email text, test_name text)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  test_user_id uuid := gen_random_uuid();
  pending_id uuid;
  result jsonb := '{}'::jsonb;
  profile_data record;
  url_count integer;
BEGIN
  -- Step 1: Create pending profile (simulating frontend signup)
  INSERT INTO pending_profiles (email, full_name, display_name, urls)
  VALUES (
    test_email, 
    test_name, 
    split_part(test_name, ' ', 1),
    '[{"url": "https://github.com/test", "type": "github"}, {"url": "https://linkedin.com/in/test", "type": "linkedin"}]'::jsonb
  ) RETURNING id INTO pending_id;
  
  result := result || jsonb_build_object('step1_pending_created', pending_id);
  
  -- Step 2: Simulate the trigger (what happens when user confirms email)
  PERFORM handle_new_user() FROM (SELECT test_user_id as id, test_email as email) as fake_user;
  
  -- Step 3: Check results
  SELECT * INTO profile_data FROM profiles WHERE user_id = test_user_id;
  SELECT COUNT(*) INTO url_count FROM profile_urls WHERE profile_id = profile_data.id;
  
  result := result || jsonb_build_object(
    'step2_profile_created', profile_data.id IS NOT NULL,
    'profile_name', profile_data.full_name,
    'profile_display_name', profile_data.display_name,
    'urls_transferred', url_count
  );
  
  -- Clean up test data
  DELETE FROM profile_urls WHERE profile_id = profile_data.id;
  DELETE FROM profiles WHERE user_id = test_user_id;
  DELETE FROM pending_profiles WHERE email = test_email;
  
  RETURN result;
END;
$$;

-- Test the flow
SELECT test_signup_flow_complete('test-flow@example.com', 'Test User') as test_result;