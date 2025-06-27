/*
  # Add Mock Users and Social Feed Data

  1. New Features
    - Add `is_agent` boolean column to profiles table
    - Create 5 mock agent users with realistic profiles
    - Create 2 additional mock users for group transactions
    - Add sample time transactions for social feed
    - Add profile URLs for mock users

  2. Auto-Connection System
    - Function to automatically connect new users to all agents
    - Trigger to execute auto-connection on profile creation
    - Connect existing users to new agents

  3. Security
    - RLS policy to allow reading agent profiles
    - Proper conflict handling for existing data
*/

-- Add is_agent column to profiles
ALTER TABLE profiles ADD COLUMN IF NOT EXISTS is_agent boolean DEFAULT false;

-- Create index for agents
CREATE INDEX IF NOT EXISTS idx_profiles_is_agent ON profiles(is_agent);

-- Create mock users and data
DO $$
DECLARE
  sarah_user_id uuid;
  mike_user_id uuid;
  alex_user_id uuid;
  rachel_user_id uuid;
  david_user_id uuid;
  jane_user_id uuid;
  kevin_user_id uuid;
  sarah_profile_id uuid := 'a0000000-0000-0000-0000-000000000001'::uuid;
  mike_profile_id uuid := 'a0000000-0000-0000-0000-000000000002'::uuid;
  alex_profile_id uuid := 'a0000000-0000-0000-0000-000000000003'::uuid;
  rachel_profile_id uuid := 'a0000000-0000-0000-0000-000000000004'::uuid;
  david_profile_id uuid := 'a0000000-0000-0000-0000-000000000005'::uuid;
  jane_profile_id uuid := 'a0000000-0000-0000-0000-000000000006'::uuid;
  kevin_profile_id uuid := 'a0000000-0000-0000-0000-000000000007'::uuid;
  existing_profile_count int;
BEGIN
  -- Check if mock data already exists
  SELECT COUNT(*) INTO existing_profile_count 
  FROM profiles 
  WHERE email IN ('sarah.johnson@yard.com', 'mike.kim@yard.com', 'alex.liu@yard.com', 'rachel.wong@yard.com', 'david.miller@yard.com');
  
  -- Only proceed if mock data doesn't already exist
  IF existing_profile_count = 0 THEN
    -- Generate unique user IDs
    sarah_user_id := gen_random_uuid();
    mike_user_id := gen_random_uuid();
    alex_user_id := gen_random_uuid();
    rachel_user_id := gen_random_uuid();
    david_user_id := gen_random_uuid();
    jane_user_id := gen_random_uuid();
    kevin_user_id := gen_random_uuid();

    -- Try to insert into auth.users table (if we have access)
    BEGIN
      INSERT INTO auth.users (
        id,
        email,
        email_confirmed_at,
        created_at,
        updated_at,
        raw_user_meta_data
      ) VALUES 
      (sarah_user_id, 'sarah.johnson@yard.com', now(), now() - interval '3 months', now() - interval '3 months', '{"full_name": "Sarah Johnson"}'::jsonb),
      (mike_user_id, 'mike.kim@yard.com', now(), now() - interval '2 months', now() - interval '2 months', '{"full_name": "Mike Kim"}'::jsonb),
      (alex_user_id, 'alex.liu@yard.com', now(), now() - interval '4 months', now() - interval '4 months', '{"full_name": "Alex Liu"}'::jsonb),
      (rachel_user_id, 'rachel.wong@yard.com', now(), now() - interval '1 month', now() - interval '1 month', '{"full_name": "Rachel Wong"}'::jsonb),
      (david_user_id, 'david.miller@yard.com', now(), now() - interval '5 months', now() - interval '5 months', '{"full_name": "David Miller"}'::jsonb),
      (jane_user_id, 'jane.doe@example.com', now(), now() - interval '2 weeks', now() - interval '2 weeks', '{"full_name": "Jane Doe"}'::jsonb),
      (kevin_user_id, 'kevin.park@example.com', now(), now() - interval '1 week', now() - interval '1 week', '{"full_name": "Kevin Park"}'::jsonb);
    EXCEPTION
      WHEN OTHERS THEN
        -- If we can't insert into auth.users, we'll skip this step
        -- The profiles will be created without proper auth users
        NULL;
    END;

    -- Insert mock profiles
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
      sarah_profile_id,
      sarah_user_id,
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
      mike_profile_id,
      mike_user_id,
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
      alex_profile_id,
      alex_user_id,
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
      rachel_profile_id,
      rachel_user_id,
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
      david_profile_id,
      david_user_id,
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
    (
      jane_profile_id,
      jane_user_id,
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
      kevin_profile_id,
      kevin_user_id,
      'kevin.park@example.com',
      'Kevin Park',
      'Kevin',
      'Engineering lead building the next generation of mobile apps.',
      'Los Angeles, CA',
      false,
      true,
      -1.0,
      now() - interval '1 week'
    );

    -- Create sample time transactions for the feed
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
    -- Sarah <-> Mike exchange (balanced)
    (
      sarah_profile_id,
      mike_profile_id,
      2.5,
      'Contract review',
      'legal',
      'confirmed',
      sarah_profile_id,
      now() - interval '2 hours',
      mike_profile_id,
      now() - interval '2 hours'
    ),
    (
      mike_profile_id,
      sarah_profile_id,
      2.5,
      'Mobile app wireframes',
      'design',
      'confirmed',
      mike_profile_id,
      now() - interval '2 hours',
      sarah_profile_id,
      now() - interval '2 hours'
    ),
    -- Alex -> Rachel (unbalanced)
    (
      alex_profile_id,
      rachel_profile_id,
      4.0,
      'Market research insights',
      'analysis',
      'confirmed',
      alex_profile_id,
      now() - interval '5 hours',
      rachel_profile_id,
      now() - interval '5 hours'
    ),
    -- David -> Jane, Kevin (group session)
    (
      david_profile_id,
      jane_profile_id,
      3.0,
      'Product roadmap planning',
      'strategy',
      'confirmed',
      david_profile_id,
      now() - interval '1 day',
      jane_profile_id,
      now() - interval '1 day'
    ),
    (
      david_profile_id,
      kevin_profile_id,
      3.0,
      'Product roadmap planning',
      'strategy',
      'confirmed',
      david_profile_id,
      now() - interval '1 day',
      kevin_profile_id,
      now() - interval '1 day'
    );

    -- Add profile URLs for the mock users
    INSERT INTO profile_urls (profile_id, url, url_type, created_at) VALUES
    -- Sarah Johnson URLs
    (sarah_profile_id, 'https://linkedin.com/in/sarahjohnsonlaw', 'linkedin', now() - interval '3 months'),
    (sarah_profile_id, 'https://sarahjohnsonlaw.com', 'website', now() - interval '3 months'),
    
    -- Mike Kim URLs  
    (mike_profile_id, 'https://linkedin.com/in/mikekim-ux', 'linkedin', now() - interval '2 months'),
    (mike_profile_id, 'https://dribbble.com/mikekim', 'portfolio', now() - interval '2 months'),
    
    -- Alex Liu URLs
    (alex_profile_id, 'https://github.com/alexliu', 'github', now() - interval '4 months'),
    (alex_profile_id, 'https://linkedin.com/in/alexliu-data', 'linkedin', now() - interval '4 months'),
    
    -- Rachel Wong URLs
    (rachel_profile_id, 'https://linkedin.com/in/rachelwong-product', 'linkedin', now() - interval '1 month'),
    (rachel_profile_id, 'https://medium.com/@rachelwong', 'article', now() - interval '1 month'),
    
    -- David Miller URLs
    (david_profile_id, 'https://linkedin.com/in/davidmiller-strategy', 'linkedin', now() - interval '5 months'),
    (david_profile_id, 'https://davidmillerstrategy.com', 'website', now() - interval '5 months');

  END IF; -- End check for existing mock data

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
  IF (NEW.is_agent = false OR NEW.is_agent IS NULL) THEN
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
ON CONFLICT (requester_id, recipient_id) DO NOTHING;

-- Update RLS policies to allow reading agent profiles
DROP POLICY IF EXISTS "Anyone can read agent profiles" ON profiles;
CREATE POLICY "Anyone can read agent profiles" ON profiles
  FOR SELECT
  TO authenticated
  USING (is_agent = true);