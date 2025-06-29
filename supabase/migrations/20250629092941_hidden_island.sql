/*
  # Create External Profiles Table

  1. New Tables
    - `external_profiles` - Profiles from external platforms
      - `id` (uuid, primary key)
      - `name` (text, not null)
      - `display_name` (text)
      - `bio` (text)
      - `location` (text)
      - `source_platform` (text) - github, linkedin, twitter, etc.
      - `source_url` (text) - original profile URL
      - `profile_url` (text) - direct link to profile
      - `company` (text)
      - `job_title` (text)
      - `follower_count` (integer)
      - `is_verified` (boolean)
      - `skills` (text array)
      - `created_at` (timestamp)
      - `updated_at` (timestamp)

  2. Security
    - Enable RLS on external_profiles table
    - Add policy for authenticated users to read external profiles

  3. Indexes
    - Add indexes for performance on commonly queried fields
*/

-- Create external_profiles table if it doesn't exist
CREATE TABLE IF NOT EXISTS external_profiles (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name text NOT NULL,
  display_name text,
  bio text,
  location text,
  source_platform text, -- 'github', 'linkedin', 'twitter', 'dribbble', 'behance', etc.
  source_url text, -- Original profile URL
  profile_url text, -- Direct link to profile (might be same as source_url)
  company text,
  job_title text,
  follower_count integer,
  is_verified boolean DEFAULT false,
  skills text[],
  avatar_url text,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

-- Enable RLS
ALTER TABLE external_profiles ENABLE ROW LEVEL SECURITY;

-- Allow authenticated users to read external profiles
CREATE POLICY "Anyone can read external profiles" ON external_profiles
  FOR SELECT
  TO authenticated
  USING (true);

-- Create indexes for performance
CREATE INDEX IF NOT EXISTS idx_external_profiles_name ON external_profiles(name);
CREATE INDEX IF NOT EXISTS idx_external_profiles_platform ON external_profiles(source_platform);
CREATE INDEX IF NOT EXISTS idx_external_profiles_company ON external_profiles(company);
CREATE INDEX IF NOT EXISTS idx_external_profiles_verified ON external_profiles(is_verified);

-- Text search indexes
CREATE INDEX IF NOT EXISTS idx_external_profiles_name_trgm ON external_profiles USING gin(name gin_trgm_ops);
CREATE INDEX IF NOT EXISTS idx_external_profiles_bio_trgm ON external_profiles USING gin(bio gin_trgm_ops);

-- Insert some sample external profiles
INSERT INTO external_profiles (
  name,
  display_name,
  bio,
  location,
  source_platform,
  source_url,
  profile_url,
  company,
  job_title,
  follower_count,
  is_verified,
  skills,
  created_at
) VALUES 
(
  'Linus Torvalds',
  'Linus',
  'Creator of Linux and Git. Software engineer focused on operating systems and version control.',
  'Portland, OR',
  'github',
  'https://github.com/torvalds',
  'https://github.com/torvalds',
  'Linux Foundation',
  'Chief Architect',
  150000,
  true,
  ARRAY['Linux', 'C Programming', 'Operating Systems', 'Git', 'Kernel Development'],
  now() - interval '6 months'
),
(
  'Cassidy Williams',
  'Cassidy',
  'Principal Developer Experience Engineer. Building developer tools and teaching web development.',
  'Chicago, IL',
  'github',
  'https://github.com/cassidoo',
  'https://github.com/cassidoo',
  'Contenda',
  'Principal DX Engineer',
  45000,
  true,
  ARRAY['JavaScript', 'React', 'Developer Relations', 'Technical Writing', 'Web Development'],
  now() - interval '4 months'
),
(
  'Kent C. Dodds',
  'Kent',
  'Full stack web developer and educator. Creator of Testing Library and Epic React.',
  'Utah, USA',
  'github',
  'https://github.com/kentcdodds',
  'https://github.com/kentcdodds',
  'EpicWeb.dev',
  'Founder & Educator',
  75000,
  true,
  ARRAY['React', 'Testing', 'JavaScript', 'Node.js', 'Education', 'Web Development'],
  now() - interval '3 months'
),
(
  'Sarah Drasner',
  'Sarah',
  'VP of Developer Experience at Netlify. Vue.js core team member and animation expert.',
  'Denver, CO',
  'github',
  'https://github.com/sdras',
  'https://github.com/sdras',
  'Netlify',
  'VP of Developer Experience',
  85000,
  true,
  ARRAY['Vue.js', 'JavaScript', 'CSS Animation', 'Developer Experience', 'SVG'],
  now() - interval '5 months'
),
(
  'Dan Abramov',
  'Dan',
  'Co-creator of Redux and Create React App. Former React team member at Meta.',
  'London, UK',
  'github',
  'https://github.com/gaearon',
  'https://github.com/gaearon',
  'Independent',
  'Software Engineer',
  120000,
  true,
  ARRAY['React', 'Redux', 'JavaScript', 'Developer Tools', 'Open Source'],
  now() - interval '2 months'
),
(
  'Addy Osmani',
  'Addy',
  'Engineering Manager at Google Chrome. Expert in web performance and modern web development.',
  'Mountain View, CA',
  'github',
  'https://github.com/addyosmani',
  'https://github.com/addyosmani',
  'Google',
  'Engineering Manager',
  95000,
  true,
  ARRAY['Web Performance', 'JavaScript', 'Chrome DevTools', 'Progressive Web Apps', 'Optimization'],
  now() - interval '1 month'
),
(
  'Una Kravets',
  'Una',
  'Developer Advocate at Google Chrome. CSS expert and design systems enthusiast.',
  'New York, NY',
  'github',
  'https://github.com/una',
  'https://github.com/una',
  'Google',
  'Developer Advocate',
  55000,
  true,
  ARRAY['CSS', 'Design Systems', 'Web Standards', 'Developer Advocacy', 'UI/UX'],
  now() - interval '3 weeks'
),
(
  'Guillermo Rauch',
  'Guillermo',
  'CEO and Founder of Vercel. Creator of Next.js and Socket.io.',
  'San Francisco, CA',
  'github',
  'https://github.com/rauchg',
  'https://github.com/rauchg',
  'Vercel',
  'CEO & Founder',
  180000,
  true,
  ARRAY['Next.js', 'React', 'Node.js', 'Serverless', 'Frontend Infrastructure'],
  now() - interval '2 weeks'
),
(
  'Evan You',
  'Evan',
  'Creator of Vue.js and Vite. Independent open source developer.',
  'Singapore',
  'github',
  'https://github.com/yyx990803',
  'https://github.com/yyx990803',
  'Independent',
  'Open Source Developer',
  200000,
  true,
  ARRAY['Vue.js', 'Vite', 'JavaScript', 'Build Tools', 'Framework Design'],
  now() - interval '1 week'
),
(
  'Sindre Sorhus',
  'Sindre',
  'Full-time open source developer. Creator of hundreds of popular npm packages.',
  'Oslo, Norway',
  'github',
  'https://github.com/sindresorhus',
  'https://github.com/sindresorhus',
  'Independent',
  'Open Source Developer',
  110000,
  true,
  ARRAY['Node.js', 'JavaScript', 'TypeScript', 'CLI Tools', 'Open Source'],
  now() - interval '4 days'
)
ON CONFLICT (id) DO NOTHING;

-- Add some LinkedIn profiles
INSERT INTO external_profiles (
  name,
  display_name,
  bio,
  location,
  source_platform,
  source_url,
  profile_url,
  company,
  job_title,
  follower_count,
  is_verified,
  skills,
  created_at
) VALUES 
(
  'Reid Hoffman',
  'Reid',
  'Co-Founder of LinkedIn. Partner at Greylock Partners. Entrepreneur and investor.',
  'Palo Alto, CA',
  'linkedin',
  'https://linkedin.com/in/reidhoffman',
  'https://linkedin.com/in/reidhoffman',
  'Greylock Partners',
  'Partner',
  3200000,
  true,
  ARRAY['Venture Capital', 'Entrepreneurship', 'Strategy', 'Networking', 'Leadership'],
  now() - interval '8 months'
),
(
  'Melinda Gates',
  'Melinda',
  'Co-founder of Pivotal Ventures. Philanthropist and advocate for women and families.',
  'Seattle, WA',
  'linkedin',
  'https://linkedin.com/in/melindafrenchgates',
  'https://linkedin.com/in/melindafrenchgates',
  'Pivotal Ventures',
  'Co-founder',
  2800000,
  true,
  ARRAY['Philanthropy', 'Gender Equality', 'Leadership', 'Social Impact', 'Strategy'],
  now() - interval '7 months'
),
(
  'Satya Nadella',
  'Satya',
  'Chairman and CEO of Microsoft. Leading digital transformation and cloud computing.',
  'Redmond, WA',
  'linkedin',
  'https://linkedin.com/in/satyanadella',
  'https://linkedin.com/in/satyanadella',
  'Microsoft',
  'Chairman & CEO',
  4500000,
  true,
  ARRAY['Cloud Computing', 'Digital Transformation', 'Leadership', 'Enterprise Software', 'AI'],
  now() - interval '6 months'
)
ON CONFLICT (id) DO NOTHING;

-- Function to update external profile timestamp
CREATE OR REPLACE FUNCTION update_external_profile_timestamp()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Trigger to update timestamp on external profile updates
CREATE TRIGGER trigger_update_external_profile_timestamp
  BEFORE UPDATE ON external_profiles
  FOR EACH ROW
  EXECUTE FUNCTION update_external_profile_timestamp();