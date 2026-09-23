CREATE TABLE accounts (id TEXT PRIMARY KEY NOT NULL, email TEXT NOT NULL UNIQUE, name TEXT NOT NULL, role TEXT NOT NULL CHECK (role IN ('mayor','manager')), password_hash TEXT NOT NULL, salt TEXT NOT NULL, enabled INTEGER NOT NULL DEFAULT 1);
--> statement-breakpoint
CREATE TABLE auth_sessions (id TEXT PRIMARY KEY NOT NULL, account_id TEXT NOT NULL REFERENCES accounts(id) ON DELETE CASCADE, password_version TEXT NOT NULL, expires_at INTEGER NOT NULL, created_at TEXT NOT NULL);
--> statement-breakpoint
CREATE INDEX idx_auth_sessions_account ON auth_sessions(account_id);
--> statement-breakpoint
CREATE TABLE drafts (owner_id TEXT PRIMARY KEY NOT NULL REFERENCES accounts(id) ON DELETE CASCADE, decisions_json TEXT NOT NULL DEFAULT '[]', revision INTEGER NOT NULL DEFAULT 0, updated_at TEXT NOT NULL);
