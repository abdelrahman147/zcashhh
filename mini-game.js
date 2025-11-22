

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
        this.maxMissed = Infinity; // No limit - infinite game
        this.lives = 5; // 5 lives
        this.maxLives = 5;
        this.combo = 0;
        this.maxCombo = 0;
        this.streak = 0;
        this.consecutiveHits = 0;
        this.lastHitTime = null;
        this.comboMultiplier = 1.0;
        this.streakBonus = 0;
        this.gameSpeed = 1.0; // Progressive speed multiplier
        this.targetSpawnRate = 1500; // Base spawn rate in ms
        this.lastTargetSpawn = 0;
        this.clickTimes = []; // Track click times for anti-cheat
        this.lastClickTime = 0;
        this.powerUps = []; // Power-up system
        this.activePowerUps = {}; // Active power-ups
        this.achievements = []; // Achievement system
        this.bossTargets = 0; // Boss target counter
        this.totalHits = 0; // Total hits counter
        this.perfectHits = 0; // Perfect timing hits
        this.doublePointsActive = false;
        this.slowMotionActive = false;
        this.freezeTimeActive = false;
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
            this.lives = 5; // 5 lives
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
            this.gameSpeed = 1.0;
            this.targetSpawnRate = 1500;
            this.lastTargetSpawn = 0;
            this.clickTimes = [];
            this.lastClickTime = 0;
            this.powerUps = [];
            this.activePowerUps = {};
            this.achievements = [];
            this.bossTargets = 0;
            this.totalHits = 0;
            this.perfectHits = 0;
            this.doublePointsActive = false;
            this.slowMotionActive = false;
            this.freezeTimeActive = false;

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
        
        // Progressive speed: game gets faster over time - NO CAP, keeps getting harder
        const gameDuration = this.gameStartTime ? Date.now() - this.gameStartTime : 0;
        const speedMultiplier = 1.0 + (gameDuration / 30000); // 2% faster every 30 seconds
        this.gameSpeed = speedMultiplier; // No cap - infinite difficulty
        
        const targetType = this.getTargetType(difficulty);
        
        // Don't create target if boss is active and this isn't a power-up
        if (!targetType) {
            return null;
        }
        
        let targetSize = Math.max(25, 60 - (difficulty * 5));
        let targetPoints = Math.floor(10 + (difficulty * 5) + Math.random() * 15);
        let targetLifetime = Math.max(1500, Math.floor((4000 - (difficulty * 300)) / this.gameSpeed));
        let requiredHits = null;
        let isBoss = false;
        let isMegaBoss = false;
        let moveInterval = null;
        
        // Boss targets are bigger, worth more, require multiple hits, move around
        if (targetType === 'boss') {
            targetSize = 80;
            targetPoints = 100 + (difficulty * 20);
            targetLifetime = 30000; // 30 seconds to defeat
            requiredHits = 50 + Math.floor(Math.random() * 51); // 50-100 hits required
            isBoss = true;
            moveInterval = 5000; // Move every 5 seconds
            this.bossTargets++;
        }
        
        // Mega boss - ultimate challenge
        if (targetType === 'megaboss') {
            targetSize = 100;
            targetPoints = 500 + (difficulty * 50);
            targetLifetime = 30000; // 30 seconds to defeat
            requiredHits = 75 + Math.floor(Math.random() * 26); // 75-100 hits required
            isBoss = true;
            isMegaBoss = true;
            moveInterval = 5000; // Move every 5 seconds
            this.bossTargets++;
        }
        
        // Power-up targets are medium size
        if (targetType === 'powerup') {
            targetSize = 50;
            targetPoints = 0; // No points, just power-up
            targetLifetime = Math.max(2000, Math.floor((5000 - (difficulty * 300)) / this.gameSpeed));
        }
        
        const target = {
            id: Date.now() + Math.random(),
            x: Math.random() * (gameAreaWidth - 100),
            y: Math.random() * (gameAreaHeight - 100),
            size: targetSize, 
            speed: (0.5 + (difficulty * 0.3)) * this.gameSpeed,
            points: targetPoints,
            createdAt: Date.now(),
            lifetime: targetLifetime, 
            color: this.getTargetColor(difficulty),
            difficulty: difficulty,
            type: targetType,
            isMoving: targetType === 'speed', // Moving targets (bosses move differently)
            moveDirection: Math.random() * Math.PI * 2, // Random direction
            moveSpeed: 2 * this.gameSpeed,
            // Boss properties
            isBoss: isBoss,
            isMegaBoss: isMegaBoss,
            requiredHits: requiredHits,
            currentHits: 0,
            moveInterval: moveInterval,
            lastMoveTime: Date.now()
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
    
    hasActiveBoss() {
        // Check if there's an active boss on screen
        return this.targets.some(t => t.isBoss);
    }
    
    getTargetType(difficulty) {
        // Different target types for variety
        const types = ['normal', 'bonus', 'speed', 'combo', 'boss', 'powerup', 'megaboss'];
        
        // Don't spawn normal targets if boss is active
        if (this.hasActiveBoss()) {
            // Only allow power-ups during boss fights
            const powerUpChance = 0.05; // 5% chance for power-up during boss
            if (Math.random() < powerUpChance) {
                return 'powerup';
            }
            return null; // Don't spawn anything else
        }
        
        // Boss target every 20 hits - more frequent as game progresses
        const bossChance = Math.min(0.5, 0.2 + (this.totalHits / 200)); // Increases with hits
        if (this.totalHits > 0 && this.totalHits % 20 === 0 && Math.random() < bossChance) {
            return 'boss';
        }
        
        // Power-up target - more frequent as game gets harder
        const powerUpChance = Math.min(0.1, 0.03 + (this.gameSpeed / 50));
        if (Math.random() < powerUpChance) {
            return 'powerup';
        }
        
        // Mega boss every 100 hits
        if (this.totalHits > 0 && this.totalHits % 100 === 0 && Math.random() < 0.8) {
            return 'megaboss';
        }
        
        if (difficulty >= 4 && Math.random() < 0.2) return 'bonus'; // 20% chance for bonus
        if (difficulty >= 3 && Math.random() < 0.15) return 'speed'; // 15% chance for speed
        if (difficulty >= 2 && Math.random() < 0.1) return 'combo'; // 10% chance for combo
        return 'normal';
    }

    
    hitTarget(targetId) {
        if (!this.isPlaying) return false;
        
        // Anti-cheat: Check click timing
        const now = Date.now();
        const timeSinceLastClick = now - this.lastClickTime;
        this.clickTimes.push(now);
        
        // Keep only last 10 clicks
        if (this.clickTimes.length > 10) {
            this.clickTimes.shift();
        }
        
        // Detect impossible click speed (human can't click faster than 50ms consistently)
        if (timeSinceLastClick < 30 && this.clickTimes.length > 3) {
            const recentClicks = this.clickTimes.slice(-5);
            if (recentClicks.length > 1) {
                const intervals = [];
                for (let i = 1; i < recentClicks.length; i++) {
                    intervals.push(recentClicks[i] - recentClicks[i - 1]);
                }
                const avgInterval = intervals.reduce((a, b) => a + b, 0) / intervals.length;
                
                if (avgInterval < 40) {
                    console.warn('[Anti-Cheat] Suspicious click speed detected');
                    if (window.antiCheat) {
                        window.antiCheat.flagCheat('impossible_speed', 'Click speed too fast to be human');
                    }
                }
            }
        }
        
        this.lastClickTime = now;

        const targetIndex = this.targets.findIndex(t => t.id === targetId);
        if (targetIndex === -1) return false;

        const target = this.targets[targetIndex];
        const elapsed = Date.now() - target.createdAt;
        const timeBonus = Math.max(0, target.lifetime - elapsed);
        const bonusMultiplier = Math.floor(timeBonus / 200);
        
        // Handle different target types
        let typeBonus = 1;
        if (target.type === 'bonus') {
            typeBonus = 2; // Double points
        } else if (target.type === 'speed') {
            typeBonus = 1.5; // 50% bonus
        } else if (target.type === 'combo') {
            typeBonus = 1.2; // 20% bonus + combo boost
            this.combo += 2;
        } else if (target.type === 'boss' || target.type === 'megaboss') {
            // Boss targets require multiple hits
            if (!target.currentHits) {
                target.currentHits = 0;
            }
            target.currentHits++;
            
            // Check if boss is defeated
            if (target.currentHits >= target.requiredHits) {
                // Boss defeated!
                if (target.type === 'megaboss') {
                    typeBonus = 5; // 5x points for mega boss
                    this.combo += 10; // Huge combo boost
                    this.triggerAchievement('megaboss_slayer', 'MEGA BOSS DESTROYED!');
                } else {
                    typeBonus = 3; // Triple points for boss
                    this.combo += 5; // Big combo boost
                    this.triggerAchievement('boss_slayer', 'Boss Target Destroyed!');
                }
                // Boss is defeated, remove it
                this.targets.splice(targetIndex, 1);
            } else {
                // Boss still alive, just increment hit counter
                // Give small points for each hit
                const hitPoints = Math.floor(target.points / target.requiredHits);
                this.score += hitPoints;
                return {
                    hit: true,
                    points: hitPoints,
                    basePoints: hitPoints,
                    comboMultiplier: 1,
                    combo: this.combo,
                    streakBonus: 0,
                    totalScore: this.score,
                    bonus: 0,
                    target: target,
                    bossHits: target.currentHits,
                    bossRequired: target.requiredHits
                };
            }
        } else if (target.type === 'powerup') {
            // Activate random power-up
            this.activatePowerUp();
            return true; // Power-up doesn't give points
        }
        
        // Check for perfect hit (hit very quickly)
        const hitTime = elapsed;
        if (hitTime < 500) {
            this.perfectHits++;
            typeBonus *= 1.5; // Perfect hit bonus
            if (this.perfectHits % 5 === 0) {
                this.triggerAchievement('perfectionist', '5 Perfect Hits!');
            }
        }
        
        this.totalHits++;
        
        // Update combo and streak
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
        const comboMultiplier = Math.min(1.0 + (this.combo * 0.1), 3.0);
        
        // Calculate final score with all bonuses
        const baseScore = target.points;
        const timeBonusPoints = bonusMultiplier * 2;
        const comboPoints = Math.floor(baseScore * (comboMultiplier - 1));
        let finalScore = Math.floor((baseScore + timeBonusPoints + comboPoints) * typeBonus);
        
        // Apply active power-ups
        if (this.doublePointsActive) {
            finalScore *= 2;
        }
        if (this.slowMotionActive) {
            finalScore = Math.floor(finalScore * 1.2); // 20% bonus
        }
        
        this.score += finalScore;
        
        // Anti-cheat: Check for impossible scores
        if (this.score > 10000 && this.gameStartTime) {
            const gameTime = (Date.now() - this.gameStartTime) / 1000;
            const scorePerSecond = this.score / gameTime;
            if (scorePerSecond > 5000) { // Impossible to get 5000 points per second
                console.warn('[Anti-Cheat] Impossible score rate detected');
                if (window.antiCheat) {
                    window.antiCheat.flagCheat('impossible_score', `Score rate too high: ${scorePerSecond.toFixed(0)} pts/sec`);
                }
            }
        }
        this.streak++;
        this.targets.splice(targetIndex, 1);
        
        // Check achievements
        this.checkAchievements();

        // Log hit details
        const logData = {
            hit: true,
            points: finalScore,
            basePoints: baseScore,
            comboMultiplier: comboMultiplier.toFixed(2),
            combo: this.combo,
            streakBonus: this.streakBonus,
            totalScore: this.score,
            bonus: bonusMultiplier,
            timeBonus: Math.floor(timeBonus)
        };

        // Log milestone combos
        if (this.combo === 5) {
            console.log(`🔥 5x COMBO! Multiplier: ${comboMultiplier.toFixed(2)}x`);
        } else if (this.combo === 10) {
            console.log(`🔥🔥 10x COMBO! Multiplier: ${comboMultiplier.toFixed(2)}x`);
        } else if (this.combo === 20) {
            console.log(`🔥🔥🔥 20x COMBO! Multiplier: ${comboMultiplier.toFixed(2)}x`);
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
            points: finalScore,
            basePoints: baseScore,
            comboMultiplier: comboMultiplier,
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
        this.lives--;
        console.log(`❌ Target missed! Lives: ${this.lives}/${this.maxLives}`);
        
        // Reset combo and streak on miss
        if (this.combo > 0) {
            console.log(`💔 Combo broken! Was at ${this.combo}x`);
        }
        this.combo = 0;
        this.consecutiveHits = 0;
        this.comboMultiplier = 1.0;
        this.streakBonus = 0;
        this.lastHitTime = null;
        
        // Game over when lives reach 0
        if (this.lives <= 0) {
            console.log(`🏁 Game over! No lives remaining (${this.lives}/${this.maxLives})`);
            // Don't call this.endGame() here - let the global endGame() handle it
            // This ensures the score gets saved and UI gets reset properly
            const callGlobalEndGame = () => {
                if (typeof window !== 'undefined' && typeof window.endGame === 'function') {
                    console.log(`📞 Calling global endGame() to save score...`);
                    try {
                        window.endGame();
                    } catch (error) {
                        console.error(`❌ Error calling global endGame():`, error);
                        // Fallback: call this.endGame() if global function fails
                        this.endGame();
                    }
                } else {
                    console.warn(`⚠️ Global endGame() not available yet, retrying...`);
                    // Retry after a short delay
                    setTimeout(() => {
                        if (typeof window !== 'undefined' && typeof window.endGame === 'function') {
                            console.log(`📞 Retry: Calling global endGame()...`);
                            window.endGame();
                        } else {
                            console.error(`❌ Global endGame() still not available after retry - using fallback`);
                            // Fallback: call this.endGame() if global function not available
            this.endGame();
                        }
                    }, 200);
                }
            };
            
            // Call immediately, with a small delay to ensure everything is ready
            setTimeout(callGlobalEndGame, 50);
        }
    }

    
    endGame() {
        // Always return game stats, even if game already ended
        // This ensures score can be saved even if endGame is called multiple times
        const duration = this.gameStartTime ? (Date.now() - this.gameStartTime) : 0;
        const finalScore = this.score || 0;
        const maxCombo = this.maxCombo || 0;
        const finalStreak = this.streak || 0;
        const scorePerSecond = duration > 0 ? (finalScore / (duration / 1000)).toFixed(2) : 0;
        
        // Mark game as not playing
        this.isPlaying = false;
        
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
            remainingLives: this.lives,
            targetsActive: this.targets.length,
            gameTime: this.gameStartTime ? Date.now() - this.gameStartTime : 0,
            combo: this.combo,
            maxCombo: this.maxCombo,
            streak: this.streak,
            comboMultiplier: this.comboMultiplier,
            streakBonus: this.streakBonus,
            totalHits: this.totalHits,
            perfectHits: this.perfectHits,
            bossTargets: this.bossTargets,
            activePowerUps: Object.keys(this.activePowerUps).length
        };
    }
    
    activatePowerUp() {
        const powerUps = ['extraLife', 'doublePoints', 'slowMotion', 'freezeTime'];
        const powerUp = powerUps[Math.floor(Math.random() * powerUps.length)];
        
        this.activePowerUps[powerUp] = Date.now() + 10000; // 10 seconds
        
        if (powerUp === 'extraLife') {
            this.lives = Math.min(this.lives + 1, this.maxLives);
            this.triggerAchievement('powerup_life', 'Extra Life Power-Up!');
        } else if (powerUp === 'doublePoints') {
            this.doublePointsActive = true;
            this.triggerAchievement('powerup_double', 'Double Points Active!');
        } else if (powerUp === 'slowMotion') {
            this.slowMotionActive = true;
            this.triggerAchievement('powerup_slow', 'Slow Motion Active!');
        } else if (powerUp === 'freezeTime') {
            this.freezeTimeActive = true;
            this.triggerAchievement('powerup_freeze', 'Time Freeze Active!');
        }
        
        // Remove power-up after duration
        setTimeout(() => {
            delete this.activePowerUps[powerUp];
            if (powerUp === 'doublePoints') this.doublePointsActive = false;
            if (powerUp === 'slowMotion') this.slowMotionActive = false;
            if (powerUp === 'freezeTime') this.freezeTimeActive = false;
        }, 10000);
    }
    
    triggerAchievement(id, message) {
        if (this.achievements.includes(id)) return;
        this.achievements.push(id);
        if (window.showAchievement) {
            window.showAchievement(message);
        }
    }
    
    checkAchievements() {
        // Score milestones
        if (this.score >= 1000 && !this.achievements.includes('score_1k')) {
            this.triggerAchievement('score_1k', '1,000 Points!');
        }
        if (this.score >= 5000 && !this.achievements.includes('score_5k')) {
            this.triggerAchievement('score_5k', '5,000 Points!');
        }
        if (this.score >= 10000 && !this.achievements.includes('score_10k')) {
            this.triggerAchievement('score_10k', '10,000 Points!');
        }
        
        // Combo achievements
        if (this.combo >= 10 && !this.achievements.includes('combo_10')) {
            this.triggerAchievement('combo_10', '10x Combo!');
        }
        if (this.combo >= 20 && !this.achievements.includes('combo_20')) {
            this.triggerAchievement('combo_20', '20x Combo!');
        }
        
        // Hit achievements
        if (this.totalHits >= 50 && !this.achievements.includes('hits_50')) {
            this.triggerAchievement('hits_50', '50 Hits!');
        }
        if (this.totalHits >= 100 && !this.achievements.includes('hits_100')) {
            this.triggerAchievement('hits_100', '100 Hits!');
        }
    }
}


if (typeof window !== 'undefined') {
    window.MiniGame = MiniGame;
}

if (typeof module !== 'undefined' && module.exports) {
    module.exports = MiniGame;
}

