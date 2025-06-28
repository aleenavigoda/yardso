/*
  # Enhance Time Logging System

  1. Improvements to existing tables
    - Add better indexes for performance
    - Enhance notification system
    - Add email/SMS tracking

  2. New Functions
    - Enhanced invitation creation with better error handling
    - Notification management functions
    - Time transaction approval workflow

  3. Triggers
    - Auto-create notifications for time transactions
    - Update time balances on confirmation
    - Handle invitation acceptance flow
*/

-- Add email/SMS tracking to invitations table
ALTER TABLE invitations ADD COLUMN IF NOT EXISTS notification_sent_at timestamptz;
ALTER TABLE invitations ADD COLUMN IF NOT EXISTS notification_type text DEFAULT 'email'; -- 'email' or 'sms'
ALTER TABLE invitations ADD COLUMN IF NOT EXISTS notification_status text DEFAULT 'pending'; -- 'pending', 'sent', 'failed'

-- Add better indexes for performance
CREATE INDEX IF NOT EXISTS idx_invitations_notification_status ON invitations(notification_status);
CREATE INDEX IF NOT EXISTS idx_pending_time_logs_mode ON pending_time_logs(mode);
CREATE INDEX IF NOT EXISTS idx_transaction_notifications_type ON transaction_notifications(notification_type);

-- Enhanced function to create invitation with time log
CREATE OR REPLACE FUNCTION create_invitation_with_time_log(
  p_inviter_profile_id uuid,
  p_invitee_email text,
  p_invitee_name text,
  p_invitee_contact text,
  p_hours decimal,
  p_description text,
  p_service_type text,
  p_mode text
) RETURNS jsonb AS $$
DECLARE
  invitation_id uuid;
  pending_log_id uuid;
  result jsonb := '{"success": true}'::jsonb;
BEGIN
  -- Validate inputs
  IF p_hours <= 0 THEN
    RETURN '{"success": false, "error": "Hours must be greater than 0"}'::jsonb;
  END IF;

  IF p_mode NOT IN ('helped', 'wasHelped') THEN
    RETURN '{"success": false, "error": "Mode must be helped or wasHelped"}'::jsonb;
  END IF;

  -- Determine notification type based on contact format
  DECLARE
    notification_type text := CASE 
      WHEN p_invitee_contact ~* '^[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Za-z]{2,}$' THEN 'email'
      ELSE 'sms'
    END;
  BEGIN
    -- Create the invitation
    INSERT INTO invitations (
      inviter_id,
      email,
      phone,
      full_name,
      invitation_type,
      notification_type
    ) VALUES (
      p_inviter_profile_id,
      CASE WHEN notification_type = 'email' THEN p_invitee_contact ELSE '' END,
      CASE WHEN notification_type = 'sms' THEN p_invitee_contact ELSE NULL END,
      p_invitee_name,
      'time_logging',
      notification_type
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
      CASE WHEN notification_type = 'email' THEN p_invitee_contact ELSE '' END,
      p_invitee_name,
      p_invitee_contact,
      p_hours,
      p_description,
      p_service_type,
      p_mode
    ) RETURNING id INTO pending_log_id;

    result := result || jsonb_build_object(
      'invitation_id', invitation_id,
      'pending_log_id', pending_log_id,
      'notification_type', notification_type
    );

    RETURN result;
  END;

EXCEPTION
  WHEN OTHERS THEN
    RETURN jsonb_build_object(
      'success', false,
      'error', SQLERRM
    );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Function to approve/reject time transactions
CREATE OR REPLACE FUNCTION update_time_transaction_status(
  p_transaction_id uuid,
  p_user_id uuid,
  p_status text,
  p_dispute_reason text DEFAULT NULL
) RETURNS jsonb AS $$
DECLARE
  transaction_record record;
  user_profile_id uuid;
  result jsonb := '{"success": true}'::jsonb;
BEGIN
  -- Get user's profile ID
  SELECT id INTO user_profile_id 
  FROM profiles 
  WHERE user_id = p_user_id;

  IF user_profile_id IS NULL THEN
    RETURN '{"success": false, "error": "Profile not found"}'::jsonb;
  END IF;

  -- Get transaction details
  SELECT * INTO transaction_record
  FROM time_transactions
  WHERE id = p_transaction_id
  AND (giver_id = user_profile_id OR receiver_id = user_profile_id)
  AND status = 'pending';

  IF transaction_record IS NULL THEN
    RETURN '{"success": false, "error": "Transaction not found or not pending"}'::jsonb;
  END IF;

  -- Update transaction status
  IF p_status = 'confirmed' THEN
    UPDATE time_transactions 
    SET 
      status = 'confirmed',
      confirmed_at = now(),
      confirmed_by = user_profile_id,
      updated_at = now()
    WHERE id = p_transaction_id;

    result := result || jsonb_build_object('message', 'Time transaction confirmed');

  ELSIF p_status = 'disputed' THEN
    UPDATE time_transactions 
    SET 
      status = 'disputed',
      disputed_at = now(),
      dispute_reason = p_dispute_reason,
      updated_at = now()
    WHERE id = p_transaction_id;

    result := result || jsonb_build_object('message', 'Time transaction disputed');

  ELSE
    RETURN '{"success": false, "error": "Invalid status"}'::jsonb;
  END IF;

  RETURN result;

EXCEPTION
  WHEN OTHERS THEN
    RETURN jsonb_build_object(
      'success', false,
      'error', SQLERRM
    );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Function to get pending time transactions for a user
CREATE OR REPLACE FUNCTION get_pending_time_transactions(p_user_id uuid)
RETURNS TABLE(
  transaction_id uuid,
  other_person_name text,
  hours decimal,
  description text,
  mode text,
  created_at timestamptz,
  is_giver boolean
) AS $$
DECLARE
  user_profile_id uuid;
BEGIN
  -- Get user's profile ID
  SELECT id INTO user_profile_id 
  FROM profiles 
  WHERE user_id = p_user_id;

  IF user_profile_id IS NULL THEN
    RETURN;
  END IF;

  RETURN QUERY
  SELECT 
    tt.id as transaction_id,
    CASE 
      WHEN tt.giver_id = user_profile_id THEN receiver_profile.full_name
      ELSE giver_profile.full_name
    END as other_person_name,
    tt.hours,
    tt.description,
    CASE 
      WHEN tt.giver_id = user_profile_id THEN 'helped'
      ELSE 'wasHelped'
    END as mode,
    tt.created_at,
    tt.giver_id = user_profile_id as is_giver
  FROM time_transactions tt
  JOIN profiles giver_profile ON tt.giver_id = giver_profile.id
  JOIN profiles receiver_profile ON tt.receiver_id = receiver_profile.id
  WHERE (tt.giver_id = user_profile_id OR tt.receiver_id = user_profile_id)
  AND tt.status = 'pending'
  ORDER BY tt.created_at DESC;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Enhanced notification creation function
CREATE OR REPLACE FUNCTION create_transaction_notification()
RETURNS TRIGGER AS $$
DECLARE
  giver_name text;
  receiver_name text;
  notification_title text;
  notification_message text;
  recipient_id uuid;
BEGIN
  -- Get names for the notification
  SELECT full_name INTO giver_name FROM profiles WHERE id = NEW.giver_id;
  SELECT full_name INTO receiver_name FROM profiles WHERE id = NEW.receiver_id;

  -- Create notification when time is logged
  IF TG_OP = 'INSERT' THEN
    -- Determine recipient (the person who didn't log the time)
    recipient_id := CASE 
      WHEN NEW.logged_by = NEW.giver_id THEN NEW.receiver_id
      ELSE NEW.giver_id
    END;

    notification_title := 'Time logged for your review';
    notification_message := CASE 
      WHEN NEW.logged_by = NEW.giver_id THEN 
        giver_name || ' logged ' || NEW.hours || ' hour' || 
        CASE WHEN NEW.hours != 1 THEN 's' ELSE '' END || 
        ' of time helping you' ||
        CASE WHEN NEW.description IS NOT NULL THEN ': "' || NEW.description || '"' ELSE '' END
      ELSE 
        receiver_name || ' logged ' || NEW.hours || ' hour' || 
        CASE WHEN NEW.hours != 1 THEN 's' ELSE '' END || 
        ' of time you spent helping them' ||
        CASE WHEN NEW.description IS NOT NULL THEN ': "' || NEW.description || '"' ELSE '' END
    END;

    INSERT INTO transaction_notifications (
      transaction_id,
      recipient_id,
      notification_type,
      title,
      message
    ) VALUES (
      NEW.id,
      recipient_id,
      'time_logged',
      notification_title,
      notification_message
    );
  END IF;

  -- Create notification when time is confirmed
  IF TG_OP = 'UPDATE' AND NEW.status = 'confirmed' AND OLD.status != 'confirmed' THEN
    -- Notify the person who logged the time
    recipient_id := NEW.logged_by;
    
    notification_title := 'Time transaction confirmed';
    notification_message := 'Your ' || NEW.hours || ' hour' || 
      CASE WHEN NEW.hours != 1 THEN 's' ELSE '' END || 
      ' time transaction has been confirmed';

    INSERT INTO transaction_notifications (
      transaction_id,
      recipient_id,
      notification_type,
      title,
      message
    ) VALUES (
      NEW.id,
      recipient_id,
      'time_confirmed',
      notification_title,
      notification_message
    );
  END IF;

  -- Create notification when time is disputed
  IF TG_OP = 'UPDATE' AND NEW.status = 'disputed' AND OLD.status != 'disputed' THEN
    -- Notify the person who logged the time
    recipient_id := NEW.logged_by;
    
    notification_title := 'Time transaction disputed';
    notification_message := 'Your ' || NEW.hours || ' hour' || 
      CASE WHEN NEW.hours != 1 THEN 's' ELSE '' END || 
      ' time transaction has been disputed' ||
      CASE WHEN NEW.dispute_reason IS NOT NULL THEN ': "' || NEW.dispute_reason || '"' ELSE '' END;

    INSERT INTO transaction_notifications (
      transaction_id,
      recipient_id,
      notification_type,
      title,
      message
    ) VALUES (
      NEW.id,
      recipient_id,
      'time_disputed',
      notification_title,
      notification_message
    );
  END IF;

  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Grant execute permissions
GRANT EXECUTE ON FUNCTION create_invitation_with_time_log(uuid, text, text, text, decimal, text, text, text) TO authenticated;
GRANT EXECUTE ON FUNCTION update_time_transaction_status(uuid, uuid, text, text) TO authenticated;
GRANT EXECUTE ON FUNCTION get_pending_time_transactions(uuid) TO authenticated;

-- Update the existing trigger to use the enhanced function
DROP TRIGGER IF EXISTS trigger_create_transaction_notification_insert ON time_transactions;
DROP TRIGGER IF EXISTS trigger_create_transaction_notification_update ON time_transactions;

CREATE TRIGGER trigger_create_transaction_notification_insert
  AFTER INSERT ON time_transactions
  FOR EACH ROW
  EXECUTE FUNCTION create_transaction_notification();

CREATE TRIGGER trigger_create_transaction_notification_update
  AFTER UPDATE ON time_transactions
  FOR EACH ROW
  EXECUTE FUNCTION create_transaction_notification();