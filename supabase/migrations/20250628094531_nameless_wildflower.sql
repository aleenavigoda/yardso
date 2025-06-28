-- Fix the trigger function to properly transfer pending profile data
-- The issue is likely in the data transfer logic, not the trigger mechanism itself

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
BEGIN
  -- Log that we're processing this user
  RAISE NOTICE 'Processing new user: % with email: %', NEW.id, NEW.email;

  -- Get pending profile data FIRST
  SELECT * INTO pending_data
  FROM pending_profiles
  WHERE email = NEW.email
  AND expires_at > now()
  ORDER BY created_at DESC
  LIMIT 1;

  IF pending_data IS NOT NULL THEN
    RAISE NOTICE 'Found pending data for %: name=%, display=%, urls=%', 
      NEW.email, pending_data.full_name, pending_data.display_name, 
      CASE WHEN pending_data.urls IS NOT NULL THEN jsonb_array_length(pending_data.urls) ELSE 0 END;
    
    -- Create profile with the pending data
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

    RAISE NOTICE 'Created profile % with name: %', new_profile_id, pending_data.full_name;

    -- Add URLs if they exist
    IF pending_data.urls IS NOT NULL AND jsonb_array_length(pending_data.urls) > 0 THEN
      FOR url_item IN SELECT * FROM jsonb_array_elements(pending_data.urls)
      LOOP
        IF url_item ? 'url' AND url_item ? 'type' THEN
          INSERT INTO profile_urls (profile_id, url, url_type)
          VALUES (
            new_profile_id,
            url_item->>'url',
            url_item->>'type'
          );
          RAISE NOTICE 'Added URL: %', url_item->>'url';
        END IF;
      END LOOP;
    END IF;

    -- Store time logging data for frontend pickup
    IF pending_data.time_logging_data IS NOT NULL THEN
      RAISE NOTICE 'Time logging data found, will be available to frontend';
      -- The frontend will check localStorage for this after auth
    END IF;

    -- Clean up pending profile
    DELETE FROM pending_profiles WHERE id = pending_data.id;
    RAISE NOTICE 'Cleaned up pending profile %', pending_data.id;

  ELSE
    RAISE NOTICE 'No pending data found for %, creating basic profile', NEW.email;
    -- Create basic profile
    INSERT INTO profiles (user_id, email, full_name, display_name)
    VALUES (NEW.id, NEW.email, '', '');
  END IF;

  RETURN NEW;

EXCEPTION
  WHEN OTHERS THEN
    RAISE WARNING 'Error in handle_new_user for %: %', NEW.email, SQLERRM;
    -- Always ensure a profile exists
    INSERT INTO profiles (user_id, email, full_name, display_name)
    VALUES (NEW.id, NEW.email, '', '')
    ON CONFLICT (user_id) DO NOTHING;
    RETURN NEW;
END;
$$;

-- Recreate the trigger
DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;
CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE FUNCTION handle_new_user();

-- Ensure the service role can access everything needed for the trigger
GRANT ALL ON pending_profiles TO service_role;
GRANT ALL ON profiles TO service_role;
GRANT ALL ON profile_urls TO service_role;

-- Function to check what's happening with a specific email
CREATE OR REPLACE FUNCTION check_email_status(check_email text)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  pending_data record;
  profile_data record;
  result jsonb := '{}'::jsonb;
BEGIN
  -- Check pending profiles
  SELECT * INTO pending_data FROM pending_profiles WHERE email = check_email ORDER BY created_at DESC LIMIT 1;
  
  -- Check profiles
  SELECT * INTO profile_data FROM profiles WHERE email = check_email LIMIT 1;
  
  result := jsonb_build_object(
    'email', check_email,
    'has_pending', pending_data IS NOT NULL,
    'has_profile', profile_data IS NOT NULL
  );
  
  IF pending_data IS NOT NULL THEN
    result := result || jsonb_build_object(
      'pending_name', pending_data.full_name,
      'pending_display', pending_data.display_name,
      'pending_urls_count', CASE WHEN pending_data.urls IS NOT NULL THEN jsonb_array_length(pending_data.urls) ELSE 0 END,
      'pending_expires', pending_data.expires_at
    );
  END IF;
  
  IF profile_data IS NOT NULL THEN
    result := result || jsonb_build_object(
      'profile_name', profile_data.full_name,
      'profile_display', profile_data.display_name,
      'profile_user_id', profile_data.user_id
    );
  END IF;
  
  RETURN result;
END;
$$;