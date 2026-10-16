CREATE TABLE IF NOT EXISTS onboarding_guidance (
 user_id varchar PRIMARY KEY REFERENCES users(id) ON DELETE CASCADE,
 version integer NOT NULL,
 status varchar NOT NULL CHECK (status IN ('not_offered','active','suspended','completed','dismissed')),
 moment integer NOT NULL DEFAULT 1 CHECK (moment BETWEEN 1 AND 3),
 updated_at timestamp DEFAULT now()
);
