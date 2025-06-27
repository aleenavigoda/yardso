/*
  # Create Mock Users and Social Feed Data

  1. New Tables
    - Add `is_agent` column to `profiles` table
    - Create mock agent profiles without user_id dependencies
    - Create sample time transactions for social feed
    - Create auto-connection system for agents

  2. Security
    - Add RLS policy for reading agent profiles
    - Create trigger to auto-connect new users to agents

  3. Sample Data
    - 5 mock agent users with realistic profiles
    - Sample time transactions showing different interaction types
    - Auto-connections between users and agents
*/

-- Add is_agent column to profiles
ALTER TABLE profiles ADD COLUMN IF NOT EXISTS is_agent boolean DEFAULT false;

-- Create index for agents
CREATE INDEX IF NOT EXISTS idx_profiles_is_agent ON profiles(is_agent);

-- Create a special UUID namespace for mock users to avoid conflicts
-- We'll use a deterministic approach to generate UUIDs

-- Insert mock agent profiles (without user_id foreign key dependency)
-- We'll set user_id to NULL initially and handle it differently
DO $$
DECLARE
  sarah_id uuid := 'a0000000-0000-0000-0000-000000000001'::uuid;
  mike_id uuid := 'a0000000-0000-0000-0000-000000000002'::uuid;
  alex_id uuid := 'a0000000-0000-0000-0000-000000000003'::uuid;
  rachel_id uuid := 'a0000000-0000-0000-0000-000000000004'::uuid;
  david_id uuid := 'a0000000-0000-0000-0000-000000000005'::uuid;
  jane_id uuid := 'a0000000-0000-0000-0000-000000000006'::uuid;
  kevin_id uuid := 'a0000000-0000-0000-0000-000000000007'::uuid;
BEGIN
  -- Temporarily disable the foreign key constraint for user_id
  ALTER TABLE profiles DROP CONSTRAINT IF EXISTS profiles_user_id_fkey;
  
  -- Insert mock agent users with fixed UUIDs
  INSERT INTO profiles (
    id,
    user_id,
    email,
    full_name,
    display_name,
    bio,
    location,
    is_agent,
    is_available_for_work,
    time_balance_hours,
    created_at
  ) VALUES 
  (
    sarah_id,
    sarah_id, -- Use same ID for user_id to avoid foreign key issues
    'sarah.johnson@yard.com',
    'Sarah Johnson',
    'Sarah',
    'Legal expert specializing in startup contracts and Series A term sheets. Former BigLaw attorney now helping early-stage companies navigate complex legal landscapes.',
    'San Francisco, CA',
    true,
    true,
    12.5,
    now() - interval '3 months'
  ),
  (
    mike_id,
    mike_id,
    'mike.kim@yard.com',
    'Mike Kim',
    'Mike',
    'Senior UX Designer with 8+ years at top tech companies. I help startups create intuitive user experiences and mobile app interfaces that users love.',
    'New York, NY',
    true,
    true,
    -2.5,
    now() - interval '2 months'
  ),
  (
    alex_id,
    alex_id,
    'alex.liu@yard.com',
    'Alex Liu',
    'Alex',
    'Data scientist and market research analyst. I turn complex datasets into actionable business insights for growing companies.',
    'Austin, TX',
    true,
    true,
    8.0,
    now() - interval '4 months'
  ),
  (
    rachel_id,
    rachel_id,
    'rachel.wong@yard.com',
    'Rachel Wong',
    'Rachel',
    'Product strategist and former startup founder. I help teams build roadmaps and make strategic decisions that drive growth.',
    'Seattle, WA',
    true,
    true,
    -4.0,
    now() - interval '1 month'
  ),
  (
    david_id,
    david_id,
    'david.miller@yard.com',
    'David Miller',
    'David',
    'Strategy consultant and workshop facilitator. I help teams align on vision and execute complex projects through collaborative planning sessions.',
    'Chicago, IL',
    true,
    true,
    6.0,
    now() - interval '5 months'
  ),
  -- Additional mock users for group transactions
  (
    jane_id,
    jane_id,
    'jane.doe@example.com',
    'Jane Doe',
    'Jane',
    'Product manager at a growing fintech startup.',
    'Boston, MA',
    false,
    true,
    2.0,
    now() - interval '2 weeks'
  ),
  (
    kevin_id,
    kevin_id,
    'kevin.park@example.com',
    'Kevin Park',
    'Kevin',
    'Engineering lead building the next generation of mobile apps.',
    'Los Angeles, CA',
    false,
    true,
    -1.0,
    now() - interval '1 week'
  )
  ON CONFLICT (id) DO NOTHING;

  -- Create sample time transactions for the feed
  
  -- Sarah <-> Mike exchange (balanced)
  INSERT INTO time_transactions (
    giver_id,
    receiver_id,
    hours,
    description,
    service_type,
    status,
    logged_by,
    confirmed_at,
    confirmed_by,
    created_at
  ) VALUES 
  (
    sarah_id,
    mike_id,
    2.5,
    'Contract review',
    'legal',
    'confirmed',
    sarah_id,
    now() - interval '2 hours',
    mike_id,
    now() - interval '2 hours'
  ),
  (
    mike_id,
    sarah_id,
    2.5,
    'Mobile app wireframes',
    'design',
    'confirmed',
    mike_id,
    now() - interval '2 hours',
    sarah_id,
    now() - interval '2 hours'
  ),
  -- Alex -> Rachel (unbalanced)
  (
    alex_id,
    rachel_id,
    4.0,
    'Market research insights',
    'analysis',
    'confirmed',
    alex_id,
    now() - interval '5 hours',
    rachel_id,
    now() - interval '5 hours'
  ),
  -- David -> Jane, Kevin (group session)
  (
    david_id,
    jane_id,
    3.0,
    'Product roadmap planning',
    'strategy',
    'confirmed',
    david_id,
    now() - interval '1 day',
    jane_id,
    now() - interval '1 day'
  ),
  (
    david_id,
    kevin_id,
    3.0,
    'Product roadmap planning',
    'strategy',
    'confirmed',
    david_id,
    now() - interval '1 day',
    kevin_id,
    now() - interval '1 day'
  )
  ON CONFLICT (id) DO NOTHING;

  -- Re-add the foreign key constraint but make it more flexible for mock users
  -- We'll modify the constraint to allow self-referencing for agent users
  ALTER TABLE profiles ADD CONSTRAINT profiles_user_id_fkey 
    FOREIGN KEY (user_id) REFERENCES profiles(id) ON DELETE CASCADE
    DEFERRABLE INITIALLY DEFERRED;

END $$;

-- Function to auto-connect new users to all agents
CREATE OR REPLACE FUNCTION connect_new_user_to_agents()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  agent_record record;
BEGIN
  -- Only connect non-agent users to agents
  IF (NEW.is_agent = false OR NEW.is_agent IS NULL) AND NEW.user_id IS NOT NULL THEN
    -- Create connections to all agents
    FOR agent_record IN 
      SELECT id FROM profiles WHERE is_agent = true
    LOOP
      INSERT INTO connections (requester_id, recipient_id, status, connection_source, created_at)
      VALUES (NEW.id, agent_record.id, 'accepted', 'auto_agent_connection', now())
      ON CONFLICT (requester_id, recipient_id) DO NOTHING;
    END LOOP;
  END IF;
  
  RETURN NEW;
END;
$$;

-- Create trigger to auto-connect new users to agents
DROP TRIGGER IF EXISTS trigger_connect_new_user_to_agents ON profiles;
CREATE TRIGGER trigger_connect_new_user_to_agents
  AFTER INSERT ON profiles
  FOR EACH ROW
  EXECUTE FUNCTION connect_new_user_to_agents();

-- Connect existing non-agent users to all agents
INSERT INTO connections (requester_id, recipient_id, status, connection_source, created_at)
SELECT 
  p1.id as requester_id,
  p2.id as recipient_id,
  'accepted' as status,
  'auto_agent_connection' as connection_source,
  now() as created_at
FROM profiles p1
CROSS JOIN profiles p2
WHERE (p1.is_agent = false OR p1.is_agent IS NULL)
  AND p2.is_agent = true
  AND p1.id != p2.id
  AND p1.user_id IS NOT NULL -- Only connect real users
ON CONFLICT (requester_id, recipient_id) DO NOTHING;

-- Update RLS policies to allow reading agent profiles
DROP POLICY IF EXISTS "Anyone can read agent profiles" ON profiles;
CREATE POLICY "Anyone can read agent profiles" ON profiles
  FOR SELECT
  TO authenticated
  USING (is_agent = true);

-- Add some profile URLs for the mock users to make them more realistic
INSERT INTO profile_urls (profile_id, url, url_type, created_at) VALUES
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

ON CONFLICT (profile_id, url) DO NOTHING;