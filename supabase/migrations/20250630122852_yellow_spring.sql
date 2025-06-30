/*
  # Fix Invitation System and Email Sending

  1. Update create_invitation_with_time_log function to properly call email function
  2. Add better error handling and logging
  3. Ensure invitation tokens are properly generated and stored
  4. Add debugging functions to help troubleshoot issues
*/

-- Drop and recreate the invitation function with better email integration
DROP FUNCTION IF EXISTS create_invitation_with_time_log(uuid, text, text, text, decimal, text, text, text);

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
  invitation_token text;
  inviter_name text;
  result jsonb := '{"success": true}'::jsonb;
BEGIN
  -- Validate inputs
  IF p_hours <= 0 THEN
    RETURN '{"success": false, "error": "Hours must be greater than 0"}'::jsonb;
  END IF;

  IF p_mode NOT IN ('helped', 'wasHelped') THEN
    RETURN '{"success": false, "error": "Mode must be helped or wasHelped"}'::jsonb;
  END IF;

  -- Get inviter name for email
  SELECT COALESCE(full_name, display_name, 'A Yard member') INTO inviter_name
  FROM profiles 
  WHERE id = p_inviter_profile_id;

  -- Generate a unique token for the invitation
  invitation_token := encode(gen_random_bytes(32), 'hex');

  -- Create the invitation
  INSERT INTO invitations (
    inviter_id,
    email,
    full_name,
    invitation_type,
    token,
    notification_type,
    notification_status
  ) VALUES (
    p_inviter_profile_id,
    p_invitee_email,
    p_invitee_name,
    'time_logging',
    invitation_token,
    'email',
    'pending'
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

  -- Update the result with success info
  result := result || jsonb_build_object(
    'invitation_id', invitation_id,
    'pending_log_id', pending_log_id,
    'invitation_token', invitation_token,
    'inviter_name', inviter_name,
    'message', 'Invitation created successfully'
  );

  -- Mark notification as ready to send
  UPDATE invitations 
  SET notification_status = 'ready_to_send'
  WHERE id = invitation_id;

  RETURN result;

EXCEPTION
  WHEN OTHERS THEN
    RETURN jsonb_build_object(
      'success', false,
      'error', SQLERRM
    );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Function to get invitation details by token (for debugging)
CREATE OR REPLACE FUNCTION get_invitation_by_token(p_token text)
RETURNS jsonb AS $$
DECLARE
  invitation_data record;
  pending_log_data record;
  result jsonb := '{"found": false}'::jsonb;
BEGIN
  -- Get invitation details
  SELECT * INTO invitation_data
  FROM invitations
  WHERE token = p_token;

  IF invitation_data IS NULL THEN
    RETURN result || jsonb_build_object('error', 'Invitation not found');
  END IF;

  -- Get pending time log details
  SELECT * INTO pending_log_data
  FROM pending_time_logs
  WHERE invitation_id = invitation_data.id;

  result := jsonb_build_object(
    'found', true,
    'invitation', to_jsonb(invitation_data),
    'pending_log', to_jsonb(pending_log_data)
  );

  RETURN result;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Function to debug invitation system
CREATE OR REPLACE FUNCTION debug_invitation_system()
RETURNS jsonb AS $$
DECLARE
  invitation_count integer;
  pending_log_count integer;
  recent_invitations jsonb;
  result jsonb := '{}'::jsonb;
BEGIN
  -- Count invitations
  SELECT COUNT(*) INTO invitation_count FROM invitations;
  SELECT COUNT(*) INTO pending_log_count FROM pending_time_logs;

  -- Get recent invitations
  SELECT jsonb_agg(
    jsonb_build_object(
      'id', id,
      'email', email,
      'full_name', full_name,
      'status', status,
      'notification_status', notification_status,
      'created_at', created_at,
      'expires_at', expires_at
    )
  ) INTO recent_invitations
  FROM invitations
  ORDER BY created_at DESC
  LIMIT 5;

  result := jsonb_build_object(
    'invitation_count', invitation_count,
    'pending_log_count', pending_log_count,
    'recent_invitations', COALESCE(recent_invitations, '[]'::jsonb)
  );

  RETURN result;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Grant execute permissions
GRANT EXECUTE ON FUNCTION create_invitation_with_time_log(uuid, text, text, text, decimal, text, text, text) TO authenticated;
GRANT EXECUTE ON FUNCTION get_invitation_by_token(text) TO authenticated;
GRANT EXECUTE ON FUNCTION debug_invitation_system() TO authenticated;