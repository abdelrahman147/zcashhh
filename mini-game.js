/**
 * Mini Game - Pay to Play
 * Costs 0.01 SOL per game
 */

class MiniGame {
    constructor(config = {}) {
        this.api = config.api || null;
        this.gameWallet = 'Hw87YF66ND8v7yAyJKEJqMvDxZrHAHiHy8qsWghddC2Z'; // Token buyback & burn wallet
        this.adminWallet = '7FSRx9hk9GHcqJNRsG8B9oTLSZSohNB7TZc9pPio45Gn'; // Admin wallet (no payment required)
        this.gameCost = 0.01; // SOL
        this.score = 0;
        this.isPlaying = false;
        this.gameStartTime = null;
        this.targets = [];
        this.missedTargets = 0;
        this.maxMissed = 5;
    }

    /**
     * Initialize game with API
     */
    init(apiInstance) {
        this.api = apiInstance;
    }

    /**
     * Start a new game (requires payment unless admin wallet)
     */
    async startGame() {
        if (!this.api || !this.api.bridge || !this.api.bridge.solanaWallet) {
            throw new Error('Please connect your Solana wallet first');
        }

        if (this.isPlaying) {
            throw new Error('Game already in progress');
        }

        const isAdminWallet = this.api.bridge.solanaWallet === this.adminWallet;
        let paymentResult = null;

        try {
            // Process payment (skip for admin wallet)
            if (!isAdminWallet) {
                paymentResult = await this.api.sendPayment(
                    this.gameCost,
                    this.gameWallet,
                    `TokenBuyback-${Date.now()}`
                );

                if (!paymentResult.success) {
                    throw new Error('Payment failed: ' + paymentResult.error);
                }
            }

            // Reset game state
            this.score = 0;
            this.missedTargets = 0;
            this.targets = [];
            this.isPlaying = true;
            this.gameStartTime = Date.now();
            this.paymentSignature = isAdminWallet ? null : paymentResult.signature;

            return {
                success: true,
                paymentSignature: this.paymentSignature,
                isAdmin: isAdminWallet,
                message: isAdminWallet ? 'Admin access granted! Game starting...' : 'Payment successful! Game starting...'
            };
        } catch (error) {
            throw new Error('Failed to start game: ' + error.message);
        }
    }

    /**
     * Create a new target
     */
    createTarget(gameAreaWidth = 800, gameAreaHeight = 500) {
        // Calculate difficulty based on score
        const difficulty = Math.min(1 + Math.floor(this.score / 100), 5);
        
        const target = {
            id: Date.now() + Math.random(),
            x: Math.random() * (gameAreaWidth - 100),
            y: Math.random() * (gameAreaHeight - 100),
            size: Math.max(30, 60 - (difficulty * 5)), // Smaller targets as difficulty increases
            speed: 0.5 + (difficulty * 0.3),
            points: Math.floor(10 + (difficulty * 5) + Math.random() * 15),
            createdAt: Date.now(),
            lifetime: Math.max(2000, 4000 - (difficulty * 300)), // Faster disappearing
            color: this.getTargetColor(difficulty)
        };
        this.targets.push(target);
        return target;
    }
    
    /**
     * Get target color based on difficulty
     */
    getTargetColor(difficulty) {
        const colors = [
            '#00d4ff', // Easy - cyan
            '#00ff88', // Medium - green
            '#ffaa00', // Hard - orange
            '#ff4444', // Very Hard - red
            '#ff00ff'  // Extreme - magenta
        ];
        return colors[Math.min(difficulty - 1, colors.length - 1)];
    }

    /**
     * Click on a target
     */
    hitTarget(targetId) {
        if (!this.isPlaying) return false;

        const targetIndex = this.targets.findIndex(t => t.id === targetId);
        if (targetIndex === -1) return false;

        const target = this.targets[targetIndex];
        const elapsed = Date.now() - target.createdAt;
        const timeBonus = Math.max(0, target.lifetime - elapsed);
        const bonusMultiplier = Math.floor(timeBonus / 200); // Bonus for quick hits
        const points = target.points + bonusMultiplier;

        this.score += points;
        this.targets.splice(targetIndex, 1);

        return {
            hit: true,
            points: points,
            totalScore: this.score,
            bonus: bonusMultiplier,
            target: target
        };
    }

    /**
     * Miss a target
     */
    missTarget() {
        if (!this.isPlaying) return;

        this.missedTargets++;
        if (this.missedTargets >= this.maxMissed) {
            this.endGame();
        }
    }

    /**
     * End the game
     */
    endGame() {
        if (!this.isPlaying) return null;

        const duration = Date.now() - this.gameStartTime;
        const finalScore = this.score;
        
        this.isPlaying = false;
        this.targets = [];
        this.gameStartTime = null;

        return {
            score: finalScore,
            duration: duration,
            missedTargets: this.missedTargets,
            paymentSignature: this.paymentSignature || null
        };
    }

    /**
     * Get game stats
     */
    getStats() {
        return {
            isPlaying: this.isPlaying,
            score: this.score,
            missedTargets: this.missedTargets,
            remainingLives: Math.max(0, this.maxMissed - this.missedTargets),
            targetsActive: this.targets.length,
            gameTime: this.gameStartTime ? Date.now() - this.gameStartTime : 0
        };
    }
}

// Export for use
if (typeof window !== 'undefined') {
    window.MiniGame = MiniGame;
}

if (typeof module !== 'undefined' && module.exports) {
    module.exports = MiniGame;
}

