-- Rollback: drop moddatetime extension (only if no triggers depend on it)
DROP EXTENSION IF EXISTS moddatetime;
