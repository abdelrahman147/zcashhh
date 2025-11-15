

class AntiCheat {
    constructor() {
        this.detectedCheats = [];
        this.originalConsole = {};
        this.originalGameMethods = {};
        this.isCheating = false;
        this.init();
    }
    
    init() {
        
        this.protectConsole();
        
        
        this.detectDevTools();
        
        
        this.protectGameObject();
        
        
        this.detectStorageManipulation();
        
        // Disable score manipulation detection - it's too aggressive and flags legitimate boss hits
        // this.detectScoreManipulation();
        
        this.detectImpossibleSpeed();
        
        this.monitorActivity();
    }
    
    protectConsole() {
        
        this.originalConsole.log = console.log;
        this.originalConsole.warn = console.warn;
        this.originalConsole.error = console.error;
        
        
        // DISABLED: Console protection is too aggressive and flags legitimate game logs
        // Game uses console.log for normal gameplay logging (scores, combos, etc.)
        // Only protect against actual manipulation attempts, not normal logging
        const self = this;
        console.log = function(...args) {
            // Only flag if someone is trying to manipulate game state via console
            // Don't flag normal game logs about scores, combos, etc.
            const logString = args.map(arg => String(arg)).join(' ');
            if (logString.includes('game.score =') || 
                logString.includes('game.score=') ||
                logString.includes('window.game.score =') ||
                logString.includes('Object.defineProperty') ||
                logString.includes('cheat') && logString.includes('hack')) {
                self.flagCheat('console_manipulation', 'Suspicious console manipulation detected');
            }
            self.originalConsole.log.apply(console, args);
        };
    }
    
    detectDevTools() {
        let devtools = {open: false, orientation: null};
        const threshold = 160;
        
        setInterval(() => {
            if (window.outerHeight - window.innerHeight > threshold || 
                window.outerWidth - window.innerWidth > threshold) {
                if (!devtools.open) {
                    devtools.open = true;
                    this.flagCheat('devtools', 'Developer tools detected');
                }
            } else {
                devtools.open = false;
            }
        }, 500);
        
        
        document.addEventListener('keydown', (e) => {
            if (e.key === 'F12' || 
                (e.ctrlKey && e.shiftKey && (e.key === 'I' || e.key === 'J')) ||
                (e.ctrlKey && e.key === 'U')) {
                e.preventDefault();
                this.flagCheat('devtools_shortcut', 'DevTools shortcut detected');
            }
        });
        
        
        document.addEventListener('contextmenu', (e) => {
            if (e.target.closest('#game-area')) {
                e.preventDefault();
                this.flagCheat('context_menu', 'Right-click disabled in game area');
            }
        });
    }
    
    protectGameObject() {
        if (!window.game) return;
        
        
        this.originalGameMethods.score = window.game.score;
        this.originalGameMethods.hitTarget = window.game.hitTarget;
        
        
        // DISABLED: Score manipulation detection is too aggressive and flags legitimate boss hits
        // Bosses can give huge score increases (up to 500+ points per hit with multipliers)
        // Combo multipliers can also cause large score jumps
        // Only protect against truly impossible increases (100x+ in single update)
        let protectedScore = window.game.score;
        Object.defineProperty(window.game, 'score', {
            get: () => protectedScore,
            set: (value) => {
                // Only flag if score increases by more than 100x in a single update (truly impossible)
                // This allows for boss hits, combos, multipliers, and all legitimate gameplay
                if (value > protectedScore * 100 && protectedScore > 0) {
                    this.flagCheat('score_manipulation', 'Impossible score increase detected (> 100x)');
                    return;
                }
                protectedScore = value;
            }
        });
    }
    
    detectStorageManipulation() {
        const originalSetItem = Storage.prototype.setItem;
        const self = this;
        
        Storage.prototype.setItem = function(key, value) {
            if (key.includes('score') || key.includes('leaderboard')) {
                self.flagCheat('storage_manipulation', 'Attempted localStorage manipulation');
                return;
            }
            originalSetItem.call(this, key, value);
        };
    }
    
    detectScoreManipulation() {
        
        let lastScore = 0;
        let lastCheck = Date.now();
        
        setInterval(() => {
            if (window.game && window.game.isPlaying) {
                const currentScore = window.game.score;
                const timeDiff = Date.now() - lastCheck;
                
                
                if (currentScore > lastScore + 1000 && timeDiff < 1000) {
                    this.flagCheat('rapid_score_increase', 'Suspicious rapid score increase');
                }
                
                lastScore = currentScore;
                lastCheck = Date.now();
            }
        }, 1000);
    }
    
    detectImpossibleSpeed() {
        let clickTimes = [];
        let lastClickTime = 0;
        let clickIntervals = [];
        const MAX_CLICKS_TO_TRACK = 20;
        
        // Track clicks in game area
        const setupDetection = () => {
            const gameArea = document.getElementById('game-area');
            if (!gameArea) {
                // Wait for game area to be created
                setTimeout(setupDetection, 1000);
                return;
            }
            
            gameArea.addEventListener('click', (e) => {
                const now = Date.now();
                const interval = now - lastClickTime;
                
                // Track click intervals
                if (lastClickTime > 0) {
                    clickIntervals.push(interval);
                    if (clickIntervals.length > MAX_CLICKS_TO_TRACK) {
                        clickIntervals.shift();
                    }
                }
                
                // Check 1: Impossibly fast single clicks (< 30ms is humanly impossible)
                if (interval > 0 && interval < 30) {
                    this.flagCheat('impossible_speed', 'Impossibly fast clicking detected (< 30ms)');
                    return;
                }
                
                // Check 2: Perfect timing pattern (auto-clickers often have consistent intervals)
                if (clickIntervals.length >= 10) {
                    const avgInterval = clickIntervals.reduce((a, b) => a + b, 0) / clickIntervals.length;
                    const variance = clickIntervals.reduce((sum, interval) => {
                        return sum + Math.pow(interval - avgInterval, 2);
                    }, 0) / clickIntervals.length;
                    const stdDev = Math.sqrt(variance);
                    
                    // Auto-clickers have very low variance (consistent timing)
                    // Human clicks have natural variation
                    if (stdDev < 5 && avgInterval < 100) {
                        this.flagCheat('auto_clicker_pattern', 'Auto-clicker pattern detected (too consistent timing)');
                        return;
                    }
                }
                
                // Check 3: Sustained high-speed clicking (human can't maintain > 10 clicks/sec for long)
                if (clickIntervals.length >= 15) {
                    const recentIntervals = clickIntervals.slice(-15);
                    const avgRecent = recentIntervals.reduce((a, b) => a + b, 0) / recentIntervals.length;
                    const clicksPerSecond = 1000 / avgRecent;
                    
                    if (clicksPerSecond > 12 && avgRecent < 85) {
                        this.flagCheat('sustained_high_speed', 'Sustained high-speed clicking detected (> 12 clicks/sec)');
                        return;
                    }
                }
                
                // Check 4: Too many clicks in short burst (human can't click 20+ times in 1 second)
                clickTimes.push(now);
                clickTimes = clickTimes.filter(time => now - time < 1000); // Keep only last second
                
                if (clickTimes.length > 20) {
                    this.flagCheat('burst_clicking', 'Burst clicking detected (> 20 clicks in 1 second)');
                    return;
                }
                
                lastClickTime = now;
            });
            
            // Check 5: Monitor for perfect pixel accuracy (auto-clickers click exact same spot)
            let lastClickPosition = null;
            let samePositionCount = 0;
            
            gameArea.addEventListener('click', (e) => {
                const pos = { x: Math.round(e.clientX / 5) * 5, y: Math.round(e.clientY / 5) * 5 };
                
                if (lastClickPosition && 
                    lastClickPosition.x === pos.x && 
                    lastClickPosition.y === pos.y) {
                    samePositionCount++;
                    if (samePositionCount > 5) {
                        this.flagCheat('pixel_perfect_clicking', 'Pixel-perfect clicking detected (auto-clicker pattern)');
                    }
                } else {
                    samePositionCount = 0;
                }
                
                lastClickPosition = pos;
            });
        };
        
        setupDetection();
    }
    
    detectScoreManipulation() {
        // DISABLED: This detection method is too aggressive
        // It conflicts with protectGameObject and flags legitimate gameplay
        // Score protection is handled in protectGameObject() instead
        // This method is kept for reference but not called
        return;
    }
    
    monitorActivity() {
        
        document.addEventListener('visibilitychange', () => {
            if (document.hidden && window.game && window.game.isPlaying) {
                this.flagCheat('background_tab', 'Game running in background tab');
            }
        });
        
        
        let resizeCount = 0;
        window.addEventListener('resize', () => {
            resizeCount++;
            if (resizeCount > 10) {
                this.flagCheat('excessive_resize', 'Excessive window resizing detected');
            }
        });
        
        
        setInterval(() => {
            resizeCount = 0;
        }, 5000);
    }
    
    flagCheat(type, message) {
        if (this.detectedCheats.includes(type)) {
            return; 
        }
        
        this.detectedCheats.push(type);
        this.isCheating = true;
        
        console.warn(`[Anti-Cheat] ${message}`);
        
        
        if (window.game && window.game.isPlaying) {
            window.game.endGame();
            if (window.showGameStatus) {
                window.showGameStatus('Cheating detected! Game ended.', 'error');
            }
        }
        
        
        this.reportCheat(type, message);
    }
    
    async reportCheat(type, message) {
        try {
            await fetch(window.location.origin + '/api/cheat-report', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    type: type,
                    message: message,
                    wallet: window.bridge?.solanaWallet || 'unknown',
                    timestamp: Date.now()
                })
            });
        } catch (error) {
            
        }
    }
    
    reset() {
        this.detectedCheats = [];
        this.isCheating = false;
    }
}


if (typeof window !== 'undefined') {
    window.AntiCheat = AntiCheat;
}

if (typeof module !== 'undefined' && module.exports) {
    module.exports = AntiCheat;
}

