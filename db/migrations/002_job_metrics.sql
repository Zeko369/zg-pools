CREATE TABLE pool_metrics_metadata (
  id boolean PRIMARY KEY DEFAULT true CHECK (id),
  tracking_since timestamptz NOT NULL DEFAULT now()
);
INSERT INTO pool_metrics_metadata (id) VALUES (true);

CREATE TABLE pool_refresh_runs (
  id uuid PRIMARY KEY,
  pool_id text NOT NULL,
  job_id uuid,
  trigger text NOT NULL,
  status text NOT NULL CHECK (status IN ('running','unchanged','updated','cooldown','busy','failed')),
  source_hash text,
  started_at timestamptz NOT NULL DEFAULT now(),
  finished_at timestamptz,
  error text
);
CREATE INDEX pool_refresh_runs_recent ON pool_refresh_runs (started_at DESC);
CREATE INDEX pool_refresh_runs_job ON pool_refresh_runs (job_id);

-- One row per HTTP attempt, including SDK retries and responses rejected by validation.
CREATE TABLE pool_ai_calls (
  id uuid PRIMARY KEY,
  run_id uuid REFERENCES pool_refresh_runs(id),
  model text NOT NULL,
  started_at timestamptz NOT NULL DEFAULT now(),
  finished_at timestamptz,
  http_status integer,
  input_tokens integer,
  output_tokens integer,
  reasoning_tokens integer,
  cached_input_tokens integer,
  error text
);
CREATE INDEX pool_ai_calls_recent ON pool_ai_calls (started_at DESC);
CREATE INDEX pool_ai_calls_run ON pool_ai_calls (run_id);
