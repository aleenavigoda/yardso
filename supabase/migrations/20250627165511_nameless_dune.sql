/*
  # Create Agent Profiles Table for Mock Data

  1. New Tables
    - `agent_profiles`
      - `id` (uuid, primary key)
      - `email` (text, unique)
      - `full_name` (text)
      - `display_name` (text)
      - `bio` (text)
      - `location` (text)
      - `time_balance_hours` (numeric)
      - `created_at` (timestamp)

  2. Mock Data
    - Insert 5 agent profiles with realistic data
    - Create sample time transactions between agents
    - Add profile URLs for agents

  3. Security
    - Enable RLS on `agent_profiles` table
    - Add policy for public read access
*/

-- Create agent_profiles table for mock data
CREATE TABLE IF NOT EXISTS agent_profiles (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  email text UNIQUE NOT NULL,
  full_name text NOT NULL,
  display_name text NOT NULL,
  bio text,
  location text,
  time_balance_hours numeric(10,2) DEFAULT 0.0,
  created_at timestamptz DEFAULT now()
);

-- Enable RLS
ALTER TABLE agent_profiles ENABLE ROW LEVEL SECURITY;

-- Allow public read access to agent profiles
CREATE POLICY "Anyone can read agent profiles" ON agent_profiles
  FOR SELECT
  TO authenticated
  USING (true);

-- Create indexes
CREATE INDEX IF NOT EXISTS idx_agent_profiles_email ON agent_profiles(email);
CREATE INDEX IF NOT EXISTS idx_agent_profiles_display_name ON agent_profiles(display_name);

-- Create agent_profile_urls table
CREATE TABLE IF NOT EXISTS agent_profile_urls (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  agent_profile_id uuid NOT NULL REFERENCES agent_profiles(id) ON DELETE CASCADE,
  url text NOT NULL,
  url_type text NOT NULL,
  created_at timestamptz DEFAULT now(),
  UNIQUE(agent_profile_id, url)
);

-- Enable RLS
ALTER TABLE agent_profile_urls ENABLE ROW LEVEL SECURITY;

-- Allow public read access to agent profile URLs
CREATE POLICY "Anyone can read agent profile URLs" ON agent_profile_urls
  FOR SELECT
  TO authenticated
  USING (true);

-- Create agent_time_transactions table for mock transaction data
CREATE TABLE IF NOT EXISTS agent_time_transactions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  giver_id uuid NOT NULL REFERENCES agent_profiles(id) ON DELETE CASCADE,
  receiver_id uuid NOT NULL REFERENCES agent_profiles(id) ON DELETE CASCADE,
  hours numeric(5,2) NOT NULL CHECK (hours > 0),
  description text,
  service_type text,
  status text DEFAULT 'confirmed',
  created_at timestamptz DEFAULT now(),
  CHECK (giver_id != receiver_id)
);

-- Enable RLS
ALTER TABLE agent_time_transactions ENABLE ROW LEVEL SECURITY;

-- Allow public read access to agent transactions
CREATE POLICY "Anyone can read agent transactions" ON agent_time_transactions
  FOR SELECT
  TO authenticated
  USING (true);

-- Create indexes
CREATE INDEX IF NOT EXISTS idx_agent_time_transactions_giver ON agent_time_transactions(giver_id);
CREATE INDEX IF NOT EXISTS idx_agent_time_transactions_receiver ON agent_time_transactions(receiver_id);
CREATE INDEX IF NOT EXISTS idx_agent_time_transactions_created ON agent_time_transactions(created_at);

-- Insert mock agent profiles
INSERT INTO agent_profiles (
  id,
  email,
  full_name,
  display_name,
  bio,
  location,
  time_balance_hours,
  created_at
) VALUES 
(
  'a0000000-0000-0000-0000-000000000001'::uuid,
  'sarah.johnson@yard.com',
  'Sarah Johnson',
  'Sarah',
  'Legal expert specializing in startup contracts and Series A term sheets. Former BigLaw attorney now helping early-stage companies navigate complex legal landscapes.',
  'San Francisco, CA',
  12.5,
  now() - interval '3 months'
),
(
  'a0000000-0000-0000-0000-000000000002'::uuid,
  'mike.kim@yard.com',
  'Mike Kim',
  'Mike',
  'Senior UX Designer with 8+ years at top tech companies. I help startups create intuitive user experiences and mobile app interfaces that users love.',
  'New York, NY',
  -2.5,
  now() - interval '2 months'
),
(
  'a0000000-0000-0000-0000-000000000003'::uuid,
  'alex.liu@yard.com',
  'Alex Liu',
  'Alex',
  'Data scientist and market research analyst. I turn complex datasets into actionable business insights for growing companies.',
  'Austin, TX',
  8.0,
  now() - interval '4 months'
),
(
  'a0000000-0000-0000-0000-000000000004'::uuid,
  'rachel.wong@yard.com',
  'Rachel Wong',
  'Rachel',
  'Product strategist and former startup founder. I help teams build roadmaps and make strategic decisions that drive growth.',
  'Seattle, WA',
  -4.0,
  now() - interval '1 month'
),
(
  'a0000000-0000-0000-0000-000000000005'::uuid,
  'david.miller@yard.com',
  'David Miller',
  'David',
  'Strategy consultant and workshop facilitator. I help teams align on vision and execute complex projects through collaborative planning sessions.',
  'Chicago, IL',
  6.0,
  now() - interval '5 months'
),
-- Additional users for group transactions
(
  'a0000000-0000-0000-0000-000000000006'::uuid,
  'jane.doe@example.com',
  'Jane Doe',
  'Jane',
  'Product manager at a growing fintech startup.',
  'Boston, MA',
  2.0,
  now() - interval '2 weeks'
),
(
  'a0000000-0000-0000-0000-000000000007'::uuid,
  'kevin.park@example.com',
  'Kevin Park',
  'Kevin',
  'Engineering lead building the next generation of mobile apps.',
  'Los Angeles, CA',
  -1.0,
  now() - interval '1 week'
)
ON CONFLICT (id) DO NOTHING;

-- Insert agent profile URLs
INSERT INTO agent_profile_urls (agent_profile_id, url, url_type, created_at) VALUES
-- Sarah Johnson URLs
('a0000000-0000-0000-0000-000000000001', 'https://linkedin.com/in/sarahjohnsonlaw', 'linkedin', now() - interval '3 months'),
('a0000000-0000-0000-0000-000000000001', 'https://sarahjohnsonlaw.com', 'website', now() - interval '3 months'),

-- Mike Kim URLs  
('a0000000-0000-0000-0000-000000000002', 'https://linkedin.com/in/mikekim-ux', 'linkedin', now() - interval '2 months'),
('a0000000-0000-0000-0000-000000000002', 'https://dribbble.com/mikekim', 'portfolio', now() - interval '2 months'),

-- Alex Liu URLs
('a0000000-0000-0000-0000-000000000003', 'https://github.com/alexliu', 'github', now() - interval '4 months'),
('a0000000-0000-0000-0000-000000000003', 'https://linkedin.com/in/alexliu-data', 'linkedin', now() - interval '4 months'),

-- Rachel Wong URLs
('a0000000-0000-0000-0000-000000000004', 'https://linkedin.com/in/rachelwong-product', 'linkedin', now() - interval '1 month'),
('a0000000-0000-0000-0000-000000000004', 'https://medium.com/@rachelwong', 'article', now() - interval '1 month'),

-- David Miller URLs
('a0000000-0000-0000-0000-000000000005', 'https://linkedin.com/in/davidmiller-strategy', 'linkedin', now() - interval '5 months'),
('a0000000-0000-0000-0000-000000000005', 'https://davidmillerstrategy.com', 'website', now() - interval '5 months')

ON CONFLICT (agent_profile_id, url) DO NOTHING;

-- Insert sample time transactions for the feed
INSERT INTO agent_time_transactions (
  giver_id,
  receiver_id,
  hours,
  description,
  service_type,
  status,
  created_at
) VALUES 
-- Sarah <-> Mike exchange (balanced)
(
  'a0000000-0000-0000-0000-000000000001',
  'a0000000-0000-0000-0000-000000000002',
  2.5,
  'Contract review',
  'legal',
  'confirmed',
  now() - interval '2 hours'
),
(
  'a0000000-0000-0000-0000-000000000002',
  'a0000000-0000-0000-0000-000000000001',
  2.5,
  'Mobile app wireframes',
  'design',
  'confirmed',
  now() - interval '2 hours'
),
-- Alex -> Rachel (unbalanced)
(
  'a0000000-0000-0000-0000-000000000003',
  'a0000000-0000-0000-0000-000000000004',
  4.0,
  'Market research insights',
  'analysis',
  'confirmed',
  now() - interval '5 hours'
),
-- David -> Jane, Kevin (group session)
(
  'a0000000-0000-0000-0000-000000000005',
  'a0000000-0000-0000-0000-000000000006',
  3.0,
  'Product roadmap planning',
  'strategy',
  'confirmed',
  now() - interval '1 day'
),
(
  'a0000000-0000-0000-0000-000000000005',
  'a0000000-0000-0000-0000-000000000007',
  3.0,
  'Product roadmap planning',
  'strategy',
  'confirmed',
  now() - interval '1 day'
)
ON CONFLICT (id) DO NOTHING;

-- Add is_agent column to main profiles table (if not exists)
ALTER TABLE profiles ADD COLUMN IF NOT EXISTS is_agent boolean DEFAULT false;

-- Create index for agents
CREATE INDEX IF NOT EXISTS idx_profiles_is_agent ON profiles(is_agent);

-- Function to auto-connect new users to all agent profiles
CREATE OR REPLACE FUNCTION connect_new_user_to_agent_profiles()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  agent_record record;
BEGIN
  -- Only connect non-agent users to agent profiles
  IF (NEW.is_agent = false OR NEW.is_agent IS NULL) THEN
    -- Create connections to all agent profiles (using their IDs as profile IDs)
    FOR agent_record IN 
      SELECT id FROM agent_profiles
    LOOP
      INSERT INTO connections (requester_id, recipient_id, status, connection_source, created_at)
      VALUES (NEW.id, agent_record.id, 'accepted', 'auto_agent_connection', now())
      ON CONFLICT (requester_id, recipient_id) DO NOTHING;
    END LOOP;
  END IF;
  
  RETURN NEW;
END;
$$;

-- Create trigger to auto-connect new users to agent profiles
DROP TRIGGER IF EXISTS trigger_connect_new_user_to_agent_profiles ON profiles;
CREATE TRIGGER trigger_connect_new_user_to_agent_profiles
  AFTER INSERT ON profiles
  FOR EACH ROW
  EXECUTE FUNCTION connect_new_user_to_agent_profiles();

-- Connect existing non-agent users to all agent profiles
INSERT INTO connections (requester_id, recipient_id, status, connection_source, created_at)
SELECT 
  p.id as requester_id,
  ap.id as recipient_id,
  'accepted' as status,
  'auto_agent_connection' as connection_source,
  now() as created_at
FROM profiles p
CROSS JOIN agent_profiles ap
WHERE (p.is_agent = false OR p.is_agent IS NULL)
  AND p.id != ap.id
ON CONFLICT (requester_id, recipient_id) DO NOTHING;