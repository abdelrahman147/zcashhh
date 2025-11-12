/**
 * Leaderboard Service - Client Side
 * Communicates with backend API to submit and retrieve scores
 * Includes anti-cheat measures
 */

class LeaderboardService {
    constructor(apiUrl = 'http://localhost:3001') {
        this.apiUrl = apiUrl;
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
    
    /**
     * Generate a secure hash for score submission
     */
    async generateScoreHash(wallet, score, time, signature) {
        const data = `${wallet}-${score}-${time}-${signature}-${Date.now()}`;
        const encoder = new TextEncoder();
        const dataBuffer = encoder.encode(data);
        const hashBuffer = await crypto.subtle.digest('SHA-256', dataBuffer);
        const hashArray = Array.from(new Uint8Array(hashBuffer));
        return hashArray.map(b => b.toString(16).padStart(2, '0')).join('');
    }
    
    /**
     * Submit score to leaderboard
     */
    async submitScore(wallet, score, time, signature, difficulty = 1) {
        if (!this.isOnline) {
            await this.checkConnection();
        }
        
        try {
            const hash = await this.generateScoreHash(wallet, score, time, signature);
            
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
            
            if (!response.ok) {
                throw new Error(`Failed to submit score: ${response.statusText}`);
            }
            
            const result = await response.json();
            return result;
        } catch (error) {
            console.error('Failed to submit score:', error);
            // Cache locally if API is down
            this.cacheScoreLocally(wallet, score, time);
            throw error;
        }
    }
    
    /**
     * Get leaderboard
     */
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
    
    /**
     * Get user's best score
     */
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
    
    /**
     * Cache score locally if API is down
     */
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

// Export for use
if (typeof window !== 'undefined') {
    window.LeaderboardService = LeaderboardService;
}

if (typeof module !== 'undefined' && module.exports) {
    module.exports = LeaderboardService;
}

