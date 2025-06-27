/*
  # Yard Platform Database Schema

  1. New Tables
    - `profiles` - User profiles with basic info and settings
    - `profile_urls` - URLs provided by users (GitHub, portfolio, etc.)
    - `work_samples` - Scraped work samples from user URLs
    - `connections` - Network connections between users
    - `time_transactions` - Time logging and exchange records
    - `transaction_notifications` - Notifications for time transaction events
    - `skills` - User skills and expertise areas
    - `profile_skills` - Junction table linking profiles to skills
    - `search_queries` - User search history for analytics

  2. Security
    - Enable RLS on all tables
    - Add policies for authenticated users to manage their own data
    - Add policies for viewing public profile information
    - Add policies for connection-based data access

  3. Features
    - Full-text search capabilities
    - Network distance calculation support
    - Time balance tracking
    - Notification system
    - Profile building from external URLs
*/

-- Enable necessary extensions
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";
CREATE EXTENSION IF NOT EXISTS "pg_trgm";

-- Profiles table - Core user information
CREATE TABLE IF NOT EXISTS profiles (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid REFERENCES auth.users(id) ON DELETE CASCADE UNIQUE NOT NULL,
  email text NOT NULL,
  full_name text,
  display_name text,
  bio text,
  location text,
  timezone text,
  avatar_url text,
  is_available_for_work boolean DEFAULT true,
  hourly_rate_range text, -- e.g., "$100-200/hour"
  preferred_work_types text[], -- e.g., ["consulting", "mentoring", "code_review"]
  time_balance_hours decimal(10,2) DEFAULT 0.0, -- Net time balance (positive = owed time, negative = owes time)
  profile_completion_score integer DEFAULT 0, -- 0-100 based on profile completeness
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

-- Profile URLs - External links provided by users
CREATE TABLE IF NOT EXISTS profile_urls (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  profile_id uuid REFERENCES profiles(id) ON DELETE CASCADE NOT NULL,
  url text NOT NULL,
  url_type text NOT NULL, -- 'github', 'portfolio', 'linkedin', 'twitter', 'website', 'article', 'presentation'
  title text, -- Scraped or user-provided title
  description text, -- Scraped or user-provided description
  is_verified boolean DEFAULT false, -- Whether we've successfully scraped data
  scrape_status text DEFAULT 'pending', -- 'pending', 'success', 'failed', 'processing'
  scraped_at timestamptz,
  created_at timestamptz DEFAULT now()
);

-- Work samples - Scraped content from profile URLs
CREATE TABLE IF NOT EXISTS work_samples (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  profile_id uuid REFERENCES profiles(id) ON DELETE CASCADE NOT NULL,
  profile_url_id uuid REFERENCES profile_urls(id) ON DELETE CASCADE,
  title text NOT NULL,
  description text,
  sample_type text NOT NULL, -- 'github_repo', 'article', 'presentation', 'portfolio_project', 'case_study'
  url text,
  image_url text, -- Screenshot or preview image
  metrics jsonb, -- Stars, views, downloads, etc.
  tags text[], -- Extracted skills/technologies
  date_created timestamptz,
  is_featured boolean DEFAULT false,
  display_order integer DEFAULT 0,
  created_at timestamptz DEFAULT now()
);

-- Skills - Master list of skills/expertise areas
CREATE TABLE IF NOT EXISTS skills (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name text UNIQUE NOT NULL,
  category text, -- 'technical', 'design', 'business', 'legal', 'marketing', etc.
  description text,
  created_at timestamptz DEFAULT now()
);

-- Profile skills - Junction table for user skills
CREATE TABLE IF NOT EXISTS profile_skills (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  profile_id uuid REFERENCES profiles(id) ON DELETE CASCADE NOT NULL,
  skill_id uuid REFERENCES skills(id) ON DELETE CASCADE NOT NULL,
  proficiency_level text DEFAULT 'intermediate', -- 'beginner', 'intermediate', 'advanced', 'expert'
  years_experience integer,
  is_primary boolean DEFAULT false, -- Top skills for search ranking
  created_at timestamptz DEFAULT now(),
  UNIQUE(profile_id, skill_id)
);

-- Connections - Network relationships between users
CREATE TABLE IF NOT EXISTS connections (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  requester_id uuid REFERENCES profiles(id) ON DELETE CASCADE NOT NULL,
  recipient_id uuid REFERENCES profiles(id) ON DELETE CASCADE NOT NULL,
  status text DEFAULT 'pending', -- 'pending', 'accepted', 'declined', 'blocked'
  connection_source text, -- 'direct_request', 'imported_contact', 'mutual_connection', 'platform_suggestion'
  mutual_connections_count integer DEFAULT 0,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now(),
  UNIQUE(requester_id, recipient_id),
  CHECK (requester_id != recipient_id)
);

-- Time transactions - Core time logging and exchange system
CREATE TABLE IF NOT EXISTS time_transactions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  giver_id uuid REFERENCES profiles(id) ON DELETE CASCADE NOT NULL, -- Person who provided the service
  receiver_id uuid REFERENCES profiles(id) ON DELETE CASCADE NOT NULL, -- Person who received the service
  hours decimal(5,2) NOT NULL CHECK (hours > 0),
  description text,
  service_type text, -- 'code_review', 'design_critique', 'consultation', 'mentoring', etc.
  status text DEFAULT 'pending', -- 'pending', 'confirmed', 'disputed', 'cancelled'
  logged_by uuid REFERENCES profiles(id) NOT NULL, -- Who initiated the log
  confirmed_at timestamptz,
  confirmed_by uuid REFERENCES profiles(id),
  disputed_at timestamptz,
  dispute_reason text,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now(),
  CHECK (giver_id != receiver_id)
);

-- Transaction notifications - Notification system for time transactions
CREATE TABLE IF NOT EXISTS transaction_notifications (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  transaction_id uuid REFERENCES time_transactions(id) ON DELETE CASCADE NOT NULL,
  recipient_id uuid REFERENCES profiles(id) ON DELETE CASCADE NOT NULL,
  notification_type text NOT NULL, -- 'time_logged', 'time_confirmed', 'time_disputed', 'reminder'
  title text NOT NULL,
  message text NOT NULL,
  is_read boolean DEFAULT false,
  read_at timestamptz,
  created_at timestamptz DEFAULT now()
);

-- Search queries - Track user searches for analytics and recommendations
CREATE TABLE IF NOT EXISTS search_queries (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid REFERENCES auth.users(id) ON DELETE CASCADE,
  query_text text NOT NULL,
  filters jsonb, -- Service type, timeline, industry, etc.
  results_count integer,
  clicked_profile_id uuid REFERENCES profiles(id),
  created_at timestamptz DEFAULT now()
);

-- Enable Row Level Security
ALTER TABLE profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE profile_urls ENABLE ROW LEVEL SECURITY;
ALTER TABLE work_samples ENABLE ROW LEVEL SECURITY;
ALTER TABLE skills ENABLE ROW LEVEL SECURITY;
ALTER TABLE profile_skills ENABLE ROW LEVEL SECURITY;
ALTER TABLE connections ENABLE ROW LEVEL SECURITY;
ALTER TABLE time_transactions ENABLE ROW LEVEL SECURITY;
ALTER TABLE transaction_notifications ENABLE ROW LEVEL SECURITY;
ALTER TABLE search_queries ENABLE ROW LEVEL SECURITY;

-- Profiles policies
CREATE POLICY "Users can read all public profiles"
  ON profiles
  FOR SELECT
  TO authenticated
  USING (true);

CREATE POLICY "Users can update their own profile"
  ON profiles
  FOR UPDATE
  TO authenticated
  USING (auth.uid() = user_id);

CREATE POLICY "Users can insert their own profile"
  ON profiles
  FOR INSERT
  TO authenticated
  WITH CHECK (auth.uid() = user_id);

-- Profile URLs policies
CREATE POLICY "Users can manage their own profile URLs"
  ON profile_urls
  FOR ALL
  TO authenticated
  USING (
    profile_id IN (
      SELECT id FROM profiles WHERE user_id = auth.uid()
    )
  );

CREATE POLICY "Users can view profile URLs of connected users"
  ON profile_urls
  FOR SELECT
  TO authenticated
  USING (
    profile_id IN (
      SELECT p.id FROM profiles p
      JOIN connections c ON (
        (c.requester_id = p.id OR c.recipient_id = p.id) 
        AND c.status = 'accepted'
        AND (c.requester_id IN (SELECT id FROM profiles WHERE user_id = auth.uid())
             OR c.recipient_id IN (SELECT id FROM profiles WHERE user_id = auth.uid()))
      )
    )
  );

-- Work samples policies
CREATE POLICY "Users can manage their own work samples"
  ON work_samples
  FOR ALL
  TO authenticated
  USING (
    profile_id IN (
      SELECT id FROM profiles WHERE user_id = auth.uid()
    )
  );

CREATE POLICY "Users can view public work samples"
  ON work_samples
  FOR SELECT
  TO authenticated
  USING (true);

-- Skills policies
CREATE POLICY "Anyone can read skills"
  ON skills
  FOR SELECT
  TO authenticated
  USING (true);

-- Profile skills policies
CREATE POLICY "Users can manage their own profile skills"
  ON profile_skills
  FOR ALL
  TO authenticated
  USING (
    profile_id IN (
      SELECT id FROM profiles WHERE user_id = auth.uid()
    )
  );

CREATE POLICY "Users can view all profile skills"
  ON profile_skills
  FOR SELECT
  TO authenticated
  USING (true);

-- Connections policies
CREATE POLICY "Users can view their own connections"
  ON connections
  FOR SELECT
  TO authenticated
  USING (
    requester_id IN (SELECT id FROM profiles WHERE user_id = auth.uid())
    OR recipient_id IN (SELECT id FROM profiles WHERE user_id = auth.uid())
  );

CREATE POLICY "Users can create connection requests"
  ON connections
  FOR INSERT
  TO authenticated
  WITH CHECK (
    requester_id IN (SELECT id FROM profiles WHERE user_id = auth.uid())
  );

CREATE POLICY "Users can update connections they're involved in"
  ON connections
  FOR UPDATE
  TO authenticated
  USING (
    requester_id IN (SELECT id FROM profiles WHERE user_id = auth.uid())
    OR recipient_id IN (SELECT id FROM profiles WHERE user_id = auth.uid())
  );

-- Time transactions policies
CREATE POLICY "Users can view their own time transactions"
  ON time_transactions
  FOR SELECT
  TO authenticated
  USING (
    giver_id IN (SELECT id FROM profiles WHERE user_id = auth.uid())
    OR receiver_id IN (SELECT id FROM profiles WHERE user_id = auth.uid())
  );

CREATE POLICY "Users can create time transactions they're involved in"
  ON time_transactions
  FOR INSERT
  TO authenticated
  WITH CHECK (
    logged_by IN (SELECT id FROM profiles WHERE user_id = auth.uid())
    AND (
      giver_id IN (SELECT id FROM profiles WHERE user_id = auth.uid())
      OR receiver_id IN (SELECT id FROM profiles WHERE user_id = auth.uid())
    )
  );

CREATE POLICY "Users can update time transactions they're involved in"
  ON time_transactions
  FOR UPDATE
  TO authenticated
  USING (
    giver_id IN (SELECT id FROM profiles WHERE user_id = auth.uid())
    OR receiver_id IN (SELECT id FROM profiles WHERE user_id = auth.uid())
  );

-- Transaction notifications policies
CREATE POLICY "Users can view their own notifications"
  ON transaction_notifications
  FOR SELECT
  TO authenticated
  USING (
    recipient_id IN (SELECT id FROM profiles WHERE user_id = auth.uid())
  );

CREATE POLICY "Users can update their own notifications"
  ON transaction_notifications
  FOR UPDATE
  TO authenticated
  USING (
    recipient_id IN (SELECT id FROM profiles WHERE user_id = auth.uid())
  );

-- Search queries policies
CREATE POLICY "Users can manage their own search queries"
  ON search_queries
  FOR ALL
  TO authenticated
  USING (auth.uid() = user_id);

-- Indexes for performance
CREATE INDEX IF NOT EXISTS idx_profiles_user_id ON profiles(user_id);
CREATE INDEX IF NOT EXISTS idx_profiles_time_balance ON profiles(time_balance_hours);
CREATE INDEX IF NOT EXISTS idx_profiles_availability ON profiles(is_available_for_work);

CREATE INDEX IF NOT EXISTS idx_profile_urls_profile_id ON profile_urls(profile_id);
CREATE INDEX IF NOT EXISTS idx_profile_urls_type ON profile_urls(url_type);

CREATE INDEX IF NOT EXISTS idx_work_samples_profile_id ON work_samples(profile_id);
CREATE INDEX IF NOT EXISTS idx_work_samples_type ON work_samples(sample_type);
CREATE INDEX IF NOT EXISTS idx_work_samples_featured ON work_samples(is_featured);

CREATE INDEX IF NOT EXISTS idx_skills_name ON skills(name);
CREATE INDEX IF NOT EXISTS idx_skills_category ON skills(category);

CREATE INDEX IF NOT EXISTS idx_profile_skills_profile_id ON profile_skills(profile_id);
CREATE INDEX IF NOT EXISTS idx_profile_skills_skill_id ON profile_skills(skill_id);
CREATE INDEX IF NOT EXISTS idx_profile_skills_primary ON profile_skills(is_primary);

CREATE INDEX IF NOT EXISTS idx_connections_requester ON connections(requester_id);
CREATE INDEX IF NOT EXISTS idx_connections_recipient ON connections(recipient_id);
CREATE INDEX IF NOT EXISTS idx_connections_status ON connections(status);

CREATE INDEX IF NOT EXISTS idx_time_transactions_giver ON time_transactions(giver_id);
CREATE INDEX IF NOT EXISTS idx_time_transactions_receiver ON time_transactions(receiver_id);
CREATE INDEX IF NOT EXISTS idx_time_transactions_status ON time_transactions(status);
CREATE INDEX IF NOT EXISTS idx_time_transactions_created ON time_transactions(created_at);

CREATE INDEX IF NOT EXISTS idx_transaction_notifications_recipient ON transaction_notifications(recipient_id);
CREATE INDEX IF NOT EXISTS idx_transaction_notifications_read ON transaction_notifications(is_read);

CREATE INDEX IF NOT EXISTS idx_search_queries_user ON search_queries(user_id);
CREATE INDEX IF NOT EXISTS idx_search_queries_created ON search_queries(created_at);

-- Full-text search indexes
CREATE INDEX IF NOT EXISTS idx_profiles_search ON profiles USING gin(
  to_tsvector('english', coalesce(full_name, '') || ' ' || coalesce(bio, '') || ' ' || coalesce(display_name, ''))
);

CREATE INDEX IF NOT EXISTS idx_work_samples_search ON work_samples USING gin(
  to_tsvector('english', coalesce(title, '') || ' ' || coalesce(description, '') || ' ' || array_to_string(tags, ' '))
);

-- Functions for time balance updates
CREATE OR REPLACE FUNCTION update_time_balances()
RETURNS TRIGGER AS $$
BEGIN
  -- When a transaction is confirmed, update both users' time balances
  IF NEW.status = 'confirmed' AND OLD.status != 'confirmed' THEN
    -- Giver gets positive balance (they are owed time)
    UPDATE profiles 
    SET time_balance_hours = time_balance_hours + NEW.hours,
        updated_at = now()
    WHERE id = NEW.giver_id;
    
    -- Receiver gets negative balance (they owe time)
    UPDATE profiles 
    SET time_balance_hours = time_balance_hours - NEW.hours,
        updated_at = now()
    WHERE id = NEW.receiver_id;
  END IF;
  
  -- When a transaction is cancelled/disputed, reverse the balance changes
  IF (NEW.status = 'cancelled' OR NEW.status = 'disputed') AND OLD.status = 'confirmed' THEN
    -- Reverse the balance changes
    UPDATE profiles 
    SET time_balance_hours = time_balance_hours - NEW.hours,
        updated_at = now()
    WHERE id = NEW.giver_id;
    
    UPDATE profiles 
    SET time_balance_hours = time_balance_hours + NEW.hours,
        updated_at = now()
    WHERE id = NEW.receiver_id;
  END IF;
  
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Trigger for automatic time balance updates
CREATE TRIGGER trigger_update_time_balances
  AFTER UPDATE ON time_transactions
  FOR EACH ROW
  EXECUTE FUNCTION update_time_balances();

-- Function to create notifications for time transactions
CREATE OR REPLACE FUNCTION create_transaction_notification()
RETURNS TRIGGER AS $$
BEGIN
  -- Create notification when time is logged
  IF TG_OP = 'INSERT' THEN
    INSERT INTO transaction_notifications (
      transaction_id,
      recipient_id,
      notification_type,
      title,
      message
    ) VALUES (
      NEW.id,
      CASE 
        WHEN NEW.logged_by = NEW.giver_id THEN NEW.receiver_id
        ELSE NEW.giver_id
      END,
      'time_logged',
      'Time logged for your review',
      CASE 
        WHEN NEW.logged_by = NEW.giver_id THEN 
          (SELECT full_name FROM profiles WHERE id = NEW.giver_id) || ' logged ' || NEW.hours || ' hours of time helping you'
        ELSE 
          (SELECT full_name FROM profiles WHERE id = NEW.receiver_id) || ' logged ' || NEW.hours || ' hours of time you spent helping them'
      END
    );
  END IF;
  
  -- Create notification when time is confirmed
  IF TG_OP = 'UPDATE' AND NEW.status = 'confirmed' AND OLD.status != 'confirmed' THEN
    INSERT INTO transaction_notifications (
      transaction_id,
      recipient_id,
      notification_type,
      title,
      message
    ) VALUES (
      NEW.id,
      CASE 
        WHEN NEW.confirmed_by = NEW.giver_id THEN NEW.receiver_id
        ELSE NEW.giver_id
      END,
      'time_confirmed',
      'Time transaction confirmed',
      'Your ' || NEW.hours || ' hour time transaction has been confirmed'
    );
  END IF;
  
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Triggers for automatic notification creation
CREATE TRIGGER trigger_create_transaction_notification_insert
  AFTER INSERT ON time_transactions
  FOR EACH ROW
  EXECUTE FUNCTION create_transaction_notification();

CREATE TRIGGER trigger_create_transaction_notification_update
  AFTER UPDATE ON time_transactions
  FOR EACH ROW
  EXECUTE FUNCTION create_transaction_notification();

-- Insert some initial skills
INSERT INTO skills (name, category) VALUES
  ('JavaScript', 'technical'),
  ('React', 'technical'),
  ('Node.js', 'technical'),
  ('Python', 'technical'),
  ('UI/UX Design', 'design'),
  ('Product Strategy', 'business'),
  ('Legal Review', 'legal'),
  ('Marketing Strategy', 'marketing'),
  ('Data Analysis', 'technical'),
  ('Fundraising', 'business'),
  ('Code Review', 'technical'),
  ('Design Critique', 'design'),
  ('Business Development', 'business'),
  ('Content Writing', 'marketing'),
  ('SEO', 'marketing')
ON CONFLICT (name) DO NOTHING;