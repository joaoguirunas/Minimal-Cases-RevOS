-- Add order_index column to score tables
ALTER TABLE score_objectives ADD COLUMN order_index INTEGER;
ALTER TABLE score_investments ADD COLUMN order_index INTEGER;
ALTER TABLE score_framings ADD COLUMN order_index INTEGER;

-- Set initial order_index values based on created_at
WITH ordered_objectives AS (
  SELECT id, ROW_NUMBER() OVER (ORDER BY created_at) - 1 as new_order
  FROM score_objectives
)
UPDATE score_objectives
SET order_index = ordered_objectives.new_order
FROM ordered_objectives
WHERE score_objectives.id = ordered_objectives.id;

WITH ordered_investments AS (
  SELECT id, ROW_NUMBER() OVER (ORDER BY created_at) - 1 as new_order
  FROM score_investments
)
UPDATE score_investments
SET order_index = ordered_investments.new_order
FROM ordered_investments
WHERE score_investments.id = ordered_investments.id;

WITH ordered_framings AS (
  SELECT id, ROW_NUMBER() OVER (ORDER BY created_at) - 1 as new_order
  FROM score_framings
)
UPDATE score_framings
SET order_index = ordered_framings.new_order
FROM ordered_framings
WHERE score_framings.id = ordered_framings.id;

-- Set NOT NULL constraint and default value
ALTER TABLE score_objectives ALTER COLUMN order_index SET NOT NULL;
ALTER TABLE score_objectives ALTER COLUMN order_index SET DEFAULT 0;

ALTER TABLE score_investments ALTER COLUMN order_index SET NOT NULL;
ALTER TABLE score_investments ALTER COLUMN order_index SET DEFAULT 0;

ALTER TABLE score_framings ALTER COLUMN order_index SET NOT NULL;
ALTER TABLE score_framings ALTER COLUMN order_index SET DEFAULT 0;

-- Add indexes for performance
CREATE INDEX idx_score_objectives_order ON score_objectives(order_index);
CREATE INDEX idx_score_investments_order ON score_investments(order_index);
CREATE INDEX idx_score_framings_order ON score_framings(order_index);