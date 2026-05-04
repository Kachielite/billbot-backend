-- Device tokens: stores OneSignal player IDs per user (one row per device)
CREATE TABLE IF NOT EXISTS device_tokens (
  id          TEXT                        PRIMARY KEY,
  user_id     TEXT                        NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  player_id   TEXT                        NOT NULL UNIQUE,
  platform    VARCHAR(20),
  created_at  TIMESTAMP WITH TIME ZONE    NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_device_tokens_user_id
  ON device_tokens(user_id);

-- Notification preferences: one row per user, all push types defaulting to enabled
CREATE TABLE IF NOT EXISTS notification_preferences (
  user_id               TEXT      PRIMARY KEY REFERENCES users(id) ON DELETE CASCADE,
  invite_received       BOOLEAN   NOT NULL DEFAULT TRUE,
  member_joined         BOOLEAN   NOT NULL DEFAULT TRUE,
  expense_created       BOOLEAN   NOT NULL DEFAULT TRUE,
  settlement_submitted  BOOLEAN   NOT NULL DEFAULT TRUE,
  settlement_confirmed  BOOLEAN   NOT NULL DEFAULT TRUE,
  settlement_disputed   BOOLEAN   NOT NULL DEFAULT TRUE,
  general               BOOLEAN   NOT NULL DEFAULT TRUE,
  updated_at            TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW()
);
