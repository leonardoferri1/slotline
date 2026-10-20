CREATE EXTENSION IF NOT EXISTS btree_gist;
CREATE TABLE organizations (id uuid PRIMARY KEY, name text NOT NULL);
CREATE TABLE users (
 id uuid PRIMARY KEY, organization_id uuid NOT NULL REFERENCES organizations,
 name text NOT NULL, email text UNIQUE NOT NULL, password_hash text NOT NULL,
 role text NOT NULL CHECK(role IN ('admin','member')), UNIQUE(id,organization_id)
);
CREATE TABLE sessions (token_hash text PRIMARY KEY, user_id uuid NOT NULL REFERENCES users, expires_at timestamptz NOT NULL);
CREATE TABLE resources (
 id uuid PRIMARY KEY, organization_id uuid NOT NULL REFERENCES organizations, name text NOT NULL,
 kind text NOT NULL, capacity integer NOT NULL CHECK(capacity>0), description text NOT NULL,
 UNIQUE(id,organization_id)
);
CREATE TABLE reservations (
 id uuid PRIMARY KEY, organization_id uuid NOT NULL, resource_id uuid NOT NULL, user_id uuid NOT NULL,
 title text NOT NULL CHECK(length(title) BETWEEN 3 AND 100), starts_at timestamptz NOT NULL, ends_at timestamptz NOT NULL,
 status text NOT NULL CHECK(status IN ('held','confirmed','cancelled','expired')),
 expires_at timestamptz NOT NULL, created_at timestamptz NOT NULL DEFAULT now(),
 CHECK(ends_at>starts_at), CHECK(ends_at<=starts_at+interval '8 hours'),
 FOREIGN KEY(resource_id,organization_id) REFERENCES resources(id,organization_id),
 FOREIGN KEY(user_id,organization_id) REFERENCES users(id,organization_id),
 EXCLUDE USING gist(resource_id WITH =, tstzrange(starts_at,ends_at,'[)') WITH &&) WHERE(status IN ('held','confirmed'))
);
CREATE INDEX reservations_org_date ON reservations(organization_id, starts_at);
CREATE INDEX reservations_expiry ON reservations(expires_at) WHERE status='held';
CREATE TABLE audit_events (
 id bigserial PRIMARY KEY, organization_id uuid NOT NULL REFERENCES organizations,
 reservation_id uuid NOT NULL REFERENCES reservations, actor_id uuid REFERENCES users,
 type text NOT NULL, created_at timestamptz NOT NULL DEFAULT now()
);
CREATE TABLE outbox (
 id bigserial PRIMARY KEY, reservation_id uuid NOT NULL REFERENCES reservations,
 type text NOT NULL, created_at timestamptz NOT NULL DEFAULT now(), delivered_at timestamptz
);
CREATE TABLE notifications (
 event_id bigint PRIMARY KEY REFERENCES outbox, user_id uuid NOT NULL REFERENCES users,
 reservation_id uuid NOT NULL REFERENCES reservations, type text NOT NULL, created_at timestamptz NOT NULL DEFAULT now()
);
CREATE TABLE idempotency_keys (
 user_id uuid NOT NULL REFERENCES users, key text NOT NULL, fingerprint text NOT NULL,
 reservation_id uuid NOT NULL REFERENCES reservations, created_at timestamptz NOT NULL DEFAULT now(), PRIMARY KEY(user_id,key)
);
