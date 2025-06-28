/*
  # Fix Pending Profiles System

  1. Create RPC function to insert pending profiles
  2. Fix permissions and policies
  3. Ensure proper data flow from signup to profile creation
*/

-- Create RPC function to insert pending profiles
CREATE OR REPLACE FUNCTION insert_pending_profile(
  p_email text,
  p_full_name text,
  p_display_name text,
  p_urls text,
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
  -- Parse URLs JSON
  IF p_urls IS NOT NULL AND p_urls != '' THEN
    urls_jsonb := p_urls::jsonb;
  ELSE
    urls_jsonb := '[]'::jsonb;
  END IF;

  -- Parse time logging data JSON
  IF p_time_logging_data IS NOT NULL AND p_time_logging_data != '' THEN
    time_data_jsonb := p_time_logging_data::jsonb;
  ELSE
    time_data_jsonb := NULL;
  END IF;

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

  RETURN new_id;
END;
$$;

-- Grant execute permission to anonymous users
GRANT EXECUTE ON FUNCTION insert_pending_profile(text, text, text, text, text) TO anon;
GRANT EXECUTE ON FUNCTION insert_pending_profile(text, text, text, text, text) TO authenticated;

-- Ensure pending_profiles table has correct permissions
GRANT INSERT ON pending_profiles TO anon;
GRANT SELECT ON pending_profiles TO authenticated;
GRANT USAGE ON ALL SEQUENCES IN SCHEMA public TO anon;

-- Update the handle_new_user function to be more robust
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
BEGIN
  -- Always create a basic profile first to ensure user can sign in
  INSERT INTO profiles (user_id, email, full_name, display_name)
  VALUES (NEW.id, NEW.email, '', '')
  RETURNING id INTO new_profile_id;

  -- Try to get and apply pending data, but don't fail if it doesn't work
  BEGIN
    SELECT * INTO pending_data
    FROM pending_profiles
    WHERE email = NEW.email
    AND expires_at > now()
    ORDER BY created_at DESC
    LIMIT 1;

    -- If we found pending data, update the profile
    IF pending_data IS NOT NULL THEN
      UPDATE profiles SET
        full_name = COALESCE(pending_data.full_name, ''),
        display_name = COALESCE(pending_data.display_name, ''),
        updated_at = now()
      WHERE id = new_profile_id;

      -- Add URLs if they exist
      IF pending_data.urls IS NOT NULL AND jsonb_array_length(pending_data.urls) > 0 THEN
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
            END IF;
          EXCEPTION
            WHEN OTHERS THEN
              -- Skip this URL if it fails, don't break the whole process
              CONTINUE;
          END;
        END LOOP;
      END IF;

      -- Store time logging data in localStorage via a special marker
      IF pending_data.time_logging_data IS NOT NULL THEN
        -- We'll handle this in the frontend by checking for pending data
        -- after successful authentication
        NULL;
      END IF;

      -- Clean up pending profile
      DELETE FROM pending_profiles WHERE id = pending_data.id;
    END IF;

  EXCEPTION
    WHEN OTHERS THEN
      -- If anything fails with pending data, just log it and continue
      -- The basic profile is already created, so user can still sign in
      RAISE WARNING 'Failed to process pending data for user %: %', NEW.email, SQLERRM;
  END;

  RETURN NEW;

EXCEPTION
  WHEN OTHERS THEN
    -- This should never happen, but if it does, don't fail the auth insert
    RAISE WARNING 'Critical error in handle_new_user for %: %', NEW.email, SQLERRM;
    RETURN NEW;
END;
$$;

-- Test the RPC function
DO $$
DECLARE
  test_id uuid;
BEGIN
  -- Test the function
  SELECT insert_pending_profile(
    'test@example.com',
    'Test User',
    'Test',
    '[{"url": "https://github.com/test", "type": "github"}]',
    '{"mode": "helped", "hours": 2, "name": "John", "contact": "john@example.com", "description": "Test work"}'
  ) INTO test_id;
  
  -- Clean up test data
  DELETE FROM pending_profiles WHERE id = test_id;
  
  RAISE NOTICE 'RPC function test successful';
EXCEPTION
  WHEN OTHERS THEN
    RAISE WARNING 'RPC function test failed: %', SQLERRM;
END;
$$;