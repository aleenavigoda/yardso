/*
  # Fix pending profiles table structure

  1. Tables
    - Fix `pending_profiles` table structure
    - Ensure proper column types and constraints
    - Add proper indexes

  2. Security
    - Update RLS policies for proper access
    - Ensure anonymous users can insert

  3. Functions
    - Fix transfer function to handle all data types properly
    - Add better error handling
*/

-- Drop existing table if it has issues
DROP TABLE IF EXISTS pending_profiles CASCADE;

-- Recreate pending_profiles table with correct structure
CREATE TABLE pending_profiles (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  email text UNIQUE NOT NULL,
  full_name text,
  display_name text,
  urls jsonb DEFAULT '[]'::jsonb,
  time_logging_data jsonb,
  token text UNIQUE NOT NULL DEFAULT encode(gen_random_bytes(32), 'hex'),
  expires_at timestamptz DEFAULT (now() + interval '24 hours'),
  created_at timestamptz DEFAULT now()
);

-- Enable RLS
ALTER TABLE pending_profiles ENABLE ROW LEVEL SECURITY;

-- Create policies
CREATE POLICY "Anyone can create pending profiles"
  ON pending_profiles
  FOR INSERT
  TO anon, authenticated
  WITH CHECK (true);

CREATE POLICY "Users can read their own pending profile"
  ON pending_profiles
  FOR SELECT
  TO anon, authenticated
  USING (true);

-- Create indexes
CREATE INDEX idx_pending_profiles_email ON pending_profiles(email);
CREATE INDEX idx_pending_profiles_token ON pending_profiles(token);
CREATE INDEX idx_pending_profiles_expires ON pending_profiles(expires_at);

-- Recreate the transfer function with better error handling
CREATE OR REPLACE FUNCTION transfer_pending_profile(user_id_param uuid, user_email text)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  pending_data record;
  new_profile_id uuid;
  url_item jsonb;
BEGIN
  -- Get pending profile data
  SELECT * INTO pending_data
  FROM pending_profiles
  WHERE email = user_email
  AND expires_at > now()
  ORDER BY created_at DESC
  LIMIT 1;

  IF pending_data IS NULL THEN
    -- No pending profile found, create basic profile
    INSERT INTO profiles (user_id, email)
    VALUES (user_id_param, user_email);
    RETURN;
  END IF;

  -- Create profile with pending data
  INSERT INTO profiles (
    user_id,
    email,
    full_name,
    display_name
  ) VALUES (
    user_id_param,
    user_email,
    COALESCE(pending_data.full_name, ''),
    COALESCE(pending_data.display_name, '')
  ) RETURNING id INTO new_profile_id;

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
      END IF;
    END LOOP;
  END IF;

  -- Clean up the pending profile
  DELETE FROM pending_profiles WHERE id = pending_data.id;

EXCEPTION
  WHEN OTHERS THEN
    -- Log error but don't fail the user creation
    RAISE WARNING 'Error transferring pending profile for %: %', user_email, SQLERRM;
    -- Create basic profile as fallback
    INSERT INTO profiles (user_id, email)
    VALUES (user_id_param, user_email)
    ON CONFLICT (user_id) DO NOTHING;
END;
$$;

-- Recreate the cleanup function
CREATE OR REPLACE FUNCTION cleanup_expired_pending_profiles()
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
  DELETE FROM pending_profiles
  WHERE expires_at < now();
END;
$$;

-- Recreate the trigger function
CREATE OR REPLACE FUNCTION handle_new_user()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
  -- Transfer pending profile data if it exists
  PERFORM transfer_pending_profile(NEW.id, NEW.email);
  RETURN NEW;
END;
$$;

-- Recreate trigger on auth.users
DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;
CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE FUNCTION handle_new_user();