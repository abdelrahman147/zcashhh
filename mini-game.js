

class MiniGame {
    constructor(config = {}) {
        this.api = config.api || null;
        this.gameWallet = 'Hw87YF66ND8v7yAyJKEJqMvDxZrHAHiHy8qsWghddC2Z'; 
        this.adminWallet = '7FSRx9hk9GHcqJNRsG8B9oTLSZSohNB7TZc9pPio45Gn'; 
        this.gameCost = 0.01; 
        this.score = 0;
        this.isPlaying = false;
        this.gameStartTime = null;
        this.targets = [];
        this.missedTargets = 0;
        this.maxMissed = 5;
        this.combo = 0;
        this.maxCombo = 0;
        this.streak = 0;
        this.consecutiveHits = 0;
        this.lastHitTime = null;
        this.comboMultiplier = 1.0;
        this.streakBonus = 0;
    }

    
    init(apiInstance) {
        this.api = apiInstance;
    }

    
    async startGame() {
        if (!this.api || !this.api.bridge || !this.api.bridge.solanaWallet) {
            throw new Error('Please connect your Solana wallet first');
        }

        if (this.isPlaying) {
            throw new Error('Game already in progress');
        }

        try {
            // Game is now free to play - just need wallet connection
            this.score = 0;
            this.missedTargets = 0;
            this.targets = [];
            this.isPlaying = true;
            this.gameStartTime = Date.now();
            this.paymentSignature = null; // No payment needed
            this.combo = 0;
            this.maxCombo = 0;
            this.streak = 0;
            this.consecutiveHits = 0;
            this.comboMultiplier = 1.0;
            this.streakBonus = 0;
            this.lastHitTime = null;

            const wallet = this.api.bridge.solanaWallet;
            console.log(`🎮 Game started for wallet: ${wallet.substring(0, 8)}...${wallet.substring(wallet.length - 8)}`);
            console.log(`⏰ Start time: ${new Date().toISOString()}`);

            return {
                success: true,
                paymentSignature: null,
                isAdmin: false,
                message: 'Game starting...'
            };
        } catch (error) {
            console.error('❌ Failed to start game:', error);
            throw new Error('Failed to start game: ' + error.message);
        }
    }

    
    createTarget(gameAreaWidth = 800, gameAreaHeight = 500) {
        
        const baseDifficulty = Math.min(1 + Math.floor(this.score / 100), 5);
        
        // Oracle-based dynamic difficulty adjustment
        let oracleModifier = 1.0;
        if (this.api && this.api.bridge && window.oracle) {
            try {
                const solPrice = window.oracle.getPriceFeed('SOL');
                if (solPrice && solPrice.price) {
                    // Adjust difficulty based on SOL price volatility
                    // Higher volatility = slightly harder targets
                    const priceChange = Math.abs(solPrice.change24h || 0);
                    oracleModifier = 1.0 + (priceChange / 100) * 0.1; // Max 10% modifier
                }
            } catch (e) {
                // Ignore oracle errors, use base difficulty
            }
        }
        
        const difficulty = Math.min(Math.floor(baseDifficulty * oracleModifier), 5);
        
        const target = {
            id: Date.now() + Math.random(),
            x: Math.random() * (gameAreaWidth - 100),
            y: Math.random() * (gameAreaHeight - 100),
            size: Math.max(30, 60 - (difficulty * 5)), 
            speed: 0.5 + (difficulty * 0.3),
            points: Math.floor(10 + (difficulty * 5) + Math.random() * 15),
            createdAt: Date.now(),
            lifetime: Math.max(2000, 4000 - (difficulty * 300)), 
            color: this.getTargetColor(difficulty),
            difficulty: difficulty
        };
        this.targets.push(target);
        return target;
    }
    
    
    getTargetColor(difficulty) {
        const colors = [
            '#00d4ff', 
            '#00ff88', 
            '#ffaa00', 
            '#ff4444', 
            '#ff00ff'  
        ];
        return colors[Math.min(difficulty - 1, colors.length - 1)];
    }

    
    hitTarget(targetId) {
        if (!this.isPlaying) return false;

        const targetIndex = this.targets.findIndex(t => t.id === targetId);
        if (targetIndex === -1) return false;

        const target = this.targets[targetIndex];
        const elapsed = Date.now() - target.createdAt;
        const timeBonus = Math.max(0, target.lifetime - elapsed);
        const bonusMultiplier = Math.floor(timeBonus / 200);
        
        // Update combo and streak
        const now = Date.now();
        if (this.lastHitTime && (now - this.lastHitTime) < 3000) {
            this.combo++;
            this.consecutiveHits++;
        } else {
            this.combo = 1;
            this.consecutiveHits = 1;
        }
        this.lastHitTime = now;
        
        if (this.combo > this.maxCombo) {
            this.maxCombo = this.combo;
        }
        
        // Calculate combo multiplier (caps at 3x for 10+ combo)
        this.comboMultiplier = Math.min(1.0 + (this.combo * 0.1), 3.0);
        
        // Calculate streak bonus (extra points for consecutive hits)
        this.streakBonus = Math.floor(this.consecutiveHits / 5) * 5;
        
        // Base points calculation
        let basePoints = target.points + bonusMultiplier;
        
        // Apply combo multiplier
        const comboPoints = Math.floor(basePoints * this.comboMultiplier);
        
        // Add streak bonus
        const totalPoints = comboPoints + this.streakBonus;
        
        this.score += totalPoints;
        this.streak++;
        this.targets.splice(targetIndex, 1);

        // Log hit details
        const logData = {
            hit: true,
            points: totalPoints,
            basePoints: basePoints,
            comboMultiplier: this.comboMultiplier.toFixed(2),
            combo: this.combo,
            streakBonus: this.streakBonus,
            totalScore: this.score,
            bonus: bonusMultiplier,
            timeBonus: Math.floor(timeBonus)
        };

        // Log milestone combos
        if (this.combo === 5) {
            console.log(`🔥 5x COMBO! Multiplier: ${this.comboMultiplier.toFixed(2)}x`);
        } else if (this.combo === 10) {
            console.log(`🔥🔥 10x COMBO! Multiplier: ${this.comboMultiplier.toFixed(2)}x`);
        } else if (this.combo === 20) {
            console.log(`🔥🔥🔥 20x COMBO! Multiplier: ${this.comboMultiplier.toFixed(2)}x`);
        }

        // Log streak milestones
        if (this.consecutiveHits === 10) {
            console.log(`⚡ 10 HIT STREAK! Bonus: +${this.streakBonus} points`);
        } else if (this.consecutiveHits === 25) {
            console.log(`⚡⚡ 25 HIT STREAK! Bonus: +${this.streakBonus} points`);
        } else if (this.consecutiveHits === 50) {
            console.log(`⚡⚡⚡ 50 HIT STREAK! Bonus: +${this.streakBonus} points`);
        }

        // Log every 100 points milestone
        if (this.score % 100 === 0 && this.score > 0) {
            console.log(`📊 Score milestone: ${this.score} points!`);
        }

        return {
            hit: true,
            points: totalPoints,
            basePoints: basePoints,
            comboMultiplier: this.comboMultiplier,
            combo: this.combo,
            streakBonus: this.streakBonus,
            totalScore: this.score,
            bonus: bonusMultiplier,
            target: target
        };
    }

    
    missTarget() {
        if (!this.isPlaying) return;

        this.missedTargets++;
        console.log(`❌ Target missed! (${this.missedTargets}/${this.maxMissed} misses)`);
        
        // Reset combo and streak on miss
        if (this.combo > 0) {
            console.log(`💔 Combo broken! Was at ${this.combo}x`);
        }
        this.combo = 0;
        this.consecutiveHits = 0;
        this.comboMultiplier = 1.0;
        this.streakBonus = 0;
        this.lastHitTime = null;
        
        if (this.missedTargets >= this.maxMissed) {
            console.log(`🏁 Game over! Max misses reached (${this.missedTargets}/${this.maxMissed})`);
            this.endGame();
        }
    }

    
    endGame() {
        if (!this.isPlaying) return null;

        const duration = Date.now() - this.gameStartTime;
        const finalScore = this.score;
        const maxCombo = this.maxCombo;
        const finalStreak = this.streak;
        const scorePerSecond = duration > 0 ? (finalScore / (duration / 1000)).toFixed(2) : 0;
        
        // Comprehensive game end logging
        console.log(`\n🏁 ========== GAME ENDED ==========`);
        console.log(`📊 Final Score: ${finalScore.toLocaleString()} points`);
        console.log(`⏱️  Duration: ${(duration / 1000).toFixed(2)}s`);
        console.log(`⚡ Score Rate: ${scorePerSecond} points/sec`);
        console.log(`🔥 Max Combo: ${maxCombo}x`);
        console.log(`💪 Final Streak: ${finalStreak}`);
        console.log(`❌ Missed Targets: ${this.missedTargets}/${this.maxMissed}`);
        if (this.api && this.api.bridge && this.api.bridge.solanaWallet) {
            const wallet = this.api.bridge.solanaWallet;
            console.log(`👛 Wallet: ${wallet.substring(0, 8)}...${wallet.substring(wallet.length - 8)}`);
        }
        console.log(`⏰ End time: ${new Date().toISOString()}`);
        console.log(`=====================================\n`);
        
        this.isPlaying = false;
        this.targets = [];
        this.gameStartTime = null;
        this.combo = 0;
        this.maxCombo = 0;
        this.streak = 0;
        this.consecutiveHits = 0;
        this.comboMultiplier = 1.0;
        this.streakBonus = 0;
        this.lastHitTime = null;

        return {
            score: finalScore,
            duration: duration,
            missedTargets: this.missedTargets,
            maxCombo: maxCombo,
            finalStreak: finalStreak,
            paymentSignature: this.paymentSignature || null
        };
    }

    
    getStats() {
        return {
            isPlaying: this.isPlaying,
            score: this.score,
            missedTargets: this.missedTargets,
            remainingLives: Math.max(0, this.maxMissed - this.missedTargets),
            targetsActive: this.targets.length,
            gameTime: this.gameStartTime ? Date.now() - this.gameStartTime : 0,
            combo: this.combo,
            maxCombo: this.maxCombo,
            streak: this.streak,
            comboMultiplier: this.comboMultiplier,
            streakBonus: this.streakBonus
        };
    }
}


if (typeof window !== 'undefined') {
    window.MiniGame = MiniGame;
}

if (typeof module !== 'undefined' && module.exports) {
    module.exports = MiniGame;
}

