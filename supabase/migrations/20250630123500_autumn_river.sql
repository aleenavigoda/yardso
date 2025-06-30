-- Add debugging functions for the email invitation system

-- Function to test the complete invitation flow
CREATE OR REPLACE FUNCTION test_invitation_flow(
  p_inviter_email text,
  p_invitee_email text,
  p_invitee_name text
) RETURNS jsonb AS $$
DECLARE
  inviter_profile_id uuid;
  invitation_result jsonb;
  result jsonb := '{"test": "invitation_flow"}'::jsonb;
BEGIN
  -- Get inviter profile
  SELECT id INTO inviter_profile_id
  FROM profiles
  WHERE email = p_inviter_email;

  IF inviter_profile_id IS NULL THEN
    RETURN result || jsonb_build_object('error', 'Inviter profile not found');
  END IF;

  -- Create test invitation
  SELECT create_invitation_with_time_log(
    inviter_profile_id,
    p_invitee_email,
    p_invitee_name,
    p_invitee_email,
    2.0,
    'Test invitation',
    'general',
    'helped'
  ) INTO invitation_result;

  result := result || jsonb_build_object(
    'inviter_profile_id', inviter_profile_id,
    'invitation_result', invitation_result
  );

  -- Clean up test data
  DELETE FROM pending_time_logs 
  WHERE invitee_email = p_invitee_email 
  AND description = 'Test invitation';
  
  DELETE FROM invitations 
  WHERE email = p_invitee_email 
  AND full_name = p_invitee_name;

  RETURN result;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Function to check email delivery status
CREATE OR REPLACE FUNCTION check_email_status()
RETURNS jsonb AS $$
DECLARE
  pending_emails integer;
  sent_emails integer;
  failed_emails integer;
  recent_invitations jsonb;
  result jsonb := '{}'::jsonb;
BEGIN
  -- Count email statuses
  SELECT COUNT(*) INTO pending_emails 
  FROM invitations 
  WHERE notification_status = 'pending';

  SELECT COUNT(*) INTO sent_emails 
  FROM invitations 
  WHERE notification_status = 'sent';

  SELECT COUNT(*) INTO failed_emails 
  FROM invitations 
  WHERE notification_status = 'failed';

  -- Get recent invitations with details
  SELECT jsonb_agg(
    jsonb_build_object(
      'id', id,
      'email', email,
      'full_name', full_name,
      'notification_status', notification_status,
      'notification_sent_at', notification_sent_at,
      'created_at', created_at,
      'token', token
    )
  ) INTO recent_invitations
  FROM invitations
  WHERE created_at > now() - interval '24 hours'
  ORDER BY created_at DESC;

  result := jsonb_build_object(
    'email_counts', jsonb_build_object(
      'pending', pending_emails,
      'sent', sent_emails,
      'failed', failed_emails
    ),
    'recent_invitations', COALESCE(recent_invitations, '[]'::jsonb)
  );

  RETURN result;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Function to manually mark email as sent (for testing)
CREATE OR REPLACE FUNCTION mark_email_sent(p_invitation_id uuid)
RETURNS jsonb AS $$
BEGIN
  UPDATE invitations 
  SET 
    notification_status = 'sent',
    notification_sent_at = now()
  WHERE id = p_invitation_id;

  RETURN jsonb_build_object(
    'success', true,
    'message', 'Email marked as sent',
    'invitation_id', p_invitation_id
  );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Grant execute permissions
GRANT EXECUTE ON FUNCTION test_invitation_flow(text, text, text) TO authenticated;
GRANT EXECUTE ON FUNCTION check_email_status() TO authenticated;
GRANT EXECUTE ON FUNCTION mark_email_sent(uuid) TO authenticated;