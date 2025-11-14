class LeaderboardSheets {
    constructor(sheetId, apiKey) {
        this.sheetId = sheetId;
        this.apiKey = apiKey;
        this.baseUrl = `https://sheets.googleapis.com/v4/spreadsheets/${sheetId}`;
        this.retryCount = 0;
        this.maxRetries = 3;
    }
    
    async submitScore(wallet, score, time, signature, difficulty = 1) {
        console.log(`📊 [Google Sheets] Submitting score: ${score} points for wallet ${wallet.substring(0, 8)}...`);
        console.log(`   Sheet ID: ${this.sheetId}`);
        
        try {
            const timestamp = new Date().toISOString();
            const scorePerSecond = time > 0 ? (score / (time / 1000)).toFixed(2) : 0;
            const hash = await this.generateHash(wallet, score, time, signature);
            
            const values = [[
                timestamp,
                wallet,
                score.toString(),
                time.toString(),
                scorePerSecond,
                difficulty.toString(),
                signature,
                hash
            ]];
            
            const url = `${this.baseUrl}/values/Sheet1!A:H:append?valueInputOption=RAW&key=${this.apiKey}`;
            
            console.log(`📤 [Google Sheets] Sending to: ${url.substring(0, 80)}...`);
            
            const response = await fetch(url, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json'
                },
                body: JSON.stringify({
                    values: values
                })
            });
            
            console.log(`📥 [Google Sheets] Response status: ${response.status} ${response.statusText}`);
            
            if (!response.ok) {
                const errorData = await response.json().catch(() => ({}));
                console.error(`❌ [Google Sheets] Error:`, errorData);
                
                if (response.status === 429 && this.retryCount < this.maxRetries) {
                    this.retryCount++;
                    console.log(`⏳ [Google Sheets] Rate limited, retrying in ${1000 * this.retryCount}ms...`);
                    await new Promise(resolve => setTimeout(resolve, 1000 * this.retryCount));
                    return this.submitScore(wallet, score, time, signature, difficulty);
                }
                throw new Error(`Failed to submit score: ${response.statusText} - ${JSON.stringify(errorData)}`);
            }
            
            const result = await response.json().catch(() => ({}));
            console.log(`✅ [Google Sheets] Score saved successfully!`, result);
            this.retryCount = 0;
            return { success: true, result: result };
        } catch (error) {
            console.error('❌ [Google Sheets] Failed to submit score:', error);
            console.error('   Error details:', error.message, error.stack);
            return { success: false, error: error.message };
        }
    }
    
    async getLeaderboard(limit = 50) {
        try {
            const url = `${this.baseUrl}/values/Sheet1!A:H?key=${this.apiKey}`;
            const response = await fetch(url);
            
            if (!response.ok) {
                throw new Error('Failed to fetch leaderboard');
            }
            
            const data = await response.json();
            if (!data.values || data.values.length === 0) {
                return { leaderboard: [], total: 0 };
            }
            
            const headers = data.values[0];
            const rows = data.values.slice(1);
            
            const leaderboard = rows
                .map((row, index) => ({
                    timestamp: row[0] || '',
                    wallet: row[1] || '',
                    score: parseInt(row[2]) || 0,
                    time: parseInt(row[3]) || 0,
                    scorePerSecond: parseFloat(row[4]) || 0,
                    difficulty: parseInt(row[5]) || 1,
                    signature: row[6] || '',
                    hash: row[7] || ''
                }))
                .filter(entry => entry.score > 0)
                .sort((a, b) => b.score - a.score)
                .slice(0, limit)
                .map((entry, index) => ({
                    rank: index + 1,
                    wallet: entry.wallet.length > 16 ? entry.wallet.substring(0, 8) + '...' + entry.wallet.substring(entry.wallet.length - 8) : entry.wallet,
                    fullWallet: entry.wallet,
                    score: entry.score,
                    time: entry.time,
                    scorePerSecond: entry.scorePerSecond,
                    timestamp: entry.timestamp
                }));
            
            return { leaderboard, total: leaderboard.length };
        } catch (error) {
            console.error('Failed to fetch leaderboard from Google Sheets:', error);
            return { leaderboard: [], total: 0 };
        }
    }
    
    async getUserBestScore(wallet) {
        try {
            const data = await this.getLeaderboard(1000);
            const userScores = data.leaderboard.filter(entry => entry.fullWallet === wallet);
            
            if (userScores.length === 0) {
                return { bestScore: null, rank: null };
            }
            
            const bestScore = userScores.reduce((best, current) => 
                current.score > best.score ? current : best
            );
            
            const allScores = await this.getLeaderboard(1000);
            const rank = allScores.leaderboard.findIndex(entry => entry.fullWallet === wallet && entry.score === bestScore.score) + 1;
            
            return {
                bestScore: {
                    score: bestScore.score,
                    time: bestScore.time,
                    scorePerSecond: bestScore.scorePerSecond,
                    rank: rank || null
                }
            };
        } catch (error) {
            console.error('Failed to fetch user score:', error);
            return { bestScore: null, rank: null };
        }
    }
    
    async generateHash(wallet, score, time, signature) {
        const data = `${wallet}-${score}-${time}-${signature}-${Date.now()}`;
        const encoder = new TextEncoder();
        const dataBuffer = encoder.encode(data);
        const hashBuffer = await crypto.subtle.digest('SHA-256', dataBuffer);
        const hashArray = Array.from(new Uint8Array(hashBuffer));
        return hashArray.map(b => b.toString(16).padStart(2, '0')).join('');
    }
}

if (typeof window !== 'undefined') {
    window.LeaderboardSheets = LeaderboardSheets;
}

if (typeof module !== 'undefined' && module.exports) {
    module.exports = LeaderboardSheets;
}

