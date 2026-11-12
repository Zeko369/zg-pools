CREATE TABLE pool_state (
  pool_id text PRIMARY KEY,
  source_hash text,
  scope text,
  availability jsonb,
  model text,
  extracted_at timestamptz,
  checked_at timestamptz,
  attempted_at timestamptz,
  last_error text
);

-- Only the relevant, normalized source body is stored, never the whole website.
CREATE TABLE pool_source_versions (
  id bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  pool_id text NOT NULL REFERENCES pool_state(pool_id),
  source_hash text NOT NULL,
  body text NOT NULL,
  observed_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (pool_id, source_hash)
);

CREATE TABLE pool_extractions (
  id bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  pool_id text NOT NULL REFERENCES pool_state(pool_id),
  source_hash text NOT NULL,
  scope text NOT NULL,
  availability jsonb NOT NULL,
  model text NOT NULL,
  usage jsonb NOT NULL,
  extracted_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX pool_extractions_history ON pool_extractions (pool_id, extracted_at DESC);
