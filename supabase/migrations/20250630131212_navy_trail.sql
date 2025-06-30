/*
  # Fix Invitation System and Time Activity Display

  1. Changes
    - Add function to get pending time log details for transactions
    - Fix the display of invitee names in the dashboard
    - Ensure proper data flow from invitations to time transactions

  2. New Functions
    - get_pending_time_log_by_transaction: Retrieves invitee name for transactions
    - get_transaction_participants: Gets detailed info about transaction participants
*/

-- Function to get pending time log details by transaction ID
CREATE OR REPLACE FUNCTION get_pending_time_log_by_transaction(p_transaction_id uuid)
RETURNS jsonb AS $$
DECLARE
  pending_log record;
  result jsonb;
BEGIN
  -- Get the pending time log that was converted to this transaction
  SELECT * INTO pending_log
  FROM pending_time_logs
  WHERE converted_transaction_id = p_transaction_id;
  
  IF pending_log IS NULL THEN
    RETURN jsonb_build_object('found', false);
  END IF;
  
  result := jsonb_build_object(
    'found', true,
    'invitee_name', pending_log.invitee_name,
    'invitee_email', pending_log.invitee_email,
    'hours', pending_log.hours,
    'description', pending_log.description,
    'mode', pending_log.mode
  );
  
  RETURN result;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Function to get transaction participants with fallback to pending logs
CREATE OR REPLACE FUNCTION get_transaction_participants(p_transaction_id uuid)
RETURNS jsonb AS $$
DECLARE
  transaction_data record;
  giver_data jsonb;
  receiver_data jsonb;
  pending_log_data jsonb;
  result jsonb;
BEGIN
  -- Get the transaction
  SELECT * INTO transaction_data
  FROM time_transactions
  WHERE id = p_transaction_id;
  
  IF transaction_data IS NULL THEN
    RETURN jsonb_build_object('found', false, 'error', 'Transaction not found');
  END IF;
  
  -- Get giver profile
  SELECT jsonb_build_object(
    'id', p.id,
    'full_name', p.full_name,
    'display_name', p.display_name
  ) INTO giver_data
  FROM profiles p
  WHERE p.id = transaction_data.giver_id;
  
  -- Get receiver profile
  SELECT jsonb_build_object(
    'id', p.id,
    'full_name', p.full_name,
    'display_name', p.display_name
  ) INTO receiver_data
  FROM profiles p
  WHERE p.id = transaction_data.receiver_id;
  
  -- If either participant is missing profile data, check pending logs
  IF (giver_data IS NULL OR receiver_data IS NULL) THEN
    SELECT get_pending_time_log_by_transaction(p_transaction_id) INTO pending_log_data;
    
    -- If we found a pending log, use its data to fill in missing participant
    IF pending_log_data->>'found' = 'true' THEN
      IF giver_data IS NULL AND pending_log_data->>'mode' = 'wasHelped' THEN
        -- The invitee was the giver
        giver_data := jsonb_build_object(
          'id', transaction_data.giver_id,
          'full_name', pending_log_data->>'invitee_name',
          'display_name', pending_log_data->>'invitee_name'
        );
      ELSIF receiver_data IS NULL AND pending_log_data->>'mode' = 'helped' THEN
        -- The invitee was the receiver
        receiver_data := jsonb_build_object(
          'id', transaction_data.receiver_id,
          'full_name', pending_log_data->>'invitee_name',
          'display_name', pending_log_data->>'invitee_name'
        );
      END IF;
    END IF;
  END IF;
  
  -- Build the final result
  result := jsonb_build_object(
    'found', true,
    'transaction_id', transaction_data.id,
    'giver', COALESCE(giver_data, jsonb_build_object('id', transaction_data.giver_id, 'full_name', 'Unknown User', 'display_name', 'Unknown')),
    'receiver', COALESCE(receiver_data, jsonb_build_object('id', transaction_data.receiver_id, 'full_name', 'Unknown User', 'display_name', 'Unknown')),
    'hours', transaction_data.hours,
    'description', transaction_data.description,
    'status', transaction_data.status,
    'created_at', transaction_data.created_at
  );
  
  RETURN result;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Grant execute permissions
GRANT EXECUTE ON FUNCTION get_pending_time_log_by_transaction(uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION get_transaction_participants(uuid) TO authenticated;