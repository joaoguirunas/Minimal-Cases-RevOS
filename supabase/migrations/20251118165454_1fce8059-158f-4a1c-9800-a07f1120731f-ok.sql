-- Add name column to score_matrix table
ALTER TABLE score_matrix 
ADD COLUMN name text;

-- Add index for better performance
CREATE INDEX idx_score_matrix_name ON score_matrix(name);

-- Update existing records with a default name based on score
UPDATE score_matrix 
SET name = 'Score ' || score_number::text 
WHERE name IS NULL;