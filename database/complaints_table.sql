CREATE TABLE complaints (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id VARCHAR(128) NOT NULL, 
    type VARCHAR(50) NOT NULL,
    image_url TEXT NOT NULL,
    area VARCHAR(255) NOT NULL,
    description TEXT,
    status VARCHAR(20) DEFAULT 'Pending',
    created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX idx_user_complaints ON complaints (user_id, created_at DESC);