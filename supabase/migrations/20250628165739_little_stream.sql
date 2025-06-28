-- Add nudge tracking to time_transactions table
ALTER TABLE time_transactions ADD COLUMN IF NOT EXISTS last_nudged_at timestamptz;
ALTER TABLE time_transactions ADD COLUMN IF NOT EXISTS nudge_count integer DEFAULT 0;

-- Create index for nudge tracking
CREATE INDEX IF NOT EXISTS idx_time_transactions_nudged ON time_transactions(last_nudged_at);

-- Drop the existing function first to avoid return type conflicts
DROP FUNCTION IF EXISTS get_pending_time_transactions(uuid);

-- Create the updated get_pending_time_transactions function to show for both parties
CREATE OR REPLACE FUNCTION get_pending_time_transactions(p_user_id uuid)
RETURNS TABLE(
  transaction_id uuid,
  other_person_name text,
  hours decimal,
  description text,
  mode text,
  created_at timestamptz,
  is_giver boolean,
  is_logger boolean,
  can_confirm boolean,
  can_nudge boolean,
  last_nudged_at timestamptz,
  nudge_count integer
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
    tt.giver_id = user_profile_id as is_giver,
    tt.logged_by = user_profile_id as is_logger,
    -- Can confirm if you're involved but didn't log it
    (tt.giver_id = user_profile_id OR tt.receiver_id = user_profile_id) 
    AND tt.logged_by != user_profile_id as can_confirm,
    -- Can nudge if you logged it
    tt.logged_by = user_profile_id as can_nudge,
    tt.last_nudged_at,
    tt.nudge_count
  FROM time_transactions tt
  JOIN profiles giver_profile ON tt.giver_id = giver_profile.id
  JOIN profiles receiver_profile ON tt.receiver_id = receiver_profile.id
  WHERE (tt.giver_id = user_profile_id OR tt.receiver_id = user_profile_id)
  AND tt.status = 'pending'
  ORDER BY tt.created_at DESC;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Function to send a nudge for a pending transaction
CREATE OR REPLACE FUNCTION nudge_time_transaction(
  p_transaction_id uuid,
  p_user_id uuid
) RETURNS jsonb AS $$
DECLARE
  transaction_record record;
  user_profile_id uuid;
  other_person_name text;
  result jsonb := '{"success": true}'::jsonb;
BEGIN
  -- Get user's profile ID
  SELECT id INTO user_profile_id 
  FROM profiles 
  WHERE user_id = p_user_id;

  IF user_profile_id IS NULL THEN
    RETURN '{"success": false, "error": "Profile not found"}'::jsonb;
  END IF;

  -- Get transaction details and verify user can nudge
  SELECT tt.*, 
         CASE 
           WHEN tt.giver_id = user_profile_id THEN receiver_profile.full_name
           ELSE giver_profile.full_name
         END as other_person_name
  INTO transaction_record
  FROM time_transactions tt
  JOIN profiles giver_profile ON tt.giver_id = giver_profile.id
  JOIN profiles receiver_profile ON tt.receiver_id = receiver_profile.id
  WHERE tt.id = p_transaction_id
  AND tt.logged_by = user_profile_id  -- Only the logger can nudge
  AND tt.status = 'pending';

  IF transaction_record IS NULL THEN
    RETURN '{"success": false, "error": "Transaction not found or you cannot nudge this transaction"}'::jsonb;
  END IF;

  -- Check if enough time has passed since last nudge (at least 1 hour)
  IF transaction_record.last_nudged_at IS NOT NULL 
     AND transaction_record.last_nudged_at > (now() - interval '1 hour') THEN
    RETURN '{"success": false, "error": "Please wait at least 1 hour between nudges"}'::jsonb;
  END IF;

  -- Update nudge tracking
  UPDATE time_transactions 
  SET 
    last_nudged_at = now(),
    nudge_count = COALESCE(nudge_count, 0) + 1,
    updated_at = now()
  WHERE id = p_transaction_id;

  -- Create a nudge notification
  INSERT INTO transaction_notifications (
    transaction_id,
    recipient_id,
    notification_type,
    title,
    message
  ) VALUES (
    p_transaction_id,
    CASE 
      WHEN transaction_record.giver_id = user_profile_id THEN transaction_record.receiver_id
      ELSE transaction_record.giver_id
    END,
    'time_nudge',
    'Reminder: Time confirmation needed',
    (SELECT full_name FROM profiles WHERE id = user_profile_id) || 
    ' sent a friendly reminder about the ' || transaction_record.hours || ' hour' ||
    CASE WHEN transaction_record.hours != 1 THEN 's' ELSE '' END ||
    ' time transaction that needs your confirmation'
  );

  result := result || jsonb_build_object(
    'message', 'Nudge sent successfully',
    'nudge_count', COALESCE(transaction_record.nudge_count, 0) + 1
  );

  RETURN result;

EXCEPTION
  WHEN OTHERS THEN
    RETURN jsonb_build_object(
      'success', false,
      'error', SQLERRM
    );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Grant execute permission
GRANT EXECUTE ON FUNCTION nudge_time_transaction(uuid, uuid) TO authenticated;