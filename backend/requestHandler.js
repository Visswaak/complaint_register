// requestHandler.js
require('dotenv').config();

const express = require('express');
const admin = require('firebase-admin');
const { Pool } = require('pg');
const Redis = require('ioredis');
const cloudinary = require('cloudinary').v2;
const axios = require('axios');
const cors = require('cors');

const serviceAccount = process.env.FIREBASE_SERVICE_ACCOUNT_JSON
    ? JSON.parse(process.env.FIREBASE_SERVICE_ACCOUNT_JSON)
    : require('./serviceAccountKey.json');

const app = express();

// 1. DYNAMIC CORS CONFIG (Must be first)
const configuredOrigins = (process.env.FRONTEND_URL || 'http://localhost:3000')
    .split(',')
    .map(origin => origin.trim())
    .filter(Boolean);

const isLocalDevOrigin = (origin) => /^https?:\/\/(localhost|127\.0\.0\.1)(:\d+)?$/.test(origin);
const isConfiguredOrigin = (origin) => configuredOrigins.includes(origin);

const corsOptions = {
    origin(origin, callback) {
        if (!origin) return callback(null, true);

        if (isConfiguredOrigin(origin) || isLocalDevOrigin(origin)) {
            return callback(null, true);
        }

        console.error('CORS blocked for origin:', origin, 'allowed:', configuredOrigins);
        return callback(null, false);
    },
    methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS'],
    allowedHeaders: ['Content-Type', 'Authorization']
};

app.use(cors(corsOptions));
app.options(/(.*)/, cors(corsOptions));


// 2. GLOBAL MIDDLEWARE
app.use(express.json());

// Initialize Connections
admin.initializeApp({ credential: admin.credential.cert(serviceAccount) });
const databaseUrl =
    process.env.DATABASE_URL ||
    process.env.SUPABASE_DB_URL ||
    process.env.NEXT_PUBLIC_SUPABASE_URL;

if (!databaseUrl) {
    throw new Error('Missing database connection string. Set DATABASE_URL or SUPABASE_DB_URL in backend/.env');
}

const pool = new Pool({ connectionString: databaseUrl });
const redis = new Redis(process.env.UPSTASH_REDIS_URL);

redis.on('connect', () => console.log('✅ Connected to Upstash Redis'));

const nowMs = () => Number(process.hrtime.bigint()) / 1e6;
const DEFAULT_ATTRACTIONS_LIMIT = 20;
const MAX_ATTRACTIONS_LIMIT = 50;

const getUserPincode = async (userId) => {
    const result = await pool.query('SELECT pincode FROM user_profiles WHERE user_id = $1', [userId]);
    return result.rows[0]?.pincode || null;
};

// --- MIDDLEWARE: Strict Auth Verification ---
const verifyAuth = async (req, res, next) => {
    // Skip auth check for browser preflight (OPTIONS) requests
    if (req.method === 'OPTIONS') return next();

    const token = req.headers.authorization?.split('Bearer ')[1];
    if (!token) return res.status(401).json({ error: 'Unauthorized' });

    try {
        const verifyStart = nowMs();
        const decodedToken = await admin.auth().verifyIdToken(token);
        req.auth_verify_ms = Math.round(nowMs() - verifyStart);

        // Security Check: Verify Project ID
        if (decodedToken.aud !== process.env.FIREBASE_PROJECT_ID) {
            console.error('Project ID Mismatch:', decodedToken.aud, 'expected:', process.env.FIREBASE_PROJECT_ID);
            return res.status(403).json({ error: 'Forbidden: Project ID mismatch' });
        }

        req.user_id = decodedToken.uid;
        next();
    } catch (err) {
        console.error('Firebase Auth Error:', err.message);
        res.status(401).json({ error: 'Invalid Token' });
    }
};

// --- ROUTES ---

app.get('/api/upload-signature', verifyAuth, (req, res) => {
    const timestamp = Math.round(new Date().getTime() / 1000);
    const signature = cloudinary.utils.api_sign_request(
        { timestamp, folder: 'civic_complaints' },
        process.env.CLOUDINARY_API_SECRET
    );

    res.json({ timestamp, signature, apiKey: process.env.CLOUDINARY_API_KEY });
});

app.post('/api/complaints', verifyAuth, async (req, res) => {
    const requestStart = nowMs();
    const { type, imageUrl, area, description } = req.body;
    const query = `INSERT INTO complaints (user_id, type, image_url, area, description) 
                   VALUES ($1, $2, $3, $4, $5) RETURNING id`;

    if (!type || !imageUrl || !area) {
        return res.status(400).json({ error: 'Missing required complaint fields' });
    }

    try {
        const dbStart = nowMs();
        const result = await pool.query(query, [req.user_id, type, imageUrl, area, description]);
        const dbMs = Math.round(nowMs() - dbStart);
        const totalMs = Math.round(nowMs() - requestStart);
        const authVerifyMs = req.auth_verify_ms || null;

        console.log('Complaint save timings:', {
            authVerifyMs,
            dbMs,
            totalMs
        });

        res.status(201).json({
            id: result.rows[0].id,
            status: 'Pending',
            timings: {
                authVerifyMs,
                dbMs,
                totalMs
            }
        });
    } catch (error) {
        console.error('DB Error:', error);
        res.status(500).json({
            error: 'Database insertion failed',
            message: error.message,
            detail: error.detail || null,
            code: error.code || null,
            timings: {
                authVerifyMs: req.auth_verify_ms || null,
                totalMs: Math.round(nowMs() - requestStart)
            }
        });
    }
});

app.get('/api/complaints', verifyAuth, async (req, res) => {
    const query = `SELECT id, type, image_url, area, status, created_at 
                 FROM complaints WHERE user_id = $1 ORDER BY created_at DESC`;

    try {
        const result = await pool.query(query, [req.user_id]);
        res.json(result.rows);
    } catch (error) {
        res.status(500).json({ error: 'Fetch failed' });
    }
});

app.get('/api/profile', verifyAuth, async (req, res) => {
    try {
        const result = await pool.query(
            'SELECT user_id, pincode, created_at, updated_at FROM user_profiles WHERE user_id = $1',
            [req.user_id]
        );
        res.json(result.rows[0] || { user_id: req.user_id, pincode: null });
    } catch (error) {
        console.error('Profile fetch failed:', error);
        res.status(500).json({ error: 'Profile fetch failed' });
    }
});

app.put('/api/profile', verifyAuth, async (req, res) => {
    const { pincode } = req.body;

    if (!/^\d{6}$/.test(String(pincode || ''))) {
        return res.status(400).json({ error: 'Pincode must be a 6 digit value' });
    }

    try {
        const result = await pool.query(
            `INSERT INTO user_profiles (user_id, pincode)
             VALUES ($1, $2)
             ON CONFLICT (user_id)
             DO UPDATE SET pincode = EXCLUDED.pincode, updated_at = NOW()
             RETURNING user_id, pincode, created_at, updated_at`,
            [req.user_id, String(pincode)]
        );
        res.json(result.rows[0]);
    } catch (error) {
        console.error('Profile save failed:', error);
        res.status(500).json({ error: 'Profile save failed' });
    }
});

app.get('/api/attractions', verifyAuth, async (req, res) => {
    try {
        const pincode = await getUserPincode(req.user_id);
        if (!pincode) {
            return res.status(400).json({ error: 'Set your pincode before viewing attractions', pincode: null });
        }

        const requestedLimit = Number.parseInt(req.query.limit, 10);
        const limit = Number.isFinite(requestedLimit)
            ? Math.min(Math.max(requestedLimit, 1), MAX_ATTRACTIONS_LIMIT)
            : DEFAULT_ATTRACTIONS_LIMIT;

        const result = await pool.query(
            `SELECT
                a.id,
                a.title,
                a.description,
                a.image_url,
                a.exact_address,
                a.pincode,
                a.created_at,
                a.score,
                a.upvotes,
                a.downvotes,
                COALESCE(v.vote_value, 0) AS current_user_vote
             FROM attractions a
             LEFT JOIN attraction_votes v
               ON v.attraction_id = a.id
              AND v.user_id = $1
             WHERE a.pincode = $2
             ORDER BY a.score DESC, a.created_at DESC, a.id DESC
             LIMIT $3`,
            [req.user_id, pincode, limit]
        );

        res.json({ pincode, limit, attractions: result.rows });
    } catch (error) {
        console.error('Attractions fetch failed:', error);
        res.status(500).json({ error: 'Attractions fetch failed' });
    }
});

app.post('/api/attractions', verifyAuth, async (req, res) => {
    const { title, description, imageUrl, exactAddress } = req.body;

    if (!title || !description || !imageUrl || !exactAddress) {
        return res.status(400).json({ error: 'Missing required attraction fields' });
    }

    try {
        const pincode = await getUserPincode(req.user_id);
        if (!pincode) {
            return res.status(400).json({ error: 'Set your pincode before posting attractions' });
        }

        const result = await pool.query(
            `INSERT INTO attractions (user_id, title, description, image_url, exact_address, pincode)
             VALUES ($1, $2, $3, $4, $5, $6)
             RETURNING id, title, description, image_url, exact_address, pincode, created_at, score, upvotes, downvotes`,
            [req.user_id, title, description, imageUrl, exactAddress, pincode]
        );

        res.status(201).json(result.rows[0]);
    } catch (error) {
        console.error('Attraction creation failed:', error);
        res.status(500).json({ error: 'Attraction creation failed' });
    }
});

app.post('/api/attractions/:id/vote', verifyAuth, async (req, res) => {
    const { id } = req.params;
    const { voteValue } = req.body;

    if (![1, -1, 0].includes(voteValue)) {
        return res.status(400).json({ error: 'voteValue must be 1, -1, or 0' });
    }

    try {
        const client = await pool.connect();
        try {
            await client.query('BEGIN');

            const existingVoteResult = await client.query(
                'SELECT vote_value FROM attraction_votes WHERE attraction_id = $1 AND user_id = $2',
                [id, req.user_id]
            );
            const previousVote = existingVoteResult.rows[0]?.vote_value || 0;

            if (voteValue === 0) {
                await client.query(
                    'DELETE FROM attraction_votes WHERE attraction_id = $1 AND user_id = $2',
                    [id, req.user_id]
                );
            } else {
                await client.query(
                    `INSERT INTO attraction_votes (attraction_id, user_id, vote_value)
                     VALUES ($1, $2, $3)
                     ON CONFLICT (attraction_id, user_id)
                     DO UPDATE SET vote_value = EXCLUDED.vote_value, updated_at = NOW()`,
                    [id, req.user_id, voteValue]
                );
            }

            if (previousVote !== voteValue) {
                const upvoteDelta = (voteValue === 1 ? 1 : 0) - (previousVote === 1 ? 1 : 0);
                const downvoteDelta = (voteValue === -1 ? 1 : 0) - (previousVote === -1 ? 1 : 0);
                const scoreDelta = voteValue - previousVote;

                await client.query(
                    `UPDATE attractions
                     SET score = score + $2,
                         upvotes = upvotes + $3,
                         downvotes = downvotes + $4
                     WHERE id = $1`,
                    [id, scoreDelta, upvoteDelta, downvoteDelta]
                );
            }

            const result = await client.query(
                `SELECT score, upvotes, downvotes
                 FROM attractions
                 WHERE id = $1`,
                [id]
            );

            await client.query('COMMIT');
            const updated = result.rows[0];
            res.json({
                score: updated?.score ?? 0,
                upvotes: updated?.upvotes ?? 0,
                downvotes: updated?.downvotes ?? 0,
                current_user_vote: voteValue
            });
        } catch (error) {
            await client.query('ROLLBACK');
            throw error;
        } finally {
            client.release();
        }
    } catch (error) {
        console.error('Attraction vote failed:', error);
        res.status(500).json({ error: 'Attraction vote failed' });
    }
});

app.get('/api/weather-alert', async (req, res) => {
    const CACHE_KEY = 'weather_full_blr';
    try {
        const cachedData = await redis.get(CACHE_KEY);
        if (cachedData) return res.json(JSON.parse(cachedData));

        const response = await axios.get(`https://api.openweathermap.org/data/2.5/weather?q=Bangalore&appid=${process.env.WEATHER_API_KEY}&units=metric`);
        const weather = response.data;
        const condition = weather.weather?.[0]?.main;

        let alertMsg = null;
        if (condition === 'Rain' || condition === 'Thunderstorm') alertMsg = 'Heavy rain';
        if (weather.main?.temp > 40) alertMsg = 'Extreme heat';

        const payload = {
            city: weather.name,
            country: weather.sys?.country || null,
            alert: alertMsg,
            condition: weather.weather?.[0]?.main || null,
            description: weather.weather?.[0]?.description || null,
            temperatureC: weather.main?.temp ?? null,
            feelsLikeC: weather.main?.feels_like ?? null,
            humidity: weather.main?.humidity ?? null,
            windSpeed: weather.wind?.speed ?? null,
            cloudiness: weather.clouds?.all ?? null,
            updatedAt: new Date().toISOString()
        };
        await redis.setex(CACHE_KEY, 900, JSON.stringify(payload));

        res.json(payload);
    } catch (error) {
        res.status(500).json({ error: 'Weather service unavailable' });
    }
});

// --- DYNAMIC PORT CONFIG ---
const PORT = process.env.PORT || 5001;
app.listen(PORT, () => console.log(`🚀 Backend running on http://localhost:${PORT}`));
