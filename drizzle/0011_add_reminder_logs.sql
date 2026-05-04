-- Tracks which monthly reminder periods have already been sent
-- Prevents duplicate sends on server restarts or multi-instance deploys
CREATE TABLE IF NOT EXISTS reminder_logs (
  period_key  TEXT                        PRIMARY KEY,
  sent_at     TIMESTAMP WITH TIME ZONE    NOT NULL DEFAULT NOW()
);
