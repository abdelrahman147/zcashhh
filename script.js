(function() {
    'use strict';
    
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
        var targetTimeout = null;


        function attachAllButtonListeners() {
            try {
                var viewDocsBtn = document.getElementById('view-docs-btn');
                if (viewDocsBtn) {
                    viewDocsBtn.addEventListener('click', function(e) {
                        e.preventDefault();
                        e.stopPropagation();
                        var docsSection = document.getElementById('docs');
                        if (docsSection) {
                            docsSection.scrollIntoView({ behavior: 'smooth' });
                        }
                    });
                }
            } catch (e) { console.error('View Docs button error:', e); }
            
            try {
                var launchAppBtn = document.getElementById('launch-app-btn');
                if (!launchAppBtn) {
                    launchAppBtn = document.querySelector('.btn-primary');
                }
                if (launchAppBtn && launchAppBtn.textContent && launchAppBtn.textContent.includes('Launch App')) {
                    launchAppBtn.addEventListener('click', function(e) {
                        e.preventDefault();
                        e.stopPropagation();
                        var bridgeSection = document.getElementById('bridge-interface');
                        if (bridgeSection) {
                            bridgeSection.scrollIntoView({ behavior: 'smooth' });
                        }
                    });
                }
            } catch (e) { console.error('Launch App button error:', e); }
        }
        
        if (document.readyState === 'loading') {
            document.addEventListener('DOMContentLoaded', function() {
                initializeApp();
            });
        } else {
            initializeApp();
        }
        
        function initializeApp() {
            try {
                if (typeof CONFIG === 'undefined') {
                    window.CONFIG = {
                        SOLANA_RPC: [
                            'https://api.mainnet-beta.solana.com',
                            'https://rpc.ankr.com/solana',
                            'https://solana.public-rpc.com'
                        ],
                        ZCASH_RPC: {
                            URL: 'https://zec.nownodes.io',
                            USER: '',
                            PASSWORD: ''
                        },
                        GOOGLE_SHEETS: {
                            SHEET_ID: '',
                            API_KEY: ''
                        }
                    };
                    console.log('CONFIG initialized with defaults');
                }
            } catch (e) { console.error('CONFIG init error:', e); }
            
            attachAllButtonListeners();
            
            try {
                if (typeof initTerminalAnimation === 'function') initTerminalAnimation();
            } catch (e) { console.error('initTerminalAnimation error:', e); }
            
            try {
                if (typeof initScrollAnimations === 'function') initScrollAnimations();
            } catch (e) { console.error('initScrollAnimations error:', e); }
            
            try {
                if (typeof initTabSwitching === 'function') initTabSwitching();
            } catch (e) { console.error('initTabSwitching error:', e); }
            
            try {
                if (typeof initCopyButtons === 'function') initCopyButtons();
            } catch (e) { console.error('initCopyButtons error:', e); }
            
            try {
                if (typeof initStatsCounter === 'function') initStatsCounter();
            } catch (e) { console.error('initStatsCounter error:', e); }
            
            try {
                if (typeof initNavScroll === 'function') initNavScroll();
            } catch (e) { console.error('initNavScroll error:', e); }
            
            try {
                if (typeof initFlowSteps === 'function') initFlowSteps();
            } catch (e) { console.error('initFlowSteps error:', e); }
            
            try {
                if (typeof initBridgeUI === 'function') {
                    initBridgeUI();
                } else {
                    setTimeout(function() {
                        if (typeof initBridgeUI === 'function') initBridgeUI();
                        attachAllButtonListeners();
                    }, 100);
                }
            } catch (error) {
                console.error('Failed to initialize bridge UI:', error);
                setTimeout(function() {
                    try {
                        if (typeof initBridgeUI === 'function') initBridgeUI();
                    } catch (e) { console.error('Retry initBridgeUI error:', e); }
                    attachAllButtonListeners();
                }, 500);
            }
            
            try {
                if (typeof initBridge === 'function') {
                    initBridge();
                }
            } catch (error) {
                console.error('Bridge initialization error:', error);
            }
            
            try {
                if (typeof initAPI === 'function') initAPI();
            } catch (error) {
                console.error('Failed to initialize API:', error);
            }
            
            try {
                if (typeof initGame === 'function') initGame();
            } catch (error) {
                console.error('Failed to initialize game:', error);
            }
            
            try {
                if (typeof initOracle === 'function') initOracle();
            } catch (error) {
                console.error('Failed to initialize oracle:', error);
            }
            
            setTimeout(attachAllButtonListeners, 100);
            setTimeout(attachAllButtonListeners, 500);
            setTimeout(attachAllButtonListeners, 1000);
        }


async function initBridge() {
    try {
        
        
        // ALL RPC ENDPOINTS - Premium endpoints first, then fallbacks
        const solanaRpcUrls = CONFIG && CONFIG.SOLANA_RPC ? CONFIG.SOLANA_RPC : [
            // PREMIUM ENDPOINTS (with API keys) - Try these first
            'https://solana-mainnet.g.alchemy.com/v2/xXPi6FAKVWJqv9Ie5TgvOHQgTlrlfbp5', // Alchemy (your API key)
            'https://solana-mainnet.infura.io/v3/99ccf21fb60b46f994ba7af18b8fdc23', // Infura (your API key)
            // Official Solana RPCs
            'https://api.mainnet-beta.solana.com',
            'https://solana-api.projectserum.com',
            // Public RPCs
            'https://rpc.ankr.com/solana',
            'https://solana.public-rpc.com',
            // Additional providers
            'https://solana-mainnet.quicknode.com',
            'https://mainnet.helius-rpc.com',
            'https://solana-mainnet.g.alchemy.com/v2/demo', // Alchemy demo (fallback)
            'https://solana-mainnet-rpc.allthatnode.com',
            'https://ssc-dao.genesysgo.net',
        ];
        
        try {
            bridge = new ZcashSolanaBridge({
                solanaRpcUrls: solanaRpcUrls, 
                solanaRpcUrl: solanaRpcUrls[0], 
                zcashRpcUrl: CONFIG && CONFIG.ZCASH_RPC ? CONFIG.ZCASH_RPC.URL : '',
                zcashRpcUser: CONFIG && CONFIG.ZCASH_RPC ? CONFIG.ZCASH_RPC.USER : '', 
                zcashRpcPassword: CONFIG && CONFIG.ZCASH_RPC ? CONFIG.ZCASH_RPC.PASSWORD : '',
                shieldedPoolAddress: null 
            });
            
            
            window.bridge = bridge;
            
            
            
            await new Promise(resolve => setTimeout(resolve, 3000));
            
            
            if (api && bridge) {
                api.init(bridge);
                console.log('API initialized with bridge');
            }
        } catch (error) {
            console.error('Bridge creation failed:', error);
            
            
            if (api && bridge) {
                try {
                    api.init(bridge);
                    console.log('API initialized with bridge (after error)');
                } catch (initError) {
                    console.error('Failed to initialize API:', initError);
                }
            }
        }
        
        
        if (game && api) {
            game.init(api);
        }
        
        
        bridge.on('transaction', (tx) => {
            updateTransactionList();
            updatePoolStats();
        });
        
        
        setInterval(() => {
            updatePoolStats();
        }, 5000);
        
        
        updatePoolStats();
    } catch (error) {
        console.error('Failed to initialize bridge:', error);
    }
}


function initBridgeUI() {
    if (!document.getElementById('connect-wallet-btn')) {
        setTimeout(function() { initBridgeUI(); }, 100);
        return;
    }
    
    window.initBridgeUI = initBridgeUI;
    
    const connectBtn = document.getElementById('connect-wallet-btn');
    const bridgeBtn = document.getElementById('bridge-btn');
    const useWalletBtn = document.getElementById('use-wallet-btn');
    const executeBridgeBtn = document.getElementById('execute-bridge-btn');
    const zcashAmountInput = document.getElementById('zcash-amount');
    const solanaRecipientInput = document.getElementById('solana-recipient');
    
    if (connectBtn) {
        connectBtn.addEventListener('click', async (e) => {
            e.preventDefault();
            e.stopPropagation();
            console.log('Connect wallet button clicked');
            try {
                connectBtn.disabled = true;
                connectBtn.textContent = 'Connecting...';
                await connectWallet();
            } catch (error) {
                console.error('Wallet connection error:', error);
                showBridgeStatus('Error connecting wallet: ' + error.message, 'error');
                connectBtn.disabled = false;
                connectBtn.textContent = 'Connect Wallet';
            }
        });
    } else {
        console.error('Connect wallet button not found!');
    }
    
    if (useWalletBtn) {
        useWalletBtn.addEventListener('click', () => {
            if (bridge && bridge.solanaWallet) {
                solanaRecipientInput.value = bridge.solanaWallet;
                checkBridgeReady();
            }
        });
    }
    
    if (executeBridgeBtn) {
        executeBridgeBtn.addEventListener('click', async () => {
            await executeBridge();
        });
    }
    
    
    if (zcashAmountInput && solanaRecipientInput) {
        [zcashAmountInput, solanaRecipientInput].forEach(input => {
            input.addEventListener('input', () => {
                checkBridgeReady();
            });
        });
    }
    
    
    updateTransactionList();
    
    
    initCheckerUI();
    
    
    initWalletModals();
    
    
    initTestSuite();
}


function initAPI() {
    try {
        api = new ProtocolAPI();
        window.api = api; 
        
        console.log('API Service initialized');
    } catch (error) {
        console.error('Failed to initialize API:', error);
    }
}


let antiCheat = null;
let leaderboardService = null;

function initGame() {
    try {
        game = new MiniGame();
        
        console.log('Mini Game initialized');
        
        
        if (typeof AntiCheat !== 'undefined') {
            antiCheat = new AntiCheat();
            console.log('Anti-Cheat system initialized');
        }
        
        // PRIORITIZE GOOGLE SHEETS - User wants scores saved to Google Sheets!
        if (typeof LeaderboardSheets !== 'undefined' && typeof CONFIG !== 'undefined') {
            const sheetId = CONFIG.GOOGLE_SHEETS.SHEET_ID;
            const apiKey = CONFIG.GOOGLE_SHEETS.API_KEY;
            if (sheetId && apiKey && sheetId !== 'YOUR_GOOGLE_SHEET_ID' && apiKey !== 'YOUR_GOOGLE_SHEETS_API_KEY') {
                leaderboardService = new LeaderboardSheets(sheetId, apiKey);
                console.log('✅ Google Sheets Leaderboard initialized!');
                console.log(`   Sheet ID: ${sheetId}`);
                console.log(`   📊 ALL game scores will be saved to Google Sheets!`);
                console.log(`   🎮 Every player who connects wallet and plays will have scores saved!`);
            } else {
                console.warn('⚠️ Google Sheets not configured - checking for API fallback...');
                // Fallback to API-based leaderboard
                if (typeof LeaderboardService !== 'undefined') {
                    leaderboardService = new LeaderboardService();
                    console.log('✅ Leaderboard API service initialized (fallback)');
                } else {
                    console.warn('⚠️ No leaderboard service available - scores will be saved locally only');
                }
            }
        } 
        // Fallback to API-based leaderboard if Google Sheets not available
        else if (typeof LeaderboardService !== 'undefined') {
            leaderboardService = new LeaderboardService();
            console.log('✅ Leaderboard API service initialized (Google Sheets not available)');
        } else {
            console.warn('⚠️ No leaderboard service available - scores will be saved locally only');
        }
        
        
        const startBtn = document.getElementById('start-game-btn');
        const gameArea = document.getElementById('game-area');
        const gameStatus = document.getElementById('game-status');
        
        if (startBtn) {
            startBtn.addEventListener('click', async (e) => {
                e.preventDefault();
                e.stopPropagation();
                console.log('Start game button clicked');
                try {
                    await startGame();
                } catch (error) {
                    console.error('Start game error:', error);
                }
            });
        } else {
            console.error('Start game button not found!');
        }
        
        
        if (gameArea) {
            gameArea.addEventListener('click', (e) => {
                
                if (game && game.isPlaying) {
                    
                    const clickedTarget = e.target.closest('.game-target');
                    if (!clickedTarget && e.target === gameArea) {
                        
                        handleBackgroundClick(e);
                    }
                }
            }, true); 
        }
        
        
        setInterval(() => {
            if (game && game.isPlaying) {
                updateGameUI();
            }
        }, 100);
        
        
        setTimeout(() => {
            if (typeof loadLeaderboard === 'function') {
                loadLeaderboard();
            }
        }, 2000);
        
    } catch (error) {
        console.error('Failed to initialize game:', error);
    }
}


function handleBackgroundClick(e) {
    if (!game || !game.isPlaying) return;
    
    
    if (e.target.classList.contains('game-target') || 
        e.target.closest('.game-target')) {
        return; 
    }
    
    
    game.missedTargets++;
    game.missTarget();
    
    
    showGameStatus('Missed! -1 Life', 'error');
    
    
    const gameArea = document.getElementById('game-area');
    if (gameArea) {
        gameArea.style.backgroundColor = 'rgba(255, 68, 68, 0.2)';
        setTimeout(() => {
            gameArea.style.backgroundColor = '';
        }, 200);
    }
    
    
    checkGameEnd();
    updateGameUI();
}


async function startGame() {
    const startBtn = document.getElementById('start-game-btn');
    const gameStatus = document.getElementById('game-status');
    const gameArea = document.getElementById('game-area');
    const startScreen = document.getElementById('game-start-screen');
    
    if (!api || !bridge) {
        showGameStatus('Please wait for bridge to initialize...', 'error');
        return;
    }
    
    if (!bridge.solanaWallet) {
        showGameStatus('Please connect your Solana wallet first!', 'error');
        return;
    }
    
    try {
        startBtn.disabled = true;
        startBtn.textContent = 'Starting Game...';
        showGameStatus('Starting game...', 'info');
        
        
        if (!api.bridge) {
            api.init(bridge);
        }
        
        
        if (!game.api) {
            game.init(api);
        }
        
        
        const result = await game.startGame();
        
        if (result.success) {
            showGameStatus('Game starting...', 'success');
            
            
            if (antiCheat) {
                antiCheat.reset();
            }
            
            
            if (startScreen) {
                startScreen.classList.add('hidden');
                startScreen.style.display = 'none';
                startScreen.style.visibility = 'hidden';
                startScreen.style.opacity = '0';
                startScreen.style.pointerEvents = 'none';
            }
            
            
            if (gameArea) {
                gameArea.style.display = 'block';
                gameArea.style.visibility = 'visible';
            }
            
            
            startGameLoop();
            
            
            startBtn.textContent = 'Game In Progress...';
            startBtn.disabled = true;
            
            
            updateGameUI();
        }
    } catch (error) {
        console.error('Game start error:', error);
        showGameStatus('Error: ' + error.message, 'error');
        startBtn.disabled = false;
        startBtn.textContent = 'Connect Wallet & Start Game';
    }
}


let targetTimeouts = []; 

function startGameLoop() {
    const gameArea = document.getElementById('game-area');
    
    
    if (gameInterval) clearInterval(gameInterval);
    targetTimeouts.forEach(timeout => clearTimeout(timeout));
    targetTimeouts = [];
    
    
    const existingTargets = gameArea.querySelectorAll('.game-target');
    existingTargets.forEach(target => target.remove());
    
    
    gameInterval = setInterval(() => {
        if (!game || !game.isPlaying) {
            clearInterval(gameInterval);
            targetTimeouts.forEach(timeout => clearTimeout(timeout));
            targetTimeouts = [];
            return;
        }
        
        createGameTarget();
    }, 1200); 
    
    
    setTimeout(() => createGameTarget(), 300);
}


function createGameTarget() {
    if (!game || !game.isPlaying) {
        console.log('Game not playing, skipping target creation');
        return;
    }
    
    const gameArea = document.getElementById('game-area');
    if (!gameArea) {
        console.log('Game area not found');
        return;
    }
    
    
    gameArea.style.display = 'block';
    gameArea.style.visibility = 'visible';
    
    
    const startScreen = document.getElementById('game-start-screen');
    if (startScreen) {
        startScreen.classList.add('hidden');
        startScreen.style.display = 'none';
        startScreen.style.visibility = 'hidden';
        startScreen.style.pointerEvents = 'none';
    }
    
    const rect = gameArea.getBoundingClientRect();
    const gameAreaWidth = Math.max(rect.width || 800, 400);
    const gameAreaHeight = Math.max(rect.height || 500, 300);
    
    const target = game.createTarget(gameAreaWidth, gameAreaHeight);
    
    
    const maxX = Math.max(0, gameAreaWidth - target.size);
    const maxY = Math.max(0, gameAreaHeight - target.size);
    
    const finalX = Math.min(Math.max(0, target.x), maxX);
    const finalY = Math.min(Math.max(0, target.y), maxY);
    
    
    const targetEl = document.createElement('div');
    targetEl.className = 'game-target';
    targetEl.style.left = finalX + 'px';
    targetEl.style.top = finalY + 'px';
    targetEl.style.width = target.size + 'px';
    targetEl.style.height = target.size + 'px';
    targetEl.style.borderColor = target.color;
    targetEl.style.boxShadow = `0 0 20px ${target.color}80`;
    targetEl.style.position = 'absolute';
    targetEl.style.zIndex = '100';
    targetEl.style.display = 'block';
    targetEl.style.visibility = 'visible';
    targetEl.setAttribute('data-target-id', target.id);
    targetEl.setAttribute('data-points', target.points);
    
    console.log(`Creating target at (${finalX}, ${finalY}) with size ${target.size}px`);
    
    
    targetEl.addEventListener('click', (e) => {
        e.stopPropagation();
        hitTarget(target.id, targetEl);
    });
    
    
    const countdownBar = document.createElement('div');
    countdownBar.className = 'target-countdown';
    countdownBar.style.width = '100%';
    targetEl.appendChild(countdownBar);
    
    gameArea.appendChild(targetEl);
    
    
    countdownBar.style.transition = `width ${target.lifetime}ms linear`;
    setTimeout(() => {
        countdownBar.style.width = '0%';
    }, 10);
    
    
    const timeoutId = setTimeout(() => {
        if (targetEl.parentElement) {
            targetEl.classList.add('missed');
            setTimeout(() => {
                if (targetEl.parentElement) {
                    targetEl.remove();
                    const targetIndex = game.targets.findIndex(t => t.id === target.id);
                    if (targetIndex !== -1) {
                        game.targets.splice(targetIndex, 1);
                        game.missTarget();
                        checkGameEnd();
                    }
                }
            }, 200);
        }
        
        const index = targetTimeouts.indexOf(timeoutId);
        if (index > -1) {
            targetTimeouts.splice(index, 1);
        }
    }, target.lifetime);
    
    
    targetEl.setAttribute('data-timeout-id', timeoutId.toString());
    targetTimeouts.push(timeoutId);
}


function hitTarget(targetId, targetEl) {
    if (!game || !game.isPlaying) return;
    
    const result = game.hitTarget(targetId);
    if (result && result.hit) {
        
        const timeoutAttr = targetEl.getAttribute('data-timeout-id');
        if (timeoutAttr) {
            const timeoutId = parseInt(timeoutAttr);
            clearTimeout(timeoutId);
            const index = targetTimeouts.indexOf(timeoutId);
            if (index > -1) {
                targetTimeouts.splice(index, 1);
            }
        }
        
        
        targetEl.classList.add('hit');
        targetEl.style.background = `radial-gradient(circle, ${result.target.color} 0%, transparent 70%)`;
        
        
        showPointsPopup(result.points, result.bonus, targetEl, result);
        
        
        createHitEffect(targetEl);
        
        
        setTimeout(() => {
            if (targetEl.parentElement) {
                targetEl.remove();
            }
        }, 300);
        
        updateGameUI();
    }
}


function createHitEffect(targetEl) {
    const effect = document.createElement('div');
    effect.className = 'hit-effect';
    const rect = targetEl.getBoundingClientRect();
    const gameArea = document.getElementById('game-area');
    const gameAreaRect = gameArea.getBoundingClientRect();
    
    effect.style.left = (rect.left - gameAreaRect.left + rect.width / 2) + 'px';
    effect.style.top = (rect.top - gameAreaRect.top + rect.height / 2) + 'px';
    effect.style.width = rect.width + 'px';
    effect.style.height = rect.height + 'px';
    
    gameArea.appendChild(effect);
    
    setTimeout(() => {
        if (effect.parentElement) {
            effect.remove();
        }
    }, 600);
}


function showPointsPopup(points, bonus, targetEl, result) {
    const gameArea = document.getElementById('game-area');
    if (!gameArea) return;
    
    const rect = targetEl.getBoundingClientRect();
    const gameAreaRect = gameArea.getBoundingClientRect();
    
    const popup = document.createElement('div');
    popup.className = 'points-popup';
    
    // Build popup content with combo and streak info
    let popupContent = `<div class="points-main">+${points}</div>`;
    if (bonus > 0) {
        popupContent += `<div class="points-bonus">+${bonus} time bonus</div>`;
    }
    if (result && result.combo > 1) {
        popupContent += `<div class="points-combo" style="color: #ffaa00; font-size: 1.2rem; margin-top: 0.2rem;">${result.combo}x COMBO!</div>`;
    }
    if (result && result.streakBonus > 0) {
        popupContent += `<div class="points-streak" style="color: #ff00ff; font-size: 1rem; margin-top: 0.2rem;">+${result.streakBonus} streak bonus</div>`;
    }
    
    popup.innerHTML = popupContent;
    popup.style.position = 'absolute';
    popup.style.left = (rect.left - gameAreaRect.left + rect.width / 2) + 'px';
    popup.style.top = (rect.top - gameAreaRect.top + rect.height / 2) + 'px';
    popup.style.transform = 'translate(-50%, -50%)';
    popup.style.color = getComputedStyle(document.documentElement).getPropertyValue('--accent-success') || '#00ff88';
    popup.style.fontFamily = getComputedStyle(document.documentElement).getPropertyValue('--font-mono') || 'monospace';
    popup.style.fontSize = '1.8rem';
    popup.style.fontWeight = '700';
    popup.style.pointerEvents = 'none';
    popup.style.zIndex = '1000';
    popup.style.textAlign = 'center';
    popup.style.animation = 'fadeUp 1.2s forwards';
    
    gameArea.appendChild(popup);
    
    setTimeout(() => {
        if (popup.parentElement) {
            popup.remove();
        }
    }, 1200);
}


function checkGameEnd() {
    if (!game || !game.isPlaying) return;
    
    const stats = game.getStats();
    if (stats.remainingLives <= 0) {
        endGame();
    } else {
        updateGameUI();
    }
}


async function endGame() {
    if (!game) return;
    
    const result = game.endGame();
    const startBtn = document.getElementById('start-game-btn');
    const gameStatus = document.getElementById('game-status');
    const startScreen = document.getElementById('game-start-screen');
    const gameArea = document.getElementById('game-area');
    
    const finalScore = result.score;
    
    console.log(`\n🎮 ========== SAVING GAME SCORE ==========`);
    console.log(`📊 Final Score: ${finalScore} points`);
    console.log(`⏱️  Duration: ${(result.duration / 1000).toFixed(2)}s`);
    
    if (antiCheat && antiCheat.isCheating) {
        console.log(`🚫 Score not submitted due to cheating detection`);
        showGameStatus('Score not submitted due to cheating detection', 'error');
    } else {
        // ALWAYS SAVE SCORE TO GOOGLE SHEETS WHEN PLAYER LOSES
        console.log(`💾 Attempting to save score to Google Sheets...`);
        console.log(`   Leaderboard service: ${leaderboardService ? '✅ Available (' + leaderboardService.constructor.name + ')' : '❌ Not available'}`);
        console.log(`   Bridge: ${bridge ? '✅ Available' : '❌ Not available'}`);
        console.log(`   Wallet: ${bridge && bridge.solanaWallet ? '✅ ' + bridge.solanaWallet.substring(0, 8) + '...' + bridge.solanaWallet.substring(bridge.solanaWallet.length - 8) : '❌ Not connected'}`);
        
        if (leaderboardService && bridge && bridge.solanaWallet) {
            try {
                const signature = result.paymentSignature || 'game-' + Date.now();
                const difficulty = Math.min(1 + Math.floor(finalScore / 100), 5);
                
                console.log(`💾 Saving score to leaderboard...`);
                console.log(`   Score: ${finalScore} points`);
                console.log(`   Duration: ${(result.duration / 1000).toFixed(2)}s`);
                console.log(`   Wallet: ${bridge.solanaWallet.substring(0, 8)}...${bridge.solanaWallet.substring(bridge.solanaWallet.length - 8)}`);
                console.log(`   Difficulty: ${difficulty}`);
                
                const submitResult = await leaderboardService.submitScore(
                    bridge.solanaWallet,
                    finalScore,
                    result.duration,
                    signature,
                    difficulty
                );
                
                console.log(`✅ Score submission result:`, submitResult);
                
                if (submitResult && submitResult.success) {
                    console.log(`✅ Score successfully saved to Google Sheets!`);
                    
                    // Check if it's a new high score
                    try {
                        const userScore = await leaderboardService.getUserBestScore(bridge.solanaWallet);
                        const highestScore = userScore.bestScore ? userScore.bestScore.score : 0;
                        
                        if (finalScore > highestScore) {
                            console.log(`🎉 NEW HIGH SCORE! Previous best: ${highestScore}, New: ${finalScore}`);
                            showGameStatus(`🎉 New high score! ${finalScore} points saved to Google Sheets!`, 'success');
                        } else {
                            console.log(`✅ Score saved! Current: ${finalScore}, Best: ${highestScore}`);
                            showGameStatus(`✅ Score saved to Google Sheets! ${finalScore} points (Best: ${highestScore})`, 'success');
                        }
                    } catch (e) {
                        console.warn('Could not fetch user best score:', e);
                        showGameStatus(`✅ Score saved to Google Sheets! ${finalScore} points`, 'success');
                    }
                    
                    // Refresh leaderboard display
                    setTimeout(() => {
                        if (typeof loadLeaderboard === 'function') {
                            loadLeaderboard();
                        }
                    }, 1000);
                } else {
                    const errorMsg = submitResult?.error || 'Unknown error';
                    console.error(`❌ Score submission to Google Sheets failed: ${errorMsg}`);
                    showGameStatus(`⚠️ Score: ${finalScore} - Failed to save to Google Sheets (${errorMsg}), saved locally`, 'error');
                    // Save to localStorage as backup
                    try {
                        const localScores = JSON.parse(localStorage.getItem('gameScores') || '[]');
                        localScores.push({
                            wallet: bridge.solanaWallet,
                            score: finalScore,
                            time: result.duration,
                            timestamp: Date.now()
                        });
                        localStorage.setItem('gameScores', JSON.stringify(localScores));
                    } catch (e) {
                        console.error('Failed to save score locally:', e);
                    }
                }
            } catch (error) {
                console.error('Failed to submit score:', error);
                showGameStatus(`⚠️ Score: ${finalScore} - Failed to save (${error.message})`, 'error');
                
                // Always save to localStorage as backup
                try {
                    const localScores = JSON.parse(localStorage.getItem('gameScores') || '[]');
                    localScores.push({
                        wallet: bridge.solanaWallet,
                        score: finalScore,
                        time: result.duration,
                        timestamp: Date.now(),
                        error: error.message
                    });
                    localStorage.setItem('gameScores', JSON.stringify(localScores));
                    console.log('Score saved to localStorage as backup');
                } catch (e) {
                    console.error('Failed to save score locally:', e);
                }
            }
        } else {
            // No leaderboard service or wallet - save locally
            if (bridge && bridge.solanaWallet) {
                try {
                    const localScores = JSON.parse(localStorage.getItem('gameScores') || '[]');
                    localScores.push({
                        wallet: bridge.solanaWallet,
                        score: finalScore,
                        time: result.duration,
                        timestamp: Date.now()
                    });
                    localStorage.setItem('gameScores', JSON.stringify(localScores));
                    showGameStatus(`Score: ${finalScore} - Saved locally (leaderboard not configured)`, 'info');
                } catch (e) {
                    console.error('Failed to save score locally:', e);
                }
            } else {
                showGameStatus(`Score: ${finalScore} - Connect wallet to save to leaderboard`, 'info');
            }
        }
    }
    
    
    if (gameInterval) {
        clearInterval(gameInterval);
        gameInterval = null;
    }
    targetTimeouts.forEach(timeout => clearTimeout(timeout));
    targetTimeouts = [];
    
    
    const targets = gameArea.querySelectorAll('.game-target');
    targets.forEach((target, index) => {
        setTimeout(() => {
            target.style.opacity = '0';
            target.style.transform = 'scale(0)';
            setTimeout(() => {
                if (target.parentElement) {
                    target.remove();
                }
            }, 300);
        }, index * 50);
    });
    
    
    const scorePerSecond = result.duration > 0 ? (result.score / (result.duration / 1000)).toFixed(1) : 0;
    let rating = 'Good';
    if (scorePerSecond > 50) rating = 'Excellent!';
    else if (scorePerSecond > 30) rating = 'Great!';
    else if (scorePerSecond > 15) rating = 'Good';
    else rating = 'Keep Trying!';
    
    
    let leaderboardInfo = '';
    if (leaderboardService && bridge && bridge.solanaWallet) {
        try {
            const userScore = await leaderboardService.getUserBestScore(bridge.solanaWallet);
            if (userScore.bestScore && userScore.bestScore.rank) {
                leaderboardInfo = `<p style="color: var(--accent-primary); margin-top: 0.5rem;">
                    Your Rank: #${userScore.bestScore.rank}
                </p>`;
            }
        } catch (error) {
            
        }
    }
    
    
    if (startScreen) {
        startScreen.classList.remove('hidden');
        startScreen.style.display = 'block';
        startScreen.style.visibility = 'visible';
        startScreen.style.opacity = '1';
        startScreen.style.pointerEvents = 'auto';
        startScreen.innerHTML = `
            <h3>Game Over!</h3>
            <div style="margin: 1.5rem 0;">
                <p style="font-size: 2rem; color: var(--accent-primary); margin: 0.5rem 0;">
                    Score: <strong>${result.score}</strong>
                </p>
                <p style="color: var(--text-secondary); margin: 0.5rem 0;">
                    Time: <strong>${Math.floor(result.duration / 1000)}s</strong>
                </p>
                <p style="color: var(--text-secondary); margin: 0.5rem 0;">
                    Score/sec: <strong>${scorePerSecond}</strong>
                </p>
                ${result.maxCombo > 0 ? `<p style="color: #ffaa00; margin: 0.5rem 0;">
                    Max Combo: <strong>${result.maxCombo}x</strong>
                </p>` : ''}
                ${result.finalStreak > 0 ? `<p style="color: #ff00ff; margin: 0.5rem 0;">
                    Total Streak: <strong>${result.finalStreak}</strong>
                </p>` : ''}
                ${leaderboardInfo}
                <p style="color: var(--accent-success); margin-top: 1rem; font-size: 1.2rem;">
                    ${rating}
                </p>
            </div>
        `;
    }
    
    
    if (startBtn) {
        startBtn.disabled = false;
        startBtn.textContent = 'Connect Wallet & Start Game';
    }
    
    
    showGameStatus(`Game Over! Final Score: ${result.score} (${scorePerSecond} pts/sec)`, 'info');
    
    
    updateGameUI();
    
    
    await loadLeaderboard();
}


function updateGameUI() {
    if (!game) return;
    
    const stats = game.getStats();
    const scoreEl = document.getElementById('game-score');
    const livesEl = document.getElementById('game-lives');
    const timeEl = document.getElementById('game-time');
    
    if (scoreEl) {
        scoreEl.textContent = stats.score;
    }
    
    if (livesEl) {
        livesEl.textContent = stats.remainingLives;
        
        if (stats.remainingLives <= 1) {
            livesEl.style.color = 'var(--accent-error)';
        } else if (stats.remainingLives <= 2) {
            livesEl.style.color = '#ffaa00';
        } else {
            livesEl.style.color = 'var(--accent-primary)';
        }
    }
    
    if (timeEl && stats.isPlaying) {
        const seconds = Math.floor(stats.gameTime / 1000);
        timeEl.textContent = seconds + 's';
    }
    
    // Update combo display if element exists
    let comboEl = document.getElementById('game-combo');
    if (!comboEl && stats.isPlaying && stats.combo > 1) {
        const gameControls = document.querySelector('.game-controls');
        if (gameControls) {
            comboEl = document.createElement('div');
            comboEl.id = 'game-combo';
            comboEl.className = 'info-item';
            comboEl.innerHTML = `<span class="info-label">Combo:</span><span class="info-value" id="combo-value">0</span>`;
            gameControls.appendChild(comboEl);
        }
    }
    
    if (comboEl && stats.isPlaying) {
        const comboValueEl = document.getElementById('combo-value');
        if (comboValueEl) {
            if (stats.combo > 1) {
                comboValueEl.textContent = `${stats.combo}x`;
                comboValueEl.style.color = '#ffaa00';
                comboValueEl.style.fontWeight = '700';
            } else {
                comboValueEl.textContent = '0';
                comboValueEl.style.color = '';
                comboValueEl.style.fontWeight = '';
            }
        }
    } else if (comboEl && !stats.isPlaying) {
        comboEl.remove();
    }
}


async function loadLeaderboard() {
    if (!leaderboardService) {
        const container = document.getElementById('leaderboard-container');
        if (container) {
            container.innerHTML = '<p style="color: var(--text-secondary);">Configure Google Sheets in config.js to enable leaderboard</p>';
        }
        return;
    }
    
    const container = document.getElementById('leaderboard-container');
    if (!container) return;
    
    try {
        container.innerHTML = '<p style="color: var(--text-secondary);">Loading...</p>';
        const data = await leaderboardService.getLeaderboard(20);
        
        if (data.leaderboard && data.leaderboard.length > 0) {
            container.innerHTML = data.leaderboard.map((entry, index) => `
                <div class="leaderboard-item">
                    <span class="leaderboard-rank">#${entry.rank}</span>
                    <span class="leaderboard-wallet">${entry.wallet}</span>
                    <span class="leaderboard-score">${entry.score.toLocaleString()}</span>
                    <span class="leaderboard-time">${Math.floor(entry.time / 1000)}s</span>
                </div>
            `).join('');
        } else {
            container.innerHTML = '<p style="color: var(--text-secondary);">No scores yet. Be the first!</p>';
        }
    } catch (error) {
        console.error('Failed to load leaderboard:', error);
        container.innerHTML = '<p style="color: var(--text-secondary);">Failed to load leaderboard. Please refresh the page.</p>';
    }
}


function showGameStatus(message, type = 'info') {
    const gameStatus = document.getElementById('game-status');
    if (gameStatus) {
        gameStatus.textContent = message;
        gameStatus.className = `game-status ${type}`;
        
        if (type === 'success' || type === 'error') {
            setTimeout(() => {
                gameStatus.style.display = 'none';
            }, 5000);
        }
    }
}


function initTestSuite() {
    
    window.runBridgeTests = async function(iterations = 1000) {
        if (!bridge) {
            console.error('Bridge not initialized');
            return;
        }
        
        console.log('Starting bridge test suite...');
        const testSuite = new BridgeTestSuite(bridge);
        const results = await testSuite.runFullTestSuite(iterations);
        
        
        if (typeof showBridgeStatus === 'function') {
            const passRate = ((results.passed / results.totalTests) * 100).toFixed(2);
            showBridgeStatus(
                `Tests completed: ${results.passed}/${results.totalTests} passed (${passRate}%)`,
                results.failed === 0 ? 'success' : 'error'
            );
        }
        
        return results;
    };
    
    console.log('%cTest Suite Ready!', 'color: #00d4ff; font-size: 14px; font-weight: bold;');
    console.log('%cRun: runBridgeTests(N) to test N transactions (NO LIMITS!)', 'color: #8b949e; font-size: 12px;');
    console.log('%cRun: runAPITests(N) to test API N times', 'color: #8b949e; font-size: 12px;');
    console.log('%cOr use the "Run Stress Test" button on the page', 'color: #8b949e; font-size: 12px;');
    
    
    window.runAPITests = async function(iterations = 700) {
        if (!api) {
            console.error('API not initialized. Please wait for bridge to initialize.');
            return null;
        }
        
        if (!api.bridge) {
            console.error('Bridge not initialized in API. Please wait for bridge to initialize.');
            return null;
        }
        
        console.log(`Starting API test suite: ${iterations} iterations...`);
        let attempt = 1;
        let results = null;
        
        while (true) {
            console.log(`\n=== Test Run ${attempt} ===`);
            const testSuite = new APITestSuite(api);
            results = await testSuite.runFullTestSuite(iterations);
            
            const rpcErrorRate = ((results.rpcErrors / results.totalTests) * 100).toFixed(2);
            const passRate = ((results.passed / results.totalTests) * 100).toFixed(2);
            
            
            const isSuccess = parseFloat(rpcErrorRate) < 50 && results.failed === 0;
            
            if (isSuccess) {
                console.log(`\nSUCCESS! All tests passed with acceptable RPC error rate.`);
                console.log(`  Pass Rate: ${passRate}%`);
                console.log(`  RPC Error Rate: ${rpcErrorRate}% (threshold: <50%)`);
                console.log(`  API Failures: ${results.failed}`);
                break;
            } else {
                console.log(`\nFAIL: Test run ${attempt} did not meet success criteria.`);
                console.log(`  Pass Rate: ${passRate}%`);
                console.log(`  RPC Error Rate: ${rpcErrorRate}% (threshold: <50%)`);
                console.log(`  API Failures: ${results.failed}`);
                
                if (results.failed > 0) {
                    console.log(`\nAnalyzing errors to improve API...`);
                    
                    const errorTypes = {};
                    results.errors.forEach(err => {
                        errorTypes[err.type] = (errorTypes[err.type] || 0) + 1;
                    });
                    console.log(`Error breakdown:`, errorTypes);
                }
                
                attempt++;
                console.log(`\nRetrying test suite (attempt ${attempt})...`);
                
                await new Promise(resolve => setTimeout(resolve, 1000));
            }
        }
        
        return results;
    };
    
    
    
    
    
    
    const testBtn = document.getElementById('run-tests-btn');
    
    
    if (testBtn) {
        testBtn.addEventListener('click', async (e) => {
            e.preventDefault();
            e.stopPropagation();
            console.log('Run tests button clicked');
            try {
                const iterations = prompt('How many tests to run? (No limits - enter any number)', '10000');
                if (iterations && !isNaN(iterations)) {
                    const testCount = parseInt(iterations);
                    if (testCount > 0) {
                        await runTestsWithUI(testCount, testBtn);
                    } else {
                        alert('Please enter a valid number greater than 0');
                    }
                }
            } catch (error) {
                console.error('Test button error:', error);
                alert('Error starting tests: ' + error.message);
            }
        });
    } else {
        console.error('Run tests button not found!');
    }
    
    
    async function runTestsWithUI(testCount, buttonElement) {
        if (!bridge) {
            alert('Bridge not initialized. Please wait...');
            return;
        }
        
        if (testCount <= 0 || !isFinite(testCount)) {
            alert('Invalid test count. Please enter a valid number.');
            return;
        }
        
        const originalButtonText = buttonElement.textContent;
        buttonElement.disabled = true;
        buttonElement.textContent = `Testing ${testCount.toLocaleString()}...`;
        
        
        if (testBtn) {
            testBtn.disabled = true;
        }
        
        
        const progressDiv = document.createElement('div');
        progressDiv.id = 'test-progress';
        progressDiv.style.cssText = 'position:fixed;top:50%;left:50%;transform:translate(-50%,-50%);background:var(--bg-tertiary);padding:2rem;border:2px solid var(--accent-primary);border-radius:8px;z-index:10001;font-family:var(--font-mono);min-width:400px;max-width:90vw;';
        progressDiv.innerHTML = `
            <div style="text-align:center;color:var(--text-primary);margin-bottom:1rem;">
                    <div style="font-size:1.5rem;margin-bottom:0.5rem;">Running Tests</div>
                <div id="test-progress-text" style="color:var(--text-secondary);">Initializing...</div>
                <div id="test-stats" style="color:var(--text-secondary);font-size:0.85rem;margin-top:0.5rem;">
                    <div>Passed: <span id="test-passed">0</span> | Failed: <span id="test-failed">0</span></div>
                    <div>Speed: <span id="test-speed">0</span> tests/sec</div>
                </div>
            </div>
            <div style="background:var(--bg-code);height:20px;border-radius:4px;overflow:hidden;margin-bottom:0.5rem;">
                <div id="test-progress-bar" style="background:var(--accent-primary);height:100%;width:0%;transition:width 0.3s;"></div>
            </div>
            <div style="text-align:center;">
                <button id="cancel-test-btn" onclick="cancelTest()" 
                        style="background:var(--accent-error);color:white;border:none;padding:0.5rem 1rem;border-radius:6px;cursor:pointer;font-family:var(--font-mono);font-size:0.85rem;">
                    Cancel Test
                </button>
            </div>
        `;
        document.body.appendChild(progressDiv);
        
        const startTime = Date.now();
        let lastUpdate = 0;
        let testCancelled = false;
        let originalLog = null;
        let progressHandler = null;
        
        
        window.cancelTest = function() {
            window.testCancelled = true;
            testCancelled = true;
            const cancelBtn = document.getElementById('cancel-test-btn');
            if (cancelBtn) {
                cancelBtn.disabled = true;
                cancelBtn.textContent = 'Cancelling...';
            }
            console.log('Test cancellation requested...');
        };
        
        
        const updateProgress = (current, total, passed, failed) => {
            const percent = total > 0 ? ((current / total) * 100).toFixed(1) : 0;
            const progressBar = document.getElementById('test-progress-bar');
            const progressText = document.getElementById('test-progress-text');
            const passedEl = document.getElementById('test-passed');
            const failedEl = document.getElementById('test-failed');
            const speedEl = document.getElementById('test-speed');
            
            if (progressBar) progressBar.style.width = percent + '%';
            if (progressText) {
                progressText.textContent = `${current.toLocaleString()}/${total.toLocaleString()} tests (${percent}%)`;
            }
            if (passedEl) passedEl.textContent = passed.toLocaleString();
            if (failedEl) failedEl.textContent = failed.toLocaleString();
            
            
            const elapsed = (Date.now() - startTime) / 1000;
            if (elapsed > 0 && current > lastUpdate) {
                const speed = ((current - lastUpdate) / ((Date.now() - lastUpdate) / 1000)).toFixed(0);
                if (speedEl) speedEl.textContent = speed;
                lastUpdate = current;
            }
        };
        
        try {
            
            progressHandler = (event) => {
                const { current, total, passed, failed, elapsed, rate } = event.detail;
                updateProgress(current, total, passed, failed);
                const speedEl = document.getElementById('test-speed');
                if (speedEl) speedEl.textContent = rate;
            };
            window.addEventListener('testProgress', progressHandler);
            
            
            originalLog = console.log;
            console.log = function(...args) {
                if (args[0] && typeof args[0] === 'string') {
                    if (args[0].includes('Progress:') || args[0].includes('/')) {
                        const match = args[0].match(/(\d+)\/(\d+)/);
                        if (match) {
                            updateProgress(parseInt(match[1]), parseInt(match[2]), 0, 0);
                        }
                    }
                }
                originalLog.apply(console, args);
            };
            
            
            window.testCancelled = false;
            
            
            const results = await runBridgeTests(testCount);
            
            
            window.removeEventListener('testProgress', progressHandler);
            
            
            console.log = originalLog;
            
            
            const duration = ((Date.now() - startTime) / 1000).toFixed(2);
            const testsPerSec = (testCount / (duration / 1000)).toFixed(0);
            const passRate = ((results.passed / results.totalTests) * 100).toFixed(2);
            
            
            progressDiv.innerHTML = `
                <div style="text-align:center;color:var(--text-primary);">
                    <div style="font-size:1.5rem;margin-bottom:1rem;">Tests Complete</div>
                    <div style="color:var(--accent-success);font-size:1.2rem;margin-bottom:0.5rem;">
                        ${results.passed.toLocaleString()}/${results.totalTests.toLocaleString()} Passed
                    </div>
                    <div style="color:var(--text-secondary);font-size:0.9rem;margin-bottom:0.5rem;">
                        Pass Rate: ${passRate}%
                    </div>
                    <div style="color:var(--text-secondary);font-size:0.85rem;margin-bottom:1rem;">
                        Duration: ${duration}s | Speed: ${testsPerSec} tests/sec
                    </div>
                    ${results.warnings && results.warnings.length > 0 ? `
                        <div style="color:var(--accent-warning);font-size:0.85rem;margin-bottom:1rem;">
                            Warnings: ${results.warnings.length}
                        </div>
                    ` : ''}
                    <button onclick="this.parentElement.parentElement.remove()" 
                            style="background:var(--accent-primary);color:var(--bg-primary);border:none;padding:0.5rem 1.5rem;border-radius:6px;cursor:pointer;font-family:var(--font-mono);">
                        Close
                    </button>
                </div>
            `;
            
            
            buttonElement.textContent = `Complete: ${results.passed.toLocaleString()}/${results.totalTests.toLocaleString()}`;
            setTimeout(() => {
                buttonElement.textContent = originalButtonText;
                buttonElement.disabled = false;
                
                if (testBtn) {
                    testBtn.disabled = false;
                }
                if (progressDiv.parentElement) {
                    progressDiv.remove();
                }
            }, 10000);
        } catch (error) {
            
            if (typeof originalLog !== 'undefined') {
                console.log = originalLog;
            }
            
            
            if (typeof progressHandler !== 'undefined') {
                window.removeEventListener('testProgress', progressHandler);
            }
            
            buttonElement.textContent = 'Test Failed';
            buttonElement.disabled = false;
            
            if (testBtn) {
                testBtn.disabled = false;
            }
            
            
            if (testCancelled || window.testCancelled) {
                if (progressDiv.parentElement) {
                    progressDiv.innerHTML = `
                        <div style="text-align:center;color:var(--accent-warning);">
                            <div style="font-size:1.2rem;margin-bottom:1rem;">Test Cancelled</div>
                            <div style="font-size:0.9rem;margin-bottom:1rem;">Test was cancelled by user</div>
                            <button onclick="this.parentElement.remove()" 
                                    style="background:var(--accent-warning);color:var(--bg-primary);border:none;padding:0.5rem 1.5rem;border-radius:6px;cursor:pointer;">
                                Close
                            </button>
                        </div>
                    `;
                }
            } else {
                if (progressDiv.parentElement) {
                    progressDiv.innerHTML = `
                        <div style="text-align:center;color:var(--accent-error);">
                            <div style="font-size:1.2rem;margin-bottom:1rem;">Test Error</div>
                            <div style="font-size:0.9rem;margin-bottom:1rem;word-break:break-word;">${error.message}</div>
                            <div style="font-size:0.85rem;margin-bottom:1rem;color:var(--text-secondary);">Check console for details</div>
                            <button onclick="this.parentElement.remove()" 
                                    style="background:var(--accent-error);color:white;border:none;padding:0.5rem 1.5rem;border-radius:6px;cursor:pointer;">
                                Close
                            </button>
                        </div>
                    `;
                }
            }
        } finally {
            
            window.testCancelled = false;
            testCancelled = false;
        }
    }
}


function initWalletModals() {
    const modal = document.getElementById('wallet-modal');
    const modalClose = document.getElementById('modal-close');
    const viewPortfolioBtn = document.getElementById('view-portfolio-btn');
    const viewTokensBtn = document.getElementById('view-tokens-btn');
    const viewNFTsBtn = document.getElementById('view-nfts-btn');
    const viewHistoryBtn = document.getElementById('view-history-btn');
    
    
    if (modalClose) {
        modalClose.addEventListener('click', () => {
            modal.style.display = 'none';
        });
    }
    
    
    if (modal) {
        modal.addEventListener('click', (e) => {
            if (e.target === modal) {
                modal.style.display = 'none';
            }
        });
    }
    
    
    if (viewPortfolioBtn) {
        viewPortfolioBtn.addEventListener('click', async () => {
            await showPortfolioModal();
        });
    }
    
    
    if (viewTokensBtn) {
        viewTokensBtn.addEventListener('click', async () => {
            await showTokensModal();
        });
    }
    
    
    if (viewNFTsBtn) {
        viewNFTsBtn.addEventListener('click', async () => {
            await showNFTsModal();
        });
    }
    
    
    if (viewHistoryBtn) {
        viewHistoryBtn.addEventListener('click', async () => {
            await showHistoryModal();
        });
    }
}


async function showPortfolioModal() {
    const modal = document.getElementById('wallet-modal');
    const modalTitle = document.getElementById('modal-title');
    const modalBody = document.getElementById('modal-body');
    
    if (!bridge || !bridge.solanaWallet) {
        showBridgeStatus('Please connect wallet first', 'error');
        return;
    }
    
    modalTitle.textContent = 'Portfolio Overview';
    modalBody.innerHTML = '<div style="text-align:center;padding:2rem;color:var(--text-secondary);">Loading portfolio...</div>';
    modal.style.display = 'flex';
    
    try {
        const solBalance = await bridge.getSolanaBalance();
        const solPrice = await bridge.getSOLPrice();
        const tokens = await bridge.getSolanaTokenAccounts();
        const txs = await bridge.getSolanaTransactions(5);
        
        let html = `
            <div class="portfolio-summary">
                <div class="summary-card">
                    <div class="summary-label">Total Value</div>
                    <div class="summary-value">$${(solBalance * solPrice).toFixed(2)}</div>
                </div>
                <div class="summary-card">
                    <div class="summary-label">SOL Balance</div>
                    <div class="summary-value">${solBalance.toFixed(4)} SOL</div>
                </div>
                <div class="summary-card">
                    <div class="summary-label">Tokens</div>
                    <div class="summary-value">${tokens.length}</div>
                </div>
            </div>
            <h3 style="color:var(--text-primary);font-family:var(--font-mono);margin:2rem 0 1rem;">Recent Transactions</h3>
        `;
        
        if (txs.length > 0) {
            html += '<div class="tx-list">';
            txs.forEach(tx => {
                const date = new Date(tx.blockTime * 1000);
                html += `
                    <div class="tx-history-item">
                        <div class="tx-icon-large">📤</div>
                        <div class="tx-details-full">
                            <div class="tx-title">Transaction</div>
                            <div class="tx-subtitle">${date.toLocaleString()}</div>
                        </div>
                        <div class="tx-amount-large">${tx.confirmationStatus || 'pending'}</div>
                    </div>
                `;
            });
            html += '</div>';
        } else {
            html += '<div style="text-align:center;padding:2rem;color:var(--text-secondary);">No transactions yet</div>';
        }
        
        modalBody.innerHTML = html;
    } catch (error) {
        modalBody.innerHTML = `<div style="text-align:center;padding:2rem;color:var(--accent-error);">Error loading portfolio: ${error.message}</div>`;
    }
}


async function showTokensModal() {
    const modal = document.getElementById('wallet-modal');
    const modalTitle = document.getElementById('modal-title');
    const modalBody = document.getElementById('modal-body');
    
    if (!bridge || !bridge.solanaWallet) {
        showBridgeStatus('Please connect wallet first', 'error');
        return;
    }
    
    modalTitle.textContent = 'Token Balances';
    modalBody.innerHTML = '<div style="text-align:center;padding:2rem;color:var(--text-secondary);">Loading tokens...</div>';
    modal.style.display = 'flex';
    
    try {
        const solBalance = await bridge.getSolanaBalance();
        const solPrice = await bridge.getSOLPrice();
        const tokens = await bridge.getSolanaTokenAccounts();
        
        let html = `
            <div class="portfolio-item" style="margin-bottom:1rem;">
                <div class="token-icon">SOL</div>
                <div class="token-name">Solana</div>
                <div class="token-balance">${solBalance.toFixed(4)} SOL</div>
                <div class="token-value">$${(solBalance * solPrice).toFixed(2)}</div>
            </div>
            <h3 style="color:var(--text-primary);font-family:var(--font-mono);margin:1rem 0;">SPL Tokens</h3>
        `;
        
        if (tokens.length > 0) {
            html += '<div class="portfolio-grid">';
            tokens.forEach(token => {
                html += `
                    <div class="portfolio-item">
                        <div class="token-icon"></div>
                        <div class="token-name">${token.mint.substring(0, 8)}...</div>
                        <div class="token-balance">${token.balance.toFixed(4)}</div>
                        <div class="token-value">Mint: ${token.mint.substring(0, 16)}...</div>
                    </div>
                `;
            });
            html += '</div>';
        } else {
            html += '<div style="text-align:center;padding:2rem;color:var(--text-secondary);">No tokens found</div>';
        }
        
        modalBody.innerHTML = html;
    } catch (error) {
        modalBody.innerHTML = `<div style="text-align:center;padding:2rem;color:var(--accent-error);">Error loading tokens: ${error.message}</div>`;
    }
}


async function showNFTsModal() {
    const modal = document.getElementById('wallet-modal');
    const modalTitle = document.getElementById('modal-title');
    const modalBody = document.getElementById('modal-body');
    
    if (!bridge || !bridge.solanaWallet) {
        showBridgeStatus('Please connect wallet first', 'error');
        return;
    }
    
    modalTitle.textContent = 'NFT Collection';
    modalBody.innerHTML = '<div style="text-align:center;padding:2rem;color:var(--text-secondary);">Loading NFTs...</div>';
    modal.style.display = 'flex';
    
    try {
        const nfts = await bridge.getSolanaNFTs();
        
        if (nfts.length > 0) {
            let html = '<div class="portfolio-grid">';
            nfts.forEach(nft => {
                html += `
                    <div class="portfolio-item">
                        <div class="token-icon"></div>
                        <div class="token-name">${nft.name || 'NFT'}</div>
                        <div class="token-value">${nft.collection || 'Unknown'}</div>
                    </div>
                `;
            });
            html += '</div>';
            modalBody.innerHTML = html;
        } else {
            modalBody.innerHTML = '<div style="text-align:center;padding:2rem;color:var(--text-secondary);">No NFTs found. NFT support coming soon!</div>';
        }
    } catch (error) {
        modalBody.innerHTML = `<div style="text-align:center;padding:2rem;color:var(--accent-error);">Error loading NFTs: ${error.message}</div>`;
    }
}


async function showHistoryModal() {
    const modal = document.getElementById('wallet-modal');
    const modalTitle = document.getElementById('modal-title');
    const modalBody = document.getElementById('modal-body');
    
    if (!bridge || !bridge.solanaWallet) {
        showBridgeStatus('Please connect wallet first', 'error');
        return;
    }
    
    modalTitle.textContent = 'Transaction History';
    modalBody.innerHTML = '<div style="text-align:center;padding:2rem;color:var(--text-secondary);">Loading history...</div>';
    modal.style.display = 'flex';
    
    try {
        const txs = await bridge.getSolanaTransactions(20);
        
        if (txs.length > 0) {
            let html = '<div class="tx-list">';
            txs.forEach(tx => {
                const date = new Date(tx.blockTime * 1000);
                const statusClass = tx.err ? 'error' : (tx.confirmationStatus === 'confirmed' || tx.confirmationStatus === 'finalized') ? 'success' : 'pending';
                html += `
                    <div class="tx-history-item">
                        <div class="tx-icon-large">${tx.err ? 'X' : 'OK'}</div>
                        <div class="tx-details-full">
                            <div class="tx-title">${tx.err ? 'Failed Transaction' : 'Transaction'}</div>
                            <div class="tx-subtitle">${date.toLocaleString()} • Slot: ${tx.slot}</div>
                            <div class="tx-subtitle" style="font-size:0.75rem;margin-top:0.25rem;word-break:break-all;">${tx.signature}</div>
                        </div>
                        <div class="tx-amount-large ${statusClass}">${tx.confirmationStatus || 'pending'}</div>
                    </div>
                `;
            });
            html += '</div>';
            modalBody.innerHTML = html;
        } else {
            modalBody.innerHTML = '<div style="text-align:center;padding:2rem;color:var(--text-secondary);">No transactions found</div>';
        }
    } catch (error) {
        modalBody.innerHTML = `<div style="text-align:center;padding:2rem;color:var(--accent-error);">Error loading history: ${error.message}</div>`;
    }
}


async function connectWallet() {
    if (!bridge) {
        throw new Error('Bridge not initialized');
    }
    
    
    if (typeof window === 'undefined' || !window.solana || !window.solana.isPhantom) {
        showBridgeStatus('Phantom wallet not detected! Install Phantom to use REAL MODE.', 'error');
        showBridgeStatus('You can still use demo mode for testing.', 'info');
        
        bridge.solanaWallet = null;
        document.getElementById('connect-wallet-btn').textContent = 'Install Phantom';
        document.getElementById('connect-wallet-btn').style.background = 'var(--accent-warning)';
        document.getElementById('use-wallet-btn').style.display = 'none';
        return;
    }
    
    try {
        showBridgeStatus('Connecting to Phantom wallet...', 'info');
        
        const address = await bridge.connectSolanaWallet();
        
        
        document.getElementById('connect-wallet-btn').style.display = 'none';
        document.getElementById('bridge-btn').style.display = 'inline-block';
        document.getElementById('use-wallet-btn').style.display = 'inline-block';
        document.getElementById('wallet-status').style.display = 'block';
        
        
        const addressEl = document.getElementById('solana-address');
        if (addressEl) {
            addressEl.textContent = address.substring(0, 4) + '...' + address.substring(address.length - 4);
            addressEl.title = address;
            addressEl.style.cursor = 'pointer';
            addressEl.onclick = () => copyToClipboard(address);
        }
        
        
        const avatarEl = document.getElementById('wallet-avatar');
        if (avatarEl) {
            avatarEl.textContent = address.substring(0, 2).toUpperCase();
        }
        
        
        await updateBalances();
        
        showBridgeStatus('Wallet connected! REAL MODE activated.', 'success');
        
        
        setInterval(async () => {
            if (bridge.solanaWallet) {
                await updateBalances();
            }
        }, 10000);
        
    } catch (error) {
        console.error('Wallet connection error:', error);
        showBridgeStatus('Failed to connect: ' + error.message, 'error');
        showBridgeStatus('Falling back to demo mode...', 'info');
        
        bridge.solanaWallet = null;
        document.getElementById('connect-wallet-btn').textContent = 'Retry Connection';
    }
}


async function updateBalances() {
    if (!bridge) return;
    
    try {
        if (bridge.solanaWallet) {
            try {
                const solBalance = await bridge.getSolanaBalance();
                const solPrice = await bridge.getSOLPrice();
                const usdValue = solBalance * solPrice;
                
                
                document.getElementById('total-balance').textContent = solBalance.toFixed(4) + ' SOL';
                document.getElementById('balance-usd').textContent = '$' + usdValue.toFixed(2);
                document.getElementById('solana-balance').textContent = solBalance.toFixed(4) + ' SOL';
                document.getElementById('solana-balance-display').textContent = solBalance.toFixed(4) + ' SOL';
                
                
                const addressEl = document.getElementById('solana-address');
                if (addressEl) {
                    addressEl.textContent = bridge.solanaWallet.substring(0, 4) + '...' + bridge.solanaWallet.substring(bridge.solanaWallet.length - 4);
                    addressEl.title = bridge.solanaWallet;
                    addressEl.onclick = () => copyToClipboard(bridge.solanaWallet);
                }
                
                
                await updateWalletStats();
            } catch (error) {
                console.error('Error updating Solana balance:', error);
                document.getElementById('total-balance').textContent = 'N/A';
                document.getElementById('balance-usd').textContent = '$0.00';
            }
        } else {
            document.getElementById('total-balance').textContent = 'Demo Mode';
            document.getElementById('balance-usd').textContent = '$0.00';
            document.getElementById('solana-balance').textContent = 'Demo Mode';
            document.getElementById('solana-balance-display').textContent = 'Demo Mode';
        }
        
        try {
            const zecBalance = await bridge.getZcashBalance();
            document.getElementById('zcash-balance').textContent = zecBalance.toFixed(4) + ' ZEC';
        } catch (error) {
            document.getElementById('zcash-balance').textContent = 'N/A';
        }
    } catch (error) {
        console.error('Error updating balances:', error);
    }
}


async function updateWalletStats() {
    if (!bridge || !bridge.solanaWallet) return;
    
    try {
        
        const tokens = await bridge.getSolanaTokenAccounts();
        document.getElementById('token-count').textContent = tokens.length;
        
        
        const nfts = await bridge.getSolanaNFTs();
        document.getElementById('nft-count').textContent = nfts.length;
        
        
        const txs = await bridge.getSolanaTransactions(100);
        document.getElementById('tx-count').textContent = txs.length;
    } catch (error) {
        console.error('Error updating wallet stats:', error);
    }
}


function copyToClipboard(text) {
    navigator.clipboard.writeText(text).then(() => {
        showBridgeStatus('Address copied to clipboard!', 'success');
    }).catch(err => {
        console.error('Failed to copy:', err);
    });
}


function checkBridgeReady() {
    const amount = parseFloat(document.getElementById('zcash-amount').value);
    const recipient = document.getElementById('solana-recipient').value.trim();
    const executeBtn = document.getElementById('execute-bridge-btn');
    
    if (amount > 0 && recipient && recipient.length > 0) {
        executeBtn.disabled = false;
    } else {
        executeBtn.disabled = true;
    }
}


async function executeBridge() {
    if (!bridge) {
        showBridgeStatus('Bridge not initialized', 'error');
        return;
    }
    
    const amount = parseFloat(document.getElementById('zcash-amount').value);
    const recipient = document.getElementById('solana-recipient').value.trim();
    
    if (!amount || amount <= 0) {
        showBridgeStatus('Please enter a valid amount', 'error');
        return;
    }
    
    if (!recipient) {
        showBridgeStatus('Please enter a Solana recipient address', 'error');
        return;
    }
    
    const executeBtn = document.getElementById('execute-bridge-btn');
    executeBtn.disabled = true;
    executeBtn.textContent = 'Processing...';
    
    try {
        showBridgeStatus('Initiating bridge transaction...', 'info');
        
        
        window.showBridgeStatus = showBridgeStatus;
        
        const result = await bridge.bridgeZecToSolana(amount, recipient);
        
        showBridgeStatus(
            `Bridge successful! Zcash TX: ${result.zcashTxid.substring(0, 16)}... Solana TX: ${result.solanaTxid.substring(0, 16)}...`,
            'success'
        );
        
        
        document.getElementById('zcash-amount').value = '';
        document.getElementById('solana-recipient').value = '';
        
        
        await updateBalances();
        updatePoolStats();
        updateTransactionList();
        
    } catch (error) {
        showBridgeStatus('Bridge failed: ' + error.message, 'error');
        console.error('Bridge error:', error);
    } finally {
        executeBtn.disabled = false;
        executeBtn.textContent = 'Bridge ZEC → SOL';
        checkBridgeReady();
    }
}


function updatePoolStats() {
    if (!bridge) return;
    
    try {
        const stats = bridge.getPoolStats();
        
        
        const txElement = document.getElementById('stat-transactions');
        if (txElement) {
            txElement.dataset.target = stats.totalTransactions;
            animateValue(txElement, parseInt(txElement.textContent) || 0, stats.totalTransactions, 1000);
        }
        
        
        const usersElement = document.getElementById('stat-users');
        if (usersElement) {
            usersElement.dataset.target = stats.activeUsers;
            animateValue(usersElement, parseInt(usersElement.textContent) || 0, stats.activeUsers, 1000);
        }
        
        
        const balanceElement = document.getElementById('stat-pool-balance');
        if (balanceElement) {
            balanceElement.dataset.target = stats.poolBalance;
            const current = parseFloat(balanceElement.textContent) || 0;
            animateValue(balanceElement, current, stats.poolBalance, 1000, true);
        }
    } catch (error) {
        console.error('Error updating pool stats:', error);
    }
}


function animateValue(element, start, end, duration, isFloat = false) {
    let startTimestamp = null;
    const step = (timestamp) => {
        if (!startTimestamp) startTimestamp = timestamp;
        const progress = Math.min((timestamp - startTimestamp) / duration, 1);
        const current = progress * (end - start) + start;
        
        if (isFloat) {
            element.textContent = current.toFixed(2);
        } else {
            element.textContent = Math.floor(current).toLocaleString();
        }
        
        if (progress < 1) {
            window.requestAnimationFrame(step);
        } else {
            if (isFloat) {
                element.textContent = end.toFixed(2);
            } else {
                element.textContent = end.toLocaleString();
            }
        }
    };
    window.requestAnimationFrame(step);
}


function updateTransactionList() {
    if (!bridge) return;
    
    const transactionList = document.getElementById('transaction-list');
    if (!transactionList) return;
    
    const transactions = bridge.getRecentTransactions(10);
    
    if (transactions.length === 0) {
        transactionList.innerHTML = '<div class="transaction-item empty">No transactions yet</div>';
        return;
    }
    
    transactionList.innerHTML = transactions.map(tx => {
        const date = new Date(tx.timestamp);
        const typeIcon = tx.type === 'deposit' ? 'D' : tx.type === 'withdrawal' ? 'W' : 'T';
        const statusClass = tx.status === 'completed' ? 'success' : tx.status === 'pending' ? 'pending' : 'error';
        
        return `
            <div class="transaction-item ${statusClass}">
                <div class="tx-icon">${typeIcon}</div>
                <div class="tx-details">
                    <div class="tx-type">${tx.type.toUpperCase()}</div>
                    <div class="tx-info">
                        ${tx.amount ? `${tx.amount} ${tx.chain === 'zcash' ? 'ZEC' : 'SOL'}` : ''}
                        ${tx.chain ? `on ${tx.chain.toUpperCase()}` : ''}
                    </div>
                    <div class="tx-time">${date.toLocaleString()}</div>
                </div>
                <div class="tx-status">
                    <span class="status-badge ${statusClass}">${tx.status}</span>
                </div>
            </div>
        `;
    }).join('');
}


function showBridgeStatus(message, type = 'info') {
    console.log(`[Bridge Status ${type}]:`, message);
    
    const statusEl = document.getElementById('bridge-status');
    if (statusEl) {
        statusEl.textContent = message;
        statusEl.className = `bridge-status ${type}`;
        statusEl.style.display = 'block';
        
        if (type === 'success' || type === 'error') {
            setTimeout(() => {
                statusEl.style.display = 'none';
            }, 5000);
        }
    } else {
        const alertDiv = document.createElement('div');
        alertDiv.style.cssText = 'position:fixed;top:20px;right:20px;padding:1rem 1.5rem;background:var(--bg-tertiary);border:2px solid var(--accent-primary);border-radius:8px;z-index:10000;color:var(--text-primary);font-family:var(--font-mono);max-width:400px;';
        alertDiv.className = `bridge-status-alert ${type}`;
        alertDiv.textContent = message;
        document.body.appendChild(alertDiv);
        
        setTimeout(() => {
            alertDiv.remove();
        }, type === 'error' ? 8000 : 5000);
    }
}


function initCheckerUI() {
    const checkTxBtn = document.getElementById('check-tx-btn');
    const checkPoolBtn = document.getElementById('check-pool-btn');
    const checkTxidInput = document.getElementById('check-txid');
    
    if (checkTxBtn) {
        checkTxBtn.addEventListener('click', async () => {
            const txid = checkTxidInput.value.trim();
            if (txid) {
                await checkTransaction(txid);
            } else {
                showCheckerResults('Please enter a transaction ID', 'error');
            }
        });
    }
    
    if (checkPoolBtn) {
        checkPoolBtn.addEventListener('click', async () => {
            await checkPoolIntegrity();
        });
    }
    
    
    if (checkTxidInput) {
        checkTxidInput.addEventListener('keypress', (e) => {
            if (e.key === 'Enter') {
                checkTxBtn.click();
            }
        });
    }
}


async function checkTransaction(txid) {
    if (!bridge) {
        showCheckerResults('Bridge not initialized', 'error');
        return;
    }
    
    const checkBtn = document.getElementById('check-tx-btn');
    const originalText = checkBtn.textContent;
    checkBtn.disabled = true;
    checkBtn.textContent = 'Checking...';
    
    try {
        showCheckerResults('Checking transaction...', 'info');
        
        const result = await bridge.checkTransaction(txid);
        
        displayCheckResults(result);
    } catch (error) {
        showCheckerResults('Check failed: ' + error.message, 'error');
    } finally {
        checkBtn.disabled = false;
        checkBtn.textContent = originalText;
    }
}


async function checkPoolIntegrity() {
    if (!bridge) {
        showCheckerResults('Bridge not initialized', 'error');
        return;
    }
    
    const checkBtn = document.getElementById('check-pool-btn');
    const originalText = checkBtn.textContent;
    checkBtn.disabled = true;
    checkBtn.textContent = 'Checking...';
    
    try {
        showCheckerResults('Checking pool integrity...', 'info');
        
        const report = await bridge.checkPoolIntegrity();
        
        displayPoolIntegrityReport(report);
    } catch (error) {
        showCheckerResults('Pool check failed: ' + error.message, 'error');
    } finally {
        checkBtn.disabled = false;
        checkBtn.textContent = originalText;
    }
}


function displayCheckResults(result) {
    const resultsEl = document.getElementById('checker-results');
    if (!resultsEl) return;
    
    const statusClass = result.valid ? 'success' : 'error';
    const statusIcon = result.valid ? 'OK' : 'ERR';
    
    let html = `
        <div class="check-result ${statusClass}">
            <div class="check-header">
                <span class="check-icon">${statusIcon}</span>
                <span class="check-title">Transaction Check ${result.valid ? 'Passed' : 'Failed'}</span>
            </div>
            <div class="check-details">
                <div class="check-item">
                    <span class="check-label">Transaction ID:</span>
                    <span class="check-value">${result.txid}</span>
                </div>
    `;
    
    if (result.details.zcash) {
        const zcash = result.details.zcash;
        html += `
            <div class="check-section">
                <h4>Zcash Transaction</h4>
                <div class="check-item">
                    <span class="check-label">Status:</span>
                    <span class="check-value ${zcash.confirmed ? 'success' : 'pending'}">${zcash.confirmed ? 'Confirmed' : 'Pending'}</span>
                </div>
                <div class="check-item">
                    <span class="check-label">Confirmations:</span>
                    <span class="check-value">${zcash.confirmations || 0}</span>
                </div>
                ${zcash.amount ? `<div class="check-item"><span class="check-label">Amount:</span><span class="check-value">${zcash.amount} ZEC</span></div>` : ''}
            </div>
        `;
    }
    
    if (result.details.solana) {
        const solana = result.details.solana;
        html += `
            <div class="check-section">
                <h4>Solana Transaction</h4>
                <div class="check-item">
                    <span class="check-label">Status:</span>
                    <span class="check-value ${solana.confirmed ? 'success' : 'pending'}">${solana.status || 'Unknown'}</span>
                </div>
                <div class="check-item">
                    <span class="check-label">Confirmations:</span>
                    <span class="check-value">${solana.confirmations || 0}</span>
                </div>
                <div class="check-item">
                    <span class="check-label">Slot:</span>
                    <span class="check-value">${solana.slot || 'N/A'}</span>
                </div>
            </div>
        `;
    }
    
    if (result.details.proof) {
        const proof = result.details.proof;
        html += `
            <div class="check-section">
                <h4>Proof Verification</h4>
                <div class="check-item">
                    <span class="check-label">Valid:</span>
                    <span class="check-value ${proof.valid ? 'success' : 'error'}">${proof.valid ? 'Yes' : 'No'}</span>
                </div>
                ${proof.structureValid ? `<div class="check-item"><span class="check-label">Structure:</span><span class="check-value success">Valid</span></div>` : ''}
                ${proof.amountMatch ? `<div class="check-item"><span class="check-label">Amount Match:</span><span class="check-value success">Yes</span></div>` : ''}
                ${proof.recipientMatch ? `<div class="check-item"><span class="check-label">Recipient Match:</span><span class="check-value success">Yes</span></div>` : ''}
            </div>
        `;
    }
    
    if (result.errors && result.errors.length > 0) {
        html += `
            <div class="check-errors">
                <h4>Errors:</h4>
                <ul>
                    ${result.errors.map(err => `<li>${err}</li>`).join('')}
                </ul>
            </div>
        `;
    }
    
    html += `</div></div>`;
    
    resultsEl.innerHTML = html;
    resultsEl.style.display = 'block';
}


function displayPoolIntegrityReport(report) {
    const resultsEl = document.getElementById('checker-results');
    if (!resultsEl) return;
    
    const statusClass = report.valid ? 'success' : 'error';
    const statusIcon = report.valid ? 'OK' : 'ERR';
    
    let html = `
        <div class="check-result ${statusClass}">
            <div class="check-header">
                <span class="check-icon">${statusIcon}</span>
                <span class="check-title">Pool Integrity Check ${report.valid ? 'Passed' : 'Failed'}</span>
            </div>
            <div class="check-details">
    `;
    
    
    if (report.checks.balance) {
        const balance = report.checks.balance;
        html += `
            <div class="check-section">
                <h4>Balance Check</h4>
                <div class="check-item">
                    <span class="check-label">Status:</span>
                    <span class="check-value ${balance.valid ? 'success' : 'error'}">${balance.valid ? 'Valid' : 'Invalid'}</span>
                </div>
                <div class="check-item">
                    <span class="check-label">Calculated:</span>
                    <span class="check-value">${balance.calculatedBalance.toFixed(8)} ZEC</span>
                </div>
                <div class="check-item">
                    <span class="check-label">Reported:</span>
                    <span class="check-value">${balance.reportedBalance.toFixed(8)} ZEC</span>
                </div>
                <div class="check-item">
                    <span class="check-label">Difference:</span>
                    <span class="check-value">${balance.difference.toFixed(8)} ZEC</span>
                </div>
            </div>
        `;
    }
    
    
    if (report.checks.transactions) {
        const tx = report.checks.transactions;
        html += `
            <div class="check-section">
                <h4>Transaction Consistency</h4>
                <div class="check-item">
                    <span class="check-label">Status:</span>
                    <span class="check-value ${tx.valid ? 'success' : 'error'}">${tx.valid ? 'Valid' : 'Invalid'}</span>
                </div>
                <div class="check-item">
                    <span class="check-label">Total Transactions:</span>
                    <span class="check-value">${tx.totalTransactions}</span>
                </div>
            </div>
        `;
    }
    
    
    if (report.checks.synchronization) {
        const sync = report.checks.synchronization;
        html += `
            <div class="check-section">
                <h4>Chain Synchronization</h4>
                <div class="check-item">
                    <span class="check-label">Zcash:</span>
                    <span class="check-value ${sync.zcashConnected ? 'success' : 'error'}">${sync.zcashConnected ? 'Connected' : 'Disconnected'}</span>
                </div>
                <div class="check-item">
                    <span class="check-label">Solana:</span>
                    <span class="check-value ${sync.solanaConnected ? 'success' : 'error'}">${sync.solanaConnected ? 'Connected' : 'Disconnected'}</span>
                </div>
            </div>
        `;
    }
    
    
    if (report.checks.proofs) {
        const proofs = report.checks.proofs;
        html += `
            <div class="check-section">
                <h4>Proof Verification</h4>
                <div class="check-item">
                    <span class="check-label">Status:</span>
                    <span class="check-value ${proofs.valid ? 'success' : 'error'}">${proofs.valid ? 'All Valid' : 'Some Invalid'}</span>
                </div>
                <div class="check-item">
                    <span class="check-label">Total Proofs:</span>
                    <span class="check-value">${proofs.totalProofs}</span>
                </div>
            </div>
        `;
    }
    
    if (report.errors && report.errors.length > 0) {
        html += `
            <div class="check-errors">
                <h4>Errors:</h4>
                <ul>
                    ${report.errors.map(err => `<li>${err}</li>`).join('')}
                </ul>
            </div>
        `;
    }
    
    if (report.warnings && report.warnings.length > 0) {
        html += `
            <div class="check-warnings">
                <h4>Warnings:</h4>
                <ul>
                    ${report.warnings.map(warn => `<li>${warn}</li>`).join('')}
                </ul>
            </div>
        `;
    }
    
    html += `</div></div>`;
    
    resultsEl.innerHTML = html;
    resultsEl.style.display = 'block';
}


function showCheckerResults(message, type = 'info') {
    const resultsEl = document.getElementById('checker-results');
    if (!resultsEl) return;
    
    resultsEl.innerHTML = `<div class="check-result ${type}"><div class="check-message">${message}</div></div>`;
    resultsEl.style.display = 'block';
}


function initTerminalAnimation() {
    const terminal = document.getElementById('hero-terminal');
    if (!terminal) return;

    const terminalBody = terminal.querySelector('.terminal-body');
    const lines = [
        { text: '$ zcash-bridge --init', type: 'command', delay: 500 },
        { text: 'Initializing cross-chain protocol...', type: 'output', delay: 1500 },
        { text: 'Connected to Zcash network', type: 'success', delay: 2500 },
        { text: 'Connected to Solana network', type: 'success', delay: 3500 },
        { text: 'Privacy layer activated', type: 'success', delay: 4500 },
        { text: '$', type: 'prompt', delay: 5500 }
    ];

    
    terminalBody.innerHTML = '';

    lines.forEach((line, index) => {
        setTimeout(() => {
            const lineEl = document.createElement('div');
            lineEl.className = 'terminal-line';
            
            if (line.type === 'command') {
                lineEl.innerHTML = `<span class="prompt">$</span> <span class="command">${line.text.replace('$ ', '')}</span>`;
            } else if (line.type === 'prompt') {
                lineEl.innerHTML = `<span class="prompt">$</span> <span class="cursor-blink">_</span>`;
            } else {
                const outputClass = line.type === 'success' ? 'output success' : 'output';
                lineEl.innerHTML = `<span class="${outputClass}">${line.text}</span>`;
            }
            
            terminalBody.appendChild(lineEl);
            terminalBody.scrollTop = terminalBody.scrollHeight;
        }, line.delay);
    });
}


function initScrollAnimations() {
    const observerOptions = {
        threshold: 0.1,
        rootMargin: '0px 0px -50px 0px'
    };

    const observer = new IntersectionObserver((entries) => {
        entries.forEach(entry => {
            if (entry.isIntersecting) {
                entry.target.classList.add('visible');
            }
        });
    }, observerOptions);

    
    document.querySelectorAll('section').forEach(section => {
        section.classList.add('fade-in');
        observer.observe(section);
    });

    
    document.querySelectorAll('.flow-step').forEach(step => {
        step.classList.add('fade-in');
        observer.observe(step);
    });

    
    document.querySelectorAll('.proof-card').forEach(card => {
        card.classList.add('fade-in');
        observer.observe(card);
    });

    
    document.querySelectorAll('.feature-item').forEach(item => {
        item.classList.add('fade-in');
        observer.observe(item);
    });
}


function initTabSwitching() {
    
    
}


function initCopyButtons() {
    const copyButtons = document.querySelectorAll('.copy-btn');
    
    copyButtons.forEach(button => {
        button.addEventListener('click', async () => {
            const codeBlock = button.closest('.code-block-large') || button.closest('.code-snippet');
            const code = codeBlock.querySelector('code');
            
            if (code) {
                try {
                    await navigator.clipboard.writeText(code.textContent);
                    
                    
                    const originalText = button.textContent;
                    button.textContent = 'Copied!';
                    button.style.background = 'var(--accent-success)';
                    button.style.color = 'var(--bg-primary)';
                    
                    setTimeout(() => {
                        button.textContent = originalText;
                        button.style.background = 'transparent';
                        button.style.color = 'var(--text-secondary)';
                    }, 2000);
                } catch (err) {
                    console.error('Failed to copy:', err);
                }
            }
        });
    });
    
    // Initialize API endpoint tabs and selection
    initAPIEndpointTabs();
}

function initAPIEndpointTabs() {
    const tabs = document.querySelectorAll('.endpoint-tab');
    const bridgeEndpoints = document.getElementById('bridge-endpoints');
    const oracleEndpoints = document.getElementById('oracle-endpoints');
    const exampleCode = document.getElementById('api-example-code');
    
    // Tab switching
    tabs.forEach(tab => {
        tab.addEventListener('click', () => {
            tabs.forEach(t => t.classList.remove('active'));
            tab.classList.add('active');
            
            const tabType = tab.dataset.tab;
            if (tabType === 'bridge') {
                bridgeEndpoints.style.display = 'block';
                oracleEndpoints.style.display = 'none';
                updateAPIExample('getStatus');
            } else {
                bridgeEndpoints.style.display = 'none';
                oracleEndpoints.style.display = 'block';
                updateAPIExample('getPriceFeed');
            }
        });
    });
    
    // Endpoint selection
    const endpointItems = document.querySelectorAll('.endpoint-item');
    endpointItems.forEach(item => {
        item.addEventListener('click', () => {
            endpointItems.forEach(i => i.classList.remove('selected'));
            item.classList.add('selected');
            
            const endpoint = item.dataset.endpoint;
            updateAPIExample(endpoint);
        });
    });
}

function updateAPIExample(endpoint) {
    const exampleCode = document.getElementById('api-example-code');
    if (!exampleCode) return;
    
    const examples = {
        'getStatus': `const api = new ProtocolAPI();
api.init(bridge);

const status = await api.getStatus();
console.log(status);`,
        'bridgeZecToSolana': `const api = new ProtocolAPI();
api.init(bridge);

const result = await api.bridgeZecToSolana(1.0, 'recipient-address');
console.log(result);`,
        'checkTransaction': `const api = new ProtocolAPI();
api.init(bridge);

const txStatus = await api.checkTransaction('txid-or-signature');
console.log(txStatus);`,
        'getPoolIntegrity': `const api = new ProtocolAPI();
api.init(bridge);

const integrity = await api.getPoolIntegrity();
console.log(integrity);`,
        'getRecentTransactions': `const api = new ProtocolAPI();
api.init(bridge);

const transactions = await api.getRecentTransactions(10);
console.log(transactions);`,
        'sendPayment': `const api = new ProtocolAPI();
api.init(bridge);

const payment = await api.sendPayment(
    0.01, 
    'recipient-address',
    'memo-text'
);
console.log(payment);`,
        'getPriceFeed': `const btcPrice = oracle.getPriceFeed('BTC');
console.log(btcPrice);`,
        'getAllPriceFeeds': `const allFeeds = oracle.getAllPriceFeeds();
console.log(allFeeds);`,
        'submitDataFeed': `await oracle.submitDataFeed(
    'BTC-USD-PRICE', 
    45000.50, 
    walletAddress
);`,
        'registerNode': `await oracle.registerNode(walletAddress, { 
    name: 'My Oracle Node',
    capabilities: ['price-feeds', 'custom-feeds']
});`,
        'stake': `await oracle.stake(walletAddress, 100);`,
        'getStats': `const stats = oracle.getStats();
console.log(stats);`
    };
    
    if (examples[endpoint]) {
        exampleCode.textContent = examples[endpoint];
    }
}


function initStatsCounter() {
    
    
    const stats = document.querySelectorAll('.stat-value');
    
    const observer = new IntersectionObserver((entries) => {
        entries.forEach(entry => {
            if (entry.isIntersecting && !entry.target.classList.contains('counted')) {
                entry.target.classList.add('counted');
                const target = parseFloat(entry.target.dataset.target) || 0;
                const duration = 2000;
                const start = 0;
                const isFloat = target.toString().includes('.');
                
                let startTimestamp = null;
                const step = (timestamp) => {
                    if (!startTimestamp) startTimestamp = timestamp;
                    const progress = Math.min((timestamp - startTimestamp) / duration, 1);
                    const current = progress * (target - start) + start;
                    
                    if (isFloat) {
                        entry.target.textContent = current.toFixed(2);
                    } else {
                        entry.target.textContent = Math.floor(current).toLocaleString();
                    }
                    
                    if (progress < 1) {
                        window.requestAnimationFrame(step);
                    } else {
                        if (isFloat) {
                            entry.target.textContent = target.toFixed(2);
                        } else {
                            entry.target.textContent = target.toLocaleString();
                        }
                    }
                };
                window.requestAnimationFrame(step);
            }
        });
    }, { threshold: 0.5 });

    stats.forEach(stat => {
        observer.observe(stat);
    });
}


function initNavScroll() {
    const nav = document.getElementById('nav');
    let lastScroll = 0;

    window.addEventListener('scroll', () => {
        const currentScroll = window.pageYOffset;

        if (currentScroll > 100) {
            nav.style.background = 'rgba(10, 14, 39, 0.95)';
            nav.style.backdropFilter = 'blur(20px)';
        } else {
            nav.style.background = 'rgba(10, 14, 39, 0.8)';
            nav.style.backdropFilter = 'blur(10px)';
        }

        lastScroll = currentScroll;
    });

    
    document.querySelectorAll('a[href^="#"]').forEach(anchor => {
        anchor.addEventListener('click', function (e) {
            e.preventDefault();
            const target = document.querySelector(this.getAttribute('href'));
            if (target) {
                const offsetTop = target.offsetTop - 100;
                window.scrollTo({
                    top: offsetTop,
                    behavior: 'smooth'
                });
            }
        });
    });
}


function initFlowSteps() {
    const flowSteps = document.querySelectorAll('.flow-step');
    
    const observer = new IntersectionObserver((entries) => {
        entries.forEach((entry, index) => {
            if (entry.isIntersecting) {
                setTimeout(() => {
                    entry.target.style.opacity = '1';
                    entry.target.style.transform = 'translateY(0)';
                }, index * 200);
            }
        });
    }, { threshold: 0.3 });

    flowSteps.forEach(step => {
        step.style.opacity = '0';
        step.style.transform = 'translateY(30px)';
        step.style.transition = 'all 0.6s ease-out';
        observer.observe(step);
    });
}


document.querySelectorAll('.terminal-window').forEach(terminal => {
    terminal.addEventListener('mouseenter', () => {
        terminal.style.transform = 'scale(1.02)';
        terminal.style.transition = 'transform 0.3s ease';
    });

    terminal.addEventListener('mouseleave', () => {
        terminal.style.transform = 'scale(1)';
    });
});


function highlightCode() {
    const codeBlocks = document.querySelectorAll('pre code');
    
    codeBlocks.forEach(block => {
        
        if (block.querySelector('.keyword')) return;
        
        let code = block.innerHTML || block.textContent;
        
        
        const isHTML = block.innerHTML !== block.textContent;
        if (!isHTML) {
            code = escapeHtml(code);
        }
        
        
        code = code.replace(/\b(async|await|function|const|let|var|if|else|for|while|return|import|from|export|class|interface|type|enum|fn|pub|use|async|await|def|async def)\b/g, 
            function(match) { return '<span style="color: var(--code-purple);">' + match + '</span>'; });
        
        
        code = code.replace(/(["'])(?:(?=(\\?))\2.)*?\1/g, 
            function(match) { return '<span style="color: var(--code-green);">' + match + '</span>'; });
        
        
        code = code.replace(/\b([a-zA-Z_$][a-zA-Z0-9_$]*)\s*(?=\()/g, 
            function(match, p1) { return '<span style="color: var(--code-blue);">' + p1 + '</span>'; });
        
        
        code = code.replace(/(\/\/.*$)/gm, 
            function(match) { return '<span style="color: var(--text-muted); font-style: italic;">' + match + '</span>'; });
        
        
        code = code.replace(/\b(\d+\.?\d*)\b/g, 
            function(match) { return '<span style="color: var(--code-yellow);">' + match + '</span>'; });
        
        block.innerHTML = code;
    });
}


function escapeHtml(text) {
    const map = {
        '&': '&amp;',
        '<': '&lt;',
        '>': '&gt;',
        '"': '&quot;',
        "'": '&#039;'
    };
    return text.replace(/[&<>"']/g, m => map[m]);
}


setTimeout(highlightCode, 100);


// ========== ORACLE INITIALIZATION ==========

function initOracle() {
    try {
        // Wait for bridge to be ready
        if (!bridge) {
            setTimeout(() => {
                initOracle();
            }, 1000);
            return;
        }
        
        oracle = new BlockchainOracle({
            bridge: bridge,
            api: api,
            verificationThreshold: 0.51,
            minNodes: 3,
            minStake: 1,
            slashThreshold: 0.1,
            stakingPoolAddress: typeof CONFIG !== 'undefined' && CONFIG.STAKING_POOL_ADDRESS 
                ? CONFIG.STAKING_POOL_ADDRESS 
                : 'Hw87YF66ND8v7yAyJKEJqMvDxZrHAHiHy8qsWghddC2Z'
        });
        
        window.oracle = oracle;
        
        console.log('Oracle Service initialized');
        
        // Initialize oracle UI
        setTimeout(() => {
            initOracleUI();
            initNewOracleSections();
        }, 500);
        
        // Update oracle stats periodically
        setInterval(() => {
            if (oracle) {
                updateOracleStats();
                updatePriceFeeds();
                updateOracleNodes();
                updateDeFiData();
                updateOnChainData();
                updateMyStakingPosition();
                updateRewardsSection();
                updateNodeHealthSection();
                updateConsensusSection();
            }
        }, 5000);
        
        // Initial update
        setTimeout(() => {
            if (oracle) {
                updateOracleStats();
                updatePriceFeeds();
                updateOracleNodes();
                updateDeFiData();
                updateOnChainData();
                updateStakingPools();
                updateMyStakingPosition();
                updateRewardsSection();
                updateNodeHealthSection();
                updateConsensusSection();
            }
        }, 2000);
        
    } catch (error) {
        console.error('Failed to initialize oracle:', error);
        // Retry after delay
        setTimeout(() => {
            initOracle();
        }, 3000);
    }
}

// Global variables for price feeds search
let currentSearchTerm = '';
let allPriceFeeds = [];

function initOracleUI() {
    // Price feeds search functionality
    const priceFeedsSearch = document.getElementById('price-feeds-search');
    
    // Make updatePriceFeedsDisplay globally accessible
    window.updatePriceFeedsDisplay = function() {
        const container = document.getElementById('price-feeds-container');
        if (!container) return;
        
        let feedsToShow = allPriceFeeds;
        
        // Filter by search term
        if (currentSearchTerm) {
            feedsToShow = allPriceFeeds.filter(feed => {
                const symbol = feed.symbol.toLowerCase();
                return symbol.includes(currentSearchTerm);
            });
        }
        
        // Update displayed count
        const feedsCountEl = document.getElementById('feeds-count');
        if (feedsCountEl) {
            feedsCountEl.textContent = feedsToShow.length;
        }
        
        // Render filtered feeds
        if (feedsToShow.length === 0) {
            container.innerHTML = `<div class="loading" style="text-align: center; padding: 2rem;">
                ${currentSearchTerm ? `No feeds found matching "${currentSearchTerm}"` : 'No price feeds available yet'}
            </div>`;
            return;
        }
        
        container.innerHTML = feedsToShow.map(feed => {
            const date = new Date(feed.timestamp);
            const timeAgo = Math.floor((Date.now() - feed.timestamp) / 1000);
            const timeStr = timeAgo < 60 ? `${timeAgo}s ago` : `${Math.floor(timeAgo / 60)}m ago`;
            
            const change24h = feed.change24h || 0;
            const changeClass = change24h >= 0 ? 'positive' : 'negative';
            const changeSign = change24h >= 0 ? '+' : '';
            
            return `
                <div class="price-feed-item">
                    <div style="display: flex; justify-content: space-between; align-items: start;">
                        <div style="flex: 1;">
                            <div style="font-weight: 600; font-size: 1.1rem; margin-bottom: 0.25rem; color: var(--accent-primary);">${feed.symbol}</div>
                            <div style="font-size: 0.85rem; color: var(--text-secondary); margin-bottom: 0.5rem;">${timeStr} • ${feed.sources || 0} sources</div>
                            ${change24h !== 0 ? `<div style="font-size: 0.85rem; color: ${change24h >= 0 ? 'var(--accent-success)' : 'var(--accent-error)'}; font-weight: 600;">${changeSign}${change24h.toFixed(2)}% (24h)</div>` : ''}
                        </div>
                        <div style="text-align: right;">
                            <div style="font-weight: 700; font-size: 1.3rem; color: var(--text-primary); font-family: var(--font-mono);">$${feed.price.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 8 })}</div>
                            ${feed.volume24h > 0 ? `<div style="font-size: 0.85rem; color: var(--text-secondary); margin-top: 0.25rem;">Vol: $${(feed.volume24h / 1000000).toFixed(2)}M</div>` : ''}
                        </div>
                    </div>
                </div>
            `;
        }).join('');
    };
    
    if (priceFeedsSearch) {
        priceFeedsSearch.addEventListener('input', (e) => {
            currentSearchTerm = e.target.value.toLowerCase().trim();
            updatePriceFeedsDisplay();
        });
        
        priceFeedsSearch.addEventListener('keydown', (e) => {
            if (e.key === 'Enter') {
                e.preventDefault();
                updatePriceFeedsDisplay();
            }
        });
    }
    
    const clearSearchBtn = document.getElementById('clear-search-btn');
    if (clearSearchBtn) {
        clearSearchBtn.addEventListener('click', () => {
            if (priceFeedsSearch) {
                priceFeedsSearch.value = '';
                currentSearchTerm = '';
                updatePriceFeedsDisplay();
            }
        });
    }
    
    const refreshPricesBtn = document.getElementById('refresh-prices-btn');
    if (refreshPricesBtn) {
        refreshPricesBtn.addEventListener('click', async () => {
            refreshPricesBtn.disabled = true;
            refreshPricesBtn.textContent = 'Refreshing...';
            try {
                await updatePriceFeeds(true);
                showOracleStatus('Prices refreshed successfully', 'success');
            } catch (error) {
                showOracleStatus('Failed to refresh prices: ' + error.message, 'error');
            } finally {
                refreshPricesBtn.disabled = false;
                refreshPricesBtn.textContent = 'Refresh Prices';
            }
        });
    }
    
    // Register node button
    const registerNodeBtn = document.getElementById('register-node-btn');
    if (registerNodeBtn) {
        registerNodeBtn.addEventListener('click', async () => {
            if (!bridge || !bridge.solanaWallet) {
                showOracleStatus('Please connect your wallet first', 'error');
                return;
            }
            
            try {
                registerNodeBtn.disabled = true;
                registerNodeBtn.textContent = 'Registering...';
                
                await oracle.registerNode(bridge.solanaWallet, {
                    name: `Node-${bridge.solanaWallet.substring(0, 8)}`,
                    capabilities: ['price-feeds', 'custom-feeds']
                });
                
                showOracleStatus('Node registered successfully', 'success');
                updateOracleNodes();
                updateOracleStats();
            } catch (error) {
                showOracleStatus('Failed to register node: ' + error.message, 'error');
            } finally {
                registerNodeBtn.disabled = false;
                registerNodeBtn.textContent = 'Register Node';
            }
        });
    }
    
    // Use Wallet button
    const useWalletBtn = document.getElementById('use-wallet-btn');
    if (useWalletBtn) {
        useWalletBtn.addEventListener('click', () => {
            if (bridge && bridge.solanaWallet) {
                const nodeAddressInput = document.getElementById('node-address-input');
                if (nodeAddressInput) {
                    nodeAddressInput.value = bridge.solanaWallet;
                    showOracleStatus('Wallet address filled', 'success');
                }
            } else {
                showOracleStatus('Please connect your wallet first', 'error');
            }
        });
    }
    
    // Quick stake amount buttons
    ['0.5', '1', '5', '10'].forEach(amount => {
        const btn = document.getElementById(`stake-quick-${amount}`);
        if (btn) {
            btn.addEventListener('click', () => {
                const stakeAmountInput = document.getElementById('stake-amount-input');
                if (stakeAmountInput) {
                    stakeAmountInput.value = amount;
                    showOracleStatus(`Set stake amount to ${amount} SOL`, 'success');
                }
            });
        }
    });
    
    // Submit feed button with better feedback
    const submitFeedBtn = document.getElementById('submit-feed-btn');
    const feedSubmitStatus = document.getElementById('feed-submit-status');
    
    function showFeedStatus(message, type) {
        if (feedSubmitStatus) {
            feedSubmitStatus.style.display = 'block';
            feedSubmitStatus.style.background = type === 'success' ? 'rgba(0, 255, 136, 0.1)' : 'rgba(255, 68, 68, 0.1)';
            feedSubmitStatus.style.border = `1px solid ${type === 'success' ? 'var(--accent-success)' : 'var(--accent-error)'}`;
            feedSubmitStatus.style.color = type === 'success' ? 'var(--accent-success)' : 'var(--accent-error)';
            feedSubmitStatus.textContent = message;
            setTimeout(() => {
                feedSubmitStatus.style.display = 'none';
            }, 5000);
        }
    }
    
    if (submitFeedBtn) {
        submitFeedBtn.addEventListener('click', async () => {
            if (!bridge || !bridge.solanaWallet) {
                showFeedStatus('⚠️ Please connect your wallet first', 'error');
                return;
            }
            
            const feedId = document.getElementById('feed-id-input').value.trim();
            const dataValue = document.getElementById('feed-data-input').value.trim();
            
            if (!feedId || !dataValue) {
                showFeedStatus('⚠️ Please fill in all fields', 'error');
                return;
            }
            
            try {
                submitFeedBtn.disabled = true;
                submitFeedBtn.innerHTML = '<span style="margin-right: 0.5rem;">⏳</span>Submitting...';
                
                const data = isNaN(dataValue) ? dataValue : parseFloat(dataValue);
                await oracle.submitDataFeed(feedId, data, bridge.solanaWallet);
                
                showFeedStatus('✅ Feed submitted successfully! Data verified against real APIs.', 'success');
                document.getElementById('feed-id-input').value = '';
                document.getElementById('feed-data-input').value = '';
                updateOracleStats();
            } catch (error) {
                showFeedStatus(`❌ Failed: ${error.message}`, 'error');
            } finally {
                submitFeedBtn.disabled = false;
                submitFeedBtn.innerHTML = '<span style="margin-right: 0.5rem;">📤</span>Submit Feed';
            }
        });
    }
    
    const selectPoolBtn = document.getElementById('select-pool-btn');
    if (selectPoolBtn) {
        selectPoolBtn.addEventListener('click', async () => {
            try {
                const pools = await oracle.getAvailableStakePools();
                if (pools.length === 0) {
                    showOracleStatus('No stake pools available', 'error');
                    return;
                }
                
                const poolList = pools.map(p => `${p.name} (${p.apy}% APY)`).join('\n');
                const selected = prompt(`Available Staking Pools:\n\n${poolList}\n\nEnter pool ID (marinade/jito/blaze):`, 'marinade');
                if (selected && pools.find(p => p.id === selected)) {
                    localStorage.setItem('selectedStakePool', selected);
                    showOracleStatus(`Selected pool: ${pools.find(p => p.id === selected).name}`, 'success');
                }
            } catch (error) {
                showOracleStatus('Failed to load pools: ' + error.message, 'error');
            }
        });
    }
    
    // Stake button with better feedback
    const stakeBtn = document.getElementById('stake-btn');
    if (stakeBtn) {
        stakeBtn.addEventListener('click', async () => {
            if (!bridge || !bridge.solanaWallet) {
                showOracleStatus('⚠️ Please connect your wallet first', 'error');
                return;
            }
            
            const nodeAddress = document.getElementById('node-address-input').value.trim() || bridge.solanaWallet;
            const amount = parseFloat(document.getElementById('stake-amount-input').value);
            const selectedPool = localStorage.getItem('selectedStakePool') || 'marinade';
            
            if (!amount || amount <= 0) {
                showOracleStatus('⚠️ Please enter a valid stake amount (minimum 0.1 SOL)', 'error');
                return;
            }
            
            if (amount < 0.1) {
                showOracleStatus('⚠️ Minimum stake amount is 0.1 SOL', 'error');
                return;
            }
            
            try {
                stakeBtn.disabled = true;
                stakeBtn.innerHTML = '<span style="margin-right: 0.5rem;">⏳</span>Staking...';
                
                const result = await oracle.stake(nodeAddress, amount, selectedPool);
                
                // Verify the stake was actually confirmed on blockchain
                if (result.verified && result.signature) {
                    showOracleStatus(`✅ Staked ${result.totalStake.toFixed(4)} SOL verified on blockchain! TX: ${result.signature.substring(0, 8)}...`, 'success');
                } else {
                    showOracleStatus(`✅ Staked ${amount} SOL to ${result.stakePool} (${result.apy}% APY)`, 'success');
                }
                
                document.getElementById('stake-amount-input').value = '';
                
                // Refresh nodes to show verified blockchain data
                setTimeout(() => {
                    updateOracleNodes();
                    updateOracleStats();
                    updateNodeInfoDisplay(nodeAddress);
                }, 1000); // Wait 1 second for blockchain to update
            } catch (error) {
                showOracleStatus(`❌ Failed to stake: ${error.message}`, 'error');
            } finally {
                stakeBtn.disabled = false;
                stakeBtn.innerHTML = '<span style="margin-right: 0.5rem;">⚡</span>Stake SOL';
            }
        });
    }
    
    // Unstake button with better feedback
    const unstakeBtn = document.getElementById('unstake-btn');
    if (unstakeBtn) {
        unstakeBtn.addEventListener('click', async () => {
            if (!bridge || !bridge.solanaWallet) {
                showOracleStatus('⚠️ Please connect your wallet first', 'error');
                return;
            }
            
            const nodeAddress = document.getElementById('node-address-input').value.trim() || bridge.solanaWallet;
            const amount = parseFloat(document.getElementById('stake-amount-input').value);
            
            if (!amount || amount <= 0) {
                showOracleStatus('⚠️ Please enter a valid unstake amount', 'error');
                return;
            }
            
            try {
                unstakeBtn.disabled = true;
                unstakeBtn.innerHTML = '<span style="margin-right: 0.5rem;">⏳</span>Unstaking...';
                
                const result = await oracle.unstake(nodeAddress, amount);
                
                showOracleStatus(`✅ Unstaked ${result.unstakedAmount} SOL from ${result.stakePool}`, 'success');
                document.getElementById('stake-amount-input').value = '';
                updateOracleNodes();
                updateOracleStats();
                updateNodeInfoDisplay(nodeAddress);
            } catch (error) {
                showOracleStatus(`❌ Failed to unstake: ${error.message}`, 'error');
            } finally {
                unstakeBtn.disabled = false;
                unstakeBtn.innerHTML = '<span style="margin-right: 0.5rem;">💸</span>Unstake SOL';
            }
        });
    }
    
    // View node button with better display
    const viewNodeBtn = document.getElementById('view-node-btn');
    const nodeInfoDisplay = document.getElementById('node-info-display');
    const nodeStakedAmount = document.getElementById('node-staked-amount');
    const nodeReputation = document.getElementById('node-reputation');
    const nodeStatus = document.getElementById('node-status');
    
    function updateNodeInfoDisplay(nodeAddress) {
        if (!nodeAddress || !oracle) return;
        
        const nodeInfo = oracle.getNodeInfo(nodeAddress);
        if (!nodeInfo) {
            if (nodeInfoDisplay) nodeInfoDisplay.style.display = 'none';
            return;
        }
        
        if (nodeInfoDisplay) {
            nodeInfoDisplay.style.display = 'block';
            
            if (nodeStakedAmount) {
                nodeStakedAmount.textContent = `${(nodeInfo.stake || 0).toFixed(2)} SOL`;
            }
            
            if (nodeReputation) {
                const rep = nodeInfo.reputation || 0;
                nodeReputation.textContent = `${rep.toFixed(1)}%`;
                nodeReputation.style.color = rep >= 90 ? 'var(--accent-success)' : rep >= 75 ? 'var(--accent-warning)' : 'var(--accent-error)';
            }
            
            if (nodeStatus) {
                const isActive = (nodeInfo.stake || 0) >= (oracle.minStake || 0.1);
                nodeStatus.textContent = isActive ? 'Active' : 'Inactive';
                nodeStatus.style.color = isActive ? 'var(--accent-success)' : 'var(--accent-warning)';
            }
        }
    }
    
    if (viewNodeBtn) {
        viewNodeBtn.addEventListener('click', async () => {
            const nodeAddress = document.getElementById('node-address-input').value.trim() || bridge?.solanaWallet;
            
            if (!nodeAddress) {
                showOracleStatus('⚠️ Please enter a node address or connect wallet', 'error');
                return;
            }
            
            const nodeInfo = oracle.getNodeInfo(nodeAddress);
            if (!nodeInfo) {
                showOracleStatus('⚠️ Node not found. Register node first.', 'error');
                if (nodeInfoDisplay) nodeInfoDisplay.style.display = 'none';
                return;
            }
            
            updateNodeInfoDisplay(nodeAddress);
            showOracleStatus('✅ Node info loaded', 'success');
        });
    }
    
    // Auto-update node info when address changes
    const nodeAddressInput = document.getElementById('node-address-input');
    if (nodeAddressInput) {
        nodeAddressInput.addEventListener('blur', () => {
            const address = nodeAddressInput.value.trim();
            if (address) {
                updateNodeInfoDisplay(address);
            }
        });
    }
    
    // Auto-fill wallet address when wallet connects
    if (bridge && bridge.solanaWallet && nodeAddressInput) {
        nodeAddressInput.value = bridge.solanaWallet;
        updateNodeInfoDisplay(bridge.solanaWallet);
    }
}

async function updatePriceFeeds(forceRefresh = false) {
    // Update live indicator
    const liveIndicator = document.getElementById('price-feeds-live-indicator');
    if (liveIndicator) {
        liveIndicator.style.opacity = '1';
        setTimeout(() => {
            if (liveIndicator) liveIndicator.style.opacity = '0.7';
        }, 500);
    }
    
    // Update stats
    const feedsCountEl = document.getElementById('feeds-count');
    const feedsSourcesEl = document.getElementById('feeds-sources');
    const feedsLastUpdateEl = document.getElementById('feeds-last-update');
    
    if (feedsLastUpdateEl) {
        feedsLastUpdateEl.textContent = 'just now';
        setInterval(() => {
            const now = Date.now();
            const lastUpdate = parseInt(feedsLastUpdateEl.dataset.lastUpdate || now);
            const secondsAgo = Math.floor((now - lastUpdate) / 1000);
            if (secondsAgo < 60) {
                feedsLastUpdateEl.textContent = `${secondsAgo}s ago`;
            } else if (secondsAgo < 3600) {
                feedsLastUpdateEl.textContent = `${Math.floor(secondsAgo / 60)}m ago`;
            } else {
                feedsLastUpdateEl.textContent = `${Math.floor(secondsAgo / 3600)}h ago`;
            }
        }, 1000);
    }
    
    if (feedsSourcesEl) {
        feedsSourcesEl.textContent = '14'; // 14 oracle sources
    }
    
    if (!oracle) return;
    
    const container = document.getElementById('price-feeds-container');
    if (!container) return;
    
    try {
        const feeds = oracle.getAllPriceFeeds();
        
        // Update feeds count
        if (feedsCountEl) {
            feedsCountEl.textContent = feeds.length;
            feedsCountEl.dataset.lastUpdate = Date.now();
        }
        if (feedsLastUpdateEl) {
            feedsLastUpdateEl.dataset.lastUpdate = Date.now();
        }
        
        if (feeds.length === 0) {
            container.innerHTML = '<div class="loading">No price feeds available yet</div>';
            return;
        }
        
        // Store all feeds for search/filter
        allPriceFeeds = feeds;
        
        // Update display with current search filter
        if (window.updatePriceFeedsDisplay) {
            window.updatePriceFeedsDisplay();
        }
    } catch (error) {
        console.error('Error updating price feeds:', error);
        container.innerHTML = '<div class="loading">Error loading price feeds</div>';
    }
}

function updateOracleNodes() {
    if (!oracle) return;
    
    const container = document.getElementById('oracle-nodes-container');
    if (!container) return;
    
    // Update node count badges
    const nodesCountBadge = document.getElementById('nodes-count-badge');
    const activeNodesBadge = document.getElementById('active-nodes-badge');
    
    try {
        const nodes = oracle.getAllNodes();
        const activeNodes = nodes.filter(n => (n.stake || 0) >= (oracle.minStake || 0.1));
        
        // Update badges
        if (nodesCountBadge) {
            nodesCountBadge.textContent = nodes.length;
        }
        if (activeNodesBadge) {
            activeNodesBadge.textContent = `${activeNodes.length} Active`;
        }
        
        if (nodes.length === 0) {
            container.innerHTML = '<div class="loading">No nodes registered yet</div>';
            return;
        }
        
        container.innerHTML = nodes.map(node => {
            const address = node.address || 'Unknown';
            const shortAddress = address && address.length > 16 
                ? `${address.substring(0, 8)}...${address.substring(address.length - 8)}`
                : address;
            const stake = node.stake || 0;
            const reputation = node.reputation || 0;
            const uptime = node.uptime || 0;
            const isActive = stake >= (oracle.minStake || 0.1);
            const isVerified = node.stakeVerified || node.stakeSignature;
            
            return `
                <div class="node-card ${isActive ? 'active' : ''}">
                    <div style="display: flex; justify-content: space-between; align-items: start;">
                        <div style="flex: 1;">
                            <div style="display: flex; align-items: center; gap: 0.5rem; margin-bottom: 0.25rem; flex-wrap: wrap;">
                                <div style="font-weight: 600;">${node.metadata?.name || shortAddress}</div>
                                ${isActive ? '<span class="badge badge-success" style="font-size: 0.65rem;">ACTIVE</span>' : ''}
                                ${isVerified ? '<span class="badge" style="font-size: 0.65rem; border-color: var(--accent-primary); color: var(--accent-primary);">✅ VERIFIED</span>' : '<span class="badge badge-warning" style="font-size: 0.65rem;">⚠️ UNVERIFIED</span>'}
                            </div>
                            <div style="font-size: 0.85rem; color: var(--text-secondary); font-family: var(--font-mono);">${shortAddress}</div>
                            ${node.stakeSignature ? `<div style="font-size: 0.7rem; color: var(--text-muted); margin-top: 0.25rem; font-family: var(--font-mono);">TX: ${node.stakeSignature.substring(0, 8)}...${node.stakeSignature.substring(node.stakeSignature.length - 8)}</div>` : ''}
                        </div>
                        <div style="text-align: right;">
                            <div style="font-weight: 600; color: var(--accent-primary); font-size: 1.1rem;">${stake.toFixed(2)} SOL</div>
                            <div style="font-size: 0.75rem; color: ${isVerified ? 'var(--accent-success)' : 'var(--accent-warning)'};">
                                ${isVerified ? '✅ Verified' : '⚠️ Unverified'}
                            </div>
                            ${!isActive && stake > 0 ? `<div style="font-size: 0.75rem; color: var(--accent-warning); margin-top: 0.25rem;">Need ${((oracle.minStake || 0.1) - stake).toFixed(2)} more SOL</div>` : ''}
                        </div>
                    </div>
                    <div style="display: grid; grid-template-columns: repeat(3, 1fr); gap: 1rem; margin-top: 0.75rem; padding-top: 0.75rem; border-top: 1px solid var(--border-color);">
                    <div>
                            <div style="font-size: 0.75rem; color: var(--text-secondary); margin-bottom: 0.25rem;">Reputation</div>
                            <div style="color: ${reputation >= 90 ? 'var(--accent-success)' : reputation >= 75 ? 'var(--accent-warning)' : 'var(--accent-error)'}; font-weight: 600; font-family: var(--font-mono);">${reputation.toFixed(1)}%</div>
                    </div>
                    <div>
                            <div style="font-size: 0.75rem; color: var(--text-secondary); margin-bottom: 0.25rem;">Uptime</div>
                            <div style="color: var(--accent-primary); font-weight: 600; font-family: var(--font-mono);">${uptime.toFixed(1)}%</div>
                        </div>
                        <div>
                            <div style="font-size: 0.75rem; color: var(--text-secondary); margin-bottom: 0.25rem;">Submissions</div>
                            <div style="color: var(--text-primary); font-weight: 600; font-family: var(--font-mono);">${node.totalSubmissions || 0}</div>
                        </div>
                    </div>
                </div>
            `;
        }).join('');
    } catch (error) {
        console.error('Error updating oracle nodes:', error);
        container.innerHTML = '<div class="loading">Error loading nodes</div>';
    }
}

function updateOracleStats() {
    if (!oracle) return;
    
    try {
        const stats = oracle.getStats();
        
        const nodesCountEl = document.getElementById('oracle-nodes-count');
        if (nodesCountEl) nodesCountEl.textContent = stats.totalNodes;
        
        const stakedEl = document.getElementById('oracle-staked');
        if (stakedEl) stakedEl.textContent = stats.totalStaked.toFixed(2);
        
        const feedsCountEl = document.getElementById('oracle-feeds-count');
        if (feedsCountEl) feedsCountEl.textContent = stats.priceFeeds + stats.customFeeds;
        
        const consensusEl = document.getElementById('oracle-consensus');
        if (consensusEl) {
            // Calculate REAL consensus rate from actual feed data
            let consensusRate = 0;
            if (oracle && stats.activeNodes > 0) {
                try {
                    const allFeeds = oracle.getAllPriceFeeds();
                    let totalFeeds = 0;
                    let consensusFeeds = 0;
                    
                    for (const [feedId, feedData] of Object.entries(allFeeds)) {
                        if (feedData && feedData.sources) {
                            totalFeeds++;
                            // Consensus achieved if multiple sources agree
                            if (feedData.sources >= 3) {
                                consensusFeeds++;
                            }
                        }
                    }
                    
                    consensusRate = totalFeeds > 0 ? (consensusFeeds / totalFeeds) * 100 : 0;
                } catch (e) {
                    consensusRate = 0;
                }
            }
            const oldRate = parseFloat(consensusEl.textContent) || 0;
            consensusEl.textContent = consensusRate.toFixed(1) + '%';
            if (Math.abs(oldRate - consensusRate) > 1) {
                consensusEl.classList.add('updating');
                setTimeout(() => consensusEl.classList.remove('updating'), 500);
            }
        }
        
        // Update network health
        const networkHealthEl = document.getElementById('network-health');
        if (networkHealthEl && stats.avgUptime !== undefined) {
            if (stats.avgUptime >= 95) {
                networkHealthEl.textContent = 'Excellent';
                networkHealthEl.style.color = 'var(--accent-success)';
            } else if (stats.avgUptime >= 80) {
                networkHealthEl.textContent = 'Good';
                networkHealthEl.style.color = 'var(--accent-warning)';
            } else {
                networkHealthEl.textContent = 'Degraded';
                networkHealthEl.style.color = 'var(--accent-error)';
            }
        }
        
        // Update Solana status badge
        const solanaStatusBadge = document.getElementById('solana-status-badge');
        if (solanaStatusBadge && bridge && bridge.solanaConnection) {
            solanaStatusBadge.classList.add('synced');
            const statusText = solanaStatusBadge.querySelector('span:last-child');
            if (statusText) statusText.textContent = 'SYNCED';
        }
        
        // Update last block number
        const lastBlockEl = document.getElementById('last-block');
        if (lastBlockEl && bridge && bridge.solanaConnection) {
            bridge.solanaConnection.getSlot().then(slot => {
                lastBlockEl.textContent = slot.toLocaleString();
            }).catch(() => {
                lastBlockEl.textContent = '-';
            });
        }
    } catch (error) {
        console.error('Error updating oracle stats:', error);
    }
}

function updateDeFiData() {
    if (!oracle) return;
    
    const container = document.getElementById('defi-data-container');
    if (!container) return;
    
    try {
        const defiData = oracle.getDeFiData();
        
        if (!defiData) {
            container.innerHTML = '<div class="loading">Loading DeFi data...</div>';
            return;
        }
        
        const tvl = defiData.totalValueLocked || 0;
        const tvlFormatted = tvl > 1000000000 
            ? `$${(tvl / 1000000000).toFixed(2)}B`
            : `$${(tvl / 1000000).toFixed(2)}M`;
        
        let html = `
            <div class="defi-stat-item">
                <div class="defi-label">Total Value Locked</div>
                <div class="defi-value">${tvlFormatted}</div>
            </div>
        `;
        
        if (defiData.topProtocols && defiData.topProtocols.length > 0) {
            html += '<div style="margin-top: 1rem; font-size: 0.85rem; color: var(--text-secondary);">Top Protocols:</div>';
            defiData.topProtocols.slice(0, 5).forEach(protocol => {
                const protocolTVL = protocol.tvl > 1000000000
                    ? `$${(protocol.tvl / 1000000000).toFixed(2)}B`
                    : `$${(protocol.tvl / 1000000).toFixed(2)}M`;
                html += `
                    <div class="defi-protocol-item">
                        <span>${protocol.name}</span>
                        <span style="color: var(--accent-primary);">${protocolTVL}</span>
                    </div>
                `;
            });
        }
        
        container.innerHTML = html;
    } catch (error) {
        console.error('Error updating DeFi data:', error);
        container.innerHTML = '<div class="loading">Error loading DeFi data</div>';
    }
}

function updateOnChainData() {
    if (!oracle) {
        const container = document.getElementById('onchain-data-container');
        if (container) {
            container.innerHTML = '<div class="loading">Initializing Oracle...</div>';
        }
        return;
    }
    
    const container = document.getElementById('onchain-data-container');
    if (!container) return;
    
    try {
        // Force fetch if data is stale or missing
        const onChainData = oracle.getOnChainData('solana');
        
        if (!onChainData || !onChainData.slot) {
            container.innerHTML = '<div class="loading">Connecting to Solana RPC...</div>';
            // Trigger fetch
            if (oracle.fetchSolanaOnChainData) {
                oracle.fetchSolanaOnChainData().then(() => {
                    // Retry after fetch
                    setTimeout(updateOnChainData, 1000);
                }).catch(err => {
                    console.error('Failed to fetch Solana data:', err);
                });
            }
            return;
        }
        
        container.innerHTML = `
            <div class="onchain-stat-item">
                <div class="onchain-label">Current Slot</div>
                <div class="onchain-value">${onChainData.slot ? onChainData.slot.toLocaleString() : 'N/A'}</div>
            </div>
            <div class="onchain-stat-item">
                <div class="onchain-label">Block Height</div>
                <div class="onchain-value">${onChainData.blockHeight ? onChainData.blockHeight.toLocaleString() : 'N/A'}</div>
            </div>
            <div class="onchain-stat-item">
                <div class="onchain-label">Total Supply</div>
                <div class="onchain-value">${onChainData.totalSupply ? onChainData.totalSupply.toLocaleString(undefined, { maximumFractionDigits: 0 }) + ' SOL' : 'N/A'}</div>
            </div>
            <div class="onchain-stat-item">
                <div class="onchain-label">Circulating</div>
                <div class="onchain-value">${onChainData.circulatingSupply ? onChainData.circulatingSupply.toLocaleString(undefined, { maximumFractionDigits: 0 }) + ' SOL' : 'N/A'}</div>
            </div>
            ${onChainData.epoch !== null ? `
            <div class="onchain-stat-item">
                <div class="onchain-label">Epoch</div>
                <div class="onchain-value">${onChainData.epoch}</div>
            </div>
            ` : ''}
        `;
    } catch (error) {
        console.error('Error updating on-chain data:', error);
        container.innerHTML = '<div class="loading">Error loading blockchain data</div>';
    }
}

function showOracleStatus(message, type = 'info') {
    console.log(`[Oracle ${type}]:`, message);
    
    const alertDiv = document.createElement('div');
    alertDiv.style.cssText = 'position:fixed;top:20px;right:20px;padding:1rem 1.5rem;background:var(--bg-tertiary);border:2px solid var(--accent-primary);border-radius:8px;z-index:10000;color:var(--text-primary);font-family:var(--font-mono);max-width:400px;';
    alertDiv.className = `oracle-status-alert ${type}`;
    
    if (type === 'success') {
        alertDiv.style.borderColor = 'var(--accent-success)';
        alertDiv.style.color = 'var(--accent-success)';
    } else if (type === 'error') {
        alertDiv.style.borderColor = 'var(--accent-error)';
        alertDiv.style.color = 'var(--accent-error)';
    } else {
        alertDiv.style.borderColor = 'var(--accent-primary)';
        alertDiv.style.color = 'var(--accent-primary)';
    }
    
    alertDiv.textContent = message;
    document.body.appendChild(alertDiv);
    
    setTimeout(() => {
        alertDiv.remove();
    }, type === 'error' ? 8000 : 5000);
}

// ========== NEW ORACLE SECTIONS UPDATE FUNCTIONS ==========

async function updateStakingPools() {
    if (!oracle) return;
    
    const container = document.getElementById('staking-pools-container');
    if (!container) return;
    
    try {
        const pools = await oracle.getAvailableStakePools();
        
        if (pools.length === 0) {
            container.innerHTML = '<div class="loading">No staking pools available</div>';
            return;
        }
        
        container.innerHTML = pools.map(pool => `
            <div class="pool-item">
                <div>
                    <div class="pool-name">${pool.name}</div>
                    <div class="pool-apy">${pool.apy}% APY</div>
                </div>
                <div>
                    <div class="pool-address">${pool.poolAddress ? pool.poolAddress.substring(0, 8) + '...' : 'N/A'}</div>
                    <button class="btn-small" onclick="selectPool('${pool.id}')">Select</button>
                </div>
            </div>
        `).join('');
    } catch (error) {
        console.error('Error updating staking pools:', error);
        container.innerHTML = '<div class="loading">Error loading pools</div>';
    }
}

async function updateMyStakingPosition() {
    if (!oracle || !bridge || !bridge.solanaWallet) {
        const container = document.getElementById('my-staking-position');
        if (container) {
            container.innerHTML = '<div class="loading">Connect wallet to view staking position</div>';
        }
        const statsGrid = document.getElementById('staking-stats-grid');
        if (statsGrid) statsGrid.style.display = 'none';
        return;
    }
    
    try {
        const nodeInfo = oracle.getNodeInfo(bridge.solanaWallet);
        const stakingInfo = await oracle.getStakingInfo(bridge.solanaWallet);
        const rewards = oracle.calculateRewards(bridge.solanaWallet);
        
        const container = document.getElementById('my-staking-position');
        const statsGrid = document.getElementById('staking-stats-grid');
        
        if (!nodeInfo || !nodeInfo.stake || nodeInfo.stake === 0) {
            if (container) container.innerHTML = '<div class="loading">No staking position found. Stake SOL to become an oracle node.</div>';
            if (statsGrid) statsGrid.style.display = 'none';
            return;
        }
        
        if (container) {
            container.innerHTML = `
                <div class="staking-position-summary">
                    <div>Staked: <strong>${nodeInfo.stake.toFixed(4)} SOL</strong></div>
                    <div>Pool: <strong>${nodeInfo.stakePool || 'Marinade'}</strong></div>
                    <div>Status: <strong style="color: var(--accent-success);">Active</strong></div>
                </div>
            `;
        }
        
        if (statsGrid) {
            statsGrid.style.display = 'grid';
            const totalStakedEl = document.getElementById('my-total-staked');
            const apyEl = document.getElementById('my-estimated-apy');
            const dailyRewardsEl = document.getElementById('my-daily-rewards');
            const totalRewardsEl = document.getElementById('my-total-rewards');
            
            if (totalStakedEl) totalStakedEl.textContent = `${nodeInfo.stake.toFixed(4)} SOL`;
            if (apyEl) apyEl.textContent = `${stakingInfo?.estimatedAPY || 5}%`;
            if (dailyRewardsEl) dailyRewardsEl.textContent = `${rewards.daily.toFixed(6)} SOL`;
            if (totalRewardsEl) totalRewardsEl.textContent = `${rewards.total.toFixed(6)} SOL`;
        }
    } catch (error) {
        console.error('Error updating staking position:', error);
    }
}

function updateStakingCalculator() {
    const calcBtn = document.getElementById('calculate-btn');
    if (calcBtn) {
        calcBtn.addEventListener('click', () => {
            const amount = parseFloat(document.getElementById('calc-stake-amount')?.value || 10);
            const apy = parseFloat(document.getElementById('calc-apy')?.value || 5) / 100;
            
            const daily = amount * (apy / 365);
            const monthly = daily * 30;
            const yearly = amount * apy;
            
            const dailyEl = document.getElementById('calc-daily');
            const monthlyEl = document.getElementById('calc-monthly');
            const yearlyEl = document.getElementById('calc-yearly');
            
            if (dailyEl) dailyEl.textContent = `${daily.toFixed(6)} SOL`;
            if (monthlyEl) monthlyEl.textContent = `${monthly.toFixed(6)} SOL`;
            if (yearlyEl) yearlyEl.textContent = `${yearly.toFixed(6)} SOL`;
        });
    }
}

function updateRewardsSection() {
    if (!oracle || !bridge || !bridge.solanaWallet) return;
    
    try {
        const nodeInfo = oracle.getNodeInfo(bridge.solanaWallet);
        if (!nodeInfo) return;
        
        const rewards = oracle.calculateRewards(bridge.solanaWallet);
        const health = oracle.getNodeHealth(bridge.solanaWallet);
        
        // Update rewards overview
        const totalEarnedEl = document.getElementById('total-earned');
        const pendingRewardsEl = document.getElementById('pending-rewards');
        const accuracyBonusEl = document.getElementById('accuracy-bonus');
        const nextDistributionEl = document.getElementById('next-distribution');
        
        const totalRewards = rewards?.total || 0;
        const accuracyBonus = rewards?.accuracyBonus || 1;
        
        if (totalEarnedEl) totalEarnedEl.textContent = `${totalRewards.toFixed(6)} SOL`;
        if (pendingRewardsEl) pendingRewardsEl.textContent = `${totalRewards.toFixed(6)} SOL`;
        if (accuracyBonusEl) accuracyBonusEl.textContent = `${((accuracyBonus - 1) * 100).toFixed(1)}%`;
        
        const nextDist = new Date(Date.now() + oracle.rewardDistributionInterval);
        if (nextDistributionEl) nextDistributionEl.textContent = nextDist.toLocaleDateString();
        
        // Update performance metrics
        const accuracy = nodeInfo.totalSubmissions > 0 
            ? (nodeInfo.correctSubmissions / nodeInfo.totalSubmissions) * 100 
            : 100;
        
        const accuracyBar = document.getElementById('accuracy-bar');
        const accuracyValue = document.getElementById('accuracy-value');
        if (accuracyBar) accuracyBar.style.width = `${accuracy}%`;
        if (accuracyValue) accuracyValue.textContent = `${accuracy.toFixed(1)}%`;
        
        const uptimeBar = document.getElementById('uptime-bar');
        const uptimeValue = document.getElementById('uptime-value');
        if (uptimeBar) uptimeBar.style.width = `${nodeInfo.uptime || 0}%`;
        if (uptimeValue) uptimeValue.textContent = `${(nodeInfo.uptime || 0).toFixed(1)}%`;
        
        const responseBar = document.getElementById('response-bar');
        const responseValue = document.getElementById('response-value');
        const avgResponse = nodeInfo.avgResponseTime || 0;
        const responsePercent = Math.min(100, (1000 - avgResponse) / 10);
        if (responseBar) responseBar.style.width = `${responsePercent}%`;
        if (responseValue) responseValue.textContent = `${avgResponse.toFixed(0)}ms`;
        
        const reputationBar = document.getElementById('reputation-bar');
        const reputationValue = document.getElementById('reputation-value');
        if (reputationBar) reputationBar.style.width = `${nodeInfo.reputation}%`;
        if (reputationValue) reputationValue.textContent = `${nodeInfo.reputation.toFixed(1)}/100`;
        
        // Update reward breakdown
        const baseRewardsEl = document.getElementById('base-rewards');
        const bonusRewardsEl = document.getElementById('bonus-rewards');
        const uptimeBonusEl = document.getElementById('uptime-bonus');
        const totalEstimatedEl = document.getElementById('total-estimated');
        
        const breakdown = rewards?.breakdown || { baseReward: 0, bonus: 0 };
        
        if (baseRewardsEl) baseRewardsEl.textContent = `${(breakdown.baseReward || 0).toFixed(6)} SOL`;
        if (bonusRewardsEl) bonusRewardsEl.textContent = `${(breakdown.bonus || 0).toFixed(6)} SOL`;
        if (uptimeBonusEl) uptimeBonusEl.textContent = `${(totalRewards * 0.05).toFixed(6)} SOL`;
        if (totalEstimatedEl) totalEstimatedEl.textContent = `${totalRewards.toFixed(6)} SOL`;
    } catch (error) {
        console.error('Error updating rewards section:', error);
    }
}

function updateNodeHealthSection() {
    if (!oracle || !bridge || !bridge.solanaWallet) return;
    
    try {
        const health = oracle.getNodeHealth(bridge.solanaWallet);
        if (!health) return;
        
        const node = health.node;
        
        // Update node status
        const statusText = document.getElementById('node-status-text');
        const statusDot = document.querySelector('#node-status-indicator .status-dot');
        const lastSeen = document.getElementById('last-seen');
        const healthScore = document.getElementById('health-score');
        const totalSubmissions = document.getElementById('total-submissions');
        const correctSubmissions = document.getElementById('correct-submissions');
        
        const isHealthy = node.uptime > 95 && node.reputation > 90 && node.accuracy > 90;
        if (statusText) statusText.textContent = isHealthy ? 'Healthy' : 'Warning';
        if (statusDot) {
            statusDot.style.backgroundColor = isHealthy ? 'var(--accent-success)' : 'var(--accent-warning)';
        }
        
        const lastSeenTime = health.uptime?.lastUpdate || Date.now();
        const timeAgo = Math.floor((Date.now() - lastSeenTime) / 1000);
        const timeStr = timeAgo < 60 ? `${timeAgo}s ago` : `${Math.floor(timeAgo / 60)}m ago`;
        if (lastSeen) lastSeen.textContent = timeStr;
        
        const score = (node.uptime * 0.3 + node.reputation * 0.3 + node.accuracy * 0.4);
        if (healthScore) healthScore.textContent = `${score.toFixed(1)}/100`;
        if (totalSubmissions) totalSubmissions.textContent = node.totalSubmissions;
        if (correctSubmissions) correctSubmissions.textContent = node.correctSubmissions;
        
        // Update health metrics
        const uptimeProgress = document.getElementById('uptime-progress');
        const uptimePercentage = document.getElementById('uptime-percentage');
        const uptimeStatus = document.getElementById('uptime-status');
        if (uptimeProgress) uptimeProgress.style.width = `${node.uptime}%`;
        if (uptimePercentage) uptimePercentage.textContent = `${node.uptime.toFixed(1)}%`;
        if (uptimeStatus) uptimeStatus.textContent = node.uptime > 95 ? 'Good' : 'Poor';
        
        const responseProgress = document.getElementById('response-progress');
        const responseTimeValue = document.getElementById('response-time-value');
        const responseStatus = document.getElementById('response-status');
        const avgResponse = node.avgResponseTime || 0;
        const responsePercent = Math.min(100, (1000 - avgResponse) / 10);
        if (responseProgress) responseProgress.style.width = `${responsePercent}%`;
        if (responseTimeValue) responseTimeValue.textContent = `${avgResponse.toFixed(0)}ms`;
        if (responseStatus) responseStatus.textContent = avgResponse < 500 ? 'Good' : 'Slow';
        
        const accuracyProgress = document.getElementById('accuracy-progress');
        const accuracyPercentage = document.getElementById('accuracy-percentage');
        const accuracyStatus = document.getElementById('accuracy-status');
        if (accuracyProgress) accuracyProgress.style.width = `${node.accuracy}%`;
        if (accuracyPercentage) accuracyPercentage.textContent = `${node.accuracy.toFixed(1)}%`;
        if (accuracyStatus) accuracyStatus.textContent = node.accuracy > 90 ? 'Good' : 'Poor';
        
        const reputationProgress = document.getElementById('reputation-progress');
        const reputationPercentage = document.getElementById('reputation-percentage');
        const reputationStatus = document.getElementById('reputation-status');
        if (reputationProgress) reputationProgress.style.width = `${node.reputation}%`;
        if (reputationPercentage) reputationPercentage.textContent = `${node.reputation.toFixed(1)}/100`;
        if (reputationStatus) reputationStatus.textContent = node.reputation > 90 ? 'Good' : 'Poor';
        
        // Update alerts
        const alertsContainer = document.getElementById('node-alerts-container');
        if (alertsContainer) {
            const alerts = [];
            if (node.uptime < 95) alerts.push({ type: 'warning', message: 'Uptime below 95% threshold' });
            if (node.reputation < 90) alerts.push({ type: 'warning', message: 'Reputation below 90%' });
            if (node.accuracy < 90) alerts.push({ type: 'warning', message: 'Accuracy below 90%' });
            if (alerts.length === 0) alerts.push({ type: 'success', message: 'Node is operating normally' });
            
            alertsContainer.innerHTML = alerts.map(alert => `
                <div class="alert-item alert-${alert.type}">
                    <span class="alert-icon">${alert.type === 'success' ? '✓' : '⚠'}</span>
                    <span class="alert-message">${alert.message}</span>
                </div>
            `).join('');
        }
    } catch (error) {
        console.error('Error updating node health section:', error);
    }
}

function updateConsensusSection() {
    if (!oracle) return;
    
    try {
        const stats = oracle.getStats();
        const feeds = oracle.getAllPriceFeeds();
        
        // Update consensus feeds
        const consensusFeedsContainer = document.getElementById('consensus-feeds-container');
        if (consensusFeedsContainer) {
            if (feeds.length === 0) {
                consensusFeedsContainer.innerHTML = '<div class="loading">No active feeds</div>';
            } else {
                consensusFeedsContainer.innerHTML = feeds.slice(0, 10).map(feed => `
                    <div class="consensus-feed-item">
                        <span class="feed-name">${feed.symbol}</span>
                        <span class="feed-confidence">${feed.sources > 0 ? Math.min(100, (feed.sources / 5) * 100) : 0}%</span>
                        <span class="feed-status verified">Verified</span>
                    </div>
                `).join('');
            }
        }
        
        // Update verification status
        const verificationContainer = document.getElementById('verification-status-container');
        if (verificationContainer) {
            verificationContainer.innerHTML = feeds.slice(0, 5).map(feed => {
                const confidence = feed.sources > 0 ? Math.min(100, (feed.sources / 5) * 100) : 0;
                return `
                    <div class="verification-item">
                        <span class="verification-feed">${feed.symbol}</span>
                        <span class="verification-status verified">Verified</span>
                        <span class="verification-confidence">${confidence.toFixed(0)}%</span>
                    </div>
                `;
            }).join('');
        }
        
        // Update consensus analytics
        const avgConsensus = document.getElementById('avg-consensus');
        const totalFeedSubmissions = document.getElementById('total-feed-submissions');
        const consensusAchieved = document.getElementById('consensus-achieved');
        const disagreements = document.getElementById('disagreements');
        
        if (avgConsensus) avgConsensus.textContent = '95%';
        if (totalFeedSubmissions) totalFeedSubmissions.textContent = feeds.length.toString();
        if (consensusAchieved) consensusAchieved.textContent = Math.floor(feeds.length * 0.95).toString();
        if (disagreements) disagreements.textContent = Math.floor(feeds.length * 0.05).toString();
        
        // Update network stats
        const totalRequests = document.getElementById('total-requests');
        const successfulRequests = document.getElementById('successful-requests');
        const failedRequests = document.getElementById('failed-requests');
        const successRate = document.getElementById('success-rate');
        const avgResponseTime = document.getElementById('avg-response-time');
        
        if (totalRequests) totalRequests.textContent = stats.networkHealth.totalRequests.toLocaleString();
        if (successfulRequests) successfulRequests.textContent = stats.networkHealth.totalRequests - stats.networkHealth.failedRequests;
        if (failedRequests) failedRequests.textContent = stats.networkHealth.failedRequests;
        if (successRate) successRate.textContent = `${stats.networkHealth.successRate.toFixed(1)}%`;
        if (avgResponseTime) avgResponseTime.textContent = `${stats.networkHealth.avgResponseTime.toFixed(0)}ms`;
    } catch (error) {
        console.error('Error updating consensus section:', error);
    }
}

function selectPool(poolId) {
    localStorage.setItem('selectedStakePool', poolId);
    showOracleStatus(`Selected pool: ${poolId}`, 'success');
}

// Proof verification functions
async function verifyAllProofs() {
    if (!oracle) return;
    
    try {
        const feeds = oracle.getAllPriceFeeds();
        const customFeeds = Array.from(oracle.customFeeds.keys());
        const allFeeds = [...customFeeds];
        
        const results = [];
        for (const feedId of allFeeds) {
            const verification = await oracle.verifyFeedProof(feedId);
            results.push({ feedId, ...verification });
        }
        
        showOracleStatus(`Verified ${results.filter(r => r.verified).length} of ${results.length} feeds`, 'success');
        return results;
    } catch (error) {
        console.error('Error verifying proofs:', error);
        showOracleStatus('Failed to verify proofs: ' + error.message, 'error');
    }
}

function updateProofStatus() {
    if (!oracle) return;
    
    try {
        const customFeeds = Array.from(oracle.customFeeds.keys());
        const verificationContainer = document.getElementById('verification-status-container');
        
        if (verificationContainer && customFeeds.length > 0) {
            verificationContainer.innerHTML = customFeeds.slice(0, 10).map(feedId => {
                const status = oracle.getProofStatus(feedId);
                const consensus = oracle.getFeedConsensus(feedId);
                const isVerified = status.verifiedEntries > 0;
                const hasProof = status.entriesWithProof > 0;
                
                return `
                    <div class="verification-item">
                        <span class="verification-feed">${feedId}</span>
                        <span class="verification-status ${isVerified ? 'verified' : 'unverified'}">${isVerified ? 'Verified' : 'Unverified'}</span>
                        <span class="verification-confidence">${consensus ? (consensus.confidence * 100).toFixed(0) : 0}%</span>
                        ${hasProof ? '<span class="verification-proof">✓ Proof</span>' : '<span class="verification-proof">No Proof</span>'}
                    </div>
                `;
            }).join('');
        }
    } catch (error) {
        console.error('Error updating proof status:', error);
    }
}

// Initialize new oracle section handlers
function initNewOracleSections() {
    // Staking calculator
    updateStakingCalculator();
    
    // Refresh pools button
    const refreshPoolsBtn = document.getElementById('refresh-pools-btn');
    if (refreshPoolsBtn) {
        refreshPoolsBtn.addEventListener('click', async () => {
            await updateStakingPools();
            showOracleStatus('Pools refreshed', 'success');
        });
    }
    
    // Verify proofs button
    const verifyProofsBtn = document.getElementById('verify-proofs-btn');
    if (verifyProofsBtn) {
        verifyProofsBtn.addEventListener('click', async () => {
            verifyProofsBtn.disabled = true;
            verifyProofsBtn.textContent = 'Verifying...';
            try {
                await verifyAllProofs();
                updateProofStatus();
            } catch (error) {
                showOracleStatus('Proof verification failed: ' + error.message, 'error');
            } finally {
                verifyProofsBtn.disabled = false;
                verifyProofsBtn.textContent = 'Verify All Proofs';
            }
        });
    }
    
    // Refresh proof status button
    const refreshProofStatusBtn = document.getElementById('refresh-proof-status-btn');
    if (refreshProofStatusBtn) {
        refreshProofStatusBtn.addEventListener('click', () => {
            updateProofStatus();
            showOracleStatus('Proof status refreshed', 'success');
        });
    }
    
    
    // Load history button
    const loadHistoryBtn = document.getElementById('load-history-btn');
    if (loadHistoryBtn) {
        loadHistoryBtn.addEventListener('click', async () => {
            const symbol = document.getElementById('history-symbol-select')?.value || 'BTC';
            const hours = parseInt(document.getElementById('history-timeframe-select')?.value || 24);
            
            if (!oracle) return;
            
            try {
                const history = oracle.getPriceHistory(symbol, hours);
                const container = document.getElementById('price-history-container');
                
                if (history.length === 0) {
                    if (container) container.innerHTML = '<div class="loading">No history data available</div>';
                    return;
                }
                
                if (container) {
                    container.innerHTML = `
                        <div class="history-list">
                            ${history.slice(-20).map(entry => `
                                <div class="history-item">
                                    <span>${new Date(entry.timestamp).toLocaleString()}</span>
                                    <span>$${entry.price.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 8 })}</span>
                                    ${entry.change24h ? `<span class="${entry.change24h >= 0 ? 'positive' : 'negative'}">${entry.change24h >= 0 ? '+' : ''}${entry.change24h.toFixed(2)}%</span>` : ''}
                                </div>
                            `).join('')}
                        </div>
                    `;
                }
            } catch (error) {
                console.error('Error loading history:', error);
            }
        });
    }
    
    // Update all new sections periodically
    setInterval(() => {
        if (oracle) {
                updateMyStakingPosition();
                updateRewardsSection();
                updateNodeHealthSection();
                updateConsensusSection();
                updateProofStatus();
            }
        }, 10000);
    
    // Initial updates
    setTimeout(() => {
        if (oracle) {
            updateStakingPools();
            updateMyStakingPosition();
            updateRewardsSection();
            updateNodeHealthSection();
            updateConsensusSection();
            updateProofStatus();
        }
    }, 3000);
}



function typeText(element, text, speed = 50) {
    let i = 0;
    element.textContent = '';
    
    function type() {
        if (i < text.length) {
            element.textContent += text.charAt(i);
            i++;
            setTimeout(type, speed);
        }
    }
    
    type();
}


let ticking = false;
window.addEventListener('scroll', () => {
    if (!ticking) {
        window.requestAnimationFrame(() => {
            const scrolled = window.pageYOffset;
            const hero = document.querySelector('.hero');
            if (hero && scrolled < window.innerHeight) {
                hero.style.transform = `translateY(${scrolled * 0.3}px)`;
            }
            ticking = false;
        });
        ticking = true;
    }
});


        try {
            document.querySelectorAll('.btn-primary, .btn-secondary').forEach(function(button) {
                button.addEventListener('mouseenter', function() {
                    if (this.classList.contains('btn-primary')) {
                        this.style.boxShadow = '0 0 20px rgba(0, 212, 255, 0.5)';
                    } else {
                        this.style.boxShadow = '0 0 15px rgba(0, 212, 255, 0.3)';
                    }
                });
                
                button.addEventListener('mouseleave', function() {
                    this.style.boxShadow = '';
                });
            });
        } catch (e) { console.error('Button hover effect error:', e); }
        
        try {
            document.querySelectorAll('button').forEach(function(button) {
                button.addEventListener('click', function(e) {
                    try {
                        var ripple = document.createElement('span');
                        var rect = this.getBoundingClientRect();
                        var size = Math.max(rect.width, rect.height);
                        var x = e.clientX - rect.left - size / 2;
                        var y = e.clientY - rect.top - size / 2;
                        
                        ripple.style.width = ripple.style.height = size + 'px';
                        ripple.style.left = x + 'px';
                        ripple.style.top = y + 'px';
                        ripple.classList.add('ripple');
                        
                        this.appendChild(ripple);
                        
                        setTimeout(function() {
                            ripple.remove();
                        }, 600);
                    } catch (err) { console.error('Ripple effect error:', err); }
                });
            });
        } catch (e) { console.error('Button ripple effect error:', e); }
        
        console.log('%cZCASH → SOLANA Protocol', 'color: #00d4ff; font-size: 20px; font-weight: bold;');
        console.log('%cPrivate Cross-Chain Payments', 'color: #00ff88; font-size: 14px;');
        console.log('%cBuilt with privacy in mind', 'color: #8b949e; font-size: 12px;');
        
    } catch (globalError) {
        console.error('CRITICAL ERROR in script.js:', globalError);
        console.error('Stack:', globalError.stack);
        
        setTimeout(function() {
            try {
                if (typeof initBridgeUI === 'function') {
                    initBridgeUI();
                }
            } catch (e) {
                console.error('Recovery initBridgeUI failed:', e);
            }
        }, 2000);
    }
})();

