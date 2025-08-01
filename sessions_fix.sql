-- Create sessions table for authentication
CREATE TABLE IF NOT EXISTS sessions (
  sid varchar PRIMARY KEY,
  sess jsonb NOT NULL,
  expire timestamp NOT NULL
);

-- Create index for session expiration
CREATE INDEX IF NOT EXISTS idx_sessions_expire ON sessions (expire);