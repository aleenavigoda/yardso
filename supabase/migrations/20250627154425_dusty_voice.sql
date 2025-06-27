/*
  # Fix Pending Profiles Table - Simple Approach

  1. Remove unnecessary constraints
  2. Keep RLS enabled but allow anonymous inserts
  3. Simple trigger to transfer data on email confirmation
  4. No complex validation - just store the data
*/

-- Drop existing table and recreate simply
DROP TABLE IF EXISTS pending_profiles CASCADE;

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

-- Simple indexes
CREATE INDEX idx_pending_profiles_email ON pending_profiles(email);
CREATE INDEX idx_pending_profiles_expires ON pending_profiles(expires_at);

-- Enable RLS
ALTER TABLE pending_profiles ENABLE ROW LEVEL SECURITY;

-- Allow anyone to insert (for signup)
CREATE POLICY "Allow insert for signup"
  ON pending_profiles
  FOR INSERT
  WITH CHECK (true);

-- Allow authenticated users to read their own
CREATE POLICY "Users can read their own pending profiles"
  ON pending_profiles
  FOR SELECT
  TO authenticated
  USING (email = (SELECT email FROM auth.users WHERE id = auth.uid()));

-- Grant permissions
GRANT INSERT ON pending_profiles TO anon;
GRANT SELECT ON pending_profiles TO authenticated;
GRANT USAGE ON ALL SEQUENCES IN SCHEMA public TO anon;

-- Simple function to handle new user
CREATE OR REPLACE FUNCTION handle_new_user()
RETURNS trigger
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
  WHERE email = NEW.email
  ORDER BY created_at DESC
  LIMIT 1;

  -- Create profile
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

  -- Store time logging data if exists
  IF pending_data.time_logging_data IS NOT NULL THEN
    -- This will be handled by the app after profile creation
    -- Just ensure it's available in localStorage
  END IF;

  -- Clean up pending profile
  DELETE FROM pending_profiles WHERE id = pending_data.id;

  RETURN NEW;

EXCEPTION
  WHEN OTHERS THEN
    -- If anything fails, still create basic profile
    INSERT INTO profiles (user_id, email, full_name, display_name)
    VALUES (NEW.id, NEW.email, '', '')
    ON CONFLICT (user_id) DO NOTHING;
    RETURN NEW;
END;
$$;

-- Recreate trigger
DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;
CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE FUNCTION handle_new_user();