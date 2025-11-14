const fetch = require('node-fetch');

// In-memory storage (in production, use a database)
let leaderboard = [];
let scoreHashes = new Map();

function generateScoreHash(wallet, score, time, signature) {
    const data = `${wallet}-${score}-${time}-${signature}-${Date.now()}`;
    // Simple hash - in production use crypto
    return Buffer.from(data).toString('base64').substring(0, 32);
}

exports.handler = async (event, context) => {
    // Handle OPTIONS preflight
    if (event.httpMethod === 'OPTIONS') {
        return {
            statusCode: 200,
            headers: {
                'Access-Control-Allow-Origin': '*',
                'Access-Control-Allow-Headers': 'Content-Type',
                'Access-Control-Allow-Methods': 'POST, OPTIONS'
            },
            body: ''
        };
    }
    
    if (event.httpMethod !== 'POST') {
        return {
            statusCode: 405,
            headers: {
                'Access-Control-Allow-Origin': '*',
                'Content-Type': 'application/json'
            },
            body: JSON.stringify({ error: 'Method not allowed' })
        };
    }

    try {
        const { wallet, score, time, signature, hash, difficulty } = JSON.parse(event.body || '{}');
        
        if (!wallet || !score || !time || !signature || !hash) {
            return {
                statusCode: 400,
                headers: {
                    'Access-Control-Allow-Origin': '*',
                    'Content-Type': 'application/json'
                },
                body: JSON.stringify({ error: 'Missing required fields' })
            };
        }
        
        // Validate score
        if (score > 1000000 || score < 0) {
            return {
                statusCode: 400,
                headers: {
                    'Access-Control-Allow-Origin': '*',
                    'Content-Type': 'application/json'
                },
                body: JSON.stringify({ error: 'Invalid score' })
            };
        }
        
        // Check if hash was already submitted
        if (scoreHashes.has(hash)) {
            return {
                statusCode: 400,
                headers: {
                    'Access-Control-Allow-Origin': '*',
                    'Content-Type': 'application/json'
                },
                body: JSON.stringify({ error: 'Score already submitted' })
            };
        }
        
        // Store hash
        scoreHashes.set(hash, true);
        
        // Add to leaderboard
        const entry = {
            wallet: wallet.substring(0, 8) + '...' + wallet.substring(wallet.length - 8),
            fullWallet: wallet,
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
        
        const rank = leaderboard.findIndex(e => e.hash === hash) + 1;
        
        return {
            statusCode: 200,
            headers: {
                'Access-Control-Allow-Origin': '*',
                'Content-Type': 'application/json'
            },
            body: JSON.stringify({ success: true, rank: rank })
        };
    } catch (error) {
        console.error('Leaderboard submit error:', error);
        return {
            statusCode: 500,
            headers: {
                'Access-Control-Allow-Origin': '*',
                'Content-Type': 'application/json'
            },
            body: JSON.stringify({ error: error.message })
        };
    }
};

