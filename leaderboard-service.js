

class LeaderboardService {
    constructor(apiUrl = null) {
        // Always use same origin - backend serves both API and static files
        this.apiUrl = apiUrl || window.location.origin;
        this.isOnline = false;
        this.checkConnection();
    }
    
    async checkConnection() {
        try {
            const response = await fetch(`${this.apiUrl}/api/health`, {
                method: 'GET',
                timeout: 3000
            });
            this.isOnline = response.ok;
        } catch (error) {
            this.isOnline = false;
            console.warn('Leaderboard API not available, scores will be cached locally');
        }
    }
    
    
    async generateScoreHash(wallet, score, time, signature) {
        const data = `${wallet}-${score}-${time}-${signature}-${Date.now()}`;
        const encoder = new TextEncoder();
        const dataBuffer = encoder.encode(data);
        const hashBuffer = await crypto.subtle.digest('SHA-256', dataBuffer);
        const hashArray = Array.from(new Uint8Array(hashBuffer));
        return hashArray.map(b => b.toString(16).padStart(2, '0')).join('');
    }
    
    
    async submitScore(wallet, score, time, signature, difficulty = 1) {
        console.log(`📤 Attempting to submit score: ${score} points for wallet ${wallet.substring(0, 8)}...`);
        
        // Always try to submit, even if we think we're offline
        try {
            const hash = await this.generateScoreHash(wallet, score, time, signature);
            
            console.log(`📤 Submitting to: ${this.apiUrl}/api/leaderboard/submit`);
            
            const response = await fetch(`${this.apiUrl}/api/leaderboard/submit`, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json'
                },
                body: JSON.stringify({
                    wallet: wallet,
                    score: score,
                    time: time,
                    signature: signature,
                    hash: hash,
                    difficulty: difficulty
                })
            });
            
            console.log(`📥 Response status: ${response.status} ${response.statusText}`);
            
            if (!response.ok) {
                const errorText = await response.text().catch(() => 'Unknown error');
                console.error(`❌ Score submission failed: ${response.status} - ${errorText}`);
                throw new Error(`Failed to submit score: ${response.status} ${response.statusText}`);
            }
            
            const result = await response.json();
            console.log(`✅ Score submitted successfully:`, result);
            this.isOnline = true; // Mark as online on success
            return result;
        } catch (error) {
            console.error('❌ Failed to submit score:', error);
            console.error('   Error details:', error.message, error.stack);
            
            // Cache locally as backup
            this.cacheScoreLocally(wallet, score, time);
            this.isOnline = false;
            
            // Don't throw - return error result so UI can handle it
            return { 
                success: false, 
                error: error.message,
                cached: true 
            };
        }
    }
    
    
    async getLeaderboard(limit = 50) {
        if (!this.isOnline) {
            await this.checkConnection();
        }
        
        try {
            const response = await fetch(`${this.apiUrl}/api/leaderboard?limit=${limit}`);
            if (!response.ok) {
                throw new Error('Failed to fetch leaderboard');
            }
            return await response.json();
        } catch (error) {
            console.error('Failed to fetch leaderboard:', error);
            return { leaderboard: [], total: 0 };
        }
    }
    
    
    async getUserBestScore(wallet) {
        if (!this.isOnline) {
            await this.checkConnection();
        }
        
        try {
            const response = await fetch(`${this.apiUrl}/api/leaderboard/user/${wallet}`);
            if (!response.ok) {
                return { bestScore: null, rank: null };
            }
            return await response.json();
        } catch (error) {
            console.error('Failed to fetch user score:', error);
            return { bestScore: null, rank: null };
        }
    }
    
    
    cacheScoreLocally(wallet, score, time) {
        try {
            const cached = localStorage.getItem('cachedScores');
            const scores = cached ? JSON.parse(cached) : [];
            scores.push({ wallet, score, time, timestamp: Date.now() });
            localStorage.setItem('cachedScores', JSON.stringify(scores));
        } catch (error) {
            console.error('Failed to cache score:', error);
        }
    }
}


if (typeof window !== 'undefined') {
    window.LeaderboardService = LeaderboardService;
}

if (typeof module !== 'undefined' && module.exports) {
    module.exports = LeaderboardService;
}


