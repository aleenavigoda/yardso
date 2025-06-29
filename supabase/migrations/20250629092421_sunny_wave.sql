/*
  # Create external_profiles table for profiles from other sites

  1. New Tables
    - `external_profiles` - Profiles scraped/imported from external sites
    - `external_profile_urls` - URLs associated with external profiles

  2. Security
    - Enable RLS on both tables
    - Add policies for authenticated users to read external profiles

  3. Mock Data
    - Sample external profiles from various platforms
    - Associated URLs for each profile
*/

-- Create external_profiles table
CREATE TABLE IF NOT EXISTS external_profiles (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name text NOT NULL,
  display_name text NOT NULL,
  bio text,
  location text,
  source_platform text NOT NULL, -- 'github', 'linkedin', 'dribbble', 'behance', etc.
  source_url text NOT NULL,
  avatar_url text,
  follower_count integer DEFAULT 0,
  following_count integer DEFAULT 0,
  public_repos integer DEFAULT 0,
  skills text[],
  company text,
  job_title text,
  is_verified boolean DEFAULT false,
  scraped_at timestamptz DEFAULT now(),
  created_at timestamptz DEFAULT now()
);

-- Create external_profile_urls table
CREATE TABLE IF NOT EXISTS external_profile_urls (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  external_profile_id uuid NOT NULL REFERENCES external_profiles(id) ON DELETE CASCADE,
  url text NOT NULL,
  url_type text NOT NULL, -- 'portfolio', 'github', 'linkedin', 'twitter', 'website'
  title text,
  description text,
  created_at timestamptz DEFAULT now(),
  UNIQUE(external_profile_id, url)
);

-- Enable RLS
ALTER TABLE external_profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE external_profile_urls ENABLE ROW LEVEL SECURITY;

-- Allow authenticated users to read external profiles
CREATE POLICY "Anyone can read external profiles" ON external_profiles
  FOR SELECT
  TO authenticated
  USING (name IS NOT NULL);

CREATE POLICY "Anyone can read external profile URLs" ON external_profile_urls
  FOR SELECT
  TO authenticated
  USING (true);

-- Create indexes for performance
CREATE INDEX IF NOT EXISTS idx_external_profiles_name ON external_profiles(name);
CREATE INDEX IF NOT EXISTS idx_external_profiles_source_platform ON external_profiles(source_platform);
CREATE INDEX IF NOT EXISTS idx_external_profiles_location ON external_profiles(location);
CREATE INDEX IF NOT EXISTS idx_external_profiles_scraped_at ON external_profiles(scraped_at);

-- Text search indexes
CREATE INDEX IF NOT EXISTS idx_external_profiles_name_trgm ON external_profiles USING gin(name gin_trgm_ops);
CREATE INDEX IF NOT EXISTS idx_external_profiles_bio_trgm ON external_profiles USING gin(bio gin_trgm_ops);

-- Insert sample external profiles
INSERT INTO external_profiles (
  id,
  name,
  display_name,
  bio,
  location,
  source_platform,
  source_url,
  follower_count,
  following_count,
  public_repos,
  skills,
  company,
  job_title,
  is_verified,
  scraped_at
) VALUES 
-- GitHub profiles
(
  'e0000000-0000-0000-0000-000000000001'::uuid,
  'Emma Chen',
  'Emma',
  'Full-stack developer passionate about React and Node.js. Building tools that make developers more productive.',
  'San Francisco, CA',
  'github',
  'https://github.com/emmachen',
  1250,
  180,
  47,
  ARRAY['React', 'Node.js', 'TypeScript', 'GraphQL', 'PostgreSQL'],
  'Vercel',
  'Senior Software Engineer',
  true,
  now() - interval '2 days'
),
(
  'e0000000-0000-0000-0000-000000000002'::uuid,
  'Marcus Rodriguez',
  'Marcus',
  'DevOps engineer specializing in Kubernetes and cloud infrastructure. Love automating everything.',
  'Austin, TX',
  'github',
  'https://github.com/marcusrodriguez',
  890,
  95,
  32,
  ARRAY['Kubernetes', 'Docker', 'AWS', 'Terraform', 'Python'],
  'HashiCorp',
  'DevOps Engineer',
  true,
  now() - interval '1 day'
),

-- LinkedIn profiles
(
  'e0000000-0000-0000-0000-000000000003'::uuid,
  'Priya Patel',
  'Priya',
  'Product Manager with 8+ years experience launching consumer apps. Expert in user research and data-driven product decisions.',
  'New York, NY',
  'linkedin',
  'https://linkedin.com/in/priyapatel',
  3200,
  850,
  0,
  ARRAY['Product Management', 'User Research', 'Data Analysis', 'A/B Testing', 'Agile'],
  'Spotify',
  'Senior Product Manager',
  true,
  now() - interval '3 hours'
),
(
  'e0000000-0000-0000-0000-000000000004'::uuid,
  'James Burton',
  'James',
  'Co-founder at Subframe. Seasoned designer and strategic advisor driving innovation for start-ups and high-growth companies.',
  'London, UK',
  'linkedin',
  'https://linkedin.com/in/jamesburton',
  5600,
  1200,
  0,
  ARRAY['UI/UX Design', 'Product Strategy', 'Design Systems', 'Figma', 'Leadership'],
  'Subframe',
  'Co-founder & Design Lead',
  true,
  now() - interval '6 hours'
),

-- Dribbble profiles
(
  'e0000000-0000-0000-0000-000000000005'::uuid,
  'Sofia Andersson',
  'Sofia',
  'Visual designer creating beautiful interfaces for mobile apps. Passionate about typography and color theory.',
  'Stockholm, Sweden',
  'dribbble',
  'https://dribbble.com/sofiaandersson',
  2100,
  340,
  0,
  ARRAY['Visual Design', 'Mobile UI', 'Typography', 'Illustration', 'Branding'],
  'Klarna',
  'Senior Visual Designer',
  true,
  now() - interval '12 hours'
),

-- Behance profiles
(
  'e0000000-0000-0000-0000-000000000006'::uuid,
  'Carlos Mendoza',
  'Carlos',
  'Creative director and brand strategist. Helping startups build memorable visual identities that connect with their audience.',
  'Mexico City, Mexico',
  'behance',
  'https://behance.net/carlosmendoza',
  1800,
  290,
  0,
  ARRAY['Brand Strategy', 'Creative Direction', 'Logo Design', 'Marketing', 'Adobe Creative Suite'],
  'Freelance',
  'Creative Director',
  false,
  now() - interval '1 day'
),

-- More GitHub profiles
(
  'e0000000-0000-0000-0000-000000000007'::uuid,
  'Aisha Okonkwo',
  'Aisha',
  'Machine learning engineer working on computer vision and NLP. PhD in Computer Science from Stanford.',
  'Seattle, WA',
  'github',
  'https://github.com/aishaokonkwo',
  2800,
  150,
  28,
  ARRAY['Machine Learning', 'Python', 'TensorFlow', 'Computer Vision', 'NLP'],
  'Microsoft',
  'Principal ML Engineer',
  true,
  now() - interval '4 hours'
),

-- More LinkedIn profiles
(
  'e0000000-0000-0000-0000-000000000008'::uuid,
  'Thomas Mueller',
  'Thomas',
  'Growth marketing specialist with expertise in B2B SaaS. Scaled multiple startups from 0 to $10M+ ARR.',
  'Berlin, Germany',
  'linkedin',
  'https://linkedin.com/in/thomasmueller',
  4100,
  980,
  0,
  ARRAY['Growth Marketing', 'B2B SaaS', 'SEO', 'Content Marketing', 'Analytics'],
  'Notion',
  'Head of Growth',
  true,
  now() - interval '8 hours'
)

ON CONFLICT (id) DO NOTHING;

-- Insert external profile URLs
INSERT INTO external_profile_urls (external_profile_id, url, url_type, title, description) VALUES
-- Emma Chen URLs
('e0000000-0000-0000-0000-000000000001', 'https://emmachen.dev', 'website', 'Personal Portfolio', 'My personal website and blog'),
('e0000000-0000-0000-0000-000000000001', 'https://twitter.com/emmachen_dev', 'twitter', 'Twitter Profile', 'Follow me for dev tips'),

-- Marcus Rodriguez URLs  
('e0000000-0000-0000-0000-000000000002', 'https://marcusrodriguez.io', 'website', 'DevOps Blog', 'Tutorials and insights on DevOps'),
('e0000000-0000-0000-0000-000000000002', 'https://linkedin.com/in/marcusrodriguez', 'linkedin', 'LinkedIn Profile', 'Professional network'),

-- Priya Patel URLs
('e0000000-0000-0000-0000-000000000003', 'https://priyapatel.com', 'website', 'Product Blog', 'Insights on product management'),
('e0000000-0000-0000-0000-000000000003', 'https://medium.com/@priyapatel', 'portfolio', 'Medium Articles', 'Product management articles'),

-- James Burton URLs
('e0000000-0000-0000-0000-000000000004', 'https://subframe.com', 'website', 'Subframe Platform', 'Design system platform'),
('e0000000-0000-0000-0000-000000000004', 'https://dribbble.com/jamesburton', 'portfolio', 'Design Portfolio', 'UI/UX design work'),

-- Sofia Andersson URLs
('e0000000-0000-0000-0000-000000000005', 'https://sofiadesign.se', 'website', 'Design Portfolio', 'Visual design showcase'),
('e0000000-0000-0000-0000-000000000005', 'https://instagram.com/sofiadesigns', 'portfolio', 'Instagram', 'Design inspiration'),

-- Carlos Mendoza URLs
('e0000000-0000-0000-0000-000000000006', 'https://carlosmendoza.mx', 'website', 'Brand Portfolio', 'Brand strategy work'),
('e0000000-0000-0000-0000-000000000006', 'https://linkedin.com/in/carlosmendoza', 'linkedin', 'LinkedIn Profile', 'Professional network'),

-- Aisha Okonkwo URLs
('e0000000-0000-0000-0000-000000000007', 'https://aishaokonkwo.com', 'website', 'Research Portfolio', 'ML research and projects'),
('e0000000-0000-0000-0000-000000000007', 'https://scholar.google.com/aisha', 'portfolio', 'Google Scholar', 'Academic publications'),

-- Thomas Mueller URLs
('e0000000-0000-0000-0000-000000000008', 'https://thomasmueller.de', 'website', 'Growth Blog', 'B2B growth strategies'),
('e0000000-0000-0000-0000-000000000008', 'https://twitter.com/thomas_growth', 'twitter', 'Twitter Profile', 'Growth marketing insights')

ON CONFLICT (external_profile_id, url) DO NOTHING;