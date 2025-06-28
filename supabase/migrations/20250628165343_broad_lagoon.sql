/*
  # Fix Pending Time Transactions Logic

  1. Update get_pending_time_transactions function
    - Only show pending transactions where the current user is NOT the one who logged it
    - This ensures users only see confirmations they need to approve, not their own logs

  2. Logic Fix
    - If user logged the transaction, they shouldn't see it as pending
    - Only the recipient should see it as a pending confirmation
*/

-- Drop and recreate the function with correct logic
DROP FUNCTION IF EXISTS get_pending_time_transactions(uuid);

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
  AND tt.logged_by != user_profile_id  -- KEY FIX: Don't show transactions the user logged themselves
  ORDER BY tt.created_at DESC;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Grant execute permission
GRANT EXECUTE ON FUNCTION get_pending_time_transactions(uuid) TO authenticated;