/*
  # Create Mock Users and Social Feed Data

  1. New Features
    - Add `is_agent` boolean column to profiles table
    - Create 5 mock agent users with realistic data
    - Create connections between all users and agents
    - Create sample time transactions for social feed
    - Add trigger to auto-connect new users to agents

  2. Security
    - Maintain existing RLS policies
    - Agents are marked with is_agent = true
*/

-- Add is_agent column to profiles
ALTER TABLE profiles ADD COLUMN IF NOT EXISTS is_agent boolean DEFAULT false;

-- Create index for agents
CREATE INDEX IF NOT EXISTS idx_profiles_is_agent ON profiles(is_agent);

-- Insert mock agent users
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
  gen_random_uuid(),
  gen_random_uuid(),
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
  gen_random_uuid(),
  gen_random_uuid(),
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
  gen_random_uuid(),
  gen_random_uuid(),
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
  gen_random_uuid(),
  gen_random_uuid(),
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
  gen_random_uuid(),
  gen_random_uuid(),
  'david.miller@yard.com',
  'David Miller',
  'David',
  'Strategy consultant and workshop facilitator. I help teams align on vision and execute complex projects through collaborative planning sessions.',
  'Chicago, IL',
  true,
  true,
  6.0,
  now() - interval '5 months'
);

-- Get the agent profile IDs for creating transactions
DO $$
DECLARE
  sarah_id uuid;
  mike_id uuid;
  alex_id uuid;
  rachel_id uuid;
  david_id uuid;
  jane_id uuid;
  kevin_id uuid;
BEGIN
  -- Get agent IDs
  SELECT id INTO sarah_id FROM profiles WHERE email = 'sarah.johnson@yard.com';
  SELECT id INTO mike_id FROM profiles WHERE email = 'mike.kim@yard.com';
  SELECT id INTO alex_id FROM profiles WHERE email = 'alex.liu@yard.com';
  SELECT id INTO rachel_id FROM profiles WHERE email = 'rachel.wong@yard.com';
  SELECT id INTO david_id FROM profiles WHERE email = 'david.miller@yard.com';

  -- Create additional mock users for group transactions
  INSERT INTO profiles (
    id,
    user_id,
    email,
    full_name,
    display_name,
    bio,
    location,
    is_agent,
    created_at
  ) VALUES 
  (
    gen_random_uuid(),
    gen_random_uuid(),
    'jane.doe@example.com',
    'Jane Doe',
    'Jane',
    'Product manager at a growing fintech startup.',
    'Boston, MA',
    false,
    now() - interval '2 weeks'
  ),
  (
    gen_random_uuid(),
    gen_random_uuid(),
    'kevin.park@example.com',
    'Kevin Park',
    'Kevin',
    'Engineering lead building the next generation of mobile apps.',
    'Los Angeles, CA',
    false,
    now() - interval '1 week'
  );

  -- Get the new user IDs
  SELECT id INTO jane_id FROM profiles WHERE email = 'jane.doe@example.com';
  SELECT id INTO kevin_id FROM profiles WHERE email = 'kevin.park@example.com';

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
  );

  -- Alex -> Rachel (unbalanced)
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
  );

  -- David -> Jane, Kevin (group session)
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
  );

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
  IF NEW.is_agent = false OR NEW.is_agent IS NULL THEN
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
WHERE p1.is_agent = false 
  AND p2.is_agent = true
  AND p1.id != p2.id
ON CONFLICT (requester_id, recipient_id) DO NOTHING;

-- Update RLS policies to allow reading agent profiles
CREATE POLICY "Anyone can read agent profiles" ON profiles
  FOR SELECT
  TO authenticated
  USING (is_agent = true);