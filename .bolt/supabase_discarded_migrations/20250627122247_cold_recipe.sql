/*
  # Add invitation system for non-users

  1. New Tables
    - `invitations`
      - `id` (uuid, primary key)
      - `inviter_id` (uuid, references profiles)
      - `email` (text, invitee email)
      - `phone` (text, optional invitee phone)
      - `full_name` (text, invitee name)
      - `invitation_type` (text, type of invitation)
      - `status` (text, pending/accepted/expired)
      - `token` (text, unique invitation token)
      - `expires_at` (timestamp)
      - `accepted_at` (timestamp)
      - `created_at` (timestamp)

    - `pending_time_logs`
      - `id` (uuid, primary key)
      - `invitation_id` (uuid, references invitations)
      - `logger_profile_id` (uuid, references profiles)
      - `invitee_email` (text)
      - `invitee_name` (text)
      - `hours` (decimal)
      - `description` (text)
      - `service_type` (text)
      - `mode` (text, helped/wasHelped)
      - `status` (text, pending/converted/expired)
      - `converted_transaction_id` (uuid, references time_transactions)
      - `created_at` (timestamp)

  2. Security
    - Enable RLS on both tables
    - Add policies for users to manage their own invitations and pending logs
    - Add policies for invited users to view relevant data

  3. Functions
    - Function to create invitation with token generation
    - Function to convert pending time log to actual transaction when user signs up
</sql>

-- Invitations table - Track invites sent to non-users
CREATE TABLE IF NOT EXISTS invitations (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  inviter_id uuid REFERENCES profiles(id) ON DELETE CASCADE NOT NULL,
  email text NOT NULL,
  phone text,
  full_name text NOT NULL,
  invitation_type text NOT NULL DEFAULT 'time_logging', -- 'time_logging', 'connection', 'general'
  status text DEFAULT 'pending', -- 'pending', 'accepted', 'expired', 'cancelled'
  token text UNIQUE NOT NULL DEFAULT encode(gen_random_bytes(32), 'hex'),
  expires_at timestamptz DEFAULT (now() + interval '7 days'),
  accepted_at timestamptz,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

-- Pending time logs - Store time logs for non-users until they sign up
CREATE TABLE IF NOT EXISTS pending_time_logs (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  invitation_id uuid REFERENCES invitations(id) ON DELETE CASCADE,
  logger_profile_id uuid REFERENCES profiles(id) ON DELETE CASCADE NOT NULL,
  invitee_email text NOT NULL,
  invitee_name text NOT NULL,
  invitee_contact text, -- email or phone
  hours decimal(5,2) NOT NULL CHECK (hours > 0),
  description text,
  service_type text,
  mode text NOT NULL CHECK (mode IN ('helped', 'wasHelped')), -- 'helped' = logger helped invitee, 'wasHelped' = invitee helped logger
  status text DEFAULT 'pending', -- 'pending', 'converted', 'expired', 'cancelled'
  converted_transaction_id uuid REFERENCES time_transactions(id),
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

-- Enable Row Level Security
ALTER TABLE invitations ENABLE ROW LEVEL SECURITY;
ALTER TABLE pending_time_logs ENABLE ROW LEVEL SECURITY;

-- Invitations policies
CREATE POLICY "Users can view invitations they sent"
  ON invitations
  FOR SELECT
  TO authenticated
  USING (
    inviter_id IN (SELECT id FROM profiles WHERE user_id = auth.uid())
  );

CREATE POLICY "Users can create invitations"
  ON invitations
  FOR INSERT
  TO authenticated
  WITH CHECK (
    inviter_id IN (SELECT id FROM profiles WHERE user_id = auth.uid())
  );

CREATE POLICY "Users can update their own invitations"
  ON invitations
  FOR UPDATE
  TO authenticated
  USING (
    inviter_id IN (SELECT id FROM profiles WHERE user_id = auth.uid())
  );

CREATE POLICY "Invited users can view their invitations by token"
  ON invitations
  FOR SELECT
  TO authenticated
  USING (
    email = (SELECT email FROM auth.users WHERE id = auth.uid())
    OR email IN (SELECT email FROM profiles WHERE user_id = auth.uid())
  );

-- Pending time logs policies
CREATE POLICY "Users can view their own pending time logs"
  ON pending_time_logs
  FOR SELECT
  TO authenticated
  USING (
    logger_profile_id IN (SELECT id FROM profiles WHERE user_id = auth.uid())
  );

CREATE POLICY "Users can create pending time logs"
  ON pending_time_logs
  FOR INSERT
  TO authenticated
  WITH CHECK (
    logger_profile_id IN (SELECT id FROM profiles WHERE user_id = auth.uid())
  );

CREATE POLICY "Users can update their own pending time logs"
  ON pending_time_logs
  FOR UPDATE
  TO authenticated
  USING (
    logger_profile_id IN (SELECT id FROM profiles WHERE user_id = auth.uid())
  );

CREATE POLICY "Invited users can view pending logs for their email"
  ON pending_time_logs
  FOR SELECT
  TO authenticated
  USING (
    invitee_email = (SELECT email FROM auth.users WHERE id = auth.uid())
    OR invitee_email IN (SELECT email FROM profiles WHERE user_id = auth.uid())
  );

-- Indexes for performance
CREATE INDEX IF NOT EXISTS idx_invitations_inviter ON invitations(inviter_id);
CREATE INDEX IF NOT EXISTS idx_invitations_email ON invitations(email);
CREATE INDEX IF NOT EXISTS idx_invitations_token ON invitations(token);
CREATE INDEX IF NOT EXISTS idx_invitations_status ON invitations(status);
CREATE INDEX IF NOT EXISTS idx_invitations_expires ON invitations(expires_at);

CREATE INDEX IF NOT EXISTS idx_pending_time_logs_logger ON pending_time_logs(logger_profile_id);
CREATE INDEX IF NOT EXISTS idx_pending_time_logs_email ON pending_time_logs(invitee_email);
CREATE INDEX IF NOT EXISTS idx_pending_time_logs_status ON pending_time_logs(status);
CREATE INDEX IF NOT EXISTS idx_pending_time_logs_invitation ON pending_time_logs(invitation_id);

-- Function to convert pending time logs to actual transactions when user signs up
CREATE OR REPLACE FUNCTION convert_pending_time_logs_on_signup()
RETURNS TRIGGER AS $$
DECLARE
  pending_log RECORD;
  new_transaction_id uuid;
  invitee_profile_id uuid;
BEGIN
  -- Get the profile ID for the new user
  SELECT id INTO invitee_profile_id 
  FROM profiles 
  WHERE user_id = NEW.id;

  -- Convert all pending time logs for this email
  FOR pending_log IN 
    SELECT * FROM pending_time_logs 
    WHERE invitee_email = NEW.email 
    AND status = 'pending'
  LOOP
    -- Create the actual time transaction
    INSERT INTO time_transactions (
      giver_id,
      receiver_id,
      hours,
      description,
      service_type,
      logged_by,
      status
    ) VALUES (
      CASE 
        WHEN pending_log.mode = 'helped' THEN pending_log.logger_profile_id
        ELSE invitee_profile_id
      END,
      CASE 
        WHEN pending_log.mode = 'helped' THEN invitee_profile_id
        ELSE pending_log.logger_profile_id
      END,
      pending_log.hours,
      pending_log.description,
      pending_log.service_type,
      pending_log.logger_profile_id,
      'pending'
    ) RETURNING id INTO new_transaction_id;

    -- Update the pending log to mark it as converted
    UPDATE pending_time_logs 
    SET 
      status = 'converted',
      converted_transaction_id = new_transaction_id,
      updated_at = now()
    WHERE id = pending_log.id;

    -- Mark related invitation as accepted if it exists
    UPDATE invitations 
    SET 
      status = 'accepted',
      accepted_at = now(),
      updated_at = now()
    WHERE id = pending_log.invitation_id;
  END LOOP;

  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Trigger to automatically convert pending time logs when user signs up
CREATE TRIGGER trigger_convert_pending_time_logs
  AFTER INSERT ON auth.users
  FOR EACH ROW
  EXECUTE FUNCTION convert_pending_time_logs_on_signup();

-- Function to create invitation and pending time log
CREATE OR REPLACE FUNCTION create_invitation_with_time_log(
  p_inviter_profile_id uuid,
  p_invitee_email text,
  p_invitee_name text,
  p_invitee_contact text,
  p_hours decimal,
  p_description text,
  p_service_type text,
  p_mode text
) RETURNS uuid AS $$
DECLARE
  invitation_id uuid;
  pending_log_id uuid;
BEGIN
  -- Create the invitation
  INSERT INTO invitations (
    inviter_id,
    email,
    full_name,
    invitation_type
  ) VALUES (
    p_inviter_profile_id,
    p_invitee_email,
    p_invitee_name,
    'time_logging'
  ) RETURNING id INTO invitation_id;

  -- Create the pending time log
  INSERT INTO pending_time_logs (
    invitation_id,
    logger_profile_id,
    invitee_email,
    invitee_name,
    invitee_contact,
    hours,
    description,
    service_type,
    mode
  ) VALUES (
    invitation_id,
    p_inviter_profile_id,
    p_invitee_email,
    p_invitee_name,
    p_invitee_contact,
    p_hours,
    p_description,
    p_service_type,
    p_mode
  ) RETURNING id INTO pending_log_id;

  RETURN invitation_id;
END;
$$ LANGUAGE plpgsql;

-- Function to clean up expired invitations and pending logs
CREATE OR REPLACE FUNCTION cleanup_expired_invitations()
RETURNS void AS $$
BEGIN
  -- Mark expired invitations
  UPDATE invitations 
  SET status = 'expired', updated_at = now()
  WHERE expires_at < now() AND status = 'pending';

  -- Mark related pending time logs as expired
  UPDATE pending_time_logs 
  SET status = 'expired', updated_at = now()
  WHERE invitation_id IN (
    SELECT id FROM invitations WHERE status = 'expired'
  ) AND status = 'pending';
END;
$$ LANGUAGE plpgsql;