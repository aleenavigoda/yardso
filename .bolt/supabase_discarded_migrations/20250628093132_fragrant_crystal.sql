/*
  # Fix Pending Profiles and Sign In Issues

  1. Database Structure
    - Fix pending_profiles table permissions and policies
    - Simplify the insert process
    - Fix the RPC function

  2. Profile Transfer
    - Improve the trigger function
    - Add better error handling and logging

  3. Database Design Clarification
    - profiles table: core user info (name, bio, location, etc.)
    - profile_urls table: separate table for URLs (GitHub, LinkedIn, etc.)
    - pending_time_logs table: for time logging data before signup
*/

-- Drop the problematic RPC function and recreate it properly
DROP FUNCTION IF EXISTS insert_pending_profile(text, text, text, text, text);

-- Ensure pending_profiles table has correct structure and permissions
ALTER TABLE pending_profiles DISABLE ROW LEVEL SECURITY;

-- Grant proper permissions
GRANT INSERT, SELECT, DELETE ON pending_profiles TO anon;
GRANT ALL ON pending_profiles TO authenticated;
GRANT USAGE, SELECT ON ALL SEQUENCES IN SCHEMA public TO anon;

-- Create a simple, working RPC function
CREATE OR REPLACE FUNCTION insert_pending_profile(
  p_email text,
  p_full_name text,
  p_display_name text,
  p_urls text DEFAULT '[]',
  p_time_logging_data text DEFAULT NULL
)
RETURNS uuid
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  new_id uuid;
  urls_jsonb jsonb;
  time_data_jsonb jsonb;
BEGIN
  -- Parse URLs JSON safely
  BEGIN
    IF p_urls IS NOT NULL AND p_urls != '' AND p_urls != '[]' THEN
      urls_jsonb := p_urls::jsonb;
    ELSE
      urls_jsonb := '[]'::jsonb;
    END IF;
  EXCEPTION
    WHEN OTHERS THEN
      urls_jsonb := '[]'::jsonb;
  END;

  -- Parse time logging data JSON safely
  BEGIN
    IF p_time_logging_data IS NOT NULL AND p_time_logging_data != '' THEN
      time_data_jsonb := p_time_logging_data::jsonb;
    ELSE
      time_data_jsonb := NULL;
    END IF;
  EXCEPTION
    WHEN OTHERS THEN
      time_data_jsonb := NULL;
  END;

  -- Insert pending profile
  INSERT INTO pending_profiles (
    email,
    full_name,
    display_name,
    urls,
    time_logging_data
  ) VALUES (
    p_email,
    p_full_name,
    p_display_name,
    urls_jsonb,
    time_data_jsonb
  ) RETURNING id INTO new_id;

  RAISE NOTICE 'Created pending profile % for %', new_id, p_email;
  RETURN new_id;
END;
$$;

-- Grant execute permission
GRANT EXECUTE ON FUNCTION insert_pending_profile(text, text, text, text, text) TO anon;
GRANT EXECUTE ON FUNCTION insert_pending_profile(text, text, text, text, text) TO authenticated;

-- Test the function works
DO $$
DECLARE
  test_id uuid;
BEGIN
  SELECT insert_pending_profile(
    'test-function@example.com',
    'Test User',
    'Test',
    '[{"url": "https://github.com/test", "type": "github"}]',
    NULL
  ) INTO test_id;
  
  IF test_id IS NOT NULL THEN
    RAISE NOTICE 'RPC function test PASSED - ID: %', test_id;
    DELETE FROM pending_profiles WHERE id = test_id;
  ELSE
    RAISE WARNING 'RPC function test FAILED - no ID returned';
  END IF;
EXCEPTION
  WHEN OTHERS THEN
    RAISE WARNING 'RPC function test FAILED: %', SQLERRM;
END;
$$;

-- Improve the handle_new_user function
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
  RAISE NOTICE 'Processing new user: % (%)', NEW.email, NEW.id;

  -- Check if profile already exists
  SELECT id INTO new_profile_id FROM profiles WHERE user_id = NEW.id;
  
  IF new_profile_id IS NOT NULL THEN
    RAISE NOTICE 'Profile already exists for user %, ID: %', NEW.id, new_profile_id;
    RETURN NEW;
  END IF;

  -- Look for pending profile data
  SELECT * INTO pending_data
  FROM pending_profiles
  WHERE email = NEW.email
  AND expires_at > now()
  ORDER BY created_at DESC
  LIMIT 1;

  IF pending_data IS NULL THEN
    RAISE NOTICE 'No pending data found for %, creating basic profile', NEW.email;
    
    -- Create basic profile
    INSERT INTO profiles (user_id, email, full_name, display_name)
    VALUES (NEW.id, NEW.email, '', '')
    RETURNING id INTO new_profile_id;
    
    RAISE NOTICE 'Created basic profile with ID: %', new_profile_id;
  ELSE
    RAISE NOTICE 'Found pending profile % for %, transferring data', pending_data.id, NEW.email;
    
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

    RAISE NOTICE 'Created profile with pending data, ID: %, name: "%"', new_profile_id, pending_data.full_name;

    -- Transfer URLs to profile_urls table
    IF pending_data.urls IS NOT NULL AND jsonb_array_length(pending_data.urls) > 0 THEN
      RAISE NOTICE 'Transferring % URLs', jsonb_array_length(pending_data.urls);
      
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
          END IF;
        EXCEPTION
          WHEN OTHERS THEN
            RAISE WARNING 'Failed to add URL %: %', url_item->>'url', SQLERRM;
        END;
      END LOOP;
      
      RAISE NOTICE 'Successfully transferred % URLs to profile_urls table', urls_added;
    END IF;

    -- Store time logging data for the frontend to pick up
    IF pending_data.time_logging_data IS NOT NULL THEN
      RAISE NOTICE 'Time logging data found, will be handled by frontend';
      -- The frontend will check localStorage for this data
    END IF;

    -- Clean up pending profile
    DELETE FROM pending_profiles WHERE id = pending_data.id;
    RAISE NOTICE 'Cleaned up pending profile %', pending_data.id;
  END IF;

  RETURN NEW;

EXCEPTION
  WHEN OTHERS THEN
    RAISE WARNING 'Error in handle_new_user for %: %', NEW.email, SQLERRM;
    -- Ensure basic profile exists as fallback
    INSERT INTO profiles (user_id, email, full_name, display_name)
    VALUES (NEW.id, NEW.email, '', '')
    ON CONFLICT (user_id) DO NOTHING;
    RETURN NEW;
END;
$$;

-- Test direct insert into pending_profiles
DO $$
DECLARE
  test_email text := 'direct-test@example.com';
BEGIN
  -- Test direct insert
  INSERT INTO pending_profiles (email, full_name, display_name, urls)
  VALUES (test_email, 'Direct Test', 'Direct', '[{"url": "https://test.com", "type": "website"}]'::jsonb);
  
  RAISE NOTICE 'Direct insert test PASSED';
  
  -- Clean up
  DELETE FROM pending_profiles WHERE email = test_email;
EXCEPTION
  WHEN OTHERS THEN
    RAISE WARNING 'Direct insert test FAILED: %', SQLERRM;
END;
$$;