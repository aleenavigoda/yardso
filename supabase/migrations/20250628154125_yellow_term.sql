/*
  # Create Work Bounties System

  1. New Tables
    - `work_bounties` - Store work bounty requests
    - `bounty_applications` - Track applications to bounties
    - `bounty_categories` - Predefined categories for bounties

  2. Security
    - Enable RLS on all tables
    - Add policies for authenticated users to manage their bounties
    - Allow public read access to open bounties

  3. Features
    - Full bounty lifecycle (open, in_progress, completed, cancelled)
    - Application system with status tracking
    - Budget ranges and timeline management
    - Search and filtering capabilities
*/

-- Create work_bounties table
CREATE TABLE IF NOT EXISTS work_bounties (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  posted_by uuid REFERENCES profiles(id) ON DELETE CASCADE NOT NULL,
  title text NOT NULL,
  description text NOT NULL,
  service_type text NOT NULL,
  deliverable_format text NOT NULL,
  timeline text NOT NULL,
  industry text NOT NULL,
  time_estimate text NOT NULL,
  company_stage text NOT NULL,
  budget_range text,
  location text DEFAULT 'Remote',
  requirements text,
  skills_required text[],
  status text DEFAULT 'open' CHECK (status IN ('open', 'in_progress', 'completed', 'cancelled')),
  assigned_to uuid REFERENCES profiles(id),
  applications_count integer DEFAULT 0,
  views_count integer DEFAULT 0,
  featured boolean DEFAULT false,
  expires_at timestamptz DEFAULT (now() + interval '30 days'),
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

-- Create bounty_applications table
CREATE TABLE IF NOT EXISTS bounty_applications (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  bounty_id uuid REFERENCES work_bounties(id) ON DELETE CASCADE NOT NULL,
  applicant_id uuid REFERENCES profiles(id) ON DELETE CASCADE NOT NULL,
  cover_letter text,
  proposed_timeline text,
  proposed_budget text,
  portfolio_links text[],
  status text DEFAULT 'pending' CHECK (status IN ('pending', 'accepted', 'rejected', 'withdrawn')),
  applied_at timestamptz DEFAULT now(),
  reviewed_at timestamptz,
  UNIQUE(bounty_id, applicant_id)
);

-- Create bounty_categories table for predefined options
CREATE TABLE IF NOT EXISTS bounty_categories (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  category_type text NOT NULL, -- 'service_type', 'industry', 'timeline', etc.
  name text NOT NULL,
  description text,
  display_order integer DEFAULT 0,
  is_active boolean DEFAULT true,
  created_at timestamptz DEFAULT now(),
  UNIQUE(category_type, name)
);

-- Enable RLS
ALTER TABLE work_bounties ENABLE ROW LEVEL SECURITY;
ALTER TABLE bounty_applications ENABLE ROW LEVEL SECURITY;
ALTER TABLE bounty_categories ENABLE ROW LEVEL SECURITY;

-- Work bounties policies
CREATE POLICY "Anyone can read open bounties"
  ON work_bounties
  FOR SELECT
  TO authenticated
  USING (status = 'open' OR posted_by IN (SELECT id FROM profiles WHERE user_id = auth.uid()));

CREATE POLICY "Users can create bounties"
  ON work_bounties
  FOR INSERT
  TO authenticated
  WITH CHECK (posted_by IN (SELECT id FROM profiles WHERE user_id = auth.uid()));

CREATE POLICY "Users can update their own bounties"
  ON work_bounties
  FOR UPDATE
  TO authenticated
  USING (posted_by IN (SELECT id FROM profiles WHERE user_id = auth.uid()));

CREATE POLICY "Users can delete their own bounties"
  ON work_bounties
  FOR DELETE
  TO authenticated
  USING (posted_by IN (SELECT id FROM profiles WHERE user_id = auth.uid()));

-- Bounty applications policies
CREATE POLICY "Users can view applications for their bounties"
  ON bounty_applications
  FOR SELECT
  TO authenticated
  USING (
    bounty_id IN (SELECT id FROM work_bounties WHERE posted_by IN (SELECT id FROM profiles WHERE user_id = auth.uid()))
    OR applicant_id IN (SELECT id FROM profiles WHERE user_id = auth.uid())
  );

CREATE POLICY "Users can create applications"
  ON bounty_applications
  FOR INSERT
  TO authenticated
  WITH CHECK (applicant_id IN (SELECT id FROM profiles WHERE user_id = auth.uid()));

CREATE POLICY "Users can update their own applications"
  ON bounty_applications
  FOR UPDATE
  TO authenticated
  USING (applicant_id IN (SELECT id FROM profiles WHERE user_id = auth.uid()));

-- Bounty categories policies
CREATE POLICY "Anyone can read bounty categories"
  ON bounty_categories
  FOR SELECT
  TO authenticated
  USING (is_active = true);

-- Create indexes for performance
CREATE INDEX IF NOT EXISTS idx_work_bounties_posted_by ON work_bounties(posted_by);
CREATE INDEX IF NOT EXISTS idx_work_bounties_status ON work_bounties(status);
CREATE INDEX IF NOT EXISTS idx_work_bounties_service_type ON work_bounties(service_type);
CREATE INDEX IF NOT EXISTS idx_work_bounties_industry ON work_bounties(industry);
CREATE INDEX IF NOT EXISTS idx_work_bounties_created_at ON work_bounties(created_at);
CREATE INDEX IF NOT EXISTS idx_work_bounties_expires_at ON work_bounties(expires_at);
CREATE INDEX IF NOT EXISTS idx_work_bounties_featured ON work_bounties(featured);

CREATE INDEX IF NOT EXISTS idx_bounty_applications_bounty_id ON bounty_applications(bounty_id);
CREATE INDEX IF NOT EXISTS idx_bounty_applications_applicant_id ON bounty_applications(applicant_id);
CREATE INDEX IF NOT EXISTS idx_bounty_applications_status ON bounty_applications(status);
CREATE INDEX IF NOT EXISTS idx_bounty_applications_applied_at ON bounty_applications(applied_at);

CREATE INDEX IF NOT EXISTS idx_bounty_categories_type ON bounty_categories(category_type);
CREATE INDEX IF NOT EXISTS idx_bounty_categories_active ON bounty_categories(is_active);

-- Text search indexes
CREATE INDEX IF NOT EXISTS idx_work_bounties_title_trgm ON work_bounties USING gin(title gin_trgm_ops);
CREATE INDEX IF NOT EXISTS idx_work_bounties_description_trgm ON work_bounties USING gin(description gin_trgm_ops);

-- Function to update applications count
CREATE OR REPLACE FUNCTION update_bounty_applications_count()
RETURNS TRIGGER AS $$
BEGIN
  IF TG_OP = 'INSERT' THEN
    UPDATE work_bounties 
    SET applications_count = applications_count + 1,
        updated_at = now()
    WHERE id = NEW.bounty_id;
    RETURN NEW;
  ELSIF TG_OP = 'DELETE' THEN
    UPDATE work_bounties 
    SET applications_count = applications_count - 1,
        updated_at = now()
    WHERE id = OLD.bounty_id;
    RETURN OLD;
  END IF;
  RETURN NULL;
END;
$$ LANGUAGE plpgsql;

-- Trigger to automatically update applications count
CREATE TRIGGER trigger_update_bounty_applications_count
  AFTER INSERT OR DELETE ON bounty_applications
  FOR EACH ROW
  EXECUTE FUNCTION update_bounty_applications_count();

-- Function to update bounty updated_at timestamp
CREATE OR REPLACE FUNCTION update_bounty_timestamp()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Trigger to update timestamp on bounty updates
CREATE TRIGGER trigger_update_bounty_timestamp
  BEFORE UPDATE ON work_bounties
  FOR EACH ROW
  EXECUTE FUNCTION update_bounty_timestamp();

-- Insert predefined categories
INSERT INTO bounty_categories (category_type, name, display_order) VALUES
-- Service Types
('service_type', 'Design Critique', 1),
('service_type', 'Code Review', 2),
('service_type', 'Strategy Consultation', 3),
('service_type', 'Mentorship', 4),
('service_type', 'Legal Review', 5),
('service_type', 'Financial Analysis', 6),
('service_type', 'Technical Consultation', 7),
('service_type', 'Marketing Strategy', 8),

-- Deliverable Formats
('deliverable_format', 'Live Consultation', 1),
('deliverable_format', 'Written Feedback', 2),
('deliverable_format', 'Video Call', 3),
('deliverable_format', 'Documentation', 4),
('deliverable_format', 'Workshop Session', 5),

-- Timelines
('timeline', 'Immediate', 1),
('timeline', 'Within 48 hours', 2),
('timeline', 'This week', 3),
('timeline', 'Next week', 4),
('timeline', 'Flexible', 5),

-- Industries
('industry', 'Technology', 1),
('industry', 'Healthcare', 2),
('industry', 'Finance', 3),
('industry', 'Education', 4),
('industry', 'Entertainment', 5),
('industry', 'Other', 6),

-- Time Estimates
('time_estimate', '1-2 hours', 1),
('time_estimate', 'Half day', 2),
('time_estimate', 'Full day', 3),
('time_estimate', 'Multiple days', 4),
('time_estimate', 'Ongoing project', 5),

-- Company Stages
('company_stage', 'Pre-seed', 1),
('company_stage', 'Seed', 2),
('company_stage', 'Series A', 3),
('company_stage', 'Series B+', 4),
('company_stage', 'Public Company', 5),
('company_stage', 'Not applicable', 6),

-- Budget Ranges
('budget_range', '$100-300', 1),
('budget_range', '$300-500', 2),
('budget_range', '$500-800', 3),
('budget_range', '$800-1200', 4),
('budget_range', '$1200-2000', 5),
('budget_range', '$2000-3000', 6),
('budget_range', '$3000+', 7)

ON CONFLICT (category_type, name) DO NOTHING;

-- Function to create a bounty from search parameters
CREATE OR REPLACE FUNCTION create_bounty_from_search(
  p_posted_by uuid,
  p_title text,
  p_description text,
  p_service_type text,
  p_deliverable_format text,
  p_timeline text,
  p_industry text,
  p_time_estimate text,
  p_company_stage text,
  p_budget_range text DEFAULT NULL,
  p_requirements text DEFAULT NULL
)
RETURNS uuid
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  new_bounty_id uuid;
BEGIN
  INSERT INTO work_bounties (
    posted_by,
    title,
    description,
    service_type,
    deliverable_format,
    timeline,
    industry,
    time_estimate,
    company_stage,
    budget_range,
    requirements,
    location
  ) VALUES (
    p_posted_by,
    p_title,
    p_description,
    p_service_type,
    p_deliverable_format,
    p_timeline,
    p_industry,
    p_time_estimate,
    p_company_stage,
    p_budget_range,
    p_requirements,
    'Remote'
  ) RETURNING id INTO new_bounty_id;

  RETURN new_bounty_id;
END;
$$;

-- Grant execute permission to authenticated users
GRANT EXECUTE ON FUNCTION create_bounty_from_search(uuid, text, text, text, text, text, text, text, text, text, text) TO authenticated;