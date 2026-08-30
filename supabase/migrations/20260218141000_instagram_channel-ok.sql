-- Add instagram_user_id to clients_people for Instagram DM support
ALTER TABLE clients_people
  ADD COLUMN IF NOT EXISTS instagram_user_id TEXT;
