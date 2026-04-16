CREATE TABLE IF NOT EXISTS activities (
  id          TEXT                        PRIMARY KEY,
  actor_id    TEXT                        REFERENCES users(id) ON DELETE SET NULL,
  pool_id     TEXT                        REFERENCES expense_pools(id) ON DELETE CASCADE,
  type        VARCHAR(50)                 NOT NULL,
  metadata    JSONB                       NOT NULL DEFAULT '{}',
  created_at  TIMESTAMP WITH TIME ZONE    NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_activities_pool_id
  ON activities(pool_id);

CREATE INDEX IF NOT EXISTS idx_activities_actor_id
  ON activities(actor_id);

CREATE INDEX IF NOT EXISTS idx_activities_created_at
  ON activities(created_at DESC);
