-- Add partial settlement tracking columns to expense_splits
ALTER TABLE expense_splits
  ADD COLUMN IF NOT EXISTS amount_settled NUMERIC(12, 2) NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS amount_remaining NUMERIC(12, 2);

-- Backfill: settled splits have amount_remaining = 0, unsettled = full amount
UPDATE expense_splits
SET
  amount_settled   = CASE WHEN settled = true THEN amount ELSE 0 END,
  amount_remaining = CASE WHEN settled = true THEN 0 ELSE amount END;

-- Now enforce NOT NULL on amount_remaining
ALTER TABLE expense_splits
  ALTER COLUMN amount_remaining SET NOT NULL;
