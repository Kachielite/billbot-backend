CREATE TABLE IF NOT EXISTS notifications (
  id          TEXT                        PRIMARY KEY,
  user_id     TEXT                        NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  type        VARCHAR(50)                 NOT NULL,
  title       VARCHAR(200)               NOT NULL,
  body        TEXT                        NOT NULL,
  metadata    JSONB                       NOT NULL DEFAULT '{}',
  is_read     BOOLEAN                     NOT NULL DEFAULT FALSE,
  created_at  TIMESTAMP WITH TIME ZONE    NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_notifications_user_id
  ON notifications(user_id);

-- Partial index makes unread-count queries very fast
CREATE INDEX IF NOT EXISTS idx_notifications_user_unread
  ON notifications(user_id, created_at DESC)
  WHERE is_read = FALSE;
