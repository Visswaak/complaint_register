ALTER TABLE attractions
    ADD COLUMN IF NOT EXISTS score INTEGER NOT NULL DEFAULT 0,
    ADD COLUMN IF NOT EXISTS upvotes INTEGER NOT NULL DEFAULT 0,
    ADD COLUMN IF NOT EXISTS downvotes INTEGER NOT NULL DEFAULT 0;

UPDATE attractions a
SET
    score = COALESCE(v.score, 0),
    upvotes = COALESCE(v.upvotes, 0),
    downvotes = COALESCE(v.downvotes, 0)
FROM (
    SELECT
        attraction_id,
        COALESCE(SUM(vote_value), 0) AS score,
        COUNT(*) FILTER (WHERE vote_value = 1) AS upvotes,
        COUNT(*) FILTER (WHERE vote_value = -1) AS downvotes
    FROM attraction_votes
    GROUP BY attraction_id
) v
WHERE a.id = v.attraction_id;

CREATE INDEX IF NOT EXISTS idx_attractions_feed
    ON attractions (pincode, score DESC, created_at DESC, id DESC);
