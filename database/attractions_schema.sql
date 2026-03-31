CREATE TABLE user_profiles (
    user_id VARCHAR(128) PRIMARY KEY,
    pincode VARCHAR(6) NOT NULL,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE attractions (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id VARCHAR(128) NOT NULL,
    title VARCHAR(160) NOT NULL,
    description TEXT NOT NULL,
    image_url TEXT NOT NULL,
    exact_address TEXT NOT NULL,
    pincode VARCHAR(6) NOT NULL,
    score INTEGER NOT NULL DEFAULT 0,
    upvotes INTEGER NOT NULL DEFAULT 0,
    downvotes INTEGER NOT NULL DEFAULT 0,
    created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE attraction_votes (
    attraction_id UUID NOT NULL REFERENCES attractions(id) ON DELETE CASCADE,
    user_id VARCHAR(128) NOT NULL,
    vote_value SMALLINT NOT NULL CHECK (vote_value IN (-1, 1)),
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW(),
    PRIMARY KEY (attraction_id, user_id)
);

CREATE INDEX idx_profiles_pincode ON user_profiles (pincode);
CREATE INDEX idx_attractions_pincode_created ON attractions (pincode, created_at DESC);
CREATE INDEX idx_attractions_feed ON attractions (pincode, score DESC, created_at DESC, id DESC);
CREATE INDEX idx_attraction_votes_score ON attraction_votes (attraction_id, vote_value);
