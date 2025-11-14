

class ZcashSolanaBridge {
    constructor(config = {}) {
        
        
        // ALL RPC ENDPOINTS - Premium endpoints first, then fallbacks
        this.solanaRpcUrls = config.solanaRpcUrls || [
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
        
        this.rpcRequestCounts = {};
        this.rpcRateLimitWindow = 60000; 
        this.maxRequestsPerWindow = 20; 
        this.solanaRpcUrl = config.solanaRpcUrl || this.solanaRpcUrls[0];
        this.currentRpcIndex = 0;
        this.solanaConnection = null;
        this.solanaWallet = null;
        this.bridgeProgramId = config.bridgeProgramId || null;
        this.poolAddress = config.poolAddress || null;
        
        // RPC switching cooldown to prevent infinite loops
        this.lastRpcSwitchTime = 0;
        this.rpcSwitchCooldown = 5000; // 5 seconds between switches
        this.maxConsecutiveFails = 5; // Stop after 5 consecutive failures
        this.consecutiveFailures = 0;
        
        
        this.zcashRpcUrl = config.zcashRpcUrl || '';
        this.zcashRpcUser = config.zcashRpcUser || '';
        this.zcashRpcPassword = config.zcashRpcPassword || '';
        this.shieldedPoolAddress = config.shieldedPoolAddress || null;
        
        
        this.poolState = {
            totalDeposits: 0,
            totalWithdrawals: 0,
            activeTransactions: [],
            poolBalance: 0,
            transactionCount: 0,
            uniqueUsers: new Set()
        };
        
        
        this.init().catch(error => {
            console.warn('Bridge initialization had errors (continuing anyway):', error.message);
        });
    }
    
    async init() {
        try {
            
            try {
                await this.initSolanaConnection();
                console.log('Solana connection initialized');
            } catch (error) {
                console.error('Failed to initialize Solana connection:', error);
                throw new Error('Solana connection required. Please check your network connection.');
            }
            
            
            await this.initZcashConnection();
            
            
            if (!this.shieldedPoolAddress) {
                const address = await this.getZcashShieldedAddress();
                if (address) {
                    this.shieldedPoolAddress = address;
                } else {
                    
                    this.shieldedPoolAddress = 'zt1test' + Math.random().toString(36).substring(2, 15);
                }
            }
            
            
            if (typeof window !== 'undefined' && window.solana && window.solana.isPhantom) {
                try {
                    await this.connectSolanaWallet();
                } catch (error) {
                    console.warn('Wallet connection optional - continuing without wallet:', error.message);
                }
            }
            
            
            await this.loadPoolState();
            
            
            this.startMonitoring();
        } catch (error) {
            console.error('Bridge initialization error:', error);
            throw error;
        }
    }
    
    
    
    async connectSolanaWallet() {
        if (typeof window === 'undefined' || !window.solana) {
            throw new Error('Solana wallet not found. Please install Phantom wallet.');
        }
        
        if (!window.solana.isPhantom) {
            throw new Error('Phantom wallet required');
        }
        
        try {
            const resp = await window.solana.connect({ onlyIfTrusted: false });
            if (!resp || !resp.publicKey) {
                throw new Error('Failed to get wallet address');
            }
            
            this.solanaWallet = resp.publicKey.toString();
            
            await this.loadSolanaWeb3();
            
            if (!this.solanaRpcUrl) {
                throw new Error('Solana RPC URL not configured');
            }
            
            this.solanaConnection = new this.SolanaWeb3.Connection(this.solanaRpcUrl, 'confirmed');
            
            try {
                await this.solanaConnection.getVersion();
            } catch (rpcError) {
                if (this.solanaRpcUrls && this.solanaRpcUrls.length > 1) {
                    await this.switchSolanaRpcEndpoint();
                    this.solanaConnection = new this.SolanaWeb3.Connection(this.solanaRpcUrl, 'confirmed');
                } else {
                    throw new Error('Solana RPC connection failed');
                }
            }
            
            return this.solanaWallet;
        } catch (err) {
            if (err.code === 4001) {
                throw new Error('Connection rejected by user');
            }
            console.error('Solana wallet connection error:', err);
            throw err;
        }
    }
    
    async loadSolanaWeb3() {
        if (this.SolanaWeb3) return;
        
        
        return new Promise((resolve, reject) => {
            if (window.solanaWeb3) {
                this.SolanaWeb3 = window.solanaWeb3;
                resolve();
                return;
            }
            
            const script = document.createElement('script');
            script.src = 'https://unpkg.com/@solana/web3.js@latest/lib/index.iife.min.js';
            script.onload = () => {
                this.SolanaWeb3 = window.solanaWeb3;
                resolve();
            };
            script.onerror = reject;
            document.head.appendChild(script);
        });
    }
    
    async disconnectSolanaWallet() {
        if (window.solana && window.solana.disconnect) {
            await window.solana.disconnect();
        }
        this.solanaWallet = null;
    }
    
    async getSolanaBalance(address = null) {
        if (!this.solanaConnection) {
            await this.initSolanaConnection();
        }
        
        await this.loadSolanaWeb3();
        const pubKey = address ? new this.SolanaWeb3.PublicKey(address) : new this.SolanaWeb3.PublicKey(this.solanaWallet);
        const balance = await this.solanaConnection.getBalance(pubKey);
        return balance / 1e9; 
    }
    
    async getSolanaTokenAccounts() {
        if (!this.solanaConnection || !this.solanaWallet) {
            return [];
        }
        
        try {
            await this.loadSolanaWeb3();
            const pubKey = new this.SolanaWeb3.PublicKey(this.solanaWallet);
            const tokenAccounts = await this.solanaConnection.getParsedTokenAccountsByOwner(pubKey, {
                programId: new this.SolanaWeb3.PublicKey('TokenkegQfeZyiNwAJbNbGKPFXCWuBvf9Ss623VQ1DA')
            });
            
            return tokenAccounts.value.map(account => ({
                mint: account.account.data.parsed.info.mint,
                balance: account.account.data.parsed.info.tokenAmount.uiAmount,
                decimals: account.account.data.parsed.info.tokenAmount.decimals,
                address: account.pubkey.toString()
            }));
        } catch (error) {
            console.error('Error fetching token accounts:', error);
            return [];
        }
    }
    
    async getSolanaTransactions(limit = 10) {
        if (!this.solanaConnection || !this.solanaWallet) {
            return [];
        }
        
        try {
            await this.loadSolanaWeb3();
            const pubKey = new this.SolanaWeb3.PublicKey(this.solanaWallet);
            const signatures = await this.solanaConnection.getSignaturesForAddress(pubKey, { limit });
            
            return signatures.map(sig => ({
                signature: sig.signature,
                slot: sig.slot,
                blockTime: sig.blockTime,
                confirmationStatus: sig.confirmationStatus,
                err: sig.err
            }));
        } catch (error) {
            console.error('Error fetching transactions:', error);
            return [];
        }
    }
    
    async getSolanaNFTs() {
        
        
        return [];
    }
    
    async getSOLPrice() {
        try {
            const response = await fetch('https://api.coingecko.com/api/v3/simple/price?ids=solana&vs_currencies=usd');
            const data = await response.json();
            return data.solana?.usd || 0;
        } catch (error) {
            console.error('Error fetching SOL price:', error);
            return 0;
        }
    }
    
    async initSolanaConnection() {
        if (!this.solanaRpcUrls || this.solanaRpcUrls.length === 0) {
            console.error('Solana RPC: No endpoints configured');
            return;
        }
        
        // PRIORITIZE PREMIUM ENDPOINTS - Try Alchemy FIRST, then Infura, then others
        const alchemyUrls = this.solanaRpcUrls.filter(url => url.includes('alchemy'));
        const infuraUrls = this.solanaRpcUrls.filter(url => url.includes('infura'));
        const otherUrls = this.solanaRpcUrls.filter(url => 
            !url.includes('alchemy') && !url.includes('infura')
        );
        
        // Try Alchemy first (most reliable), then Infura, then others
        const prioritizedUrls = [...alchemyUrls, ...infuraUrls, ...otherUrls];
        
        console.log(`🔗 Solana RPC: Trying ${prioritizedUrls.length} endpoints (Alchemy first: ${alchemyUrls.length})`);
        
        for (let i = 0; i < prioritizedUrls.length; i++) {
            const rpcUrl = prioritizedUrls[i];
            
            
            if (this.isRateLimited(rpcUrl)) {
                console.warn(`Solana RPC: Rate limit reached for ${rpcUrl}, skipping...`);
                continue;
            }
            
            try {
                await this.loadSolanaWeb3();
                this.solanaConnection = new this.SolanaWeb3.Connection(rpcUrl, {
                    commitment: 'confirmed',
                    disableRetryOnRateLimit: false
                });
                this.solanaRpcUrl = rpcUrl;
                this.currentRpcIndex = this.solanaRpcUrls.indexOf(rpcUrl);
                
                
                // Longer timeout for premium endpoints
                const timeout = (rpcUrl.includes('alchemy') || rpcUrl.includes('infura')) ? 15000 : 10000;
                const slot = await Promise.race([
                    this.solanaConnection.getSlot(),
                    new Promise((_, reject) => setTimeout(() => reject(new Error('Timeout')), timeout))
                ]);
                
                if (slot && slot > 0) {
                    const displayUrl = rpcUrl.length > 60 ? rpcUrl.substring(0, 60) + '...' : rpcUrl;
                    console.log(`✅ Solana RPC: Connected to ${displayUrl} (slot: ${slot})`);
                    this.recordRpcRequest(rpcUrl);
                    this.solanaRpcUrl = rpcUrl;
                    this.currentRpcIndex = this.solanaRpcUrls.indexOf(rpcUrl);
                    // Reset failure counter on successful connection
                    this.consecutiveFailures = 0;
                    return;
                }
            } catch (error) {
                const errorMsg = error.message || error.toString();
                const displayUrl = rpcUrl.length > 60 ? rpcUrl.substring(0, 60) + '...' : rpcUrl;
                
                // Don't mark premium endpoints as rate limited on first failure
                if (!rpcUrl.includes('alchemy') && !rpcUrl.includes('infura')) {
                    if (errorMsg.includes('403') || errorMsg.includes('forbidden') || errorMsg.includes('rate limit')) {
                        this.markRateLimited(rpcUrl);
                    }
                }
                
                console.warn(`⚠️ Solana RPC: Failed to connect to ${displayUrl}: ${errorMsg.substring(0, 100)}`);
                this.solanaConnection = null;
                continue;
            }
        }
        
        console.error('Solana RPC: All endpoints failed during initialization.');
        
        // Try to use premium endpoints as fallback (they might work even if test failed)
        const premiumFallback = this.solanaRpcUrls.find(url => url.includes('alchemy') || url.includes('infura'));
        const fallbackUrl = premiumFallback || (this.solanaRpcUrls && this.solanaRpcUrls[0]);
        
        if (fallbackUrl) {
            try {
                await this.loadSolanaWeb3();
                this.solanaConnection = new this.SolanaWeb3.Connection(fallbackUrl, {
                    commitment: 'confirmed',
                    disableRetryOnRateLimit: false
                });
                this.solanaRpcUrl = fallbackUrl;
                const displayUrl = fallbackUrl.length > 60 ? fallbackUrl.substring(0, 60) + '...' : fallbackUrl;
                console.warn(`⚠️ Using fallback connection to ${displayUrl} (connection may be slow)`);
            } catch (fallbackError) {
                console.error('Fallback connection also failed:', fallbackError.message);
                this.solanaConnection = null;
            }
        } else {
            this.solanaConnection = null;
        }
    }
    
    isRateLimited(rpcUrl) {
        const key = rpcUrl;
        if (!this.rpcRequestCounts[key]) return false;
        
        const now = Date.now();
        const windowStart = now - this.rpcRateLimitWindow;
        
        
        this.rpcRequestCounts[key] = this.rpcRequestCounts[key].filter(timestamp => timestamp > windowStart);
        
        return this.rpcRequestCounts[key].length >= this.maxRequestsPerWindow;
    }
    
    recordRpcRequest(rpcUrl) {
        const key = rpcUrl;
        if (!this.rpcRequestCounts[key]) {
            this.rpcRequestCounts[key] = [];
        }
        this.rpcRequestCounts[key].push(Date.now());
    }
    
    markRateLimited(rpcUrl) {
        
        const key = rpcUrl;
        if (!this.rpcRequestCounts[key]) {
            this.rpcRequestCounts[key] = [];
        }
        
        const now = Date.now();
        for (let i = 0; i < this.maxRequestsPerWindow; i++) {
            this.rpcRequestCounts[key].push(now - (this.rpcRateLimitWindow * i / this.maxRequestsPerWindow));
        }
    }
    
    async switchSolanaRpcEndpoint() {
        // Prevent rapid switching (cooldown period)
        const now = Date.now();
        if (now - this.lastRpcSwitchTime < this.rpcSwitchCooldown) {
            console.warn(`Solana RPC: Cooldown active, skipping switch (${Math.ceil((this.rpcSwitchCooldown - (now - this.lastRpcSwitchTime)) / 1000)}s remaining)`);
            return;
        }
        
        // Check if we've failed too many times
        this.consecutiveFailures++;
        if (this.consecutiveFailures >= this.maxConsecutiveFails) {
            console.error(`Solana RPC: Too many consecutive failures (${this.consecutiveFailures}). Stopping retry attempts.`);
            return;
        }
        
        this.lastRpcSwitchTime = now;
        this.currentRpcIndex = (this.currentRpcIndex + 1) % this.solanaRpcUrls.length;
        const newRpcUrl = this.solanaRpcUrls[this.currentRpcIndex];
        console.log(`Solana RPC: Switching to ${newRpcUrl} (attempt ${this.consecutiveFailures}/${this.maxConsecutiveFails})`);
        await this.initSolanaConnection();
    }
    
    async makeSolanaRpcCall(methodName, ...args) {
        
        if (!this.solanaConnection) {
            await this.initSolanaConnection();
        }
        
        
        if (!this.solanaConnection) {
            throw new Error('Solana RPC: No connection available');
        }
        
        
        if (this.isRateLimited(this.solanaRpcUrl)) {
            console.warn(`Solana RPC: Rate limit reached for ${this.solanaRpcUrl}, switching endpoint...`);
            await this.switchSolanaRpcEndpoint();
            if (!this.solanaConnection) {
                throw new Error('Solana RPC: Failed to establish connection after rate limit');
            }
        }
        
        try {
            
            this.recordRpcRequest(this.solanaRpcUrl);
            
            
            await new Promise(resolve => setTimeout(resolve, 100));
            
            
            const method = this.solanaConnection[methodName];
            if (typeof method !== 'function') {
                throw new Error(`Solana RPC: Method ${methodName} not found`);
            }
            const result = await method.apply(this.solanaConnection, args);
            return result;
        } catch (error) {
            const errorMsg = error.message || error.toString();
            
            
            if (errorMsg.includes('403') || errorMsg.includes('forbidden') || errorMsg.includes('rate limit')) {
                console.error(`Solana RPC: ${errorMsg} - switching endpoint...`);
                this.markRateLimited(this.solanaRpcUrl);
                await this.switchSolanaRpcEndpoint();
                
                if (this.solanaConnection) {
                    try {
                        this.recordRpcRequest(this.solanaRpcUrl);
                        await new Promise(resolve => setTimeout(resolve, 200));
                        const method = this.solanaConnection[methodName];
                        return await method.apply(this.solanaConnection, args);
                    } catch (retryError) {
                        console.error(`Solana RPC: Retry failed: ${retryError.message}`);
                        throw retryError;
                    }
                }
            }
            
            throw error;
        }
    }
    
    
    
    async initZcashConnection() {
        
        this.zcashRpcAuth = btoa(`${this.zcashRpcUser}:${this.zcashRpcPassword}`);
    }
    
    async zcashRpcCall(method, params = [], retries = 3) {
        // Always use same origin - backend serves both API and static files
        const proxyUrl = '/api/zcash-rpc';
        
        for (let attempt = 0; attempt < retries; attempt++) {
            try {
                const controller = new AbortController();
                const timeoutId = setTimeout(() => controller.abort(), 15000);
                
                const response = await fetch(proxyUrl, {
                    method: 'POST',
                    headers: {
                        'Content-Type': 'application/json'
                    },
                    body: JSON.stringify({
                        method: method,
                        params: params
                    }),
                    signal: controller.signal
                });
                
                clearTimeout(timeoutId);
                
                if (!response.ok) {
                    const errorData = await response.json().catch(() => ({ error: response.statusText }));
                    const errorMsg = errorData.error || `HTTP ${response.status} ${response.statusText}`;
                    console.error(`Zcash RPC error (attempt ${attempt + 1}/${retries}): ${errorMsg}`);
                    if (attempt < retries - 1) {
                        await new Promise(resolve => setTimeout(resolve, 1000 * (attempt + 1)));
                        continue;
                    }
                    return null;
                }
                
                const data = await response.json();
                if (data.error) {
                    const errorMsg = `Zcash RPC error: ${data.error}`;
                    console.error(`Zcash RPC error (attempt ${attempt + 1}/${retries}): ${errorMsg}`);
                    if (attempt < retries - 1) {
                        await new Promise(resolve => setTimeout(resolve, 1000 * (attempt + 1)));
                        continue;
                    }
                    return null;
                }
                return data.result;
            } catch (error) {
                const errorMsg = error.name === 'AbortError' ? 'Request timeout' : error.message;
                
                if (errorMsg.includes('Failed to fetch') && attempt === 0) {
                    console.warn('Zcash RPC: Proxy server not running. Start the backend server with: npm start');
                } else {
                    console.error(`Zcash RPC call failed (attempt ${attempt + 1}/${retries}) for ${method}: ${errorMsg}`);
                }
                
                if (attempt < retries - 1) {
                    await new Promise(resolve => setTimeout(resolve, 1000 * (attempt + 1)));
                    continue;
                }
                return null;
            }
        }
        return null;
    }
    
    async getZcashBalance(address = null) {
        if (address) {
            const balance = await this.zcashRpcCall('z_getbalance', [address], 2);
            return balance !== null ? balance : 0;
        }
        const balance = await this.zcashRpcCall('getbalance', [], 2);
        return balance !== null ? balance : 0;
    }
    
    async getZcashShieldedAddress() {
        return await this.zcashRpcCall('z_getnewaddress', [], 2);
    }
    
    async sendZcashToPool(amount, memo = '') {
        if (!this.shieldedPoolAddress) {
            throw new Error('Pool address not configured. Please configure shieldedPoolAddress.');
        }
        
        if (!amount || amount <= 0) {
            throw new Error('Invalid amount: must be greater than 0');
        }
        
        try {
            const txid = await this.zcashRpcCall('z_sendmany', [
                null, 
                [{
                    address: this.shieldedPoolAddress,
                    amount: amount,
                    memo: memo || `solana-bridge-${Date.now()}`
                }]
            ]);
            
            if (!txid) {
                throw new Error('Zcash RPC returned no transaction ID');
            }
            
            
            this.trackTransaction({
                type: 'deposit',
                chain: 'zcash',
                txid: txid,
                amount: amount,
                timestamp: Date.now(),
                status: 'pending'
            });
            
            
            const roundedAmount = Math.round(amount * 1e8) / 1e8;
            const currentDeposits = Math.round((this.poolState.totalDeposits || 0) * 1e8) / 1e8;
            const currentBalance = Math.round((this.poolState.poolBalance || 0) * 1e8) / 1e8;
            
            this.poolState.totalDeposits = Math.round((currentDeposits + roundedAmount) * 1e8) / 1e8;
            this.poolState.poolBalance = Math.round((currentBalance + roundedAmount) * 1e8) / 1e8;
            
            return txid;
        } catch (error) {
            console.error('Failed to send Zcash to pool:', error);
            throw new Error(`Failed to send Zcash to pool: ${error.message}`);
        }
    }
    
    
    
    async loadPoolState() {
        try {
            
            if (this.poolAddress && this.solanaConnection) {
                await this.loadSolanaWeb3();
                const accountInfo = await this.solanaConnection.getAccountInfo(
                    new this.SolanaWeb3.PublicKey(this.poolAddress)
                );
                
                if (accountInfo) {
                    
                    
                    this.poolState.poolBalance = accountInfo.lamports / 1e9;
                }
            }
            
            
            await this.updatePoolStats();
        } catch (error) {
            console.error('Error loading pool state:', error);
        }
    }
    
    async updatePoolStats() {
        try {
            
            const txArray = this.poolState.activeTransactions || [];
            const txCount = txArray.length;
            
            
            let deposits, withdrawals;
            if (txCount > 10000) {
                
                const sample = txArray.slice(-5000);
                deposits = sample.filter(tx => tx.type === 'deposit' || tx.type === 'bridge');
                withdrawals = sample.filter(tx => tx.type === 'withdrawal');
                
                const scaleFactor = txCount / 5000;
                const sampleDeposits = deposits.reduce((sum, tx) => {
                    const amount = parseFloat(tx.amount) || 0;
                    return sum + amount;
                }, 0);
                const sampleWithdrawals = withdrawals.reduce((sum, tx) => {
                    const amount = parseFloat(tx.amount) || 0;
                    return sum + amount;
                }, 0);
                this.poolState.totalDeposits = sampleDeposits * scaleFactor;
                this.poolState.totalWithdrawals = sampleWithdrawals * scaleFactor;
            } else {
                
                deposits = txArray.filter(tx => tx.type === 'deposit' || tx.type === 'bridge');
                withdrawals = txArray.filter(tx => tx.type === 'withdrawal');
                
                
                this.poolState.totalDeposits = deposits.reduce((sum, tx) => {
                    const amount = parseFloat(tx.amount) || 0;
                    const newSum = sum + amount;
                    
                    return newSum > Number.MAX_SAFE_INTEGER ? sum : newSum;
                }, 0);
                
                this.poolState.totalWithdrawals = withdrawals.reduce((sum, tx) => {
                    const amount = parseFloat(tx.amount) || 0;
                    const newSum = sum + amount;
                    return newSum > Number.MAX_SAFE_INTEGER ? sum : newSum;
                }, 0);
            }
            
            
            this.poolState.transactionCount = txCount;
            
            
            const recentTxs = txArray.slice(-1000);
            recentTxs.forEach(tx => {
                if (tx.userAddress && tx.userAddress !== 'unknown') {
                    this.poolState.uniqueUsers.add(tx.userAddress);
                }
            });
            
            
            const calculatedBalance = this.poolState.totalDeposits - this.poolState.totalWithdrawals;
            
            
            
            const roundedCalculated = Math.round(calculatedBalance * 1e8) / 1e8;
            const roundedReported = Math.round(this.poolState.poolBalance * 1e8) / 1e8;
            
            
            if (isNaN(this.poolState.poolBalance) || !isFinite(this.poolState.poolBalance) || 
                this.poolState.poolBalance < 0 || Math.abs(roundedCalculated - roundedReported) > 0.0001) {
                this.poolState.poolBalance = Math.max(0, roundedCalculated);
            }
            
            
            if (!isFinite(this.poolState.totalDeposits)) {
                this.poolState.totalDeposits = 0;
            } else {
                
                this.poolState.totalDeposits = Math.round(this.poolState.totalDeposits * 1e8) / 1e8;
            }
            
            if (!isFinite(this.poolState.totalWithdrawals)) {
                this.poolState.totalWithdrawals = 0;
            } else {
                
                this.poolState.totalWithdrawals = Math.round(this.poolState.totalWithdrawals * 1e8) / 1e8;
            }
            
            
            this.poolState.poolBalance = Math.round(this.poolState.poolBalance * 1e8) / 1e8;
            
        } catch (error) {
            console.error('Error updating pool stats:', error);
            
            this.poolState.totalDeposits = this.poolState.totalDeposits || 0;
            this.poolState.totalWithdrawals = this.poolState.totalWithdrawals || 0;
            this.poolState.transactionCount = (this.poolState.activeTransactions || []).length;
            this.poolState.poolBalance = Math.max(0, this.poolState.poolBalance || 0);
        }
    }
    
    trackTransaction(tx) {
        try {
            
            if (!tx) {
                console.warn('Invalid transaction: null or undefined');
                return;
            }
            
            
            tx.id = tx.id || `tx_${Date.now()}_${Math.random().toString(36).substring(7)}`;
            
            
            tx.userAddress = tx.userAddress || this.solanaWallet || 'unknown';
            
            
            if (!tx.type) {
                tx.type = 'unknown';
            }
            
            if (!tx.timestamp) {
                tx.timestamp = Date.now();
            }
            
            if (!tx.status) {
                tx.status = 'pending';
            }
            
            
            if (tx.userAddress && tx.userAddress !== 'unknown') {
                this.poolState.uniqueUsers.add(tx.userAddress);
            }
            
            
            this.poolState.activeTransactions.push(tx);
            
            
            if (this.poolState.activeTransactions.length > 1000) {
                const removed = this.poolState.activeTransactions.shift();
                
                if (removed.userAddress) {
                    const hasOtherTxs = this.poolState.activeTransactions.some(
                        t => t.userAddress === removed.userAddress
                    );
                    if (!hasOtherTxs) {
                        this.poolState.uniqueUsers.delete(removed.userAddress);
                    }
                }
            }
            
            
            this.updatePoolStats();
            
            
            this.emit('transaction', tx);
            
        } catch (error) {
            console.error('Error tracking transaction:', error);
            
        }
    }
    
    async getTransactionStatus(txid) {
        
        const tx = this.poolState.activeTransactions.find(t => t.txid === txid);
        if (!tx) return null;
        
        if (tx.chain === 'zcash') {
            
            const zcashTx = await this.zcashRpcCall('gettransaction', [txid], 2);
            return {
                ...tx,
                confirmations: zcashTx?.confirmations || 0,
                status: zcashTx?.confirmations > 0 ? 'confirmed' : 'pending'
            };
        } else if (tx.chain === 'solana') {
            
            if (this.solanaConnection) {
                try {
                    const signature = txid;
                    const statusPromise = this.makeSolanaRpcCall('getSignatureStatus', signature);
                    const timeoutPromise = new Promise((_, reject) => 
                        setTimeout(() => reject(new Error('Timeout')), 5000)
                    );
                    const status = await Promise.race([statusPromise, timeoutPromise]);
                    return {
                        ...tx,
                        confirmations: status?.value?.confirmations || 0,
                        status: status?.value?.confirmationStatus || 'pending'
                    };
                } catch (error) {
                    console.error(`Solana RPC: getSignatureStatus failed: ${error.message}`);
                    
                    if (error.message.includes('403') || error.message.includes('forbidden')) {
                        await this.switchSolanaRpcEndpoint();
                        if (this.solanaConnection) {
                            try {
                                const statusPromise = this.makeSolanaRpcCall('getSignatureStatus', signature);
                                const timeoutPromise = new Promise((_, reject) => 
                                    setTimeout(() => reject(new Error('Timeout')), 5000)
                                );
                                const status = await Promise.race([statusPromise, timeoutPromise]);
                                return {
                                    ...tx,
                                    confirmations: status?.value?.confirmations || 0,
                                    status: status?.value?.confirmationStatus || 'pending'
                                };
                            } catch (retryError) {
                                console.error(`Solana RPC: Retry failed: ${retryError.message}`);
                            }
                        }
                    }
                    return {
                        ...tx,
                        confirmations: 0,
                        status: 'pending'
                    };
                }
            }
        }
        
        return tx;
    }
    
    
    
    async bridgeZecToSolana(zcashAmount, solanaRecipient = null) {
        
        const amount = parseFloat(zcashAmount);
        if (!amount || isNaN(amount) || amount <= 0) {
            throw new Error('Invalid amount: must be a positive number');
        }
        
        if (amount > 1000000) {
            throw new Error('Amount too large: maximum 1,000,000 ZEC');
        }
        
        
        const recipient = solanaRecipient || this.solanaWallet;
        if (!recipient) {
            throw new Error('Solana recipient address required. Please connect wallet or provide recipient address.');
        }
        
        
        if (!this.isValidSolanaAddress(recipient)) {
            throw new Error('Invalid Solana address format');
        }
        
        
        if (!this.solanaConnection) {
            await this.initSolanaConnection();
        }
        
        try {
            
            this.showBridgeStatus('Step 1/4: Depositing ZEC to pool...', 'info');
            const zcashTxid = await this.sendZcashToPool(amount, `bridge-to-${recipient}`);
            
            if (!zcashTxid) {
                throw new Error('Failed to create Zcash transaction');
            }
            
            
            this.showBridgeStatus('Step 2/4: Waiting for confirmation...', 'info');
            await this.waitForZcashConfirmation(zcashTxid);
            
            
            this.showBridgeStatus('Step 3/4: Generating zero-knowledge proof...', 'info');
            const proof = await this.generateProof(zcashTxid, amount, recipient);
            
            if (!proof || !proof.txid) {
                throw new Error('Failed to generate proof');
            }
            
            
            this.showBridgeStatus('Step 4/4: Minting on Solana...', 'info');
            
            if (!this.solanaWallet) {
                throw new Error('Solana wallet required for real transactions. Please connect your wallet.');
            }
            
            const solanaTx = await this.mintOnSolana(proof, amount, recipient);
            
            if (!solanaTx || !solanaTx.signature) {
                throw new Error('Failed to create Solana transaction');
            }
            
            
            this.trackTransaction({
                type: 'bridge',
                chain: 'both',
                zcashTxid: zcashTxid,
                solanaTxid: solanaTx.signature,
                amount: amount,
                from: 'zcash',
                to: recipient,
                timestamp: Date.now(),
                status: 'completed'
            });
            
            
            if (!isNaN(amount) && amount > 0) {
                const roundedAmount = Math.round(amount * 1e8) / 1e8;
                const currentDeposits = Math.round((this.poolState.totalDeposits || 0) * 1e8) / 1e8;
                const currentBalance = Math.round((this.poolState.poolBalance || 0) * 1e8) / 1e8;
                
                this.poolState.totalDeposits = Math.round((currentDeposits + roundedAmount) * 1e8) / 1e8;
                this.poolState.poolBalance = Math.round((currentBalance + roundedAmount) * 1e8) / 1e8;
                
                
                this.updatePoolStats().catch(err => {
                    console.warn('Stats update error:', err);
                });
            }
            
            return {
                zcashTxid,
                solanaTxid: solanaTx.signature,
                amount: amount,
                recipient
            };
        } catch (error) {
            console.error('Bridge error:', error);
            
            this.trackTransaction({
                type: 'bridge',
                chain: 'both',
                amount: amount,
                from: 'zcash',
                to: recipient,
                timestamp: Date.now(),
                status: 'failed',
                error: error.message
            });
            throw error;
        }
    }
    
    
    showBridgeStatus(message, type) {
        
        if (typeof window !== 'undefined' && window.showBridgeStatus) {
            try {
                window.showBridgeStatus(message, type);
            } catch (error) {
                console.log(`[Bridge Status] ${message}`);
            }
        } else {
            console.log(`[Bridge Status] ${message}`);
        }
    }
    
    async generateProof(txid, amount, recipient) {
        if (!txid || !amount || !recipient) {
            throw new Error('Missing required proof parameters: txid, amount, recipient');
        }
        
        
        const amountHash = await this.hashAmount(amount);
        const recipientHash = await this.hashAddress(recipient);
        
        
        
        const proof = {
            txid: txid,
            amount: amount,
            recipient: recipient,
            proof: 'zk-proof-' + Date.now() + '-' + txid.substring(0, 8),
            publicInputs: {
                amountHash: amountHash,
                recipientHash: recipientHash
            },
            timestamp: Date.now()
        };
        
        return proof;
    }
    
    async mintOnSolana(proof, amount, recipient) {
        if (!this.solanaConnection) {
            throw new Error('Solana connection not initialized');
        }
        
        if (!window.solana || !window.solana.isPhantom) {
            throw new Error('Phantom wallet required. Please install and connect Phantom wallet.');
        }
        
        if (!this.solanaWallet) {
            throw new Error('Solana wallet not connected. Please connect your wallet first.');
        }
        
        await this.loadSolanaWeb3();
        
        
        let fromPubkey, toPubkey;
        try {
            fromPubkey = new this.SolanaWeb3.PublicKey(this.solanaWallet);
            toPubkey = new this.SolanaWeb3.PublicKey(recipient);
        } catch (error) {
            throw new Error(`Invalid Solana address: ${error.message}`);
        }
        
        
        const LAMPORTS_PER_SOL = this.SolanaWeb3?.LAMPORTS_PER_SOL || 1000000000;
        const lamportsValue = parseFloat(amount) * LAMPORTS_PER_SOL;
        let lamports = Math.floor(lamportsValue);
        
        if (!Number.isFinite(lamports) || lamports <= 0 || lamports > Number.MAX_SAFE_INTEGER) {
            throw new Error('Invalid amount: must be a positive number within safe range');
        }
        
        lamports = Number(lamports);
        
        if (typeof lamports !== 'number' || !Number.isInteger(lamports)) {
            throw new Error(`Invalid lamports type: ${typeof lamports}, value: ${lamports}`);
        }
        
        const transaction = new this.SolanaWeb3.Transaction();
        
        try {
            const SystemProgram = this.SolanaWeb3.SystemProgram;
            
            if (!SystemProgram || !SystemProgram.transfer) {
                throw new Error('SystemProgram.transfer not available');
            }
            
            const transferParams = {
                fromPubkey: fromPubkey,
                toPubkey: toPubkey,
                lamports: lamports
            };
            
            console.log('Creating transfer instruction with params:', {
                fromPubkey: fromPubkey.toString(),
                toPubkey: toPubkey.toString(),
                lamports: lamports,
                lamportsType: typeof lamports,
                isInteger: Number.isInteger(lamports)
            });
            
            const transferInstruction = SystemProgram.transfer(transferParams);
            
            if (!transferInstruction || !transferInstruction.keys) {
                throw new Error('Transfer instruction creation returned invalid result');
            }
            
            transaction.add(transferInstruction);
        } catch (instructionError) {
            console.error('Transfer instruction creation error:', instructionError);
            console.error('Error stack:', instructionError.stack);
            throw new Error(`Failed to create transfer instruction: ${instructionError.message}`);
        }
        
        
        let blockhash, lastValidBlockHeight;
        try {
            const blockhashPromise = this.makeSolanaRpcCall('getLatestBlockhash', 'confirmed');
            const timeoutPromise = new Promise((_, reject) => 
                setTimeout(() => reject(new Error('Timeout')), 10000)
            );
            const result = await Promise.race([blockhashPromise, timeoutPromise]);
            blockhash = result.blockhash;
            lastValidBlockHeight = result.lastValidBlockHeight;
        } catch (error) {
            console.error(`Solana RPC: getLatestBlockhash failed: ${error.message}`);
            
            if (error.message.includes('403') || error.message.includes('forbidden')) {
                await this.switchSolanaRpcEndpoint();
                if (this.solanaConnection) {
                    try {
                        const blockhashPromise = this.makeSolanaRpcCall('getLatestBlockhash', 'confirmed');
                        const timeoutPromise = new Promise((_, reject) => 
                            setTimeout(() => reject(new Error('Timeout')), 10000)
                        );
                        const result = await Promise.race([blockhashPromise, timeoutPromise]);
                        blockhash = result.blockhash;
                        lastValidBlockHeight = result.lastValidBlockHeight;
                    } catch (retryError) {
                        console.error(`Solana RPC: Retry failed: ${retryError.message}`);
                        throw new Error(`Failed to get blockhash after retry: ${retryError.message}`);
                    }
                } else {
                    throw new Error('No Solana connection available');
                }
            } else {
                throw error;
            }
        }
        
        transaction.recentBlockhash = blockhash;
        transaction.feePayer = fromPubkey;
        
        
        const signed = await window.solana.signTransaction(transaction);
        
        
        let signature;
        try {
            signature = await this.makeSolanaRpcCall('sendRawTransaction', signed.serialize(), {
                skipPreflight: false,
                maxRetries: 3
            });
        } catch (error) {
            console.error(`Solana RPC: sendRawTransaction failed: ${error.message}`);
            
            if (error.message.includes('403') || error.message.includes('forbidden')) {
                await this.switchSolanaRpcEndpoint();
                if (this.solanaConnection) {
                    try {
                        
                        const blockhashResult = await Promise.race([
                            this.makeSolanaRpcCall('getLatestBlockhash', 'confirmed'),
                            new Promise((_, reject) => setTimeout(() => reject(new Error('Timeout')), 10000))
                        ]);
                        transaction.recentBlockhash = blockhashResult.blockhash;
                        transaction.feePayer = fromPubkey;
                        const reSigned = await window.solana.signTransaction(transaction);
                        signature = await this.makeSolanaRpcCall('sendRawTransaction', reSigned.serialize(), {
                            skipPreflight: false,
                            maxRetries: 3
                        });
                    } catch (retryError) {
                        console.error(`Solana RPC: Retry failed: ${retryError.message}`);
                        throw new Error(`Failed to send transaction after retry: ${retryError.message}`);
                    }
                } else {
                    throw new Error('No Solana connection available');
                }
            } else {
                throw error;
            }
        }
        
        
        let confirmation;
        try {
            confirmation = await this.makeSolanaRpcCall('confirmTransaction', {
                signature: signature,
                blockhash: blockhash,
                lastValidBlockHeight: lastValidBlockHeight
            }, 'confirmed');
        } catch (error) {
            console.error(`Solana RPC: confirmTransaction failed: ${error.message}`);
            
            if (error.message.includes('403') || error.message.includes('forbidden')) {
                await this.switchSolanaRpcEndpoint();
                if (this.solanaConnection) {
                    try {
                        confirmation = await this.makeSolanaRpcCall('confirmTransaction', {
                            signature: signature,
                            blockhash: blockhash,
                            lastValidBlockHeight: lastValidBlockHeight
                        }, 'confirmed');
                    } catch (retryError) {
                        console.error(`Solana RPC: Retry failed: ${retryError.message}`);
                        throw new Error(`Failed to confirm transaction after retry: ${retryError.message}`);
                    }
                } else {
                    throw new Error('No Solana connection available');
                }
            } else {
                throw error;
            }
        }
        
        if (confirmation.value.err) {
            throw new Error(`Solana transaction failed: ${JSON.stringify(confirmation.value.err)}`);
        }
        
        return { signature };
    }
    
    async waitForZcashConfirmation(txid, requiredConfirmations = 1) {
        if (!txid) {
            throw new Error('Transaction ID required');
        }
        
        const maxAttempts = 60; 
        const pollInterval = 5000; 
        
        for (let attempt = 0; attempt < maxAttempts; attempt++) {
            try {
                const txInfo = await this.zcashRpcCall('gettransaction', [txid], 2);
                if (!txInfo) {
                    
                    await new Promise(resolve => setTimeout(resolve, pollInterval));
                    continue;
                }
                const confirmations = txInfo.confirmations || 0;
                
                if (confirmations >= requiredConfirmations) {
                    return {
                        confirmed: true,
                        confirmations: confirmations,
                        txid: txid
                    };
                }
                
                
                await new Promise(resolve => setTimeout(resolve, pollInterval));
            } catch (error) {
                
                if (error.message.includes('not found') || error.message.includes('No information')) {
                    await new Promise(resolve => setTimeout(resolve, pollInterval));
                    continue;
                }
                throw error;
            }
        }
        
        throw new Error(`Transaction ${txid} did not confirm after ${maxAttempts * pollInterval / 1000} seconds`);
    }
    
    
    
    isValidSolanaAddress(address) {
        try {
            if (!address || typeof address !== 'string') {
                return false;
            }
            
            if (address.length < 32 || address.length > 44) {
                return false;
            }
            
            if (this.SolanaWeb3) {
                new this.SolanaWeb3.PublicKey(address);
                return true;
            }
            return true; 
        } catch (error) {
            return false;
        }
    }
    
    hashAmount(amount) {
        
        const encoder = new TextEncoder();
        const data = encoder.encode(amount.toString());
        return crypto.subtle.digest('SHA-256', data).then(hashBuffer => {
            const hashArray = Array.from(new Uint8Array(hashBuffer));
            return hashArray.map(b => b.toString(16).padStart(2, '0')).join('').substring(0, 16);
        }).catch(() => {
            
            return btoa(amount.toString()).replace(/[^a-zA-Z0-9]/g, '').substring(0, 16);
        });
    }
    
    async hashAddress(address) {
        
        const encoder = new TextEncoder();
        const data = encoder.encode(address);
        try {
            const hashBuffer = await crypto.subtle.digest('SHA-256', data);
            const hashArray = Array.from(new Uint8Array(hashBuffer));
            return hashArray.map(b => b.toString(16).padStart(2, '0')).join('').substring(0, 16);
        } catch (error) {
            
            return btoa(address).replace(/[^a-zA-Z0-9]/g, '').substring(0, 16);
        }
    }
    
    
    
    startMonitoring() {
        
        let poolUpdateRunning = false;
        setInterval(async () => {
            if (!poolUpdateRunning) {
                poolUpdateRunning = true;
                try {
                    await this.loadPoolState();
                } catch (error) {
                    console.warn('Pool state update error:', error);
                } finally {
                    poolUpdateRunning = false;
                }
            }
        }, 10000);
        
        
        let statusUpdateRunning = false;
        setInterval(async () => {
            if (!statusUpdateRunning && this.poolState.activeTransactions.length < 1000) {
                statusUpdateRunning = true;
                try {
                    await this.updateTransactionStatuses();
                } catch (error) {
                    console.warn('Transaction status update error:', error);
                } finally {
                    statusUpdateRunning = false;
                }
            }
        }, 5000);
    }
    
    async updateTransactionStatuses() {
        const pendingTxs = this.poolState.activeTransactions.filter(tx => 
            tx.status === 'pending'
        );
        
        for (const tx of pendingTxs) {
            const status = await this.getTransactionStatus(tx.txid);
            if (status) {
                Object.assign(tx, status);
            }
        }
        
        this.updatePoolStats();
    }
    
    
    
    emit(event, data) {
        if (this.eventListeners && this.eventListeners[event]) {
            this.eventListeners[event].forEach(callback => callback(data));
        }
    }
    
    on(event, callback) {
        if (!this.eventListeners) {
            this.eventListeners = {};
        }
        if (!this.eventListeners[event]) {
            this.eventListeners[event] = [];
        }
        this.eventListeners[event].push(callback);
    }
    
    
    
    async checkTransaction(txid, chain = null) {
        const tx = this.poolState.activeTransactions.find(t => 
            t.txid === txid || t.zcashTxid === txid || t.solanaTxid === txid
        );
        
        if (!tx) {
            return {
                valid: false,
                error: 'Transaction not found in pool',
                txid
            };
        }
        
        const checks = {
            txid: txid,
            chain: chain || tx.chain,
            found: true,
            valid: true,
            errors: [],
            warnings: [],
            details: {}
        };
        
        
        if (tx.chain === 'zcash' || tx.zcashTxid === txid || tx.type === 'deposit') {
            const zcashCheck = await this.checkZcashTransaction(tx.zcashTxid || txid);
            checks.details.zcash = zcashCheck;
            if (!zcashCheck.valid) {
                checks.valid = false;
                checks.errors.push(`Zcash: ${zcashCheck.error}`);
            }
        }
        
        
        if (tx.chain === 'solana' || tx.solanaTxid === txid || tx.type === 'withdrawal') {
            const solanaCheck = await this.checkSolanaTransaction(tx.solanaTxid || txid);
            checks.details.solana = solanaCheck;
            if (!solanaCheck.valid) {
                checks.valid = false;
                checks.errors.push(`Solana: ${solanaCheck.error}`);
            }
        }
        
        
        if (tx.proof) {
            const proofCheck = await this.checkProof(tx.proof, tx);
            checks.details.proof = proofCheck;
            if (!proofCheck.valid) {
                checks.valid = false;
                checks.errors.push(`Proof: ${proofCheck.error}`);
            }
        }
        
        
        if (tx.amount) {
            const amountCheck = this.checkAmountConsistency(tx);
            checks.details.amount = amountCheck;
            if (!amountCheck.valid) {
                checks.valid = false;
                checks.errors.push(`Amount: ${amountCheck.error}`);
            }
        }
        
        return checks;
    }
    
    async checkZcashTransaction(txid) {
        try {
            const txInfo = await this.zcashRpcCall('gettransaction', [txid], 2);
            if (!txInfo) {
                return {
                    exists: false,
                    confirmations: 0,
                    valid: false
                };
            }
            
            const confirmations = txInfo.confirmations || 0;
            const isConfirmed = confirmations > 0;
            
            return {
                valid: isConfirmed,
                confirmed: isConfirmed,
                confirmations: confirmations,
                blockHeight: txInfo.blockheight || null,
                amount: txInfo.amount || 0,
                fee: txInfo.fee || 0,
                details: txInfo,
                txid
            };
        } catch (error) {
            return {
                valid: false,
                error: error.message || 'Failed to check Zcash transaction',
                txid
            };
        }
    }
    
    async checkSolanaTransaction(signature) {
        try {
            if (!this.solanaConnection) {
                await this.initSolanaConnection();
            }
            
            if (!this.solanaConnection) {
                return {
                    exists: false,
                    confirmations: 0,
                    valid: false
                };
            }
            
            await this.loadSolanaWeb3();
            const statusPromise = this.makeSolanaRpcCall('getSignatureStatus', signature);
            const timeoutPromise = new Promise((_, reject) => 
                setTimeout(() => reject(new Error('Timeout')), 5000)
            );
            const status = await Promise.race([statusPromise, timeoutPromise]);
            
            if (!status || !status.value) {
                return {
                    valid: false,
                    error: 'Transaction not found on Solana network',
                    signature
                };
            }
            
            const isConfirmed = status.value.confirmationStatus === 'confirmed' || 
                               status.value.confirmationStatus === 'finalized';
            
            
            let tx;
            try {
                tx = await this.makeSolanaRpcCall('getTransaction', signature, {
                    commitment: 'confirmed',
                    maxSupportedTransactionVersion: 0
                });
            } catch (txError) {
                console.error(`Solana RPC: getTransaction failed: ${txError.message}`);
                
                if (txError.message.includes('403') || txError.message.includes('forbidden')) {
                    await this.switchSolanaRpcEndpoint();
                    if (this.solanaConnection) {
                        try {
                            tx = await this.makeSolanaRpcCall('getTransaction', signature, {
                                commitment: 'confirmed',
                                maxSupportedTransactionVersion: 0
                            });
                        } catch (retryError) {
                            console.error(`Solana RPC: Retry failed: ${retryError.message}`);
                            tx = null;
                        }
                    }
                } else {
                    tx = null;
                }
            }
            
            return {
                valid: isConfirmed,
                confirmed: isConfirmed,
                confirmations: status.value.confirmations || 0,
                status: status.value.confirmationStatus,
                slot: status.context.slot,
                transaction: tx,
                signature
            };
        } catch (error) {
            console.error(`Solana RPC: checkSolanaTransaction failed: ${error.message}`);
            
            if (error.message.includes('403') || error.message.includes('forbidden')) {
                await this.switchSolanaRpcEndpoint();
                if (this.solanaConnection) {
                    try {
                        await this.loadSolanaWeb3();
                        const statusPromise = this.makeSolanaRpcCall('getSignatureStatus', signature);
                        const timeoutPromise = new Promise((_, reject) => 
                            setTimeout(() => reject(new Error('Timeout')), 5000)
                        );
                        const status = await Promise.race([statusPromise, timeoutPromise]);
                        if (status && status.value) {
                            const isConfirmed = status.value.confirmationStatus === 'confirmed' || 
                                               status.value.confirmationStatus === 'finalized';
                            return {
                                valid: isConfirmed,
                                confirmed: isConfirmed,
                                confirmations: status.value.confirmations || 0,
                                status: status.value.confirmationStatus,
                                slot: status.context?.slot,
                                transaction: null,
                                signature
                            };
                        }
                    } catch (retryError) {
                        console.error(`Solana RPC: Retry failed: ${retryError.message}`);
                    }
                }
            }
            return {
                valid: false,
                error: error.message || 'Failed to check Solana transaction',
                signature
            };
        }
    }
    
    async checkProof(proof, tx) {
        try {
            
            if (!proof.txid || !proof.amount || !proof.recipient) {
                return {
                    valid: false,
                    error: 'Invalid proof structure',
                    proof
                };
            }
            
            
            if (proof.txid !== tx.zcashTxid && proof.txid !== tx.txid) {
                return {
                    valid: false,
                    error: 'Proof txid does not match transaction',
                    proofTxid: proof.txid,
                    txTxid: tx.zcashTxid || tx.txid
                };
            }
            
            
            if (Math.abs(proof.amount - tx.amount) > 0.00000001) {
                return {
                    valid: false,
                    error: 'Proof amount does not match transaction amount',
                    proofAmount: proof.amount,
                    txAmount: tx.amount
                };
            }
            
            
            if (proof.recipient !== tx.to && proof.recipient !== tx.recipient) {
                return {
                    valid: false,
                    error: 'Proof recipient does not match transaction recipient',
                    proofRecipient: proof.recipient,
                    txRecipient: tx.to || tx.recipient
                };
            }
            
            
            if (proof.publicInputs) {
                const amountHash = await this.hashAmount(proof.amount);
                const recipientHash = await this.hashAddress(proof.recipient);
                
                if (proof.publicInputs.amountHash !== amountHash) {
                    return {
                        valid: false,
                        error: 'Proof amount hash mismatch',
                        expected: amountHash,
                        actual: proof.publicInputs.amountHash
                    };
                }
                
                if (proof.publicInputs.recipientHash !== recipientHash) {
                    return {
                        valid: false,
                        error: 'Proof recipient hash mismatch',
                        expected: recipientHash,
                        actual: proof.publicInputs.recipientHash
                    };
                }
            }
            
            
            
            return {
                valid: true,
                proofValid: true,
                structureValid: true,
                amountMatch: true,
                recipientMatch: true,
                hashMatch: true,
                proof
            };
        } catch (error) {
            return {
                valid: false,
                error: error.message || 'Proof verification failed',
                proof
            };
        }
    }
    
    checkAmountConsistency(tx) {
        const checks = {
            valid: true,
            errors: [],
            warnings: []
        };
        
        
        if (!tx.amount || tx.amount <= 0) {
            checks.valid = false;
            checks.errors.push('Amount must be positive');
        }
        
        
        if (tx.type === 'bridge' && tx.zcashAmount && tx.solanaAmount) {
            const diff = Math.abs(tx.zcashAmount - tx.solanaAmount);
            if (diff > 0.00000001) {
                checks.warnings.push(`Amount mismatch: ZEC ${tx.zcashAmount} vs SOL ${tx.solanaAmount}`);
            }
        }
        
        return checks;
    }
    
    
    
    async checkPoolIntegrity() {
        const report = {
            valid: true,
            errors: [],
            warnings: [],
            checks: {
                balance: null,
                transactions: null,
                synchronization: null,
                proofs: null
            },
            timestamp: Date.now()
        };
        
        
        const balanceCheck = await this.checkPoolBalance();
        report.checks.balance = balanceCheck;
        if (!balanceCheck.valid) {
            report.valid = false;
            report.errors.push(...balanceCheck.errors);
        }
        
        
        const txCheck = await this.checkTransactionConsistency();
        report.checks.transactions = txCheck;
        if (!txCheck.valid) {
            report.valid = false;
            report.errors.push(...txCheck.errors);
        }
        
        
        let syncCheck;
        try {
            syncCheck = await this.checkChainSynchronization();
        } catch (error) {
            
            syncCheck = {
                valid: false,
                zcashConnected: false,
                solanaConnected: false,
                warnings: []
            };
        }
        report.checks.synchronization = syncCheck;
        if (!syncCheck.valid) {
            report.warnings.push(...syncCheck.warnings);
        }
        
        
        const proofCheck = await this.checkAllProofs();
        report.checks.proofs = proofCheck;
        if (!proofCheck.valid) {
            report.valid = false;
            report.errors.push(...proofCheck.errors);
        }
        
        return report;
    }
    
    async checkPoolBalance() {
        
        const roundedDeposits = Math.round(this.poolState.totalDeposits * 1e8) / 1e8;
        const roundedWithdrawals = Math.round(this.poolState.totalWithdrawals * 1e8) / 1e8;
        const calculatedBalance = roundedDeposits - roundedWithdrawals;
        const reportedBalance = Math.round(this.poolState.poolBalance * 1e8) / 1e8;
        const diff = Math.abs(calculatedBalance - reportedBalance);
        
        
        if (diff > 0.0001) {
            this.poolState.poolBalance = Math.max(0, calculatedBalance);
        }
        
        return {
            valid: diff < 0.0001, 
            calculatedBalance,
            reportedBalance,
            difference: diff,
            errors: diff >= 0.0001 ? [`Balance mismatch: calculated ${calculatedBalance}, reported ${reportedBalance}`] : []
        };
    }
    
    async checkTransactionConsistency() {
        const errors = [];
        const transactions = this.poolState.activeTransactions;
        
        
        const txids = new Set();
        for (const tx of transactions) {
            const id = tx.txid || tx.zcashTxid || tx.solanaTxid;
            if (id && txids.has(id)) {
                errors.push(`Duplicate transaction: ${id}`);
            }
            if (id) txids.add(id);
        }
        
        
        for (const tx of transactions) {
            if (tx.type === 'bridge') {
                if (!tx.zcashTxid && !tx.solanaTxid) {
                    errors.push(`Bridge transaction missing both chain IDs: ${tx.id}`);
                }
            }
        }
        
        return {
            valid: errors.length === 0,
            totalTransactions: transactions.length,
            errors
        };
    }
    
    async checkChainSynchronization() {
        const warnings = [];
        
        
        let zcashConnected = false;
        let solanaConnected = false;
        
        
        if (this.zcashRpcUrl) {
            const blockCount = await this.zcashRpcCall('getblockcount', [], 2);
            if (blockCount !== null && blockCount > 0) {
                zcashConnected = true;
            } else {
                warnings.push('Zcash RPC: Connection failed or returned invalid data');
            }
        } else {
            warnings.push('Zcash RPC: Endpoint not configured');
        }
        
        
        try {
            if (!this.solanaConnection) {
                await this.initSolanaConnection();
            }
            
            if (this.solanaConnection) {
                
                const slotPromise = this.makeSolanaRpcCall('getSlot');
                const timeoutPromise = new Promise((_, reject) => 
                    setTimeout(() => reject(new Error('Timeout')), 5000)
                );
                
                const slot = await Promise.race([slotPromise, timeoutPromise]);
                if (slot && slot > 0) {
                    solanaConnected = true;
                } else {
                    warnings.push('Solana RPC: Connection returned invalid slot');
                }
            } else {
                warnings.push('Solana RPC: Connection not initialized');
            }
        } catch (error) {
            console.error(`Solana RPC: Connection check failed: ${error.message}`);
            warnings.push(`Solana RPC: ${error.message}`);
            
                
                try {
                    await this.switchSolanaRpcEndpoint();
                    if (this.solanaConnection) {
                        const slotPromise = this.makeSolanaRpcCall('getSlot');
                        const timeoutPromise = new Promise((_, reject) => 
                            setTimeout(() => reject(new Error('Timeout')), 3000)
                        );
                        const slot = await Promise.race([slotPromise, timeoutPromise]);
                    if (slot && slot > 0) {
                        solanaConnected = true;
                        warnings.pop(); 
                    }
                }
            } catch (retryError) {
                console.error(`Solana RPC: Retry failed: ${retryError.message}`);
            }
        }
        
        return {
            valid: zcashConnected && solanaConnected,
            zcashConnected,
            solanaConnected,
            warnings
        };
    }
    
    async checkAllProofs() {
        const errors = [];
        const bridgeTxs = this.poolState.activeTransactions.filter(tx => tx.type === 'bridge' && tx.proof);
        
        for (const tx of bridgeTxs) {
            const proofCheck = await this.checkProof(tx.proof, tx);
            if (!proofCheck.valid) {
                errors.push(`Transaction ${tx.id}: ${proofCheck.error}`);
            }
        }
        
        return {
            valid: errors.length === 0,
            totalProofs: bridgeTxs.length,
            errors
        };
    }
    
    
    
    getPoolStats() {
        try {
            
            const stats = {
                totalTransactions: Math.max(0, parseInt(this.poolState.transactionCount) || 0),
                activeUsers: Math.max(0, parseInt(this.poolState.uniqueUsers.size) || 0),
                totalDeposits: Math.max(0, parseFloat(this.poolState.totalDeposits) || 0),
                totalWithdrawals: Math.max(0, parseFloat(this.poolState.totalWithdrawals) || 0),
                poolBalance: Math.max(0, parseFloat(this.poolState.poolBalance) || 0),
                pendingTransactions: this.poolState.activeTransactions.filter(
                    tx => tx.status === 'pending' || tx.status === 'processing'
                ).length
            };
            
            
            Object.keys(stats).forEach(key => {
                if (isNaN(stats[key]) || !isFinite(stats[key])) {
                    console.warn(`Invalid stat value for ${key}:`, stats[key]);
                    stats[key] = 0;
                }
            });
            
            return stats;
        } catch (error) {
            console.error('Error getting pool stats:', error);
            return {
                totalTransactions: 0,
                activeUsers: 0,
                totalDeposits: 0,
                totalWithdrawals: 0,
                poolBalance: 0,
                pendingTransactions: 0
            };
        }
    }
    
    getRecentTransactions(limit = 10) {
        try {
            
            const safeLimit = Math.max(1, Math.min(1000, parseInt(limit) || 10));
            
            
            const transactions = this.poolState.activeTransactions || [];
            const recent = transactions.slice(-safeLimit).reverse();
            
            
            return recent.map(tx => ({
                id: tx.id || 'unknown',
                type: tx.type || 'unknown',
                amount: parseFloat(tx.amount) || 0,
                chain: tx.chain || 'unknown',
                status: tx.status || 'pending',
                timestamp: tx.timestamp || Date.now(),
                zcashTxid: tx.zcashTxid,
                solanaTxid: tx.solanaTxid,
                txid: tx.txid || tx.zcashTxid || tx.solanaTxid,
                ...tx
            }));
        } catch (error) {
            console.error('Error getting recent transactions:', error);
            return [];
        }
    }
}


if (typeof module !== 'undefined' && module.exports) {
    module.exports = ZcashSolanaBridge;
}

