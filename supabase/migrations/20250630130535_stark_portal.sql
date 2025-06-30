/*
  # Fix Invitation System and Add RPC Functions

  1. New Functions
    - `create_simple_invitation` - Creates an invitation with a token for link sharing
    - `get_invitation_details` - Gets invitation details by token
    - `accept_invitation` - Accepts an invitation and creates time transaction

  2. Changes
    - Improve invitation token handling
    - Add better error handling
    - Support dynamic URL generation in frontend
*/

-- Create a simplified invitation creation function
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

  -- Return success with invitation details
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

-- Function to get invitation details for the signup page
CREATE OR REPLACE FUNCTION get_invitation_details(p_token text)
RETURNS jsonb AS $$
DECLARE
  invitation_data record;
  pending_log_data record;
  inviter_data record;
  result jsonb := '{"found": false}'::jsonb;
BEGIN
  -- Get invitation with inviter details
  SELECT 
    i.*,
    p.full_name as inviter_full_name,
    p.display_name as inviter_display_name
  INTO invitation_data
  FROM invitations i
  JOIN profiles p ON i.inviter_id = p.id
  WHERE i.token = p_token
  AND i.status = 'pending'
  AND i.expires_at > now();

  IF invitation_data IS NULL THEN
    -- Check if invitation exists but is expired/used
    SELECT * INTO invitation_data
    FROM invitations
    WHERE token = p_token;
    
    IF invitation_data IS NULL THEN
      RETURN result || jsonb_build_object('error', 'Invitation not found');
    ELSIF invitation_data.status != 'pending' THEN
      RETURN result || jsonb_build_object('error', 'Invitation already used');
    ELSIF invitation_data.expires_at <= now() THEN
      RETURN result || jsonb_build_object('error', 'Invitation expired');
    END IF;
  END IF;

  -- Get pending time log details
  SELECT * INTO pending_log_data
  FROM pending_time_logs
  WHERE invitation_id = invitation_data.id;

  result := jsonb_build_object(
    'found', true,
    'invitation', jsonb_build_object(
      'id', invitation_data.id,
      'email', invitation_data.email,
      'full_name', invitation_data.full_name,
      'inviter_name', COALESCE(invitation_data.inviter_full_name, invitation_data.inviter_display_name),
      'expires_at', invitation_data.expires_at,
      'created_at', invitation_data.created_at
    ),
    'time_log', CASE 
      WHEN pending_log_data IS NOT NULL THEN
        jsonb_build_object(
          'hours', pending_log_data.hours,
          'description', pending_log_data.description,
          'mode', pending_log_data.mode
        )
      ELSE null
    END
  );

  RETURN result;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Function to accept an invitation (called during signup)
CREATE OR REPLACE FUNCTION accept_invitation(
  p_token text,
  p_user_id uuid
) RETURNS jsonb AS $$
DECLARE
  invitation_data record;
  pending_log_data record;
  new_profile_id uuid;
  new_transaction_id uuid;
  result jsonb := '{"success": false}'::jsonb;
BEGIN
  -- Get invitation details
  SELECT * INTO invitation_data
  FROM invitations
  WHERE token = p_token
  AND status = 'pending'
  AND expires_at > now();

  IF invitation_data IS NULL THEN
    RETURN result || jsonb_build_object('error', 'Invalid or expired invitation');
  END IF;

  -- Get user's profile
  SELECT id INTO new_profile_id
  FROM profiles
  WHERE user_id = p_user_id;

  IF new_profile_id IS NULL THEN
    RETURN result || jsonb_build_object('error', 'User profile not found');
  END IF;

  -- Get pending time log
  SELECT * INTO pending_log_data
  FROM pending_time_logs
  WHERE invitation_id = invitation_data.id
  AND status = 'pending';

  -- Create time transaction if there's a pending log
  IF pending_log_data IS NOT NULL THEN
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
        WHEN pending_log_data.mode = 'helped' THEN pending_log_data.logger_profile_id
        ELSE new_profile_id
      END,
      CASE 
        WHEN pending_log_data.mode = 'helped' THEN new_profile_id
        ELSE pending_log_data.logger_profile_id
      END,
      pending_log_data.hours,
      pending_log_data.description,
      pending_log_data.service_type,
      pending_log_data.logger_profile_id,
      'pending'
    ) RETURNING id INTO new_transaction_id;

    -- Mark pending log as converted
    UPDATE pending_time_logs 
    SET 
      status = 'converted',
      converted_transaction_id = new_transaction_id,
      updated_at = now()
    WHERE id = pending_log_data.id;
  END IF;

  -- Mark invitation as accepted
  UPDATE invitations 
  SET 
    status = 'accepted',
    accepted_at = now(),
    updated_at = now()
  WHERE id = invitation_data.id;

  result := jsonb_build_object(
    'success', true,
    'message', 'Invitation accepted successfully',
    'transaction_created', new_transaction_id IS NOT NULL,
    'transaction_id', new_transaction_id
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

-- Grant execute permissions
GRANT EXECUTE ON FUNCTION create_simple_invitation(uuid, text, text, decimal, text, text) TO authenticated;
GRANT EXECUTE ON FUNCTION get_invitation_details(text) TO authenticated;
GRANT EXECUTE ON FUNCTION get_invitation_details(text) TO anon;
GRANT EXECUTE ON FUNCTION accept_invitation(text, uuid) TO authenticated;