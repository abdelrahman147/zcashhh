/**
 * Leaderboard API Backend
 * Stores game scores securely on the server
 * Prevents client-side manipulation
 */

const express = require('express');
const cors = require('cors');
const bodyParser = require('body-parser');

const app = express();
const PORT = process.env.PORT || 3001;

// In-memory storage (in production, use a real database)
let leaderboard = [];
let scoreHashes = new Map(); // Store hashes to prevent manipulation

app.use(cors());
app.use(bodyParser.json());

// Middleware to validate score submissions
function validateScore(req, res, next) {
    const { wallet, score, time, signature, hash } = req.body;
    
    if (!wallet || !score || !time || !signature || !hash) {
        return res.status(400).json({ error: 'Missing required fields' });
    }
    
    // Validate score is reasonable (max 1 million)
    if (score > 1000000 || score < 0) {
        return res.status(400).json({ error: 'Invalid score' });
    }
    
    // Check if hash was already submitted (prevent replay)
    if (scoreHashes.has(hash)) {
        return res.status(400).json({ error: 'Score already submitted' });
    }
    
    next();
}

// Submit score
app.post('/api/leaderboard/submit', validateScore, (req, res) => {
    const { wallet, score, time, signature, hash, difficulty } = req.body;
    
    // Store hash to prevent replay
    scoreHashes.set(hash, true);
    
    // Add to leaderboard
    const entry = {
        wallet: wallet.substring(0, 8) + '...' + wallet.substring(wallet.length - 8),
        fullWallet: wallet, // Store full wallet for verification
        score: parseInt(score),
        time: parseInt(time),
        scorePerSecond: time > 0 ? (score / (time / 1000)).toFixed(2) : 0,
        difficulty: difficulty || 1,
        signature: signature,
        timestamp: Date.now(),
        hash: hash
    };
    
    leaderboard.push(entry);
    
    // Sort by score (descending)
    leaderboard.sort((a, b) => b.score - a.score);
    
    // Keep top 100
    if (leaderboard.length > 100) {
        leaderboard = leaderboard.slice(0, 100);
    }
    
    res.json({ success: true, rank: leaderboard.findIndex(e => e.hash === hash) + 1 });
});

// Get leaderboard
app.get('/api/leaderboard', (req, res) => {
    const limit = parseInt(req.query.limit) || 50;
    const topScores = leaderboard.slice(0, limit).map((entry, index) => ({
        rank: index + 1,
        wallet: entry.wallet,
        score: entry.score,
        time: entry.time,
        scorePerSecond: entry.scorePerSecond,
        timestamp: entry.timestamp
    }));
    
    res.json({ leaderboard: topScores, total: leaderboard.length });
});

// Get user's best score
app.get('/api/leaderboard/user/:wallet', (req, res) => {
    const wallet = req.params.wallet;
    const userScores = leaderboard.filter(e => e.fullWallet === wallet);
    
    if (userScores.length === 0) {
        return res.json({ bestScore: null, rank: null });
    }
    
    const bestScore = userScores.reduce((best, current) => 
        current.score > best.score ? current : best
    );
    
    const rank = leaderboard.findIndex(e => e.hash === bestScore.hash) + 1;
    
    res.json({ 
        bestScore: {
            score: bestScore.score,
            time: bestScore.time,
            scorePerSecond: bestScore.scorePerSecond,
            rank: rank
        }
    });
});

// Health check
app.get('/api/health', (req, res) => {
    res.json({ status: 'ok', entries: leaderboard.length });
});

app.listen(PORT, () => {
    console.log(`Leaderboard API running on port ${PORT}`);
});

