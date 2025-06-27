/*
  # Fix Pending Profiles Access with RLS

  1. Enable RLS on pending_profiles
  2. Add policy to allow anonymous inserts
  3. Add policy to allow authenticated users to read their own data
  4. Grant necessary permissions
*/

-- Enable RLS on pending_profiles
ALTER TABLE pending_profiles ENABLE ROW LEVEL SECURITY;

-- Allow anonymous users to insert (for signup)
CREATE POLICY "Allow anonymous insert for signup"
  ON pending_profiles
  FOR INSERT
  TO anon
  WITH CHECK (true);

-- Allow authenticated users to read their own pending profiles
CREATE POLICY "Users can read their own pending profiles"
  ON pending_profiles
  FOR SELECT
  TO authenticated
  USING (email = (SELECT email FROM auth.users WHERE id = auth.uid()));

-- Grant necessary permissions
GRANT INSERT ON pending_profiles TO anon;
GRANT SELECT ON pending_profiles TO authenticated;
GRANT ALL ON pending_profiles TO authenticated;

-- Also ensure the sequence permissions are correct
GRANT USAGE ON ALL SEQUENCES IN SCHEMA public TO anon;
GRANT USAGE ON ALL SEQUENCES IN SCHEMA public TO authenticated;