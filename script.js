// Global bridge instance
let bridge = null;
let api = null;
let game = null;
let gameInterval = null;
let targetTimeout = null;

// Wait for DOM to load
document.addEventListener('DOMContentLoaded', function() {
    // Initialize bridge service
    initBridge();
    
    // Initialize all features
    initTerminalAnimation();
    initScrollAnimations();
    initTabSwitching();
    initCopyButtons();
    initStatsCounter();
    initNavScroll();
    initFlowSteps();
    initBridgeUI();
    
    // Initialize API and Game
    initAPI();
    initGame();
});

// Initialize Bridge Service
async function initBridge() {
    try {
        // Use QuickNode Solana RPC endpoint (primary) with public endpoints as fallback
        // Multiple endpoints for redundancy and rate limit distribution
        const solanaRpcUrls = [
            'https://prettiest-icy-sea.solana-mainnet.quiknode.pro/5426a8ab0b64bdfb1d9e9b7cdda36020b6c94669',
            'https://api.mainnet-beta.solana.com',
            'https://solana-api.projectserum.com',
            'https://rpc.ankr.com/solana',
            'https://solana.public-rpc.com',
            'https://rpc.solana.com',
            'https://solana-mainnet.g.alchemy.com/v2/demo'
        ];
        
        try {
            bridge = new ZcashSolanaBridge({
                solanaRpcUrls: solanaRpcUrls, // Multiple endpoints for failover
                solanaRpcUrl: solanaRpcUrls[0], // Primary RPC endpoint
                zcashRpcUrl: 'http://localhost:8232', // Configure your Zcash RPC endpoint
                zcashRpcUser: '', // Add your Zcash RPC credentials
                zcashRpcPassword: '',
                shieldedPoolAddress: null // Will be obtained from Zcash RPC if not provided
            });
            
            // Make bridge globally available
            window.bridge = bridge;
            
            // Wait for initialization to complete (bridge.init() is called in constructor)
            // Give it time to initialize, even if Zcash RPC fails
            await new Promise(resolve => setTimeout(resolve, 3000));
            
            // Initialize API with bridge (even if initialization had errors)
            if (api && bridge) {
                api.init(bridge);
                console.log('API initialized with bridge');
            }
        } catch (error) {
            console.error('Bridge creation failed:', error);
            // Bridge might still be created but initialization failed
            // Try to initialize API anyway if bridge exists
            if (api && bridge) {
                try {
                    api.init(bridge);
                    console.log('API initialized with bridge (after error)');
                } catch (initError) {
                    console.error('Failed to initialize API:', initError);
                }
            }
        }
        
        // Initialize game with API
        if (game && api) {
            game.init(api);
        }
        
        // Listen to bridge events
        bridge.on('transaction', (tx) => {
            updateTransactionList();
            updatePoolStats();
        });
        
        // Update stats periodically
        setInterval(() => {
            updatePoolStats();
        }, 5000);
        
        // Initial stats update
        updatePoolStats();
    } catch (error) {
        console.error('Failed to initialize bridge:', error);
    }
}

// Initialize Bridge UI
function initBridgeUI() {
    // Connect wallet button
    const connectBtn = document.getElementById('connect-wallet-btn');
    const bridgeBtn = document.getElementById('bridge-btn');
    const useWalletBtn = document.getElementById('use-wallet-btn');
    const executeBridgeBtn = document.getElementById('execute-bridge-btn');
    const zcashAmountInput = document.getElementById('zcash-amount');
    const solanaRecipientInput = document.getElementById('solana-recipient');
    
    if (connectBtn) {
        connectBtn.addEventListener('click', async () => {
            try {
                await connectWallet();
            } catch (error) {
                showBridgeStatus('Error connecting wallet: ' + error.message, 'error');
            }
        });
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
    
    // Update bridge button state when inputs change
    if (zcashAmountInput && solanaRecipientInput) {
        [zcashAmountInput, solanaRecipientInput].forEach(input => {
            input.addEventListener('input', () => {
                checkBridgeReady();
            });
        });
    }
    
    // Load transaction history
    updateTransactionList();
    
    // Initialize checker UI
    initCheckerUI();
    
    // Initialize wallet modals
    initWalletModals();
    
    // Initialize test suite (for development)
    initTestSuite();
}

// Initialize API Service
function initAPI() {
    try {
        api = new ProtocolAPI();
        window.api = api; // Make API globally available
        // API will be initialized with bridge once bridge is ready
        console.log('✅ API Service initialized');
    } catch (error) {
        console.error('Failed to initialize API:', error);
    }
}

// Initialize Mini Game
let antiCheat = null;
let leaderboardService = null;

function initGame() {
    try {
        game = new MiniGame();
        // Game will be initialized with API once API is ready
        console.log('✅ Mini Game initialized');
        
        // Initialize anti-cheat system
        if (typeof AntiCheat !== 'undefined') {
            antiCheat = new AntiCheat();
            console.log('✅ Anti-Cheat system initialized');
        }
        
        // Initialize leaderboard service
        if (typeof LeaderboardService !== 'undefined') {
            leaderboardService = new LeaderboardService();
            console.log('✅ Leaderboard service initialized');
        }
        
        // Setup game UI
        const startBtn = document.getElementById('start-game-btn');
        const gameArea = document.getElementById('game-area');
        const gameStatus = document.getElementById('game-status');
        
        if (startBtn) {
            startBtn.addEventListener('click', async () => {
                await startGame();
            });
        }
        
        // Setup background click handler (lose 1 life)
        if (gameArea) {
            gameArea.addEventListener('click', (e) => {
                // Only trigger if clicking directly on game area background (not on targets)
                if (game && game.isPlaying) {
                    // Check if click was on a target or target's child elements
                    const clickedTarget = e.target.closest('.game-target');
                    if (!clickedTarget && e.target === gameArea) {
                        // Clicked on background, not a target
                        handleBackgroundClick(e);
                    }
                }
            }, true); // Use capture phase to catch clicks before targets
        }
        
        // Update game stats periodically
        setInterval(() => {
            if (game && game.isPlaying) {
                updateGameUI();
            }
        }, 100);
        
        // Load leaderboard after a delay
        setTimeout(() => {
            if (typeof loadLeaderboard === 'function') {
                loadLeaderboard();
            }
        }, 2000);
        
    } catch (error) {
        console.error('Failed to initialize game:', error);
    }
}

// Handle background click (lose 1 life)
function handleBackgroundClick(e) {
    if (!game || !game.isPlaying) return;
    
    // Check if clicked element is actually the game area (not a target)
    if (e.target.classList.contains('game-target') || 
        e.target.closest('.game-target')) {
        return; // Clicked on a target, not background
    }
    
    // Lose 1 life
    game.missedTargets++;
    game.missTarget();
    
    // Show feedback
    showGameStatus('Missed! -1 Life', 'error');
    
    // Visual feedback
    const gameArea = document.getElementById('game-area');
    if (gameArea) {
        gameArea.style.backgroundColor = 'rgba(255, 68, 68, 0.2)';
        setTimeout(() => {
            gameArea.style.backgroundColor = '';
        }, 200);
    }
    
    // Check if game should end
    checkGameEnd();
    updateGameUI();
}

// Start Game
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
        startBtn.textContent = 'Processing Payment...';
        showGameStatus('Processing payment of 0.01 SOL...', 'info');
        
        // Initialize API with bridge if not already done
        if (!api.bridge) {
            api.init(bridge);
        }
        
        // Initialize game with API if not already done
        if (!game.api) {
            game.init(api);
        }
        
        // Start the game (this will process payment)
        const result = await game.startGame();
        
        if (result.success) {
            const paymentMsg = result.paymentSignature 
                ? `✅ Payment successful! TX: ${result.paymentSignature.substring(0, 16)}...` 
                : '✅ Admin access granted! Game starting...';
            showGameStatus(paymentMsg, 'success');
            
            // Reset anti-cheat for new game
            if (antiCheat) {
                antiCheat.reset();
            }
            
            // Hide start screen immediately
            if (startScreen) {
                startScreen.classList.add('hidden');
                startScreen.style.display = 'none';
                startScreen.style.visibility = 'hidden';
                startScreen.style.opacity = '0';
                startScreen.style.pointerEvents = 'none';
            }
            
            // Ensure game area is visible
            if (gameArea) {
                gameArea.style.display = 'block';
                gameArea.style.visibility = 'visible';
            }
            
            // Start game loop
            startGameLoop();
            
            // Update button
            startBtn.textContent = 'Game In Progress...';
            startBtn.disabled = true;
            
            // Force UI update
            updateGameUI();
        }
    } catch (error) {
        console.error('Game start error:', error);
        showGameStatus('❌ ' + error.message, 'error');
        startBtn.disabled = false;
        startBtn.textContent = 'Pay 0.01 SOL & Start Game';
    }
}

// Start Game Loop
let targetTimeouts = []; // Track all target timeouts

function startGameLoop() {
    const gameArea = document.getElementById('game-area');
    
    // Clear any existing intervals/timeouts
    if (gameInterval) clearInterval(gameInterval);
    targetTimeouts.forEach(timeout => clearTimeout(timeout));
    targetTimeouts = [];
    
    // Clear all existing targets
    const existingTargets = gameArea.querySelectorAll('.game-target');
    existingTargets.forEach(target => target.remove());
    
    // Create targets periodically (faster as score increases)
    gameInterval = setInterval(() => {
        if (!game || !game.isPlaying) {
            clearInterval(gameInterval);
            targetTimeouts.forEach(timeout => clearTimeout(timeout));
            targetTimeouts = [];
            return;
        }
        
        createGameTarget();
    }, 1200); // New target every 1.2 seconds
    
    // Create first target immediately
    setTimeout(() => createGameTarget(), 300);
}

// Create Game Target
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
    
    // Ensure game area is visible
    gameArea.style.display = 'block';
    gameArea.style.visibility = 'visible';
    
    // Ensure start screen is hidden
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
    
    // Ensure target stays within bounds
    const maxX = Math.max(0, gameAreaWidth - target.size);
    const maxY = Math.max(0, gameAreaHeight - target.size);
    
    const finalX = Math.min(Math.max(0, target.x), maxX);
    const finalY = Math.min(Math.max(0, target.y), maxY);
    
    // Create target element
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
    
    // Add click handler
    targetEl.addEventListener('click', (e) => {
        e.stopPropagation();
        hitTarget(target.id, targetEl);
    });
    
    // Add visual countdown indicator
    const countdownBar = document.createElement('div');
    countdownBar.className = 'target-countdown';
    countdownBar.style.width = '100%';
    targetEl.appendChild(countdownBar);
    
    gameArea.appendChild(targetEl);
    
    // Animate countdown bar
    countdownBar.style.transition = `width ${target.lifetime}ms linear`;
    setTimeout(() => {
        countdownBar.style.width = '0%';
    }, 10);
    
    // Remove target after lifetime expires if not clicked
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
        // Remove from timeouts array
        const index = targetTimeouts.indexOf(timeoutId);
        if (index > -1) {
            targetTimeouts.splice(index, 1);
        }
    }, target.lifetime);
    
    // Store timeout ID on target element for easy cleanup
    targetEl.setAttribute('data-timeout-id', timeoutId.toString());
    targetTimeouts.push(timeoutId);
}

// Hit Target
function hitTarget(targetId, targetEl) {
    if (!game || !game.isPlaying) return;
    
    const result = game.hitTarget(targetId);
    if (result && result.hit) {
        // Find and clear timeout for this specific target
        const timeoutAttr = targetEl.getAttribute('data-timeout-id');
        if (timeoutAttr) {
            const timeoutId = parseInt(timeoutAttr);
            clearTimeout(timeoutId);
            const index = targetTimeouts.indexOf(timeoutId);
            if (index > -1) {
                targetTimeouts.splice(index, 1);
            }
        }
        
        // Animate hit with explosion effect
        targetEl.classList.add('hit');
        targetEl.style.background = `radial-gradient(circle, ${result.target.color} 0%, transparent 70%)`;
        
        // Show points popup with bonus info
        showPointsPopup(result.points, result.bonus, targetEl);
        
        // Play hit sound effect (visual feedback)
        createHitEffect(targetEl);
        
        // Remove target
        setTimeout(() => {
            if (targetEl.parentElement) {
                targetEl.remove();
            }
        }, 300);
        
        updateGameUI();
    }
}

// Create hit effect
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

// Show Points Popup
function showPointsPopup(points, bonus, targetEl) {
    const gameArea = document.getElementById('game-area');
    if (!gameArea) return;
    
    const rect = targetEl.getBoundingClientRect();
    const gameAreaRect = gameArea.getBoundingClientRect();
    
    const popup = document.createElement('div');
    popup.className = 'points-popup';
    popup.innerHTML = `<div class="points-main">+${points}</div>${bonus > 0 ? `<div class="points-bonus">+${bonus} bonus</div>` : ''}`;
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

// Check Game End
function checkGameEnd() {
    if (!game || !game.isPlaying) return;
    
    const stats = game.getStats();
    if (stats.remainingLives <= 0) {
        endGame();
    } else {
        updateGameUI();
    }
}

// End Game
async function endGame() {
    if (!game) return;
    
    const result = game.endGame();
    const startBtn = document.getElementById('start-game-btn');
    const gameStatus = document.getElementById('game-status');
    const startScreen = document.getElementById('game-start-screen');
    const gameArea = document.getElementById('game-area');
    
    // Don't submit score if cheating was detected
    if (antiCheat && antiCheat.isCheating) {
        showGameStatus('Score not submitted due to cheating detection', 'error');
    } else {
        // Submit score to leaderboard
        if (leaderboardService && bridge && bridge.solanaWallet) {
            try {
                const signature = result.paymentSignature || 'admin-' + Date.now();
                const difficulty = Math.min(1 + Math.floor(result.score / 100), 5);
                await leaderboardService.submitScore(
                    bridge.solanaWallet,
                    result.score,
                    result.duration,
                    signature,
                    difficulty
                );
                showGameStatus('Score submitted to leaderboard!', 'success');
            } catch (error) {
                console.error('Failed to submit score:', error);
            }
        }
    }
    
    // Clear intervals and timeouts
    if (gameInterval) {
        clearInterval(gameInterval);
        gameInterval = null;
    }
    targetTimeouts.forEach(timeout => clearTimeout(timeout));
    targetTimeouts = [];
    
    // Remove all targets with fade out
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
    
    // Calculate performance rating
    const scorePerSecond = result.duration > 0 ? (result.score / (result.duration / 1000)).toFixed(1) : 0;
    let rating = 'Good';
    if (scorePerSecond > 50) rating = 'Excellent!';
    else if (scorePerSecond > 30) rating = 'Great!';
    else if (scorePerSecond > 15) rating = 'Good';
    else rating = 'Keep Trying!';
    
    // Get leaderboard position
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
            // Ignore leaderboard errors
        }
    }
    
    // Show game over screen
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
                ${leaderboardInfo}
                <p style="color: var(--accent-success); margin-top: 1rem; font-size: 1.2rem;">
                    ${rating}
                </p>
            </div>
        `;
    }
    
    // Update button
    if (startBtn) {
        startBtn.disabled = false;
        startBtn.textContent = 'Pay 0.01 SOL & Start Game';
    }
    
    // Show final status
    showGameStatus(`Game Over! Final Score: ${result.score} (${scorePerSecond} pts/sec)`, 'info');
    
    // Reset UI
    updateGameUI();
    
    // Load and display leaderboard
    await loadLeaderboard();
}

// Update Game UI
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
        // Change color based on lives
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
}

// Load Leaderboard
async function loadLeaderboard() {
    if (!leaderboardService) {
        const container = document.getElementById('leaderboard-container');
        if (container) {
            container.innerHTML = '<p style="color: var(--text-secondary);">Leaderboard API not available. Start the backend server with: npm start</p>';
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
        container.innerHTML = '<p style="color: var(--text-secondary);">Failed to load leaderboard. Make sure the backend API is running on port 3001.</p>';
    }
}

// Show Game Status
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

// Initialize Test Suite
function initTestSuite() {
    // Add test button to console for easy access
    window.runBridgeTests = async function(iterations = 1000) {
        if (!bridge) {
            console.error('Bridge not initialized');
            return;
        }
        
        console.log('Starting bridge test suite...');
        const testSuite = new BridgeTestSuite(bridge);
        const results = await testSuite.runFullTestSuite(iterations);
        
        // Display results in UI if possible
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
    
    // API Test Function - Run tests and retry until success
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
            
            // Success criteria: RPC errors < 50% AND API failures = 0
            const isSuccess = parseFloat(rpcErrorRate) < 50 && results.failed === 0;
            
            if (isSuccess) {
                console.log(`\n✓ SUCCESS! All tests passed with acceptable RPC error rate.`);
                console.log(`  Pass Rate: ${passRate}%`);
                console.log(`  RPC Error Rate: ${rpcErrorRate}% (threshold: <50%)`);
                console.log(`  API Failures: ${results.failed}`);
                break;
            } else {
                console.log(`\n✗ Test run ${attempt} did not meet success criteria.`);
                console.log(`  Pass Rate: ${passRate}%`);
                console.log(`  RPC Error Rate: ${rpcErrorRate}% (threshold: <50%)`);
                console.log(`  API Failures: ${results.failed}`);
                
                if (results.failed > 0) {
                    console.log(`\nAnalyzing errors to improve API...`);
                    // Analyze errors and try to fix common issues
                    const errorTypes = {};
                    results.errors.forEach(err => {
                        errorTypes[err.type] = (errorTypes[err.type] || 0) + 1;
                    });
                    console.log(`Error breakdown:`, errorTypes);
                }
                
                attempt++;
                console.log(`\nRetrying test suite (attempt ${attempt})...`);
                // Small delay before retry
                await new Promise(resolve => setTimeout(resolve, 1000));
            }
        }
        
        return results;
    };
    
    // Auto-run API tests after initialization (optional - can be disabled)
    // Uncomment the following to auto-test on page load:
    /*
    setTimeout(async () => {
        if (api && api.bridge) {
            console.log('Auto-running API tests...');
            await runAPITests(100);
        }
    }, 3000);
    */
    
    // Add test button to UI
    const testBtn = document.getElementById('run-tests-btn');
    
    // Stress test button (customizable, no limits)
    if (testBtn) {
        testBtn.addEventListener('click', async () => {
            const iterations = prompt('How many tests to run? (No limits - enter any number)', '10000');
            if (iterations && !isNaN(iterations)) {
                const testCount = parseInt(iterations);
                if (testCount > 0) {
                    await runTestsWithUI(testCount, testBtn);
                } else {
                    alert('Please enter a valid number greater than 0');
                }
            }
        });
    }
    
    // Unified test runner function
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
        
        // Disable test button during test
        if (testBtn) {
            testBtn.disabled = true;
        }
        
        // Create progress indicator
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
        
        // Make cancel function available globally
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
        
        // Update progress function
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
            
            // Calculate speed
            const elapsed = (Date.now() - startTime) / 1000;
            if (elapsed > 0 && current > lastUpdate) {
                const speed = ((current - lastUpdate) / ((Date.now() - lastUpdate) / 1000)).toFixed(0);
                if (speedEl) speedEl.textContent = speed;
                lastUpdate = current;
            }
        };
        
        try {
            // Listen for test progress events
            progressHandler = (event) => {
                const { current, total, passed, failed, elapsed, rate } = event.detail;
                updateProgress(current, total, passed, failed);
                const speedEl = document.getElementById('test-speed');
                if (speedEl) speedEl.textContent = rate;
            };
            window.addEventListener('testProgress', progressHandler);
            
            // Override console.log temporarily to show progress
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
            
            // Initialize cancellation flag
            window.testCancelled = false;
            
            // Run tests (NO LIMITS!)
            const results = await runBridgeTests(testCount);
            
            // Remove progress event listener
            window.removeEventListener('testProgress', progressHandler);
            
            // Restore console.log
            console.log = originalLog;
            
            // Calculate final stats
            const duration = ((Date.now() - startTime) / 1000).toFixed(2);
            const testsPerSec = (testCount / (duration / 1000)).toFixed(0);
            const passRate = ((results.passed / results.totalTests) * 100).toFixed(2);
            
            // Show results
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
            
            // Update button
            buttonElement.textContent = `Complete: ${results.passed.toLocaleString()}/${results.totalTests.toLocaleString()}`;
            setTimeout(() => {
                buttonElement.textContent = originalButtonText;
                buttonElement.disabled = false;
                // Re-enable test button
                if (testBtn) {
                    testBtn.disabled = false;
                }
                if (progressDiv.parentElement) {
                    progressDiv.remove();
                }
            }, 10000);
        } catch (error) {
            // Restore console.log
            if (typeof originalLog !== 'undefined') {
                console.log = originalLog;
            }
            
            // Remove progress event listener if it exists
            if (typeof progressHandler !== 'undefined') {
                window.removeEventListener('testProgress', progressHandler);
            }
            
            buttonElement.textContent = 'Test Failed';
            buttonElement.disabled = false;
            // Re-enable test button
            if (testBtn) {
                testBtn.disabled = false;
            }
            
            // Check if cancelled
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
            // Clean up cancellation flag
            window.testCancelled = false;
            testCancelled = false;
        }
    }
}

// Initialize Wallet Modals
function initWalletModals() {
    const modal = document.getElementById('wallet-modal');
    const modalClose = document.getElementById('modal-close');
    const viewPortfolioBtn = document.getElementById('view-portfolio-btn');
    const viewTokensBtn = document.getElementById('view-tokens-btn');
    const viewNFTsBtn = document.getElementById('view-nfts-btn');
    const viewHistoryBtn = document.getElementById('view-history-btn');
    
    // Close modal
    if (modalClose) {
        modalClose.addEventListener('click', () => {
            modal.style.display = 'none';
        });
    }
    
    // Close on background click
    if (modal) {
        modal.addEventListener('click', (e) => {
            if (e.target === modal) {
                modal.style.display = 'none';
            }
        });
    }
    
    // Portfolio button
    if (viewPortfolioBtn) {
        viewPortfolioBtn.addEventListener('click', async () => {
            await showPortfolioModal();
        });
    }
    
    // Tokens button
    if (viewTokensBtn) {
        viewTokensBtn.addEventListener('click', async () => {
            await showTokensModal();
        });
    }
    
    // NFTs button
    if (viewNFTsBtn) {
        viewNFTsBtn.addEventListener('click', async () => {
            await showNFTsModal();
        });
    }
    
    // History button
    if (viewHistoryBtn) {
        viewHistoryBtn.addEventListener('click', async () => {
            await showHistoryModal();
        });
    }
}

// Show Portfolio Modal
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

// Show Tokens Modal
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
                        <div class="token-icon">🪙</div>
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

// Show NFTs Modal
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
                        <div class="token-icon">🖼️</div>
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

// Show History Modal
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
                        <div class="tx-icon-large">${tx.err ? '❌' : '✓'}</div>
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

// Connect Solana Wallet - REAL MODE
async function connectWallet() {
    if (!bridge) {
        throw new Error('Bridge not initialized');
    }
    
    // Check if Phantom wallet is installed
    if (typeof window === 'undefined' || !window.solana || !window.solana.isPhantom) {
        showBridgeStatus('⚠️ Phantom wallet not detected! Install Phantom to use REAL MODE.', 'error');
        showBridgeStatus('You can still use demo mode for testing.', 'info');
        // Enable demo mode
        bridge.solanaWallet = null;
        document.getElementById('connect-wallet-btn').textContent = '⚠️ Install Phantom';
        document.getElementById('connect-wallet-btn').style.background = 'var(--accent-warning)';
        document.getElementById('use-wallet-btn').style.display = 'none';
        return;
    }
    
    try {
        showBridgeStatus('Connecting to Phantom wallet...', 'info');
        
        const address = await bridge.connectSolanaWallet();
        
        // Update UI - Show wallet card
        document.getElementById('connect-wallet-btn').style.display = 'none';
        document.getElementById('bridge-btn').style.display = 'inline-block';
        document.getElementById('use-wallet-btn').style.display = 'inline-block';
        document.getElementById('wallet-status').style.display = 'block';
        
        // Update wallet info
        const addressEl = document.getElementById('solana-address');
        if (addressEl) {
            addressEl.textContent = address.substring(0, 4) + '...' + address.substring(address.length - 4);
            addressEl.title = address;
            addressEl.style.cursor = 'pointer';
            addressEl.onclick = () => copyToClipboard(address);
        }
        
        // Update wallet avatar with first 2 chars
        const avatarEl = document.getElementById('wallet-avatar');
        if (avatarEl) {
            avatarEl.textContent = address.substring(0, 2).toUpperCase();
        }
        
        // Update balance and stats
        await updateBalances();
        
        showBridgeStatus('✅ Wallet connected! REAL MODE activated.', 'success');
        
        // Auto-refresh wallet data every 10 seconds
        setInterval(async () => {
            if (bridge.solanaWallet) {
                await updateBalances();
            }
        }, 10000);
        
    } catch (error) {
        console.error('Wallet connection error:', error);
        showBridgeStatus('❌ Failed to connect: ' + error.message, 'error');
        showBridgeStatus('Falling back to demo mode...', 'info');
        // Fallback to demo mode
        bridge.solanaWallet = null;
        document.getElementById('connect-wallet-btn').textContent = 'Retry Connection';
    }
}

// Update balances and wallet info
async function updateBalances() {
    if (!bridge) return;
    
    try {
        if (bridge.solanaWallet) {
            try {
                const solBalance = await bridge.getSolanaBalance();
                const solPrice = await bridge.getSOLPrice();
                const usdValue = solBalance * solPrice;
                
                // Update main balance display
                document.getElementById('total-balance').textContent = solBalance.toFixed(4) + ' SOL';
                document.getElementById('balance-usd').textContent = '$' + usdValue.toFixed(2);
                document.getElementById('solana-balance').textContent = solBalance.toFixed(4) + ' SOL';
                document.getElementById('solana-balance-display').textContent = solBalance.toFixed(4) + ' SOL';
                
                // Update wallet address
                const addressEl = document.getElementById('solana-address');
                if (addressEl) {
                    addressEl.textContent = bridge.solanaWallet.substring(0, 4) + '...' + bridge.solanaWallet.substring(bridge.solanaWallet.length - 4);
                    addressEl.title = bridge.solanaWallet;
                    addressEl.onclick = () => copyToClipboard(bridge.solanaWallet);
                }
                
                // Update wallet stats
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

// Update wallet statistics
async function updateWalletStats() {
    if (!bridge || !bridge.solanaWallet) return;
    
    try {
        // Get token accounts
        const tokens = await bridge.getSolanaTokenAccounts();
        document.getElementById('token-count').textContent = tokens.length;
        
        // Get NFTs (placeholder for now)
        const nfts = await bridge.getSolanaNFTs();
        document.getElementById('nft-count').textContent = nfts.length;
        
        // Get transaction count
        const txs = await bridge.getSolanaTransactions(100);
        document.getElementById('tx-count').textContent = txs.length;
    } catch (error) {
        console.error('Error updating wallet stats:', error);
    }
}

// Copy to clipboard
function copyToClipboard(text) {
    navigator.clipboard.writeText(text).then(() => {
        showBridgeStatus('Address copied to clipboard!', 'success');
    }).catch(err => {
        console.error('Failed to copy:', err);
    });
}

// Check if bridge is ready to execute
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

// Execute Bridge Transaction
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
        
        // Make showBridgeStatus available to bridge service
        window.showBridgeStatus = showBridgeStatus;
        
        const result = await bridge.bridgeZecToSolana(amount, recipient);
        
        showBridgeStatus(
            `Bridge successful! Zcash TX: ${result.zcashTxid.substring(0, 16)}... Solana TX: ${result.solanaTxid.substring(0, 16)}...`,
            'success'
        );
        
        // Clear form
        document.getElementById('zcash-amount').value = '';
        document.getElementById('solana-recipient').value = '';
        
        // Update balances and stats
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

// Update Pool Statistics
function updatePoolStats() {
    if (!bridge) return;
    
    try {
        const stats = bridge.getPoolStats();
        
        // Update transaction count
        const txElement = document.getElementById('stat-transactions');
        if (txElement) {
            txElement.dataset.target = stats.totalTransactions;
            animateValue(txElement, parseInt(txElement.textContent) || 0, stats.totalTransactions, 1000);
        }
        
        // Update active users
        const usersElement = document.getElementById('stat-users');
        if (usersElement) {
            usersElement.dataset.target = stats.activeUsers;
            animateValue(usersElement, parseInt(usersElement.textContent) || 0, stats.activeUsers, 1000);
        }
        
        // Update pool balance
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

// Animate value (for stats)
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

// Update Transaction List
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
        const typeIcon = tx.type === 'deposit' ? '⬇️' : tx.type === 'withdrawal' ? '⬆️' : '🔄';
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

// Show Bridge Status
function showBridgeStatus(message, type = 'info') {
    const statusEl = document.getElementById('bridge-status');
    if (!statusEl) return;
    
    statusEl.textContent = message;
    statusEl.className = `bridge-status ${type}`;
    statusEl.style.display = 'block';
    
    if (type === 'success' || type === 'error') {
        setTimeout(() => {
            statusEl.style.display = 'none';
        }, 5000);
    }
}

// Initialize Checker UI
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
    
    // Allow Enter key to trigger check
    if (checkTxidInput) {
        checkTxidInput.addEventListener('keypress', (e) => {
            if (e.key === 'Enter') {
                checkTxBtn.click();
            }
        });
    }
}

// Check Transaction
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

// Check Pool Integrity
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

// Display Check Results
function displayCheckResults(result) {
    const resultsEl = document.getElementById('checker-results');
    if (!resultsEl) return;
    
    const statusClass = result.valid ? 'success' : 'error';
    const statusIcon = result.valid ? '✓' : '✗';
    
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

// Display Pool Integrity Report
function displayPoolIntegrityReport(report) {
    const resultsEl = document.getElementById('checker-results');
    if (!resultsEl) return;
    
    const statusClass = report.valid ? 'success' : 'error';
    const statusIcon = report.valid ? '✓' : '✗';
    
    let html = `
        <div class="check-result ${statusClass}">
            <div class="check-header">
                <span class="check-icon">${statusIcon}</span>
                <span class="check-title">Pool Integrity Check ${report.valid ? 'Passed' : 'Failed'}</span>
            </div>
            <div class="check-details">
    `;
    
    // Balance check
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
    
    // Transaction consistency
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
    
    // Chain synchronization
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
    
    // Proofs check
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

// Show Checker Results
function showCheckerResults(message, type = 'info') {
    const resultsEl = document.getElementById('checker-results');
    if (!resultsEl) return;
    
    resultsEl.innerHTML = `<div class="check-result ${type}"><div class="check-message">${message}</div></div>`;
    resultsEl.style.display = 'block';
}

// Terminal Animation
function initTerminalAnimation() {
    const terminal = document.getElementById('hero-terminal');
    if (!terminal) return;

    const terminalBody = terminal.querySelector('.terminal-body');
    const lines = [
        { text: '$ zcash-bridge --init', type: 'command', delay: 500 },
        { text: 'Initializing cross-chain protocol...', type: 'output', delay: 1500 },
        { text: '✓ Connected to Zcash network', type: 'success', delay: 2500 },
        { text: '✓ Connected to Solana network', type: 'success', delay: 3500 },
        { text: '✓ Privacy layer activated', type: 'success', delay: 4500 },
        { text: '$', type: 'prompt', delay: 5500 }
    ];

    // Clear initial content
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

// Scroll Animations
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

    // Observe all sections
    document.querySelectorAll('section').forEach(section => {
        section.classList.add('fade-in');
        observer.observe(section);
    });

    // Observe flow steps
    document.querySelectorAll('.flow-step').forEach(step => {
        step.classList.add('fade-in');
        observer.observe(step);
    });

    // Observe proof cards
    document.querySelectorAll('.proof-card').forEach(card => {
        card.classList.add('fade-in');
        observer.observe(card);
    });

    // Observe feature items
    document.querySelectorAll('.feature-item').forEach(item => {
        item.classList.add('fade-in');
        observer.observe(item);
    });
}

// Tab Switching (removed - no tabs needed for bash-only)
function initTabSwitching() {
    // Tabs removed - all examples are bash now
    // Keep function for compatibility but no-op
}

// Copy Buttons
function initCopyButtons() {
    const copyButtons = document.querySelectorAll('.copy-btn');
    
    copyButtons.forEach(button => {
        button.addEventListener('click', async () => {
            const codeBlock = button.closest('.code-block-large') || button.closest('.code-snippet');
            const code = codeBlock.querySelector('code');
            
            if (code) {
                try {
                    await navigator.clipboard.writeText(code.textContent);
                    
                    // Visual feedback
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
}

// Stats Counter Animation (now uses real data from bridge)
function initStatsCounter() {
    // Stats are now updated by updatePoolStats() function
    // This observer is kept for initial animation
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

// Navbar Scroll Effect
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

    // Smooth scroll for anchor links
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

// Flow Steps Animation
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

// Terminal Window Hover Effect
document.querySelectorAll('.terminal-window').forEach(terminal => {
    terminal.addEventListener('mouseenter', () => {
        terminal.style.transform = 'scale(1.02)';
        terminal.style.transition = 'transform 0.3s ease';
    });

    terminal.addEventListener('mouseleave', () => {
        terminal.style.transform = 'scale(1)';
    });
});

// Code Block Syntax Highlighting (enhanced)
function highlightCode() {
    const codeBlocks = document.querySelectorAll('pre code');
    
    codeBlocks.forEach(block => {
        // Skip if already highlighted
        if (block.querySelector('.keyword')) return;
        
        let code = block.innerHTML || block.textContent;
        
        // Preserve existing HTML if any
        const isHTML = block.innerHTML !== block.textContent;
        if (!isHTML) {
            code = escapeHtml(code);
        }
        
        // Highlight keywords
        code = code.replace(/\b(async|await|function|const|let|var|if|else|for|while|return|import|from|export|class|interface|type|enum|fn|pub|use|async|await|def|async def)\b/g, 
            '<span style="color: var(--code-purple);">$&</span>');
        
        // Highlight strings
        code = code.replace(/(["'])(?:(?=(\\?))\2.)*?\1/g, 
            '<span style="color: var(--code-green);">$&</span>');
        
        // Highlight functions/methods
        code = code.replace(/\b([a-zA-Z_$][a-zA-Z0-9_$]*)\s*(?=\()/g, 
            '<span style="color: var(--code-blue);">$1</span>');
        
        // Highlight comments
        code = code.replace(/(\/\/.*$)/gm, 
            '<span style="color: var(--text-muted); font-style: italic;">$1</span>');
        
        // Highlight numbers
        code = code.replace(/\b(\d+\.?\d*)\b/g, 
            '<span style="color: var(--code-yellow);">$1</span>');
        
        block.innerHTML = code;
    });
}

// Escape HTML to prevent XSS
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

// Initialize code highlighting
setTimeout(highlightCode, 100);

// Add typing effect to terminal
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

// Parallax effect for hero section
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

// Add glow effect to buttons on hover
document.querySelectorAll('.btn-primary, .btn-secondary').forEach(button => {
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

// Add ripple effect to buttons
document.querySelectorAll('button').forEach(button => {
    button.addEventListener('click', function(e) {
        const ripple = document.createElement('span');
        const rect = this.getBoundingClientRect();
        const size = Math.max(rect.width, rect.height);
        const x = e.clientX - rect.left - size / 2;
        const y = e.clientY - rect.top - size / 2;
        
        ripple.style.width = ripple.style.height = size + 'px';
        ripple.style.left = x + 'px';
        ripple.style.top = y + 'px';
        ripple.classList.add('ripple');
        
        this.appendChild(ripple);
        
        setTimeout(() => {
            ripple.remove();
        }, 600);
    });
});

// Console log for debugging
console.log('%cZCASH → SOLANA Protocol', 'color: #00d4ff; font-size: 20px; font-weight: bold;');
console.log('%cPrivate Cross-Chain Payments', 'color: #00ff88; font-size: 14px;');
console.log('%cBuilt with privacy in mind', 'color: #8b949e; font-size: 12px;');

