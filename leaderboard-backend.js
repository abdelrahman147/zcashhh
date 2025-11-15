/**
 * Backend-powered Google Sheets Leaderboard Service
 * Uses the backend API with service account authentication
 */
class LeaderboardBackend {
    constructor() {
        // Use relative URLs - works both locally and in production
        // Handle file:// protocol (local file) by using production URL
        let origin = window.location.origin;
        if (origin === 'null' || origin.startsWith('file://')) {
            // If opened as file://, use production URL
            origin = 'https://zecit.online';
        }
        this.apiBase = origin + '/api/sheets';
        this.sheetId = '1apjUM4vb-6TUx4cweIThML5TIKBg8E7HjLlaZyiw1e8';
        this.maxRetries = 3;
        this.retryCount = 0;
        
        console.log('✅ Backend-powered Google Sheets Leaderboard initialized');
        console.log(`   API Base: ${this.apiBase}`);
        console.log(`   Sheet ID: ${this.sheetId}`);
        console.log(`\n📝 IMPORTANT: Make sure the service account has Editor access to the Google Sheet!`);
        console.log(`   Service Account Email: meshnodelicense-185@gen-lang-client-0795253847.iam.gserviceaccount.com`);
        console.log(`   Google Sheet: https://docs.google.com/spreadsheets/d/1apjUM4vb-6TUx4cweIThML5TIKBg8E7HjLlaZyiw1e8/edit`);
        console.log(`   → Click Share button and add the service account email as Editor`);
    }

    /**
     * Submit a game score to Google Sheets via backend
     */
    async submitScore(wallet, score, time, signature, difficulty = 1) {
        console.log(`📊 [Backend] Submitting score: ${score} points for wallet ${wallet.substring(0, 8)}...`);

        try {
            const response = await fetch(`${this.apiBase}/submit`, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json'
                },
                body: JSON.stringify({
                    wallet,
                    score,
                    time,
                    signature: signature || 'game-' + Date.now(),
                    difficulty,
                    sheetId: this.sheetId
                })
            });

            console.log(`📥 [Backend] Response status: ${response.status} ${response.statusText}`);

            if (!response.ok) {
                const errorData = await response.json().catch(() => ({ error: 'Unknown error' }));
                console.error(`❌ [Backend] Error:`, errorData);

                if (response.status === 429 && this.retryCount < this.maxRetries) {
                    this.retryCount++;
                    console.log(`⏳ [Backend] Rate limited, retrying in ${1000 * this.retryCount}ms...`);
                    await new Promise(resolve => setTimeout(resolve, 1000 * this.retryCount));
                    return this.submitScore(wallet, score, time, signature, difficulty);
                }

                // Check for permission errors
                if (response.status === 403) {
                    console.error(`\n🚫 PERMISSION DENIED!`);
                    console.error(`   The service account doesn't have access to the Google Sheet.`);
                    console.error(`   Please add this email as Editor to the sheet:`);
                    console.error(`   meshnodelicense-185@gen-lang-client-0795253847.iam.gserviceaccount.com`);
                    console.error(`   Sheet URL: https://docs.google.com/spreadsheets/d/1apjUM4vb-6TUx4cweIThML5TIKBg8E7HjLlaZyiw1e8/edit\n`);
                }

                return { success: false, error: errorData.error || `HTTP ${response.status}` };
            }

            const result = await response.json();
            console.log(`✅ [Backend] Score saved successfully!`, result);
            this.retryCount = 0;
            return result;
        } catch (error) {
            console.error('❌ [Backend] Failed to submit score:', error);
            console.error('   Error details:', error.message, error.stack);
            return { success: false, error: error.message };
        }
    }

    /**
     * Get all scores from the leaderboard
     */
    async getScores(limit = 100) {
        try {
            const response = await fetch(`${this.apiBase}/scores?sheetId=${this.sheetId}`);
            
            if (!response.ok) {
                throw new Error(`HTTP ${response.status}: ${response.statusText}`);
            }

            const data = await response.json();
            
            if (!data.success || !data.scores) {
                throw new Error('Invalid response format');
            }

            // Sort by score (descending) and limit
            const sortedScores = data.scores
                .sort((a, b) => b.score - a.score)
                .slice(0, limit);

            return sortedScores;
        } catch (error) {
            console.error('❌ Failed to fetch scores:', error);
            return [];
        }
    }

    /**
     * Get the best score for a specific wallet
     */
    async getUserBestScore(wallet) {
        try {
            const response = await fetch(`${this.apiBase}/scores?sheetId=${this.sheetId}`);
            
            if (!response.ok) {
                throw new Error(`HTTP ${response.status}: ${response.statusText}`);
            }

            const data = await response.json();
            
            if (!data.success || !data.scores) {
                throw new Error('Invalid response format');
            }

            // Filter scores for this wallet
            const userScores = data.scores.filter(s => s.wallet === wallet);
            
            if (userScores.length === 0) {
                return { wallet, bestScore: null, totalGames: 0 };
            }

            // Find best score
            const bestScore = userScores.reduce((best, current) => {
                return current.score > best.score ? current : best;
            });

            return {
                wallet,
                bestScore,
                totalGames: userScores.length,
                avgScore: userScores.reduce((sum, s) => sum + s.score, 0) / userScores.length
            };
        } catch (error) {
            console.error('❌ Failed to fetch user best score:', error);
            return { wallet, bestScore: null, totalGames: 0 };
        }
    }

    /**
     * Get the top N players
     */
    async getTopPlayers(limit = 10) {
        try {
            const scores = await this.getScores(1000); // Get more to process
            
            // Group by wallet and get best score for each
            const playerMap = new Map();
            
            scores.forEach(score => {
                if (!playerMap.has(score.wallet)) {
                    playerMap.set(score.wallet, score);
                } else {
                    const existing = playerMap.get(score.wallet);
                    if (score.score > existing.score) {
                        playerMap.set(score.wallet, score);
                    }
                }
            });

            // Convert to array and sort
            const topPlayers = Array.from(playerMap.values())
                .sort((a, b) => b.score - a.score)
                .slice(0, limit);

            return topPlayers;
        } catch (error) {
            console.error('❌ Failed to fetch top players:', error);
            return [];
        }
    }

    /**
     * Get leaderboard (alias for getTopPlayers for compatibility)
     */
    async getLeaderboard(limit = 10) {
        return this.getTopPlayers(limit);
    }
}

// Make it available globally
if (typeof window !== 'undefined') {
    window.LeaderboardBackend = LeaderboardBackend;
}

