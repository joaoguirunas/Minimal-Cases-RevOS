
-- Rename thread_id column to pessoa_id in crm_messages table
ALTER TABLE crm_messages RENAME COLUMN thread_id TO pessoa_id;

-- Update the column type to integer to match the crm_pessoas.id type
ALTER TABLE crm_messages ALTER COLUMN pessoa_id TYPE integer USING pessoa_id::integer;

-- Add foreign key constraint to ensure referential integrity
ALTER TABLE crm_messages 
ADD CONSTRAINT fk_crm_messages_pessoa_id 
FOREIGN KEY (pessoa_id) REFERENCES crm_pessoas(id);
