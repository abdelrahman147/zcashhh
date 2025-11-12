

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
        
        
        this.detectScoreManipulation();
        
        
        this.monitorActivity();
    }
    
    protectConsole() {
        
        this.originalConsole.log = console.log;
        this.originalConsole.warn = console.warn;
        this.originalConsole.error = console.error;
        
        
        const self = this;
        console.log = function(...args) {
            if (args.some(arg => typeof arg === 'string' && 
                (arg.includes('score') || arg.includes('cheat') || arg.includes('hack')))) {
                self.flagCheat('console_manipulation', 'Suspicious console usage detected');
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
        
        
        let protectedScore = window.game.score;
        Object.defineProperty(window.game, 'score', {
            get: () => protectedScore,
            set: (value) => {
                if (value > protectedScore + 1000) {
                    
                    this.flagCheat('score_manipulation', 'Score manipulation detected');
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
            await fetch('http://localhost:3001/api/cheat-report', {
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

