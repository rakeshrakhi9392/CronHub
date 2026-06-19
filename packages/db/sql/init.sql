# ChronoFlow schema (ported from Flyway migrations)
CREATE TABLE IF NOT EXISTS tenant (
    id UUID PRIMARY KEY,
    name VARCHAR(120) NOT NULL UNIQUE,
    created_at TIMESTAMP WITH TIME ZONE NOT NULL,
    rate_limit_per_minute INTEGER NOT NULL
);

CREATE TABLE IF NOT EXISTS api_key (
    id BIGSERIAL PRIMARY KEY,
    tenant_id UUID NOT NULL REFERENCES tenant (id),
    key_id VARCHAR(64) NOT NULL UNIQUE,
    key_secret_hash VARCHAR(256) NOT NULL,
    status VARCHAR(16) NOT NULL,
    created_at TIMESTAMP WITH TIME ZONE NOT NULL
);

CREATE TABLE IF NOT EXISTS job_definition (
    id BIGSERIAL PRIMARY KEY,
    tenant_id UUID NOT NULL REFERENCES tenant (id),
    name VARCHAR(140) NOT NULL,
    cron_expression VARCHAR(64) NOT NULL,
    target_url VARCHAR(1000) NOT NULL,
    status VARCHAR(16) NOT NULL,
    created_at TIMESTAMP WITH TIME ZONE NOT NULL,
    updated_at TIMESTAMP WITH TIME ZONE NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_api_key_tenant_id ON api_key (tenant_id);
CREATE INDEX IF NOT EXISTS idx_job_definition_tenant_id_created_at
    ON job_definition (tenant_id, created_at DESC);

CREATE TABLE IF NOT EXISTS execution_record (
    execution_id VARCHAR(64) PRIMARY KEY,
    job_id VARCHAR(64) NOT NULL,
    tenant_id VARCHAR(64) NOT NULL,
    target_url VARCHAR(1000) NOT NULL,
    triggered_at TIMESTAMP WITH TIME ZONE NOT NULL,
    attempt INTEGER NOT NULL,
    status VARCHAR(24) NOT NULL,
    next_attempt_at TIMESTAMP WITH TIME ZONE,
    last_error VARCHAR(2000),
    last_status_code INTEGER,
    last_latency_ms BIGINT,
    created_at TIMESTAMP WITH TIME ZONE NOT NULL,
    updated_at TIMESTAMP WITH TIME ZONE NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_execution_record_status_next_attempt
    ON execution_record (status, next_attempt_at);
