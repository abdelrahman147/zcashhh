// Shared leaderboard handler for GET requests
// Uses same storage as leaderboard-submit (if in same container)

let leaderboard = [];
let scoreHashes = new Map();

exports.handler = async (event, context) => {
    // Handle OPTIONS preflight
    if (event.httpMethod === 'OPTIONS') {
        return {
            statusCode: 200,
            headers: {
                'Access-Control-Allow-Origin': '*',
                'Access-Control-Allow-Headers': 'Content-Type',
                'Access-Control-Allow-Methods': 'GET, OPTIONS'
            },
            body: ''
        };
    }
    
    if (event.httpMethod !== 'GET') {
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
        const path = event.path;
        const limit = parseInt(event.queryStringParameters?.limit || '50');
        
        // Health check
        if (path.includes('/health')) {
            return {
                statusCode: 200,
                headers: {
                    'Access-Control-Allow-Origin': '*',
                    'Content-Type': 'application/json'
                },
                body: JSON.stringify({ status: 'ok', entries: leaderboard.length })
            };
        }
        
        // Get user's best score
        if (path.includes('/user/')) {
            const wallet = path.split('/user/')[1];
            const userScores = leaderboard.filter(e => e.fullWallet === wallet);
            
            if (userScores.length === 0) {
                return {
                    statusCode: 200,
                    headers: {
                        'Access-Control-Allow-Origin': '*',
                        'Content-Type': 'application/json'
                    },
                    body: JSON.stringify({ bestScore: null, rank: null })
                };
            }
            
            const bestScore = userScores.reduce((best, current) => 
                current.score > best.score ? current : best
            );
            
            const rank = leaderboard.findIndex(e => e.hash === bestScore.hash) + 1;
            
            return {
                statusCode: 200,
                headers: {
                    'Access-Control-Allow-Origin': '*',
                    'Content-Type': 'application/json'
                },
                body: JSON.stringify({ 
                    bestScore: {
                        score: bestScore.score,
                        time: bestScore.time,
                        scorePerSecond: bestScore.scorePerSecond,
                        rank: rank
                    }
                })
            };
        }
        
        // Get leaderboard
        const topScores = leaderboard.slice(0, limit).map((entry, index) => ({
            rank: index + 1,
            wallet: entry.wallet,
            score: entry.score,
            time: entry.time,
            scorePerSecond: entry.scorePerSecond,
            timestamp: entry.timestamp
        }));
        
        return {
            statusCode: 200,
            headers: {
                'Access-Control-Allow-Origin': '*',
                'Content-Type': 'application/json'
            },
            body: JSON.stringify({ leaderboard: topScores, total: leaderboard.length })
        };
    } catch (error) {
        console.error('Leaderboard error:', error);
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

