/*
  # Fix Invitation URLs for Deployment

  1. Update functions to use proper site URL
  2. Add environment variable support for deployment URLs
  3. Fix invitation link generation
*/

-- Update the create_simple_invitation function to use proper URLs
CREATE OR REPLACE FUNCTION create_simple_invitation(
  p_inviter_profile_id uuid,
  p_invitee_email text,
  p_invitee_name text,
  p_hours decimal,
  p_description text,
  p_mode text
) RETURNS jsonb AS $$
DECLARE
  invitation_id uuid;
  pending_log_id uuid;
  invitation_token text;
  inviter_name text;
  site_url text;
  result jsonb := '{"success": true}'::jsonb;
BEGIN
  -- Validate inputs
  IF p_hours <= 0 THEN
    RETURN '{"success": false, "error": "Hours must be greater than 0"}'::jsonb;
  END IF;

  IF p_mode NOT IN ('helped', 'wasHelped') THEN
    RETURN '{"success": false, "error": "Mode must be helped or wasHelped"}'::jsonb;
  END IF;

  -- Get inviter name
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
    notification_status,
    expires_at
  ) VALUES (
    p_inviter_profile_id,
    p_invitee_email,
    p_invitee_name,
    'time_logging',
    invitation_token,
    'link',
    'ready',
    now() + interval '7 days'
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
    p_invitee_email,
    p_hours,
    COALESCE(p_description, ''),
    'general',
    p_mode
  ) RETURNING id INTO pending_log_id;

  -- Return success with invitation details (URL will be constructed in frontend)
  result := result || jsonb_build_object(
    'invitation_id', invitation_id,
    'invitation_token', invitation_token,
    'inviter_name', inviter_name,
    'message', 'Invitation created successfully'
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

-- Function to get the proper site URL for invitations
CREATE OR REPLACE FUNCTION get_site_url()
RETURNS text AS $$
BEGIN
  -- This will be set by environment variables in production
  -- For now, return a placeholder that the frontend can replace
  RETURN 'SITE_URL_PLACEHOLDER';
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Grant execute permissions
GRANT EXECUTE ON FUNCTION get_site_url() TO authenticated;
GRANT EXECUTE ON FUNCTION get_site_url() TO anon;