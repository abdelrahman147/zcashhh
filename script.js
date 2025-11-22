(function() {
    'use strict';
    
    // Simple SDK site functionality
    document.addEventListener('DOMContentLoaded', function() {
        console.log('ZK-PayLink site initialized');
        
        // Smooth scrolling for navigation links
        document.querySelectorAll('a[href^="#"]').forEach(anchor => {
            anchor.addEventListener('click', function (e) {
                e.preventDefault();
                const href = this.getAttribute('href');
                console.log('Navigation link clicked:', href);
                
                // Special handling for #payments - go to dashboard and switch to payments tab
                if (href === '#payments') {
                    const merchantSection = document.getElementById('dashboard');
                    if (merchantSection) {
                        merchantSection.scrollIntoView({ behavior: 'smooth', block: 'start' });
                        // Switch to payments tab after scrolling
                        setTimeout(() => {
                            const paymentsTab = document.querySelector('[data-tab="payments"]');
                            if (paymentsTab) {
                                paymentsTab.click();
                            }
                        }, 500);
                    }
                    return;
                }
                
                // Special handling for #game
                if (href === '#game') {
                    const gameSection = document.getElementById('game');
                    if (gameSection) {
                        console.log('Scrolling to game section');
                        gameSection.scrollIntoView({ behavior: 'smooth', block: 'start' });
                    } else {
                        console.error('Game section not found');
                    }
                    return;
                }
                
                const target = document.querySelector(href);
                if (target) {
                    console.log('Scrolling to:', href);
                    target.scrollIntoView({ behavior: 'smooth', block: 'start' });
                } else {
                    console.error('Target not found:', href);
                }
            });
        });
        
        // Get Started button
        const getStartedBtn = document.getElementById('get-started-btn');
        if (getStartedBtn) {
            getStartedBtn.addEventListener('click', function() {
                const quickstart = document.getElementById('quickstart');
                if (quickstart) {
                    quickstart.scrollIntoView({ behavior: 'smooth' });
                }
            });
        }
        
        // Install button
        const installBtn = document.getElementById('install-btn');
        if (installBtn) {
            installBtn.addEventListener('click', function() {
                const quickstart = document.getElementById('quickstart');
                if (quickstart) {
                    quickstart.scrollIntoView({ behavior: 'smooth' });
                }
            });
        }
        
        // Play Game button - scroll to game section
        const viewDocsBtn = document.getElementById('view-docs-btn');
        if (viewDocsBtn) {
            viewDocsBtn.addEventListener('click', function(e) {
                e.preventDefault();
                e.stopPropagation();
                console.log('Play Game button clicked');
                const gameSection = document.getElementById('game');
                if (gameSection) {
                    console.log('Scrolling to game section');
                    gameSection.scrollIntoView({ behavior: 'smooth', block: 'start' });
                } else {
                    console.error('Game section not found');
                }
            });
        } else {
            console.warn('Play Game button not found');
        }
        
        // Try Payments button - scroll to payment dashboard
        const tryDemoBtn = document.getElementById('try-demo-btn');
        if (tryDemoBtn) {
            tryDemoBtn.addEventListener('click', function() {
                const merchantSection = document.getElementById('dashboard');
                if (merchantSection) {
                    merchantSection.scrollIntoView({ behavior: 'smooth' });
                    // Switch to payments tab
                    const paymentsTab = document.querySelector('[data-tab="payments"]');
                    if (paymentsTab) {
                        paymentsTab.click();
                    }
                }
            });
        }
        
        // Buy Token button - redirect to pump.fun
        const buyTokenBtn = document.getElementById('buy-token-btn');
        if (buyTokenBtn) {
            buyTokenBtn.addEventListener('click', function(e) {
                e.preventDefault();
                e.stopPropagation();
                console.log('Buy Token clicked - opening pump.fun');
                // Try multiple methods to open the link
                const url = 'https://pump.fun/';
                const opened = window.open(url, '_blank', 'noopener,noreferrer');
                if (!opened || opened.closed || typeof opened.closed === 'undefined') {
                    // Popup blocked, try direct navigation
                    console.warn('Popup blocked, trying direct navigation');
                    window.location.href = url;
                }
            });
        } else {
            console.warn('Buy Token button not found');
        }
        
        // Connect Wallet button in hero
        const connectWalletHeroBtn = document.getElementById('connect-wallet-hero-btn');
        if (connectWalletHeroBtn) {
            connectWalletHeroBtn.addEventListener('click', async function() {
                // Connect wallet immediately, no scrolling
                if (window.connectWallet) {
                    await window.connectWallet();
                } else {
                    // Fallback if function not available yet
                    await connectWalletDirect();
                }
            });
        }
        
        // Direct wallet connection function
        async function connectWalletDirect() {
            try {
                if (typeof window === 'undefined' || !window.solana || !window.solana.isPhantom) {
                    alert('Phantom wallet not found. Please install Phantom wallet from https://phantom.app');
                    return;
                }
                
                const resp = await window.solana.connect({ onlyIfTrusted: false });
                if (resp && resp.publicKey) {
                    // Initialize bridge if not exists
                    // Bridge service removed - using Solana payments only
                    if (!window.bridge) {
                        window.bridge = null; // No bridge needed
                        try {
                            await window.bridge.init();
                        } catch (e) {
                            console.warn('Bridge init warning:', e);
                        }
                    }
                    
                    // Update bridge wallet
                    if (window.bridge) {
                        window.bridge.solanaWallet = resp.publicKey.toString();
                        console.log('Wallet connected:', window.bridge.solanaWallet);
                    }
                    
                    // Update API bridge if it exists - CRITICAL
                    if (window.api) {
                        if (!window.api.bridge) {
                            window.api.bridge = window.bridge;
                        } else {
                            window.api.bridge.solanaWallet = resp.publicKey.toString();
                        }
                    }
                    
                    // Also update game's API if it exists
                    if (window.game && window.game.api) {
                        if (!window.game.api.bridge) {
                            window.game.api.bridge = window.bridge;
                        } else {
                            window.game.api.bridge.solanaWallet = resp.publicKey.toString();
                        }
                    }
                    
                    // Update hero button
                    const heroBtn = document.getElementById('connect-wallet-hero-btn');
                    if (heroBtn) {
                        heroBtn.textContent = 'Wallet Connected';
                        heroBtn.style.background = 'var(--accent-success)';
                    }
                    
                    // Update game section button if it exists
                    const gameStartBtn = document.getElementById('start-game-btn');
                    if (gameStartBtn) {
                        gameStartBtn.textContent = 'Start Game';
                        const walletIndicator = document.getElementById('wallet-status-indicator');
                        if (walletIndicator) {
                            walletIndicator.style.display = 'none';
                        }
                    }
                    
                    // Call update functions if game is initialized
                    if (window.updateStartButton) {
                        window.updateStartButton();
                    }
                    if (window.updateHeroWalletButton) {
                        window.updateHeroWalletButton();
                    }
                }
            } catch (error) {
                console.error('Wallet connection error:', error);
                if (error.code === 4001) {
                    alert('Wallet connection was rejected. Please try again.');
    } else {
                    alert('Failed to connect wallet: ' + error.message);
                }
            }
        }
        
        // Wallet connection function (global)
        window.connectWallet = async function() {
            return await connectWalletDirect();
        };
        
        // Copy code blocks on click
        document.querySelectorAll('pre code').forEach(block => {
            block.addEventListener('click', function() {
                const text = this.textContent;
                navigator.clipboard.writeText(text).then(() => {
                    const original = this.textContent;
                    this.textContent = 'Copied!';
                    setTimeout(() => {
                        this.textContent = original;
                    }, 1000);
                });
            });
        });
        
        // Add copy button to code blocks
        document.querySelectorAll('.code-block').forEach(block => {
            const copyBtn = document.createElement('button');
            copyBtn.className = 'copy-btn';
            copyBtn.textContent = 'Copy';
            copyBtn.addEventListener('click', function() {
                const code = block.querySelector('code');
                if (code) {
                    navigator.clipboard.writeText(code.textContent).then(() => {
                        copyBtn.textContent = 'Copied!';
                        setTimeout(() => {
                            copyBtn.textContent = 'Copy';
                        }, 1000);
                    });
                }
            });
            block.style.position = 'relative';
            block.appendChild(copyBtn);
        });
        
        // Navbar scroll effect
        let lastScroll = 0;
        const nav = document.getElementById('nav');
        window.addEventListener('scroll', function() {
            const currentScroll = window.pageYOffset;
            if (currentScroll > 100) {
                nav.style.background = '#000000';
                nav.style.boxShadow = '0 2px 8px rgba(0, 255, 0, 0.2)';
            } else {
                nav.style.background = '';
                nav.style.boxShadow = '';
            }
            lastScroll = currentScroll;
        });
        
        // Initialize game if game section exists
        if (document.getElementById('game-area')) {
            initializeGame();
        }
    });
    
    // Game initialization
    async function initializeGame() {
        try {
            window.bridge = window.bridge || null;
            window.api = window.api || null;
            window.game = window.game || null;
            window.oracle = window.oracle || null;
            
            var bridge = window.bridge;
            var api = window.api;
            var game = window.game;
            var oracle = window.oracle;
            var gameInterval = null;
            var targetTimeouts = [];
            var leaderboardService = null;
            var antiCheat = null;
            
            // Initialize bridge
            // Bridge service removed - using Solana payments only
            bridge = null; // No bridge needed
            window.bridge = bridge;
            
            // Initialize API service
            if (typeof ProtocolAPI !== 'undefined') {
        api = new ProtocolAPI();
        window.api = api; 
                if (bridge) {
                    api.init(bridge);
                    // Ensure API bridge reference is the same
                    api.bridge = bridge;
                }
            } else if (typeof APIService !== 'undefined') {
                api = new APIService();
                window.api = api;
                if (bridge) {
                    api.init(bridge);
                    // Ensure API bridge reference is the same
                    api.bridge = bridge;
                }
            }
            
            // Initialize game
            if (typeof MiniGame !== 'undefined') {
        game = new MiniGame();
                window.game = game;
                if (api) {
                    game.init(api);
                    // Ensure game's API reference is the same
                    game.api = api;
                }
            }
            
            // Initialize anti-cheat
        if (typeof AntiCheat !== 'undefined') {
            antiCheat = new AntiCheat();
        }
        
            // Initialize leaderboard
            if (typeof LeaderboardBackend !== 'undefined') {
                leaderboardService = new LeaderboardBackend();
            } else if (typeof LeaderboardSheets !== 'undefined' && typeof CONFIG !== 'undefined') {
            const sheetId = CONFIG.GOOGLE_SHEETS.SHEET_ID;
            const apiKey = CONFIG.GOOGLE_SHEETS.API_KEY;
                if (sheetId && apiKey) {
                leaderboardService = new LeaderboardSheets(sheetId, apiKey);
            }
        }
        
            // Update button text based on wallet status
            function updateStartButton() {
        const startBtn = document.getElementById('start-game-btn');
                const walletIndicator = document.getElementById('wallet-status-indicator');
        
        if (startBtn) {
                    if (bridge && bridge.solanaWallet) {
                if (game && game.isPlaying) {
            startBtn.textContent = 'Game In Progress...';
            startBtn.disabled = true;
                        } else {
                            startBtn.textContent = 'Start Game';
        startBtn.disabled = false;
                        }
                        // Hide wallet indicator when connected
                        if (walletIndicator) {
                            walletIndicator.style.display = 'none';
                        }
                    } else {
                        startBtn.textContent = 'Connect Wallet & Start Game';
                        startBtn.disabled = false;
                        // Show wallet indicator when not connected
                        if (walletIndicator) {
                            walletIndicator.style.display = 'block';
                        }
                    }
                }
            }
            
            // Check for existing wallet connection on load
            if (bridge && typeof window !== 'undefined' && window.solana && window.solana.isPhantom) {
                window.solana.on('connect', () => {
                    if (bridge && window.solana && window.solana.publicKey) {
                        bridge.solanaWallet = window.solana.publicKey.toString();
                        // Also update API bridge if it exists - CRITICAL
                        if (api) {
                            if (!api.bridge) {
                                api.bridge = bridge;
    } else {
                                api.bridge.solanaWallet = bridge.solanaWallet;
                            }
                        }
                        
                        // Also update game's API if it exists
                        if (game && game.api) {
                            if (!game.api.bridge) {
                                game.api.bridge = bridge;
    } else {
                                game.api.bridge.solanaWallet = bridge.solanaWallet;
                            }
                        }
                        updateStartButton();
                        updateHeroWalletButton();
                        showGameStatus('Wallet connected! Ready to play.', 'success');
                        console.log('Wallet connected via event:', bridge.solanaWallet);
                    }
                });
                
                window.solana.on('disconnect', () => {
                    if (bridge) {
                        bridge.solanaWallet = null;
                        updateStartButton();
                        updateHeroWalletButton();
                        showGameStatus('Wallet disconnected', 'info');
                    }
                });
                
                // Check if already connected
                if (window.solana.isConnected && window.solana.publicKey) {
                        bridge.solanaWallet = window.solana.publicKey.toString();
                        // Also update API bridge if it exists - CRITICAL
                        if (api) {
                            if (!api.bridge) {
                                api.bridge = bridge;
        } else {
                                api.bridge.solanaWallet = bridge.solanaWallet;
                            }
                        }
                        
                        // Also update game's API if it exists
                        if (game && game.api) {
                            if (!game.api.bridge) {
                                game.api.bridge = bridge;
            } else {
                                game.api.bridge.solanaWallet = bridge.solanaWallet;
                            }
                        }
                    updateStartButton();
                    updateHeroWalletButton();
                    console.log('Wallet already connected:', bridge.solanaWallet);
                }
            }
            
            // Update hero wallet button
            function updateHeroWalletButton() {
                const heroBtn = document.getElementById('connect-wallet-hero-btn');
                if (heroBtn) {
                    if (bridge && bridge.solanaWallet) {
                        heroBtn.textContent = 'Wallet Connected';
                        heroBtn.style.background = 'var(--accent-success)';
        } else {
                        heroBtn.textContent = 'Connect Wallet';
                        heroBtn.style.background = '';
                    }
                }
            }
            
            // Expose functions globally
            window.updateStartButton = updateStartButton;
            window.updateHeroWalletButton = updateHeroWalletButton;
            
            // Game start button
            const startBtn = document.getElementById('start-game-btn');
            if (startBtn) {
                startBtn.addEventListener('click', async function() {
        if (!bridge) {
                        showGameStatus('Bridge not initialized. Please refresh the page.', 'error');
            return;
        }
        
                    if (!bridge.solanaWallet) {
                        try {
                            showGameStatus('Connecting to wallet...', 'info');
                            await bridge.connectSolanaWallet();
                            
                            // Ensure API bridge has wallet - CRITICAL
                            if (api) {
        if (!api.bridge) {
                                    api.bridge = bridge;
            } else {
                                    api.bridge.solanaWallet = bridge.solanaWallet;
                                }
                            }
                            
                            // Also update game's API if it exists
                            if (game && game.api) {
                                if (!game.api.bridge) {
                                    game.api.bridge = bridge;
                    } else {
                                    game.api.bridge.solanaWallet = bridge.solanaWallet;
                                }
                            }
                            
                            console.log('Wallet connected, address:', bridge.solanaWallet);
                            updateStartButton();
                            updateHeroWalletButton();
                            showGameStatus('Wallet connected! Starting game...', 'success');
                            
                            // Auto-start game after connection
            setTimeout(() => {
                                if (bridge && bridge.solanaWallet) {
                                    console.log('Auto-starting game with wallet:', bridge.solanaWallet);
                                    startGame();
                                } else {
                                    console.error('Wallet not set after connection');
                                    showGameStatus('Wallet connection failed. Please try again.', 'error');
                                }
                            }, 500);
        } catch (error) {
                            console.error('Wallet connection error:', error);
                            let errorMsg = 'Failed to connect wallet. ';
                            if (error.message.includes('not found')) {
                                errorMsg += 'Please install Phantom wallet from phantom.app';
                            } else if (error.message.includes('rejected')) {
                                errorMsg += 'Connection was rejected. Please try again.';
            } else {
                                errorMsg += error.message;
                            }
                            showGameStatus(errorMsg, 'error');
                            updateStartButton();
                        }
                        return;
                    }
                    
                    // Wallet is connected, start game
                    await startGame();
                });
            }
            
            // Game status function (needs to be defined early)
            function showGameStatus(message, type = 'info') {
                const statusEl = document.getElementById('game-status');
                if (statusEl) {
                    statusEl.textContent = message;
                    statusEl.className = 'game-status ' + type;
                    setTimeout(() => {
                        statusEl.className = 'game-status';
                        statusEl.textContent = '';
                    }, 5000);
                }
            }
            
            // Initial button state
            updateStartButton();
            
            // Game functions
            async function startGame() {
                if (!game) {
                    showGameStatus('Game not initialized. Please refresh the page.', 'error');
                    return;
                }
                
                if (!bridge) {
                    showGameStatus('Bridge not initialized. Please refresh the page.', 'error');
                    return;
                }
                
                if (!bridge.solanaWallet) {
                    showGameStatus('Wallet not connected. Please connect your wallet first.', 'error');
        return;
    }
    
                if (!api) {
                    showGameStatus('API not initialized. Please refresh the page.', 'error');
        return;
    }
    
                const startBtn = document.getElementById('start-game-btn');
                const gameArea = document.getElementById('game-area');
                const startScreen = document.getElementById('game-start-screen');
                
                try {
                    startBtn.disabled = true;
                    startBtn.textContent = 'Starting Game...';
                    
                    // Ensure API bridge has wallet - CRITICAL FIX
                    if (api) {
                        if (!api.bridge) {
                            api.bridge = bridge;
        } else {
                            api.bridge.solanaWallet = bridge.solanaWallet;
                        }
                    }
                    
                    if (!game.api) {
                        game.init(api);
                    }
                    
                    // Ensure game's API has the bridge with wallet
                    if (game.api) {
                        if (!game.api.bridge) {
                            game.api.bridge = bridge;
        } else {
                            game.api.bridge.solanaWallet = bridge.solanaWallet;
                        }
                    }
                    
                    // Double check wallet before starting
                    if (!bridge.solanaWallet) {
                        throw new Error('Wallet not connected');
                    }
                    
                    // Final verification - check game.api.bridge.solanaWallet
                    if (!game.api || !game.api.bridge || !game.api.bridge.solanaWallet) {
                        console.error('Game API bridge wallet check failed:', {
                            hasApi: !!game.api,
                            hasBridge: !!(game.api && game.api.bridge),
                            hasWallet: !!(game.api && game.api.bridge && game.api.bridge.solanaWallet),
                            bridgeWallet: bridge.solanaWallet
                        });
                        // Force set it one more time
                        if (game.api && game.api.bridge) {
                            game.api.bridge.solanaWallet = bridge.solanaWallet;
                        }
                    }
                    
                    console.log('Starting game with wallet:', bridge.solanaWallet.substring(0, 8) + '...');
                    console.log('Game API bridge wallet:', game.api && game.api.bridge ? game.api.bridge.solanaWallet : 'NOT SET');
                    const result = await game.startGame();
                    
                    if (result.success) {
                        if (startScreen) {
                            startScreen.classList.add('hidden');
                            startScreen.style.display = 'none';
                        }
                        if (gameArea) {
                            gameArea.classList.add('game-active');
                        }
                        startBtn.textContent = 'Game In Progress...';
                        startGameLoop();
                        updateGameUI();
                    }
    } catch (error) {
                    console.error('Game start error:', error);
                    showGameStatus('Error: ' + error.message, 'error');
                    startBtn.disabled = false;
                    startBtn.textContent = 'Connect Wallet & Start Game';
                }
            }
            
            function startGameLoop() {
                if (gameInterval) clearInterval(gameInterval);
                targetTimeouts.forEach(timeout => clearTimeout(timeout));
                targetTimeouts = [];
                
                const gameArea = document.getElementById('game-area');
                if (gameArea) {
                    const existingTargets = gameArea.querySelectorAll('.game-target');
                    existingTargets.forEach(target => target.remove());
                }
                
                // Progressive spawn rate - gets faster over time
                function scheduleNextTarget() {
                    if (!game || !game.isPlaying) {
        return;
    }
    
                    const gameDuration = game.gameStartTime ? Date.now() - game.gameStartTime : 0;
                    // Spawn rate decreases (faster) over time: 1500ms -> 200ms - NO MINIMUM, keeps getting faster
                    const baseRate = 1500;
                    const spawnRate = Math.max(200, baseRate - (gameDuration / 60)); // Faster spawn rate decrease
                    
                    createGameTarget();
                    setTimeout(scheduleNextTarget, spawnRate);
                }
                
                // Start progressive spawning
                setTimeout(() => {
                    createGameTarget();
                    scheduleNextTarget();
                }, 300);
            }
            
            function createGameTarget() {
                if (!game || !game.isPlaying) return;
                
                const gameArea = document.getElementById('game-area');
                if (!gameArea) return;
                
                const target = game.createTarget(gameArea.offsetWidth, gameArea.offsetHeight);
                if (!target) return; // Boss is active, don't spawn normal targets
                
                const targetEl = document.createElement('div');
                targetEl.className = 'game-target';
                targetEl.id = target.id;
                targetEl.style.left = target.x + 'px';
                targetEl.style.top = target.y + 'px';
                targetEl.style.width = target.size + 'px';
                targetEl.style.height = target.size + 'px';
                targetEl.style.borderColor = target.color;
                targetEl.style.boxShadow = `0 0 20px ${target.color}, inset 0 0 20px ${target.color}40`;
                targetEl.textContent = target.points;
                
                // Add type indicator
                if (target.type === 'bonus') {
                    targetEl.classList.add('target-bonus');
                    targetEl.textContent = '⭐ ' + target.points;
                } else if (target.type === 'speed') {
                    targetEl.classList.add('target-speed');
                    targetEl.textContent = '⚡ ' + target.points;
                } else if (target.type === 'combo') {
                    targetEl.classList.add('target-combo');
                    targetEl.textContent = '🔥 ' + target.points;
                } else if (target.type === 'boss') {
                    targetEl.classList.add('target-boss');
                    targetEl.textContent = '👑 ' + target.points;
                } else if (target.type === 'megaboss') {
                    targetEl.classList.add('target-megaboss');
                    targetEl.textContent = '👑👑 ' + target.points;
                } else if (target.type === 'powerup') {
                    targetEl.classList.add('target-powerup');
                    targetEl.textContent = '💎';
                }
                
                // Add moving animation for moving targets
                if (target.isMoving) {
                    targetEl.classList.add('target-moving');
                    animateMovingTarget(targetEl, target);
                }
                
                // Boss targets move every 5 seconds
                if (target.isBoss) {
                    targetEl.classList.add('target-boss-moving');
                    animateBossMovement(targetEl, target);
                    
                    // Update boss hit counter display
                    if (target.requiredHits) {
                        const hitCounter = document.createElement('div');
                        hitCounter.className = 'boss-hit-counter';
                        hitCounter.textContent = `${target.currentHits || 0}/${target.requiredHits}`;
                        hitCounter.style.position = 'absolute';
                        hitCounter.style.bottom = '-25px';
                        hitCounter.style.left = '50%';
                        hitCounter.style.transform = 'translateX(-50%)';
                        hitCounter.style.color = '#ff00ff';
                        hitCounter.style.fontSize = '0.9rem';
                        hitCounter.style.fontWeight = '700';
                        hitCounter.style.fontFamily = 'var(--font-mono)';
                        hitCounter.style.textShadow = '0 0 10px #ff00ff';
                        hitCounter.style.whiteSpace = 'nowrap';
                        targetEl.appendChild(hitCounter);
                    }
                }
                
                // Add enhanced pulsing animation based on type
                if (target.type === 'megaboss') {
                    targetEl.style.animation = 'targetPulse 0.3s ease-in-out infinite, megabossPulse 1.5s ease-in-out infinite, targetGlow 2s ease-in-out infinite';
                } else if (target.type === 'boss') {
                    targetEl.style.animation = 'targetPulse 0.5s ease-in-out infinite, bossPulse 2s ease-in-out infinite';
        } else {
                    targetEl.style.animation = 'targetPulse 1s ease-in-out infinite';
                }
                
                // Add trail effect for moving targets
                if (target.isMoving) {
                    targetEl.style.filter = 'drop-shadow(0 0 10px ' + target.color + ')';
                }
                
                targetEl.addEventListener('click', function(e) {
                    e.stopPropagation(); // Prevent background click
                    
                    const result = game.hitTarget(target.id);
                    
                    // Handle boss multi-hit system
                    if (target.isBoss && result) {
                        // Update hit counter display
                        const hitCounter = targetEl.querySelector('.boss-hit-counter');
                        if (hitCounter) {
                            hitCounter.textContent = `${result.bossHits || 0}/${result.bossRequired || target.requiredHits}`;
                            
                            // Visual feedback for boss hits
                            hitCounter.style.animation = 'none';
            setTimeout(() => {
                                hitCounter.style.animation = 'bossHitPulse 0.3s ease-out';
                            }, 10);
                        }
                        
                        // Create hit effect (not explosion yet)
                        createBossHitEffect(e.clientX, e.clientY, target.color);
                        
                        // Screen shake on boss hits
                        screenShake();
                        
                        // Boss not defeated yet, just update UI
                        updateGameUI();
        return;
    }
    
                    // Normal target or boss defeated
                    // Create advanced click visual effects
                    createAdvancedClickEffect(e.clientX, e.clientY, target.points, target.color, target.type);
                    
                    // Add hit effect with screen shake for big targets
                    if (target.type === 'boss' || target.type === 'megaboss') {
                        screenShake();
                    }
                    
                    // Add explosion effect
                    createExplosionEffect(targetEl, target.color);
                    
                    targetEl.style.transform = 'scale(1.5)';
                    targetEl.style.opacity = '0';
                    setTimeout(() => {
                        targetEl.remove();
                    }, 200);
                    
                    updateGameUI();
                    checkGameEnd();
                });
                
                gameArea.appendChild(targetEl);
                
                const timeoutId = setTimeout(() => {
                    if (targetEl.parentElement) {
                        // Boss targets don't expire - they just disappear if not defeated in time
                        if (target.isBoss) {
                            // Boss escaped - remove it
                            targetEl.style.animation = 'targetMiss 0.5s ease-out forwards';
                            setTimeout(() => {
                                targetEl.remove();
                            }, 500);
                            // Remove from game targets
                            if (game && game.targets) {
                                const targetIndex = game.targets.findIndex(t => t.id === target.id);
                                if (targetIndex !== -1) {
                                    game.targets.splice(targetIndex, 1);
                                }
                            }
                        } else {
                            game.missTarget();
                            // Add miss effect with animation
                            targetEl.style.animation = 'targetMiss 0.3s ease-out forwards';
                            setTimeout(() => {
                                targetEl.remove();
                            }, 300);
                        }
                        updateGameUI();
                        checkGameEnd();
                    }
                }, target.lifetime);
                
                targetTimeouts.push(timeoutId);
            }
            
            // Screen shake effect
            function screenShake() {
                const gameArea = document.getElementById('game-area');
                if (!gameArea) return;
                
                gameArea.style.animation = 'none';
                setTimeout(() => {
                    gameArea.style.animation = 'screenShake 0.5s ease-out, gameAreaPulse 3s ease-in-out infinite';
                }, 10);
            }
            
            // Create boss hit effect (smaller than explosion)
            function createBossHitEffect(x, y, color) {
                const gameArea = document.getElementById('game-area');
                if (!gameArea) return;
                
                const rect = gameArea.getBoundingClientRect();
                const clickX = x - rect.left;
                const clickY = y - rect.top;
                
                const hitEffect = document.createElement('div');
                hitEffect.style.position = 'absolute';
                hitEffect.style.left = clickX + 'px';
                hitEffect.style.top = clickY + 'px';
                hitEffect.style.width = '60px';
                hitEffect.style.height = '60px';
                hitEffect.style.borderRadius = '50%';
                hitEffect.style.background = `radial-gradient(circle, ${color} 0%, transparent 70%)`;
                hitEffect.style.pointerEvents = 'none';
                hitEffect.style.zIndex = '500';
                hitEffect.style.animation = 'bossHitExplosion 0.4s ease-out forwards';
                hitEffect.style.transform = 'translate(-50%, -50%)';
                gameArea.appendChild(hitEffect);
                
                setTimeout(() => hitEffect.remove(), 400);
            }
            
            // Create explosion effect
            function createExplosionEffect(targetEl, color) {
                const gameArea = document.getElementById('game-area');
                if (!gameArea || !targetEl) return;
                
                const rect = targetEl.getBoundingClientRect();
                const gameRect = gameArea.getBoundingClientRect();
                const x = rect.left + rect.width / 2 - gameRect.left;
                const y = rect.top + rect.height / 2 - gameRect.top;
                
                const explosion = document.createElement('div');
                explosion.style.position = 'absolute';
                explosion.style.left = x + 'px';
                explosion.style.top = y + 'px';
                explosion.style.width = '200px';
                explosion.style.height = '200px';
                explosion.style.borderRadius = '50%';
                explosion.style.background = `radial-gradient(circle, ${color} 0%, transparent 70%)`;
                explosion.style.pointerEvents = 'none';
                explosion.style.zIndex = '500';
                explosion.style.animation = 'explosion 0.6s ease-out forwards';
                explosion.style.transform = 'translate(-50%, -50%)';
                gameArea.appendChild(explosion);
                
                setTimeout(() => explosion.remove(), 600);
            }
            
            // Create advanced click visual effect function
            function createAdvancedClickEffect(x, y, points, color, targetType) {
                const gameArea = document.getElementById('game-area');
                if (!gameArea) return;
                
                // Get game area position
                const rect = gameArea.getBoundingClientRect();
                const clickX = x - rect.left;
                const clickY = y - rect.top;
                
                // Create particle container
                const particleContainer = document.createElement('div');
                particleContainer.style.position = 'absolute';
                particleContainer.style.left = clickX + 'px';
                particleContainer.style.top = clickY + 'px';
                particleContainer.style.pointerEvents = 'none';
                particleContainer.style.zIndex = '1000';
                gameArea.appendChild(particleContainer);
                
                // Create enhanced score text with glow
                const scoreText = document.createElement('div');
                scoreText.textContent = '+' + points;
                scoreText.style.position = 'absolute';
                scoreText.style.color = color;
                scoreText.style.fontSize = targetType === 'megaboss' ? '2.5rem' : targetType === 'boss' ? '2rem' : '1.5rem';
                scoreText.style.fontWeight = '700';
                scoreText.style.fontFamily = 'var(--font-mono)';
                scoreText.style.textShadow = `0 0 20px ${color}, 0 0 40px ${color}, 0 0 60px ${color}`;
                scoreText.style.animation = 'scoreFloatAdvanced 1.5s ease-out forwards';
                particleContainer.appendChild(scoreText);
                
                // Create more particles for bigger targets
                const particleCount = targetType === 'megaboss' ? 20 : targetType === 'boss' ? 15 : 8;
                
                for (let i = 0; i < particleCount; i++) {
                    const particle = document.createElement('div');
                    particle.style.position = 'absolute';
                    particle.style.width = targetType === 'megaboss' ? '10px' : '6px';
                    particle.style.height = targetType === 'megaboss' ? '10px' : '6px';
                    particle.style.borderRadius = '50%';
                    particle.style.backgroundColor = color;
                    particle.style.boxShadow = `0 0 15px ${color}, 0 0 30px ${color}`;
                    
                    const angle = (Math.PI * 2 * i) / particleCount;
                    const distance = targetType === 'megaboss' ? 80 : targetType === 'boss' ? 50 : 30 + Math.random() * 20;
                    const duration = 0.5 + Math.random() * 0.5;
                    
                    particle.style.animation = `particleExplodeAdvanced ${duration}s ease-out forwards`;
                    particle.style.setProperty('--end-x', Math.cos(angle) * distance + 'px');
                    particle.style.setProperty('--end-y', Math.sin(angle) * distance + 'px');
                    
                    particleContainer.appendChild(particle);
                }
                
                // Create ring effect
                const ring = document.createElement('div');
                ring.style.position = 'absolute';
                ring.style.left = '50%';
                ring.style.top = '50%';
                ring.style.width = '0px';
                ring.style.height = '0px';
                ring.style.border = `3px solid ${color}`;
                ring.style.borderRadius = '50%';
                ring.style.transform = 'translate(-50%, -50%)';
                ring.style.opacity = '0.8';
                ring.style.animation = 'ringExpand 0.8s ease-out forwards';
                particleContainer.appendChild(ring);
                
                // Remove after animation
        setTimeout(() => {
                    particleContainer.remove();
                }, 1500);
            }
            
            // Create click visual effect function (legacy support)
            function createClickEffect(x, y, points, color) {
                createAdvancedClickEffect(x, y, points, color, 'normal');
            }
            
            // Add background click handler for game area
            const gameArea = document.getElementById('game-area');
            if (gameArea) {
                gameArea.addEventListener('click', function(e) {
                    // Only count as background click if not clicking a target
                    if (game && game.isPlaying && !e.target.classList.contains('game-target') && !e.target.closest('.game-target')) {
                        // Lose 1 health for clicking background
                        game.lives--;
                        game.missedTargets++;
                        
                        // Create miss effect
                        createMissEffect(e.clientX, e.clientY);
                        
                        // Visual feedback
                        gameArea.style.backgroundColor = 'rgba(255, 68, 68, 0.3)';
                        setTimeout(() => {
                            gameArea.style.backgroundColor = '';
                        }, 200);
                        
                        // Show miss message
                        showGameStatus('Missed! -1 Life (' + game.lives + ' left)', 'error');
                        
                        updateGameUI();
                        
                        // Check if game should end
                        if (game.lives <= 0) {
                            if (window.endGame) {
                                window.endGame();
                            }
                }
            }
        });
            }
            
            // Animate moving targets
            function animateMovingTarget(targetEl, target) {
                if (!target.isMoving || !game || !game.isPlaying) return;
                
                const gameArea = document.getElementById('game-area');
                if (!gameArea) return;
                
                let x = parseFloat(targetEl.style.left);
                let y = parseFloat(targetEl.style.top);
                const speed = target.moveSpeed || 2;
                const angle = target.moveDirection || 0;
                
                function move() {
                    if (!targetEl.parentElement || !game.isPlaying) return;
                    
                    x += Math.cos(angle) * speed;
                    y += Math.sin(angle) * speed;
                    
                    // Bounce off walls
                    const rect = gameArea.getBoundingClientRect();
                    if (x < 0 || x > rect.width - target.size) {
                        target.moveDirection = Math.PI - target.moveDirection;
                    }
                    if (y < 0 || y > rect.height - target.size) {
                        target.moveDirection = -target.moveDirection;
                    }
                    
                    targetEl.style.left = x + 'px';
                    targetEl.style.top = y + 'px';
                    
                    requestAnimationFrame(move);
                }
                
                move();
            }
            
            // Animate boss movement - changes position every 5 seconds
            function animateBossMovement(targetEl, target) {
                if (!target.isBoss || !game || !game.isPlaying) return;
                
                const gameArea = document.getElementById('game-area');
                if (!gameArea) return;
                
                function moveBoss() {
                    if (!targetEl.parentElement || !game.isPlaying) return;
                    
                    const now = Date.now();
                    if (now - target.lastMoveTime >= target.moveInterval) {
                        // Move boss to random position
                        const rect = gameArea.getBoundingClientRect();
                        const newX = Math.random() * (rect.width - target.size);
                        const newY = Math.random() * (rect.height - target.size);
                        
                        // Smooth transition
                        targetEl.style.transition = 'all 0.5s ease-out';
                        targetEl.style.left = newX + 'px';
                        targetEl.style.top = newY + 'px';
                        
                        // Update target position
                        target.x = newX;
                        target.y = newY;
                        target.lastMoveTime = now;
                        
                        // Remove transition after animation
                setTimeout(() => {
                            targetEl.style.transition = '';
                        }, 500);
                    }
                    
                    // Check again soon
                    setTimeout(moveBoss, 1000);
                }
                
                moveBoss();
            }
            
            // Show achievement notification
            window.showAchievement = function(message) {
                const gameArea = document.getElementById('game-area');
                if (!gameArea) return;
                
                const achievement = document.createElement('div');
                achievement.className = 'achievement-notification';
                achievement.textContent = message;
                achievement.style.position = 'absolute';
                achievement.style.top = '20px';
                achievement.style.left = '50%';
                achievement.style.transform = 'translateX(-50%)';
                achievement.style.zIndex = '2000';
                gameArea.appendChild(achievement);
                
                setTimeout(() => {
                    achievement.style.opacity = '0';
                    achievement.style.transform = 'translateX(-50%) translateY(-20px)';
                    setTimeout(() => achievement.remove(), 500);
                }, 2000);
            };
            
            // Create miss effect function
            function createMissEffect(x, y) {
                const gameArea = document.getElementById('game-area');
                if (!gameArea) return;
                
                const rect = gameArea.getBoundingClientRect();
                const clickX = x - rect.left;
                const clickY = y - rect.top;
                
                const missText = document.createElement('div');
                missText.textContent = '-1';
                missText.style.position = 'absolute';
                missText.style.left = clickX + 'px';
                missText.style.top = clickY + 'px';
                missText.style.color = '#ff4444';
                missText.style.fontSize = '1.5rem';
                missText.style.fontWeight = '700';
                missText.style.fontFamily = 'var(--font-mono)';
                missText.style.textShadow = '0 0 10px #ff4444';
                missText.style.pointerEvents = 'none';
                missText.style.zIndex = '1000';
                missText.style.animation = 'missFloat 1s ease-out forwards';
                gameArea.appendChild(missText);
                
            setTimeout(() => {
                    missText.remove();
            }, 1000);
            }
            
            function updateGameUI() {
                if (!game) return;
                const stats = game.getStats();
                
                const scoreEl = document.getElementById('game-score');
                const livesEl = document.getElementById('game-lives');
                const timeEl = document.getElementById('game-time');
                
                if (scoreEl) scoreEl.textContent = stats.score;
                if (livesEl) {
                    livesEl.textContent = stats.remainingLives;
                    // Update color based on lives
                    if (stats.remainingLives <= 1) {
                        livesEl.style.color = 'var(--accent-error)';
                    } else if (stats.remainingLives <= 2) {
                        livesEl.style.color = '#ffaa00';
                    } else if (stats.remainingLives <= 3) {
                        livesEl.style.color = '#ffaa00';
                    } else {
                        livesEl.style.color = 'var(--accent-primary)';
                    }
                }
                
                // Show active power-ups
                const powerUpIndicator = document.getElementById('powerup-indicator');
                if (powerUpIndicator) {
                    const activePowerUps = stats.activePowerUps || 0;
                    if (activePowerUps > 0) {
                        powerUpIndicator.style.display = 'block';
                        powerUpIndicator.textContent = `⚡ ${activePowerUps} Power-Up${activePowerUps > 1 ? 's' : ''} Active`;
                    } else {
                        powerUpIndicator.style.display = 'none';
                    }
                }
                
                // Show combo multiplier with visual effects
                const comboIndicator = document.getElementById('combo-indicator');
                if (comboIndicator && stats.combo > 1) {
                    comboIndicator.style.display = 'block';
                    comboIndicator.textContent = `${stats.combo}x COMBO!`;
                    
                    // Visual effects based on combo level
                    if (stats.combo >= 20) {
                        comboIndicator.style.animation = 'comboMega 0.5s ease-in-out infinite';
                        comboIndicator.style.textShadow = '0 0 20px #ff00ff, 0 0 40px #ff00ff, 0 0 60px #ff00ff';
                    } else if (stats.combo >= 10) {
                        comboIndicator.style.animation = 'comboHigh 0.6s ease-in-out infinite';
                        comboIndicator.style.textShadow = '0 0 15px #ff4444, 0 0 30px #ff4444';
                    } else {
                        comboIndicator.style.animation = 'comboNormal 0.8s ease-in-out infinite';
                        comboIndicator.style.textShadow = '0 0 10px currentColor';
                    }
                } else if (comboIndicator) {
                    comboIndicator.style.display = 'none';
                }
                
                // Show difficulty level indicator
                const difficultyIndicator = document.getElementById('difficulty-indicator');
                if (difficultyIndicator && game.gameStartTime) {
                    const gameDuration = Date.now() - game.gameStartTime;
                    const difficultyLevel = Math.floor(gameDuration / 30000) + 1; // Level up every 30 seconds
                    difficultyIndicator.style.display = 'block';
                    difficultyIndicator.textContent = `Level ${difficultyLevel}`;
                    difficultyIndicator.style.color = difficultyLevel >= 10 ? '#ff00ff' : difficultyLevel >= 5 ? '#ff4444' : '#00ff88';
                }
                if (timeEl && game.gameStartTime) {
                    const elapsed = Math.floor((Date.now() - game.gameStartTime) / 1000);
                    timeEl.textContent = elapsed + 's';
                }
            }
            
            function checkGameEnd() {
                if (!game || !game.isPlaying) return;
                // Infinite game - never ends automatically
                // Game only ends if player manually stops or closes tab
            }
            
            async function endGame() {
                if (!game) return;
                
                console.log('🎮 [endGame] Called - checking game state...');
                
                // Get game stats even if game already ended
                const result = game.endGame();
                
                // If result is null, get stats manually
                if (!result) {
                    console.warn('⚠️ [endGame] game.endGame() returned null, getting stats manually...');
                    const duration = game.gameStartTime ? (Date.now() - game.gameStartTime) : 0;
                    const finalScore = game.score || 0;
                    const maxCombo = game.maxCombo || 0;
                    const finalStreak = game.streak || 0;
                    const missedTargets = game.missedTargets || 0;
                    
                    // Create result object manually
                    const manualResult = {
                        score: finalScore,
                        duration: duration,
                        maxCombo: maxCombo,
                        finalStreak: finalStreak,
                        missedTargets: missedTargets,
                        difficulty: Math.min(1 + Math.floor(finalScore / 100), 5)
                    };
                    
                    // Use manual result for saving
                    await saveGameScore(manualResult);
                    return;
                }
                
                // Helper function to save game score
                async function saveGameScore(result) {
                    if (!result) return;
                    
                    const finalScore = result.score || 0;
                    const duration = result.duration || 0;
                    const difficulty = result.difficulty || Math.min(1 + Math.floor(finalScore / 100), 5);
                    
                    console.log('🎮 ========== SAVING GAME SCORE ==========');
                    console.log('📊 Final Score: ' + finalScore + ' points');
                    console.log('⏱️  Duration: ' + (duration / 1000).toFixed(2) + 's');
                    
                    // Try to save score using leaderboard service
                    if (leaderboardService && bridge && bridge.solanaWallet) {
                        try {
                            await leaderboardService.submitScore(
                                bridge.solanaWallet,
                                finalScore,
                                duration,
                                'game-' + Date.now(),
                                difficulty
                            );
                            console.log('✅ Score saved successfully!');
                            showGameStatus('Score saved! ' + finalScore + ' points', 'success');
            } catch (error) {
                            console.error('❌ Failed to save score:', error);
                            showGameStatus('Score: ' + finalScore + ' points. Failed to save.', 'error');
                        }
                    } else {
                        console.warn('⚠️ Leaderboard service or wallet not available');
                        showGameStatus('Score: ' + finalScore + ' points', 'info');
                    }
                }
                
                // Save score with result
                await saveGameScore(result);
                
                // Reset UI
                const startBtn = document.getElementById('start-game-btn');
                const startScreen = document.getElementById('game-start-screen');
                const gameArea = document.getElementById('game-area');
                
                if (gameArea) {
                    gameArea.classList.remove('game-active');
                    const targets = gameArea.querySelectorAll('.game-target');
                    targets.forEach(t => t.remove());
                }
                
                if (startScreen) {
                    startScreen.classList.remove('hidden');
                    startScreen.style.display = 'flex';
                    startScreen.innerHTML = `
                        <h3>Game Over!</h3>
                        <p style="color: var(--text-secondary); margin-top: 1rem;">Score: ${result.score} points</p>
                    `;
                }
                
                if (startBtn) {
                    startBtn.disabled = false;
                    updateStartButton();
                }
                
                if (gameInterval) {
                    clearInterval(gameInterval);
                    gameInterval = null;
                }
                targetTimeouts.forEach(timeout => clearTimeout(timeout));
                targetTimeouts = [];
                
                updateGameUI();
                if (typeof loadLeaderboard === 'function') {
                    loadLeaderboard();
                }
            }
            
            // Expose endGame globally
            window.endGame = endGame;
            
            // Load leaderboard
            async function loadLeaderboard() {
                if (!leaderboardService) return;
                const container = document.getElementById('leaderboard-container');
    if (!container) return;
    
    try {
                    container.innerHTML = '<p style="color: var(--text-secondary);">Loading...</p>';
                    const data = await leaderboardService.getLeaderboard(20);
                    const scores = Array.isArray(data) ? data : (data.leaderboard || []);
                    
                    if (scores && scores.length > 0) {
                        container.innerHTML = scores.map((entry, index) => `
                            <div class="leaderboard-item" style="display: flex; justify-content: space-between; padding: 0.75rem; border-bottom: 1px solid var(--border-color);">
                                <span>#${index + 1}</span>
                                <span>${entry.wallet ? (entry.wallet.substring(0, 8) + '...' + entry.wallet.substring(entry.wallet.length - 6)) : 'Unknown'}</span>
                                <span style="color: var(--accent-primary);">${entry.score ? entry.score.toLocaleString() : 0}</span>
            </div>
                        `).join('');
                    } else {
                        container.innerHTML = '<p style="color: var(--text-secondary);">No scores yet. Be the first!</p>';
                    }
    } catch (error) {
                    console.error('Failed to load leaderboard:', error);
                    container.innerHTML = '<p style="color: var(--text-secondary);">Failed to load leaderboard.</p>';
                }
            }
            
            window.loadLeaderboard = loadLeaderboard;
            
            // Initial leaderboard load
            setTimeout(loadLeaderboard, 2000);
            
    } catch (error) {
            console.error('Game initialization error:', error);
        }
    });
})();
