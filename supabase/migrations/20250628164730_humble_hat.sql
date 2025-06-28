/*
  # Add INSERT policy for transaction notifications

  1. Security Changes
    - Add INSERT policy for `transaction_notifications` table
    - Allow the system to create notifications when transactions are created
    - Ensure notifications can only be created for valid recipients

  This fixes the RLS violation that occurs when the database trigger tries to create
  notifications after time transactions are inserted.
*/

-- Add INSERT policy for transaction_notifications table
CREATE POLICY "System can create transaction notifications"
  ON transaction_notifications
  FOR INSERT
  TO authenticated
  WITH CHECK (
    -- Allow insert if the recipient_id corresponds to a valid profile
    recipient_id IN (
      SELECT id FROM profiles
    )
  );