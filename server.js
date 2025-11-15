require('dotenv').config();
const express = require('express');
const cors = require('cors');
const fetch = require('node-fetch');
const path = require('path');
const fs = require('fs');
const { Connection, PublicKey, Keypair, Transaction, TransactionInstruction, SystemProgram, sendAndConfirmTransaction, LAMPORTS_PER_SOL } = require('@solana/web3.js');
const { StakePoolLayout, depositSol, withdrawSol, findWithdrawAuthorityProgramAddress } = require('@solana/spl-stake-pool');
const { getAssociatedTokenAddress, createAssociatedTokenAccountInstruction, getAccount, TOKEN_PROGRAM_ID } = require('@solana/spl-token');
const bs58 = require('bs58');

const app = express();
const PORT = process.env.PORT || 3000;

// Load service account credentials for Google Sheets
let serviceAccount = null;
const serviceAccountPath = path.join(__dirname, 'gen-lang-client-0795253847-40a86032d27e.json');
if (fs.existsSync(serviceAccountPath)) {
    serviceAccount = JSON.parse(fs.readFileSync(serviceAccountPath, 'utf8'));
    console.log('✅ Service account loaded for Google Sheets');
} else {
    console.warn('⚠️ Service account file not found - Google Sheets integration will not work');
}

app.use(cors({
    origin: '*',
    methods: ['GET', 'POST', 'OPTIONS'],
    allowedHeaders: ['Content-Type', 'Authorization']
}));

app.options('*', (req, res) => {
    res.header('Access-Control-Allow-Origin', '*');
    res.header('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
    res.header('Access-Control-Allow-Headers', 'Content-Type, Authorization');
    res.sendStatus(200);
});

app.use(express.json());
// Don't serve static files for API routes - API routes must be checked first
// Static files will be served only if no API route matches (handled later)

// RATE LIMITING - Prevent abuse
const rateLimitMap = new Map();
const RATE_LIMIT_WINDOW = 60000; // 1 minute
const RATE_LIMIT_MAX_REQUESTS = 100; // Max requests per window per IP

function rateLimitMiddleware(req, res, next) {
    const ip = req.ip || req.connection.remoteAddress || 'unknown';
    const now = Date.now();
    
    if (!rateLimitMap.has(ip)) {
        rateLimitMap.set(ip, { count: 0, resetTime: now + RATE_LIMIT_WINDOW });
    }
    
    const limit = rateLimitMap.get(ip);
    
    if (now > limit.resetTime) {
        limit.count = 0;
        limit.resetTime = now + RATE_LIMIT_WINDOW;
    }
    
    if (limit.count >= RATE_LIMIT_MAX_REQUESTS) {
        return res.status(429).json({ 
            error: 'Rate limit exceeded', 
            retryAfter: Math.ceil((limit.resetTime - now) / 1000) 
        });
    }
    
    limit.count++;
    next();
}

// PERFORMANCE MONITORING
const performanceStats = {
    requests: 0,
    errors: 0,
    avgResponseTime: 0,
    responseTimes: [],
    endpoints: {}
};

function performanceMiddleware(req, res, next) {
    const startTime = Date.now();
    const endpoint = `${req.method} ${req.path}`;
    
    res.on('finish', () => {
        const responseTime = Date.now() - startTime;
        performanceStats.requests++;
        
        if (!performanceStats.endpoints[endpoint]) {
            performanceStats.endpoints[endpoint] = {
                count: 0,
                totalTime: 0,
                errors: 0,
                minTime: Infinity,
                maxTime: 0
            };
        }
        
        const stats = performanceStats.endpoints[endpoint];
        stats.count++;
        stats.totalTime += responseTime;
        stats.minTime = Math.min(stats.minTime, responseTime);
        stats.maxTime = Math.max(stats.maxTime, responseTime);
        
        if (res.statusCode >= 400) {
            stats.errors++;
            performanceStats.errors++;
        }
        
        performanceStats.responseTimes.push(responseTime);
        if (performanceStats.responseTimes.length > 1000) {
            performanceStats.responseTimes.shift();
        }
        
        performanceStats.avgResponseTime = performanceStats.responseTimes.reduce((a, b) => a + b, 0) / performanceStats.responseTimes.length;
    });
    
    next();
}

app.use(rateLimitMiddleware);
app.use(performanceMiddleware);

const ZCASH_RPC_URL = process.env.ZCASH_RPC_URL || 'https://zec.nownodes.io';
const ZCASH_RPC_USER = process.env.ZCASH_RPC_USER || '302b8045-dc7d-4e77-9ba8-b87b8fb4937b';

// Solana connection and staking pool configuration - Premium endpoints first
const SOLANA_RPC_URLS = process.env.SOLANA_RPC_URLS ? process.env.SOLANA_RPC_URLS.split(',') : [
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

const SOLANA_RPC_URL = process.env.SOLANA_RPC_URL || SOLANA_RPC_URLS[0];

// Marinade Finance Stake Pool (mSOL) - Official Solana liquid staking
const MARINADE_STAKE_POOL = new PublicKey('7gpj9jdSyK4Bhc2gihKJYH22s16f3TFDud4V5xynw3Gp');
const MARINADE_MSOL_MINT = new PublicKey('mSoLzYCxHdYgdzU16g5QSh3i5K3z3KZK7ytfqcJm7So');

// Jito Stake Pool (JitoSOL) - MEV optimized staking
const JITO_STAKE_POOL = new PublicKey('Jito4APyf642JPZPx3hGc6WWJ8zPKtRbRs4P815Awbb');
const JITO_JITOSOL_MINT = new PublicKey('J1toso1uCk3RLmjorhTtrVwY9HJ7X8V9yYac6Y7kGCPn');

// BlazeStake (bSOL) - Solana Foundation endorsed
const BLAZE_STAKE_POOL = new PublicKey('stk9ApL5HeVAwPLr3TLhDXdZS8ptVu7zp6ov8HFDuMi');
const BLAZE_BSOL_MINT = new PublicKey('bSo13r4TkiE4KumL71LsHTPpL2euBYLFx6h9HP3piy1');

let solanaConnection = null;
let currentRpcIndex = 0;

// Initialize Solana connection with fallback RPCs
async function initSolanaConnection() {
    for (let i = 0; i < SOLANA_RPC_URLS.length; i++) {
        const rpcUrl = SOLANA_RPC_URLS[i];
        try {
            const testConnection = new Connection(rpcUrl, 'confirmed');
            const slot = await Promise.race([
                testConnection.getSlot(),
                new Promise((_, reject) => setTimeout(() => reject(new Error('Timeout')), 5000))
            ]);
            
            if (slot && slot > 0) {
                solanaConnection = testConnection;
                currentRpcIndex = i;
                console.log(`✅ Solana RPC connected: ${rpcUrl} (slot: ${slot})`);
                return;
            }
} catch (error) {
            console.warn(`⚠️ Failed to connect to ${rpcUrl}: ${error.message}`);
            continue;
        }
    }
    
    // Fallback to first RPC even if test fails
    solanaConnection = new Connection(SOLANA_RPC_URLS[0], 'confirmed');
    console.warn(`⚠️ Using fallback RPC: ${SOLANA_RPC_URLS[0]}`);
}

// Initialize connection
initSolanaConnection().catch(error => {
    console.error('Failed to initialize Solana connection:', error);
    solanaConnection = new Connection(SOLANA_RPC_URLS[0], 'confirmed');
});

// Staking pool selection (default to Marinade)
const DEFAULT_STAKE_POOL = process.env.STAKE_POOL || 'marinade';
const STAKE_POOLS = {
    marinade: { pool: MARINADE_STAKE_POOL, mint: MARINADE_MSOL_MINT, name: 'Marinade (mSOL)', apy: 7.5 },
    jito: { pool: JITO_STAKE_POOL, mint: JITO_JITOSOL_MINT, name: 'Jito (JitoSOL)', apy: 6.96 },
    blaze: { pool: BLAZE_STAKE_POOL, mint: BLAZE_BSOL_MINT, name: 'BlazeStake (bSOL)', apy: 6.23 }
};

const selectedPool = STAKE_POOLS[DEFAULT_STAKE_POOL] || STAKE_POOLS.marinade;
console.log(`Using stake pool: ${selectedPool.name}`);

// In-memory staking records (in production, use a database)
const stakingRecords = new Map();

// Handle OPTIONS preflight for Zcash RPC
app.options('/api/zcash-rpc', (req, res) => {
    res.setHeader('Access-Control-Allow-Origin', '*');
    res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
    res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
    res.status(200).end();
});

app.post('/api/zcash-rpc', async (req, res) => {
    // Set CORS headers
    res.setHeader('Content-Type', 'application/json');
    res.setHeader('Access-Control-Allow-Origin', '*');
    res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
    res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
    
    try {
        const { method, params } = req.body;
        
        // VALIDATION
        if (!method || typeof method !== 'string') {
            return res.status(400).json({ error: 'Method is required and must be a string' });
        }
        
        // ALLOWED METHODS - Security check (expanded to include shielded address methods)
        const allowedMethods = [
            'getinfo', 'getblockchaininfo', 'getnetworkinfo', 'getblock', 
            'getrawtransaction', 'getbalance', 'listtransactions',
            'z_getnewaddress', 'z_listaddresses', 'z_getbalance', 'z_listunspent',
            'z_sendmany', 'z_shieldcoinbase', 'z_getoperationstatus', 'z_getoperationresult'
        ];
        if (!allowedMethods.includes(method.toLowerCase())) {
            return res.status(403).json({ error: `Method ${method} not allowed` });
        }
        
        const rpcUrl = ZCASH_RPC_USER ? `${ZCASH_RPC_URL}/${ZCASH_RPC_USER}` : ZCASH_RPC_URL;
        
        const controller = new AbortController();
        const timeoutId = setTimeout(() => controller.abort(), 15000);
        
        try {
            const response = await fetch(rpcUrl, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json'
                },
                body: JSON.stringify({
                    jsonrpc: '2.0',
                    id: 1,
                    method: method,
                    params: params || []
                }),
                signal: controller.signal
            });
            
            clearTimeout(timeoutId);
            
            if (!response.ok) {
                const errorText = await response.text();
                return res.status(response.status).json({ 
                    error: `RPC HTTP ${response.status}: ${errorText}` 
                });
            }
            
            const data = await response.json();
            
            if (data.error) {
                return res.status(400).json({ 
                    error: `RPC error: ${data.error.message || JSON.stringify(data.error)}` 
                });
            }
            
            res.json({ result: data.result });
        } catch (fetchError) {
            clearTimeout(timeoutId);
            if (fetchError.name === 'AbortError') {
                return res.status(504).json({ error: 'RPC request timeout' });
            }
            throw fetchError;
        }
    } catch (error) {
        console.error('Zcash RPC proxy error:', error);
        res.status(500).json({ 
            error: `Proxy error: ${error.message}` 
        });
    }
});

// ========== STAKING ENDPOINTS ==========

// SMART CONTRACT STAKING ENDPOINT - Uses custom Solana program
app.post('/api/oracle/stake', async (req, res) => {
    // ALWAYS return JSON - prevent HTML errors
    res.setHeader('Content-Type', 'application/json');
    
    try {
        const { nodeAddress, amount } = req.body;
        
        // VALIDATION
        if (!nodeAddress || typeof nodeAddress !== 'string') {
            return res.status(400).json({ success: false, error: 'Valid nodeAddress is required' });
        }
        
        if (!amount || typeof amount !== 'number' || amount <= 0) {
            return res.status(400).json({ success: false, error: 'Valid amount > 0 is required' });
        }
        
        if (amount < 0.1) {
            return res.status(400).json({ success: false, error: 'Minimum stake amount is 0.1 SOL' });
        }
        
        if (!solanaConnection) {
            return res.status(500).json({ success: false, error: 'Solana connection not available' });
        }
        
        const userPubkey = new PublicKey(nodeAddress);
        const stakeAmount = Math.floor(parseFloat(amount) * LAMPORTS_PER_SOL);
        
        // SMART CONTRACT PROGRAM ID
        const PROGRAM_ID = new PublicKey('Fg6PaFpoGXkYsidMpWTK6W2BeZ7FEfcYkg476zPFsLnS');
        
        // Derive PDAs for smart contract
        const [stakingPoolPDA] = await PublicKey.findProgramAddress(
            [Buffer.from('staking_pool')],
            PROGRAM_ID
        );
        
        const [nodeStakePDA, nodeStakeBump] = await PublicKey.findProgramAddress(
            [Buffer.from('node_stake'), userPubkey.toBuffer()],
            PROGRAM_ID
        );
        
        // Create stake instruction for smart contract
        const transaction = new Transaction();
        
        // Create stake instruction for smart contract
        const instructionData = Buffer.allocUnsafe(9);
        instructionData.writeUInt8(1, 0); // Instruction discriminator (1 = stake)
        instructionData.writeBigUInt64LE(BigInt(stakeAmount), 1); // Amount as u64
        
        const stakeIx = new TransactionInstruction({
            programId: PROGRAM_ID,
            keys: [
                { pubkey: stakingPoolPDA, isSigner: false, isWritable: true },
                { pubkey: nodeStakePDA, isSigner: false, isWritable: true },
                { pubkey: userPubkey, isSigner: true, isWritable: true },
                { pubkey: SystemProgram.programId, isSigner: false, isWritable: false }
            ],
            data: instructionData
        });
        
        transaction.add(stakeIx);
        
        const { blockhash } = await solanaConnection.getLatestBlockhash('confirmed');
        transaction.recentBlockhash = blockhash;
        transaction.feePayer = userPubkey;
        
        // Serialize transaction for client to sign
        const serialized = transaction.serialize({ requireAllSignatures: false }).toString('base64');
        
        // Store pending stake record
        const record = {
            nodeAddress,
            amount: parseFloat(amount),
            stakedAt: Date.now(),
            pending: true,
            contractType: 'smart_contract',
            programId: PROGRAM_ID.toString(),
            stakingPoolPDA: stakingPoolPDA.toString(),
            nodeStakePDA: nodeStakePDA.toString()
        };
        
        stakingRecords.set(nodeAddress, record);
        
        res.json({
            success: true,
            transaction: serialized,
            stakePool: 'Oracle Staking Smart Contract',
            poolAddress: stakingPoolPDA.toString(),
            programId: PROGRAM_ID.toString(),
            estimatedAPY: 7.5,
            nodeStakePDA: nodeStakePDA.toString(),
            contractType: 'smart_contract'
        });
        
    } catch (error) {
        console.error('Stake error:', error);
        // ALWAYS return JSON - never HTML
        if (!res.headersSent) {
            res.status(500).json({ 
                success: false,
                error: error.message || 'Unknown error occurred',
                details: process.env.NODE_ENV === 'development' ? error.stack : undefined
            });
        }
    }
});

// Complete stake (after user signs transaction)
app.post('/api/oracle/stake/complete', async (req, res) => {
    res.setHeader('Content-Type', 'application/json');
    res.setHeader('Access-Control-Allow-Origin', '*');
    try {
        const { nodeAddress, signature } = req.body;
        
        if (!nodeAddress || !signature) {
            return res.status(400).json({ error: 'Missing required fields' });
        }
        
        const record = stakingRecords.get(nodeAddress);
        if (!record || !record.pending) {
            return res.status(400).json({ error: 'No pending stake found' });
        }
        
        // Verify transaction
        const tx = await solanaConnection.getTransaction(signature, { commitment: 'confirmed' });
        if (!tx || tx.meta?.err) {
            return res.status(400).json({ error: 'Transaction failed' });
        }
        
        record.pending = false;
        record.signature = signature;
        stakingRecords.set(nodeAddress, record);
        
        res.json({ success: true, signature });
    } catch (error) {
        console.error('Complete stake error:', error);
        res.status(500).json({ error: error.message });
    }
});

// Get REAL stake pool info from APIs
async function getStakePoolInfo(poolName) {
    const pool = STAKE_POOLS[poolName] || selectedPool;
    
    try {
        // Try to get REAL data from on-chain first
        const stakePoolAccount = await solanaConnection.getAccountInfo(pool.pool);
        if (stakePoolAccount) {
            try {
        const stakePoolData = StakePoolLayout.decode(stakePoolAccount.data);
                const totalStaked = Number(stakePoolData.totalLamports) / LAMPORTS_PER_SOL;
                
                // Get REAL APY from Marinade/Jito/BlazeStake APIs
                let realAPY = pool.apy;
                try {
                    if (poolName === 'marinade') {
                        // Marinade Finance API
                        const marinadeResponse = await fetch('https://api.marinade.finance/msol/price_sol');
                        if (marinadeResponse.ok) {
                            const marinadeData = await marinadeResponse.json();
                            // Calculate APY from price ratio
                            if (marinadeData && marinadeData.value) {
                                // APY calculation based on mSOL/SOL ratio growth
                                realAPY = marinadeData.apy || pool.apy;
                            }
                        }
                    } else if (poolName === 'jito') {
                        // Jito API - get real staking data
                        const jitoResponse = await fetch('https://api.jito.wtf/api/v1/staking/apy');
                        if (jitoResponse.ok) {
                            const jitoData = await jitoResponse.json();
                            if (jitoData && jitoData.apy) {
                                realAPY = parseFloat(jitoData.apy) * 100;
                            }
                        }
                    } else if (poolName === 'blaze') {
                        // BlazeStake API
                        const blazeResponse = await fetch('https://api.blazestake.com/v1/pool/stats');
                        if (blazeResponse.ok) {
                            const blazeData = await blazeResponse.json();
                            if (blazeData && blazeData.apy) {
                                realAPY = parseFloat(blazeData.apy) * 100;
                            }
                        }
                    }
                } catch (apiError) {
                    // Use default APY if API fails
                    console.log(`Using default APY for ${poolName}`);
                }
                
        return {
                    totalStaked: totalStaked,
                    totalStakeAccounts: Number(stakePoolData.validatorList) || 0,
                    apy: realAPY,
                    name: pool.name,
                    poolAddress: pool.pool.toString(),
                    mintAddress: pool.mint.toString(),
                    realTime: true
                };
            } catch (decodeError) {
                // Decode failed, use API data
            }
        }
        
        // Fallback: Use API data if on-chain fails
        let realAPY = pool.apy;
        let totalStaked = 0;
        
        try {
            if (poolName === 'marinade') {
                const marinadeResponse = await fetch('https://api.marinade.finance/msol/price_sol');
                if (marinadeResponse.ok) {
                    const marinadeData = await marinadeResponse.json();
                    realAPY = marinadeData.apy || pool.apy;
                    totalStaked = marinadeData.totalStaked || 0;
                }
            } else if (poolName === 'jito') {
                const jitoResponse = await fetch('https://api.jito.wtf/api/v1/staking/apy');
                if (jitoResponse.ok) {
                    const jitoData = await jitoResponse.json();
                    if (jitoData && jitoData.apy) {
                        realAPY = parseFloat(jitoData.apy) * 100;
                    }
                    totalStaked = jitoData.totalStaked || 0;
                }
            } else if (poolName === 'blaze') {
                const blazeResponse = await fetch('https://api.blazestake.com/v1/pool/stats');
                if (blazeResponse.ok) {
                    const blazeData = await blazeResponse.json();
                    if (blazeData && blazeData.apy) {
                        realAPY = parseFloat(blazeData.apy) * 100;
                    }
                    totalStaked = blazeData.totalStaked || 0;
                }
            }
        } catch (apiError) {
            console.log(`API fetch failed for ${poolName}, using defaults`);
        }
        
        return {
            totalStaked: totalStaked,
            totalStakeAccounts: 0,
            apy: realAPY,
            name: pool.name,
            poolAddress: pool.pool.toString(),
            mintAddress: pool.mint.toString(),
            realTime: false
        };
    } catch (error) {
        console.error('Error getting stake pool info:', error);
        return {
            totalStaked: 0,
            totalStakeAccounts: 0,
            apy: pool.apy,
            name: pool.name,
            poolAddress: pool.pool.toString(),
            mintAddress: pool.mint.toString(),
            realTime: false
        };
    }
}

// Unstake from liquid staking pool
app.post('/api/oracle/unstake', async (req, res) => {
    res.setHeader('Content-Type', 'application/json');
    res.setHeader('Access-Control-Allow-Origin', '*');
    try {
        const { nodeAddress, amount, pool = DEFAULT_STAKE_POOL } = req.body;
        
        if (!nodeAddress || !amount) {
            return res.status(400).json({ error: 'Missing required fields' });
        }
        
        const stakePool = STAKE_POOLS[pool] || selectedPool;
        const userPubkey = new PublicKey(nodeAddress);
        const unstakeAmount = parseFloat(amount) * LAMPORTS_PER_SOL;
        
        if (unstakeAmount <= 0) {
            return res.status(400).json({ error: 'Invalid unstake amount' });
        }
        
        // Get user's liquid staking token balance (mSOL/JitoSOL/bSOL)
        const tokenAccount = await getAssociatedTokenAddress(stakePool.mint, userPubkey);
        let tokenBalance = 0;
        
        try {
            const account = await getAccount(solanaConnection, tokenAccount);
            tokenBalance = Number(account.amount);
        } catch (error) {
            return res.status(400).json({ error: 'No staking tokens found. Please stake first.' });
        }
        
        if (tokenBalance < unstakeAmount) {
            return res.status(400).json({ error: 'Insufficient staking tokens' });
        }
        
        // Create withdraw transaction
        const transaction = new Transaction();
        
        // Withdraw SOL from stake pool using SPL stake pool program
        try {
            const withdrawIx = await withdrawSol(
                solanaConnection,
                stakePool.pool,
                userPubkey,
                unstakeAmount
            );
            
            if (Array.isArray(withdrawIx)) {
                transaction.add(...withdrawIx);
            } else if (withdrawIx.instructions) {
                transaction.add(...withdrawIx.instructions);
            } else {
                transaction.add(withdrawIx);
            }
        } catch (error) {
            console.error('Withdraw instruction error:', error);
            throw new Error(`Failed to create withdraw instruction: ${error.message}`);
        }
        
        const { blockhash } = await solanaConnection.getLatestBlockhash('confirmed');
        transaction.recentBlockhash = blockhash;
        transaction.feePayer = userPubkey;
        
        // Serialize transaction for client to sign
        const serialized = transaction.serialize({ requireAllSignatures: false }).toString('base64');
        
        res.json({
            success: true,
            transaction: serialized,
            unstakeAmount: parseFloat(amount),
            stakePool: stakePool.name
        });
        
    } catch (error) {
        console.error('Unstaking error:', error);
        res.status(500).json({ 
            error: error.message || 'Failed to process unstaking request' 
        });
    }
});

// Send transaction endpoint (for when frontend connection is unavailable)
app.post('/api/oracle/send-transaction', async (req, res) => {
    res.setHeader('Content-Type', 'application/json');
    res.setHeader('Access-Control-Allow-Origin', '*');
    try {
        const { transaction } = req.body;
        
        if (!transaction || typeof transaction !== 'string') {
            return res.status(400).json({ success: false, error: 'Valid transaction is required' });
        }
        
        if (!solanaConnection) {
            return res.status(500).json({ success: false, error: 'Solana connection not available' });
        }
        
        // Convert string to Buffer
        const txBuffer = Buffer.from(transaction, 'binary');
        
        // Send transaction
        const signature = await solanaConnection.sendRawTransaction(txBuffer, {
            skipPreflight: false,
            maxRetries: 3,
            preflightCommitment: 'confirmed'
        });
        
        res.json({ success: true, signature });
    } catch (error) {
        console.error('Send transaction error:', error);
        res.status(500).json({ success: false, error: error.message });
    }
});

// Verify transaction endpoint
app.post('/api/oracle/verify-transaction', async (req, res) => {
    res.setHeader('Content-Type', 'application/json');
    res.setHeader('Access-Control-Allow-Origin', '*');
    try {
        const { signature } = req.body;
        
        if (!signature || typeof signature !== 'string') {
            return res.status(400).json({ success: false, error: 'Valid signature is required' });
        }
        
        if (!solanaConnection) {
            return res.status(500).json({ success: false, error: 'Solana connection not available' });
        }
        
        // Verify transaction
        const tx = await solanaConnection.getTransaction(signature, { commitment: 'confirmed' });
        
        if (!tx) {
            return res.json({ confirmed: false, error: 'Transaction not found' });
        }
        
        if (tx.meta?.err) {
            return res.json({ confirmed: false, error: `Transaction failed: ${JSON.stringify(tx.meta.err)}` });
        }
        
        res.json({ confirmed: true, transaction: tx });
    } catch (error) {
        console.error('Transaction verification error:', error);
        res.status(500).json({ success: false, error: error.message });
    }
});

// Get staking info for a node
app.get('/api/oracle/staking-info/:nodeAddress', async (req, res) => {
    res.setHeader('Content-Type', 'application/json');
    res.setHeader('Access-Control-Allow-Origin', '*');
    try {
        const { nodeAddress } = req.params;
        const { pool = DEFAULT_STAKE_POOL } = req.query;
        
        const stakePool = STAKE_POOLS[pool] || selectedPool;
        const userPubkey = new PublicKey(nodeAddress);
        
        // Get liquid staking token balance
        let tokenBalance = 0;
        let hasTokens = false;
        
        try {
            const tokenAccount = await getAssociatedTokenAddress(stakePool.mint, userPubkey);
            const account = await getAccount(solanaConnection, tokenAccount);
            tokenBalance = Number(account.amount) / LAMPORTS_PER_SOL;
            hasTokens = tokenBalance > 0;
        } catch (error) {
            // No tokens yet
        }
        
        const poolInfo = await getStakePoolInfo(pool);
        
        res.json({
            staked: hasTokens,
            stake: tokenBalance,
            stakePool: stakePool.name,
            poolInfo: poolInfo,
            apy: stakePool.apy,
            mintAddress: stakePool.mint.toString(),
            poolAddress: stakePool.pool.toString(),
            canUnstake: hasTokens
        });
    } catch (error) {
        console.error('Get staking info error:', error);
        res.status(500).json({ error: error.message });
    }
});

// Get available stake pools
app.get('/api/oracle/stake-pools', async (req, res) => {
    res.setHeader('Content-Type', 'application/json');
    res.setHeader('Access-Control-Allow-Origin', '*');
    try {
        const pools = await Promise.all(
            Object.entries(STAKE_POOLS).map(async ([key, pool]) => {
                const info = await getStakePoolInfo(key);
                return {
                    id: key,
                    name: pool.name,
                    apy: pool.apy,
                    poolAddress: pool.pool.toString(),
                    mintAddress: pool.mint.toString(),
                    info: info
                };
            })
        );
        
        res.json({ pools });
    } catch (error) {
        console.error('Get stake pools error:', error);
        res.status(500).json({ error: error.message });
    }
});

// ========== PROOF VERIFICATION ENDPOINTS ==========

// Verify feed proof
app.post('/api/oracle/verify-proof', async (req, res) => {
    try {
        const { feedId, entryIndex } = req.body;
        
        if (!feedId) {
            return res.status(400).json({ error: 'Feed ID is required' });
        }
        
        // This would need access to oracle instance - for now return structure
        // In production, you'd pass oracle instance or use a shared state
        res.json({
            success: true,
            message: 'Proof verification endpoint - integrate with oracle instance',
            feedId: feedId,
            entryIndex: entryIndex || null
        });
    } catch (error) {
        console.error('Verify proof error:', error);
        res.status(500).json({ error: error.message });
    }
});

// Get proof status for a feed
app.get('/api/oracle/proof-status/:feedId', async (req, res) => {
    try {
        const { feedId } = req.params;
        
        // This would need access to oracle instance
        res.json({
            success: true,
            message: 'Proof status endpoint - integrate with oracle instance',
            feedId: feedId
        });
    } catch (error) {
        console.error('Get proof status error:', error);
        res.status(500).json({ error: error.message });
    }
});

app.get('/health', (req, res) => {
    res.json({ 
        status: 'ok', 
        service: 'zcash-rpc-proxy',
        solanaConnected: !!solanaConnection,
        stakePools: Object.keys(STAKE_POOLS).length,
        defaultPool: selectedPool.name,
        uptime: process.uptime(),
        memory: process.memoryUsage()
    });
});

// PERFORMANCE STATS ENDPOINT - Internal only
app.get('/api/internal/stats', (req, res) => {
    const endpointStats = {};
    for (const [endpoint, stats] of Object.entries(performanceStats.endpoints)) {
        if (stats.count > 0) {
            endpointStats[endpoint] = {
                requests: stats.count,
                avgResponseTime: stats.totalTime / stats.count,
                minResponseTime: stats.minTime === Infinity ? 0 : stats.minTime,
                maxResponseTime: stats.maxTime,
                errorRate: (stats.errors / stats.count) * 100
            };
        }
    }
    
    res.json({
        totalRequests: performanceStats.requests,
        totalErrors: performanceStats.errors,
        avgResponseTime: performanceStats.avgResponseTime,
        errorRate: performanceStats.requests > 0 ? (performanceStats.errors / performanceStats.requests) * 100 : 0,
        endpoints: endpointStats,
        rateLimits: Array.from(rateLimitMap.entries()).map(([ip, limit]) => ({
            ip: ip.substring(0, 8) + '...',
            requests: limit.count,
            resetIn: Math.max(0, Math.ceil((limit.resetTime - Date.now()) / 1000))
        }))
    });
});

// Serve static files ONLY for non-API routes (after all API routes)
app.use((req, res, next) => {
    // If it's an API route, don't serve static files - let 404 handler catch it
    if (req.path.startsWith('/api/')) {
        return next();
    }
    // Serve static files for non-API routes
    express.static('.')(req, res, next);
});

// 404 handler - return JSON for API routes, HTML for others
app.use((req, res) => {
    if (req.path.startsWith('/api/')) {
        // API routes - return JSON
        res.setHeader('Content-Type', 'application/json');
        res.status(404).json({ 
            success: false,
            error: `Endpoint not found: ${req.method} ${req.path}`,
            availableEndpoints: [
                'POST /api/zcash-rpc',
                'POST /api/oracle/stake',
                'POST /api/oracle/unstake',
                'GET /api/oracle/stake-pools',
                'GET /api/oracle/staking-info/:nodeAddress',
                'GET /api/proxy/coingecko/*',
                'POST /api/cheat-report',
                'POST /api/oracle/verify-transaction',
                'POST /api/oracle/send-transaction'
            ]
        });
    } else {
        // Non-API routes - serve index.html for SPA
        res.sendFile(path.join(__dirname, 'index.html'));
    }
});

// ERROR HANDLING MIDDLEWARE - Must be last
app.use((err, req, res, next) => {
    console.error('Server Error:', err);
    performanceStats.errors++;
    
    // ALWAYS return JSON - never HTML
    if (!res.headersSent) {
        res.setHeader('Content-Type', 'application/json');
        res.status(500).json({ 
            success: false,
            error: 'Internal server error',
            message: process.env.NODE_ENV === 'development' ? err.message : 'An error occurred',
            details: process.env.NODE_ENV === 'development' ? err.stack : undefined
        });
    }
});

// CORS proxy for CoinGecko API
app.get('/api/proxy/coingecko/*', async (req, res) => {
    res.setHeader('Access-Control-Allow-Origin', '*');
    res.setHeader('Content-Type', 'application/json');
    try {
        const path = req.params[0] || '';
        const queryString = req.url.includes('?') ? req.url.substring(req.url.indexOf('?')) : '';
        const url = `https://api.coingecko.com/api/v3/${path}${queryString}`;
        
        const response = await fetch(url, {
            headers: {
                'Accept': 'application/json'
            }
        });
        
        if (!response.ok) {
            return res.status(response.status).json({ error: 'CoinGecko API error' });
        }
        
        const data = await response.json();
        res.json(data);
    } catch (error) {
        console.error('CoinGecko proxy error:', error);
        res.status(500).json({ error: error.message });
    }
});

// Anti-cheat report endpoint
app.post('/api/cheat-report', async (req, res) => {
    res.setHeader('Content-Type', 'application/json');
    res.setHeader('Access-Control-Allow-Origin', '*');
    try {
        const { wallet, reason, evidence } = req.body;
        console.log('Cheat report received:', { wallet, reason });
        // In production, store in database
        res.json({ success: true, message: 'Report received' });
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});

// ==================== LEADERBOARD API ====================
// In-memory storage (in production, use a real database)
let leaderboard = [];
let scoreHashes = new Map(); // Store hashes to prevent manipulation

// Middleware to validate score submissions
function validateScore(req, res, next) {
    const { wallet, score, time, signature, hash } = req.body;
    
    if (!wallet || !score || !time || !signature || !hash) {
        res.setHeader('Content-Type', 'application/json');
        res.setHeader('Access-Control-Allow-Origin', '*');
        return res.status(400).json({ error: 'Missing required fields' });
    }
    
    // Validate score is reasonable (max 1 million)
    if (score > 1000000 || score < 0) {
        res.setHeader('Content-Type', 'application/json');
        res.setHeader('Access-Control-Allow-Origin', '*');
        return res.status(400).json({ error: 'Invalid score' });
    }
    
    // Check if hash was already submitted (prevent replay)
    if (scoreHashes.has(hash)) {
        res.setHeader('Content-Type', 'application/json');
        res.setHeader('Access-Control-Allow-Origin', '*');
        return res.status(400).json({ error: 'Score already submitted' });
    }
    
    next();
}

// Submit score
app.post('/api/leaderboard/submit', validateScore, (req, res) => {
    res.setHeader('Content-Type', 'application/json');
    res.setHeader('Access-Control-Allow-Origin', '*');
    
    const { wallet, score, time, signature, hash, difficulty } = req.body;
    
    // Store hash to prevent replay
    scoreHashes.set(hash, true);
    
    // Add to leaderboard
    const entry = {
        wallet: wallet.substring(0, 8) + '...' + wallet.substring(wallet.length - 8),
        fullWallet: wallet, // Store full wallet for verification
        score: parseInt(score),
        time: parseInt(time),
        scorePerSecond: time > 0 ? (score / (time / 1000)).toFixed(2) : 0,
        difficulty: difficulty || 1,
        signature: signature,
        timestamp: Date.now(),
        hash: hash
    };
    
    leaderboard.push(entry);
    
    // Sort by score (descending)
    leaderboard.sort((a, b) => b.score - a.score);
    
    // Keep top 100
    if (leaderboard.length > 100) {
        leaderboard = leaderboard.slice(0, 100);
    }
    
    const rank = leaderboard.findIndex(e => e.hash === hash) + 1;
    console.log(`📊 Score submitted: ${score} points by ${entry.wallet} (Rank: #${rank})`);
    
    res.json({ success: true, rank: rank });
});

// Get leaderboard
app.get('/api/leaderboard', (req, res) => {
    res.setHeader('Content-Type', 'application/json');
    res.setHeader('Access-Control-Allow-Origin', '*');
    
    const limit = parseInt(req.query.limit) || 50;
    const topScores = leaderboard.slice(0, limit).map((entry, index) => ({
        rank: index + 1,
        wallet: entry.wallet,
        score: entry.score,
        time: entry.time,
        scorePerSecond: entry.scorePerSecond,
        timestamp: entry.timestamp
    }));
    
    res.json({ leaderboard: topScores, total: leaderboard.length });
});

// Get user's best score
app.get('/api/leaderboard/user/:wallet', (req, res) => {
    res.setHeader('Content-Type', 'application/json');
    res.setHeader('Access-Control-Allow-Origin', '*');
    
    const wallet = req.params.wallet;
    const userScores = leaderboard.filter(e => e.fullWallet === wallet);
    
    if (userScores.length === 0) {
        return res.json({ bestScore: null, rank: null });
    }
    
    const bestScore = userScores.reduce((best, current) => 
        current.score > best.score ? current : best
    );
    
    const rank = leaderboard.findIndex(e => e.hash === bestScore.hash) + 1;
    
    res.json({ 
        bestScore: {
            score: bestScore.score,
            time: bestScore.time,
            scorePerSecond: bestScore.scorePerSecond,
            rank: rank
        }
    });
});

// Google Sheets JWT Token Generation
async function getGoogleSheetsAccessToken() {
    if (!serviceAccount) {
        throw new Error('Service account not loaded');
    }

    const jwtHeader = Buffer.from(JSON.stringify({
        alg: 'RS256',
        typ: 'JWT'
    })).toString('base64url');

    const now = Math.floor(Date.now() / 1000);
    const jwtClaimSet = {
        iss: serviceAccount.client_email,
        scope: 'https://www.googleapis.com/auth/spreadsheets',
        aud: serviceAccount.token_uri,
        exp: now + 3600,
        iat: now
    };

    const jwtClaimSetEncoded = Buffer.from(JSON.stringify(jwtClaimSet)).toString('base64url');
    const signatureInput = `${jwtHeader}.${jwtClaimSetEncoded}`;

    // Sign with private key
    const crypto = require('crypto');
    const sign = crypto.createSign('RSA-SHA256');
    sign.update(signatureInput);
    const signature = sign.sign(serviceAccount.private_key).toString('base64url');

    const jwt = `${signatureInput}.${signature}`;

    // Exchange JWT for access token
    const response = await fetch(serviceAccount.token_uri, {
        method: 'POST',
        headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
        body: `grant_type=urn:ietf:params:oauth:grant-type:jwt-bearer&assertion=${jwt}`
    });

    const data = await response.json();
    if (!response.ok) {
        throw new Error(`Failed to get access token: ${JSON.stringify(data)}`);
    }

    return data.access_token;
}

// Google Sheets API - Read scores
app.get('/api/sheets/scores', async (req, res) => {
    res.setHeader('Content-Type', 'application/json');
    res.setHeader('Access-Control-Allow-Origin', '*');

    try {
        if (!serviceAccount) {
            return res.status(500).json({ error: 'Service account not configured' });
        }

        const sheetId = req.query.sheetId || '1apjUM4vb-6TUx4cweIThML5TIKBg8E7HjLlaZyiw1e8';
        const accessToken = await getGoogleSheetsAccessToken();

        const response = await fetch(
            `https://sheets.googleapis.com/v4/spreadsheets/${sheetId}/values/Sheet1!A2:H1000`,
            {
                headers: { 'Authorization': `Bearer ${accessToken}` }
            }
        );

        if (!response.ok) {
            const error = await response.text();
            return res.status(response.status).json({ error: `Sheets API error: ${error}` });
        }

        const data = await response.json();
        const scores = (data.values || []).map(row => ({
            timestamp: row[0],
            wallet: row[1],
            score: parseInt(row[2]),
            time: parseInt(row[3]),
            scorePerSecond: parseFloat(row[4]),
            difficulty: parseInt(row[5]),
            signature: row[6],
            hash: row[7]
        }));

        res.json({ success: true, scores });
    } catch (error) {
        console.error('Error reading Google Sheets:', error);
        res.status(500).json({ error: error.message });
    }
});

// Google Sheets API - Submit score
app.post('/api/sheets/submit', async (req, res) => {
    res.setHeader('Content-Type', 'application/json');
    res.setHeader('Access-Control-Allow-Origin', '*');

    try {
        if (!serviceAccount) {
            return res.status(500).json({ success: false, error: 'Service account not configured' });
        }

        const { wallet, score, time, signature, difficulty = 1 } = req.body;

        if (!wallet || score === undefined || !time) {
            return res.status(400).json({ success: false, error: 'Missing required fields' });
        }

        const sheetId = req.body.sheetId || '1apjUM4vb-6TUx4cweIThML5TIKBg8E7HjLlaZyiw1e8';
        const accessToken = await getGoogleSheetsAccessToken();

        const timestamp = new Date().toISOString();
        const scorePerSecond = time > 0 ? (score / (time / 1000)).toFixed(2) : 0;
        
        // Generate hash
        const crypto = require('crypto');
        const hash = crypto.createHash('sha256')
            .update(`${wallet}${score}${time}${signature}`)
            .digest('hex').substring(0, 16);

        const values = [[
            timestamp,
            wallet,
            score.toString(),
            time.toString(),
            scorePerSecond,
            difficulty.toString(),
            signature || 'game-' + Date.now(),
            hash
        ]];

        console.log(`📊 [Google Sheets] Submitting score: ${score} for ${wallet.substring(0, 8)}...`);

        const response = await fetch(
            `https://sheets.googleapis.com/v4/spreadsheets/${sheetId}/values/Sheet1!A:H:append?valueInputOption=RAW`,
            {
                method: 'POST',
                headers: {
                    'Authorization': `Bearer ${accessToken}`,
                    'Content-Type': 'application/json'
                },
                body: JSON.stringify({ values })
            }
        );

        if (!response.ok) {
            const error = await response.text();
            console.error(`❌ [Google Sheets] Error:`, error);
            return res.status(response.status).json({ success: false, error: `Sheets API error: ${error}` });
        }

        const result = await response.json();
        console.log(`✅ [Google Sheets] Score saved successfully!`);

        res.json({ success: true, result });
    } catch (error) {
        console.error('❌ Error submitting to Google Sheets:', error);
        res.status(500).json({ success: false, error: error.message });
    }
});

// Health check
app.get('/api/health', (req, res) => {
    res.setHeader('Content-Type', 'application/json');
    res.setHeader('Access-Control-Allow-Origin', '*');
    res.json({ status: 'ok', entries: leaderboard.length, googleSheets: serviceAccount ? 'configured' : 'not configured' });
});

// ========== CRYPTOCOMMERCE PAYMENT API ==========

// Price cache for server.js (3 minute updates)
const priceCache = new Map();
const CACHE_DURATION = 3 * 60 * 1000; // 3 minutes
const updatePromises = new Map();

async function getCachedPriceServer(crypto, fiat) {
    const key = `${crypto.toLowerCase()}_${fiat.toLowerCase()}`;
    const cached = priceCache.get(key);
    
    if (cached && cached.expiresAt > Date.now()) {
        console.log(`📦 Using cached price for ${crypto}: $${cached.price}`);
        return cached;
    }
    
    if (updatePromises.has(key)) {
        return await updatePromises.get(key);
    }
    
    const updatePromise = fetchPriceFromCoinGeckoServer(crypto, fiat);
    updatePromises.set(key, updatePromise);
    
    try {
        return await updatePromise;
    } finally {
        updatePromises.delete(key);
    }
}

async function fetchPriceFromCoinGeckoServer(crypto, fiat) {
    const coinIdMap = {
        'sol': 'solana',
        'solana': 'solana',
        'usdc': 'usd-coin',
        'usdt': 'tether',
        'eurc': 'euro-coin',
        'btc': 'bitcoin',
        'bitcoin': 'bitcoin',
        'eth': 'ethereum',
        'ethereum': 'ethereum'
    };
    
    const coinId = coinIdMap[crypto.toLowerCase()] || crypto.toLowerCase();
    const fiatLower = fiat.toLowerCase();
    const key = `${crypto.toLowerCase()}_${fiatLower}`;
    
    for (let attempt = 1; attempt <= 3; attempt++) {
            try {
                const coingeckoUrl = `https://api.coingecko.com/api/v3/simple/price?ids=${coinId}&vs_currencies=${fiatLower}`;
                console.log(`🔍 [Attempt ${attempt}/3] Fetching price from CoinGecko: ${coingeckoUrl}`);
                
                const controller = new AbortController();
                const timeoutId = setTimeout(() => controller.abort(), 15000);
                
                const response = await fetch(coingeckoUrl, {
                    headers: {
                        'Accept': 'application/json',
                        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36',
                        'Accept-Language': 'en-US,en;q=0.9'
                    },
                    signal: controller.signal
                });
                
                clearTimeout(timeoutId);
                
                if (response.ok) {
                    const data = await response.json();
                    const price = data[coinId]?.[fiatLower];
                    if (price && price > 0) {
                        const cacheEntry = {
                            price: price,
                            fetchedAt: Date.now(),
                            expiresAt: Date.now() + CACHE_DURATION,
                            source: 'coingecko-direct'
                        };
                        priceCache.set(key, cacheEntry);
                        console.log(`✅ Got real price for ${crypto}: $${price} (cached for 3 minutes)`);
                        return cacheEntry;
                    }
                } else {
                    const errorText = await response.text();
                    console.warn(`❌ CoinGecko API returned status ${response.status}: ${errorText}`);
                    if (attempt < 3) {
                        await new Promise(resolve => setTimeout(resolve, 1000 * attempt));
                        continue;
                    }
                }
            } catch (error) {
                if (error.name === 'AbortError') {
                    console.error(`❌ CoinGecko API timeout (attempt ${attempt}/3)`);
                } else {
                    console.error(`❌ CoinGecko API failed (attempt ${attempt}/3):`, error.message);
                }
                if (attempt < 3) {
                    await new Promise(resolve => setTimeout(resolve, 1000 * attempt));
                    continue;
                }
            }
        }
        
        // Try search method
        try {
            const searchUrl = `https://api.coingecko.com/api/v3/search?query=${coinId}`;
            const controller = new AbortController();
            const timeoutId = setTimeout(() => controller.abort(), 15000);
            
            const searchResponse = await fetch(searchUrl, {
                headers: {
                    'Accept': 'application/json',
                    'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36'
                },
                signal: controller.signal
            });
            
            clearTimeout(timeoutId);
            
            if (searchResponse.ok) {
                const searchData = await searchResponse.json();
                if (searchData.coins && searchData.coins.length > 0) {
                    const foundCoinId = searchData.coins[0].id;
                    const priceUrl = `https://api.coingecko.com/api/v3/simple/price?ids=${foundCoinId}&vs_currencies=${fiatLower}`;
                    
                    const priceResponse = await fetch(priceUrl, {
                        headers: {
                            'Accept': 'application/json',
                            'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36'
                        },
                        signal: controller.signal
                    });
                    
                    if (priceResponse.ok) {
                        const priceData = await priceResponse.json();
                        const price = priceData[foundCoinId]?.[fiatLower];
                        if (price && price > 0) {
                            const cacheEntry = {
                                price: price,
                                fetchedAt: Date.now(),
                                expiresAt: Date.now() + CACHE_DURATION,
                                source: 'coingecko-search'
                            };
                            priceCache.set(key, cacheEntry);
                            console.log(`✅ Got real price via search for ${crypto}: $${price} (cached for 3 minutes)`);
                            return cacheEntry;
                        }
                    }
                }
            }
        } catch (error) {
            console.warn('Search method failed:', error.message);
        }
        
        // Use stale cache if available
        const staleCache = priceCache.get(key);
        if (staleCache) {
            console.warn(`⚠️ Using stale cached price for ${crypto}: $${staleCache.price}`);
            return staleCache;
        }
        
        throw new Error(`Failed to fetch price for ${crypto} after multiple attempts`);
}

// Get cryptocurrency price - CACHED (updates every 3 minutes)
app.get('/api/crypto-price', async (req, res) => {
    res.setHeader('Content-Type', 'application/json');
    res.setHeader('Access-Control-Allow-Origin', '*');
    
    try {
        const { crypto, fiat = 'USD' } = req.query;
        
        if (!crypto) {
            return res.status(400).json({ error: 'crypto parameter required' });
        }
        
        // Use cached price (updates every 3 minutes)
        try {
            const cached = await getCachedPriceServer(crypto, fiat);
            return res.json({ 
                crypto, 
                fiat, 
                price: cached.price, 
                source: cached.source,
                cached: true,
                age: Math.round((Date.now() - cached.fetchedAt) / 1000),
                expiresIn: Math.round((cached.expiresAt - Date.now()) / 1000)
            });
        } catch (error) {
            console.error(`❌ Failed to get price for ${crypto}:`, error.message);
            return res.status(503).json({ 
                error: 'Failed to fetch price from CoinGecko after multiple attempts',
                crypto: crypto,
                fiat: fiat,
                details: error.message
            });
        }
        
    } catch (error) {
        console.error('Price API error:', error);
        res.status(500).json({ error: 'Failed to get price', details: error.message });
    }
});

// Create payment (store payment request)
const paymentStore = new Map();

app.post('/api/payments/create', (req, res) => {
    res.setHeader('Content-Type', 'application/json');
    res.setHeader('Access-Control-Allow-Origin', '*');
    
    try {
        const { amount, currency, crypto, orderId } = req.body;
        
        if (!amount || amount <= 0) {
            return res.status(400).json({ error: 'Invalid amount' });
        }
        
        const paymentId = `pay_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
        const payment = {
            id: paymentId,
            amount: parseFloat(amount),
            currency: currency || 'USD',
            crypto: crypto || 'SOL',
            orderId: orderId || null,
            status: 'pending',
            createdAt: Date.now(),
            expiresAt: Date.now() + (15 * 60 * 1000)
        };
        
        paymentStore.set(paymentId, payment);
        
        res.json({ success: true, payment });
    } catch (error) {
        console.error('Create payment error:', error);
        res.status(500).json({ error: 'Failed to create payment' });
    }
});

// Get payment status
app.get('/api/payments/:paymentId', (req, res) => {
    res.setHeader('Content-Type', 'application/json');
    res.setHeader('Access-Control-Allow-Origin', '*');
    
    try {
        const { paymentId } = req.params;
        const payment = paymentStore.get(paymentId);
        
        if (!payment) {
            return res.status(404).json({ error: 'Payment not found' });
        }
        
        res.json({ success: true, payment });
    } catch (error) {
        console.error('Get payment error:', error);
        res.status(500).json({ error: 'Failed to get payment' });
    }
});

// Webhook endpoint (for payment confirmations)
app.post('/api/webhooks/payment', (req, res) => {
    res.setHeader('Content-Type', 'application/json');
    res.setHeader('Access-Control-Allow-Origin', '*');
    
    try {
        const { event, data } = req.body;
        
        if (event === 'payment.confirmed') {
            const payment = paymentStore.get(data.id);
            if (payment) {
                payment.status = 'confirmed';
                payment.transactionHash = data.transactionHash;
                payment.confirmedAt = data.confirmedAt;
                paymentStore.set(data.id, payment);
            }
        }
        
        res.json({ success: true });
    } catch (error) {
        console.error('Webhook error:', error);
        res.status(500).json({ error: 'Webhook processing failed' });
    }
});

// ========== MERCHANT API ENDPOINTS ==========

// Store management
const merchantStores = new Map();
const merchantProducts = new Map();
const merchantOrders = new Map();
const merchantWebhooks = new Map();

app.post('/api/merchant/stores', (req, res) => {
    res.setHeader('Content-Type', 'application/json');
    res.setHeader('Access-Control-Allow-Origin', '*');
    
    try {
        const store = {
            id: `store_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
            ...req.body,
            createdAt: Date.now()
        };
        
        merchantStores.set(store.id, store);
        res.json({ success: true, store });
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});

app.get('/api/merchant/stores/:storeId', (req, res) => {
    res.setHeader('Content-Type', 'application/json');
    res.setHeader('Access-Control-Allow-Origin', '*');
    
    const store = merchantStores.get(req.params.storeId);
    if (!store) {
        return res.status(404).json({ error: 'Store not found' });
    }
    
    res.json({ success: true, store });
});

// Product management
app.post('/api/merchant/products', (req, res) => {
    res.setHeader('Content-Type', 'application/json');
    res.setHeader('Access-Control-Allow-Origin', '*');
    
    try {
        const product = {
            id: `prod_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
            ...req.body,
            createdAt: Date.now(),
            updatedAt: Date.now()
        };
        
        merchantProducts.set(product.id, product);
        res.json({ success: true, product });
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});

app.get('/api/merchant/products', (req, res) => {
    res.setHeader('Content-Type', 'application/json');
    res.setHeader('Access-Control-Allow-Origin', '*');
    
    try {
        const { storeId, category, inStock } = req.query;
        let products = Array.from(merchantProducts.values());
        
        if (storeId) {
            products = products.filter(p => p.storeId === storeId);
        }
        if (category) {
            products = products.filter(p => p.category === category);
        }
        if (inStock === 'true') {
            products = products.filter(p => p.inStock);
        }
        
        res.json({ success: true, products });
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});

app.put('/api/merchant/products/:productId', (req, res) => {
    res.setHeader('Content-Type', 'application/json');
    res.setHeader('Access-Control-Allow-Origin', '*');
    
    const product = merchantProducts.get(req.params.productId);
    if (!product) {
        return res.status(404).json({ error: 'Product not found' });
    }
    
    Object.assign(product, req.body, { updatedAt: Date.now() });
    merchantProducts.set(product.id, product);
    
    res.json({ success: true, product });
});

app.delete('/api/merchant/products/:productId', (req, res) => {
    res.setHeader('Content-Type', 'application/json');
    res.setHeader('Access-Control-Allow-Origin', '*');
    
    merchantProducts.delete(req.params.productId);
    res.json({ success: true });
});

// Order management
app.get('/api/merchant/orders', (req, res) => {
    res.setHeader('Content-Type', 'application/json');
    res.setHeader('Access-Control-Allow-Origin', '*');
    
    try {
        const { storeId, status, limit = 100 } = req.query;
        let orders = Array.from(merchantOrders.values());
        
        if (storeId) {
            orders = orders.filter(o => o.storeId === storeId);
        }
        if (status) {
            orders = orders.filter(o => o.status === status);
        }
        
        orders = orders.sort((a, b) => b.createdAt - a.createdAt).slice(0, parseInt(limit));
        
        res.json({ success: true, orders });
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});

app.put('/api/merchant/orders/:orderId', (req, res) => {
    res.setHeader('Content-Type', 'application/json');
    res.setHeader('Access-Control-Allow-Origin', '*');
    
    const order = merchantOrders.get(req.params.orderId);
    if (!order) {
        return res.status(404).json({ error: 'Order not found' });
    }
    
    Object.assign(order, req.body, { updatedAt: Date.now() });
    merchantOrders.set(order.id, order);
    
    // Trigger webhook if configured
    triggerOrderWebhook(order);
    
    res.json({ success: true, order });
});

// Analytics
app.get('/api/merchant/analytics', (req, res) => {
    res.setHeader('Content-Type', 'application/json');
    res.setHeader('Access-Control-Allow-Origin', '*');
    
    try {
        const { storeId, period = '30d' } = req.query;
        const orders = Array.from(merchantOrders.values()).filter(o => 
            !storeId || o.storeId === storeId
        );
        
        const periodMs = period === '7d' ? 7 * 24 * 60 * 60 * 1000 :
                         period === '30d' ? 30 * 24 * 60 * 60 * 1000 :
                         period === '90d' ? 90 * 24 * 60 * 60 * 1000 :
                         30 * 24 * 60 * 60 * 1000;
        
        const cutoff = Date.now() - periodMs;
        const recentOrders = orders.filter(o => o.createdAt >= cutoff);
        
        const analytics = {
            totalRevenue: recentOrders
                .filter(o => o.status === 'completed')
                .reduce((sum, o) => sum + o.total, 0),
            totalOrders: recentOrders.length,
            completedOrders: recentOrders.filter(o => o.status === 'completed').length,
            pendingOrders: recentOrders.filter(o => o.status === 'pending').length,
            averageOrderValue: 0,
            topProducts: getTopProducts(recentOrders),
            salesByDay: getSalesByDay(recentOrders),
            paymentMethods: getPaymentMethods(recentOrders)
        };
        
        if (analytics.completedOrders > 0) {
            analytics.averageOrderValue = analytics.totalRevenue / analytics.completedOrders;
        }
        
        res.json({ success: true, analytics });
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});

function getTopProducts(orders) {
    const productCounts = {};
    orders.forEach(order => {
        if (order.items) {
            order.items.forEach(item => {
                productCounts[item.productId] = (productCounts[item.productId] || 0) + item.quantity;
            });
        }
    });
    
    return Object.entries(productCounts)
        .sort((a, b) => b[1] - a[1])
        .slice(0, 10)
        .map(([productId, count]) => ({
            productId,
            sales: count,
            product: merchantProducts.get(productId)
        }));
}

function getSalesByDay(orders) {
    const salesByDay = {};
    orders.forEach(order => {
        if (order.status === 'completed') {
            const date = new Date(order.createdAt).toISOString().split('T')[0];
            salesByDay[date] = (salesByDay[date] || 0) + order.total;
        }
    });
    
    return Object.entries(salesByDay).map(([date, revenue]) => ({ date, revenue }));
}

function getPaymentMethods(orders) {
    const methods = {};
    orders.forEach(order => {
        const method = order.payment?.crypto || 'unknown';
        methods[method] = (methods[method] || 0) + 1;
    });
    return methods;
}

// Webhooks
app.post('/api/merchant/webhooks', (req, res) => {
    res.setHeader('Content-Type', 'application/json');
    res.setHeader('Access-Control-Allow-Origin', '*');
    
    try {
        const { storeId, url, events } = req.body;
        const webhook = {
            id: `webhook_${Date.now()}`,
            storeId,
            url,
            events,
            createdAt: Date.now()
        };
        
        merchantWebhooks.set(webhook.id, webhook);
        res.json({ success: true, webhook });
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});

function triggerOrderWebhook(order) {
    const webhooks = Array.from(merchantWebhooks.values())
        .filter(w => w.storeId === order.storeId);
    
    webhooks.forEach(webhook => {
        if (webhook.events.includes(`order.${order.status}`)) {
            fetch(webhook.url, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    event: `order.${order.status}`,
                    data: order,
                    timestamp: Date.now()
                })
            }).catch(err => console.warn('Webhook failed:', err));
        }
    });
}

// ========== SOLANA PAYMENT ORACLE ENDPOINTS ==========

const oraclePayments = new Map();

app.post('/api/oracle/payments', (req, res) => {
    res.setHeader('Content-Type', 'application/json');
    res.setHeader('Access-Control-Allow-Origin', '*');
    
    try {
        const payment = req.body;
        oraclePayments.set(payment.id, payment);
        res.json({ success: true, payment });
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});

app.get('/api/oracle/payments/:paymentId', (req, res) => {
    res.setHeader('Content-Type', 'application/json');
    res.setHeader('Access-Control-Allow-Origin', '*');
    
    const payment = oraclePayments.get(req.params.paymentId);
    if (!payment) {
        return res.status(404).json({ error: 'Payment not found' });
    }
    
    res.json({ success: true, payment });
});

app.get('/api/oracle/payments', (req, res) => {
    res.setHeader('Content-Type', 'application/json');
    res.setHeader('Access-Control-Allow-Origin', '*');
    
    const { status, merchantAddress } = req.query;
    let payments = Array.from(oraclePayments.values());
    
    if (status) {
        payments = payments.filter(p => p.status === status);
    }
    if (merchantAddress) {
        payments = payments.filter(p => p.merchantAddress === merchantAddress);
    }
    
    payments = payments.sort((a, b) => b.createdAt - a.createdAt);
    
    res.json({ success: true, payments });
});

app.post('/api/oracle/verify', (req, res) => {
    res.setHeader('Content-Type', 'application/json');
    res.setHeader('Access-Control-Allow-Origin', '*');
    
    try {
        const { transactionHash, expectedAmount } = req.body;
        
        if (!transactionHash || !expectedAmount) {
            return res.status(400).json({ error: 'Transaction hash and expected amount required' });
        }
        
        // Verify transaction via Solana RPC
        // This would call the Solana node to verify the transaction
        // For now, return a simulated verification
        
        const verification = {
            verified: true,
            transactionSignature: transactionHash,
            amount: expectedAmount,
            confirmations: 6,
            proof: {
                id: `proof_${Date.now()}`,
                verified: true,
                timestamp: Date.now()
            }
        };
        
        res.json({ success: true, verification });
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});

// Payment Links
const paymentLinks = new Map();

app.post('/api/payment-links', (req, res) => {
    res.setHeader('Content-Type', 'application/json');
    res.setHeader('Access-Control-Allow-Origin', '*');
    
    try {
        const link = req.body;
        paymentLinks.set(link.id, link);
        res.json({ success: true, link });
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});

app.get('/api/payment-links/:linkId', (req, res) => {
    res.setHeader('Content-Type', 'application/json');
    res.setHeader('Access-Control-Allow-Origin', '*');
    
    const link = paymentLinks.get(req.params.linkId);
    if (!link) {
        return res.status(404).json({ error: 'Payment link not found' });
    }
    
    res.json({ success: true, link });
});

// Webhooks
const webhooks = new Map();

app.post('/api/webhooks', (req, res) => {
    res.setHeader('Content-Type', 'application/json');
    res.setHeader('Access-Control-Allow-Origin', '*');
    
    try {
        const webhook = req.body;
        webhooks.set(webhook.id, webhook);
        res.json({ success: true, webhook });
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});

app.get('/api/webhooks', (req, res) => {
    res.setHeader('Content-Type', 'application/json');
    res.setHeader('Access-Control-Allow-Origin', '*');
    
    const webhookList = Array.from(webhooks.values());
    res.json({ success: true, webhooks: webhookList });
});

app.delete('/api/webhooks/:webhookId', (req, res) => {
    res.setHeader('Content-Type', 'application/json');
    res.setHeader('Access-Control-Allow-Origin', '*');
    
    webhooks.delete(req.params.webhookId);
    res.json({ success: true });
});

// Refunds
app.post('/api/oracle/refunds', (req, res) => {
    res.setHeader('Content-Type', 'application/json');
    res.setHeader('Access-Control-Allow-Origin', '*');
    
    try {
        const { paymentId, amount, reason } = req.body;
        
        // In production, this would process actual refund
        const refund = {
            id: `refund_${Date.now()}`,
            paymentId: paymentId,
            amount: amount,
            reason: reason,
            status: 'processed',
            createdAt: Date.now()
        };
        
        res.json({ success: true, refund });
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});

// Store order when payment is created
app.post('/api/payments/create', (req, res) => {
    res.setHeader('Content-Type', 'application/json');
    res.setHeader('Access-Control-Allow-Origin', '*');
    
    try {
        const { amount, currency, crypto, orderId, cart, shippingAddress, email } = req.body;
        
        if (!amount || amount <= 0) {
            return res.status(400).json({ error: 'Invalid amount' });
        }
        
        const paymentId = `pay_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
        const payment = {
            id: paymentId,
            amount: parseFloat(amount),
            currency: currency || 'USD',
            crypto: crypto || 'SOL',
            orderId: orderId || null,
            cart: cart || null,
            shippingAddress: shippingAddress || null,
            email: email || null,
            status: 'pending',
            createdAt: Date.now(),
            expiresAt: Date.now() + (15 * 60 * 1000)
        };
        
        paymentStore.set(paymentId, payment);
        
        // Create order if cart provided
        if (cart && cart.length > 0) {
            const order = {
                id: orderId || `order_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
                storeId: cart[0]?.storeId || 'default',
                items: cart,
                subtotal: amount,
                total: amount,
                currency: currency || 'USD',
                payment: {
                    paymentId: paymentId,
                    crypto: crypto,
                    status: 'pending'
                },
                shippingAddress: shippingAddress,
                email: email,
                status: 'pending',
                createdAt: Date.now()
            };
            
            merchantOrders.set(order.id, order);
            payment.orderId = order.id;
        }
        
        res.json({ success: true, payment });
    } catch (error) {
        console.error('Create payment error:', error);
        res.status(500).json({ error: 'Failed to create payment' });
    }
});

// Start background price cache updates every 3 minutes
const updatePriceCache = async () => {
    const cryptos = ['solana', 'usd-coin', 'tether', 'euro-coin', 'bitcoin', 'ethereum'];
    console.log(`🔄 Updating price cache for ${cryptos.length} cryptos...`);
    for (const crypto of cryptos) {
        try {
            await getCachedPriceServer(crypto, 'USD');
        } catch (error) {
            console.warn(`Failed to update price for ${crypto}:`, error.message);
        }
    }
    console.log(`✅ Price cache update complete`);
};

// Initial cache update
updatePriceCache();

// Update every 3 minutes
setInterval(updatePriceCache, 3 * 60 * 1000);

app.listen(PORT, () => {
    console.log(`Zcash RPC Proxy server running on http://localhost:${PORT}`);
    console.log(`Zcash RPC endpoint: ${ZCASH_RPC_URL}`);
    console.log(`API Key configured: ${ZCASH_RPC_USER ? 'Yes' : 'No'}`);
    console.log(`Solana RPC: ${SOLANA_RPC_URL}`);
    console.log(`\n=== Price Cache ===`);
    console.log(`🔄 Auto-updating prices every 3 minutes`);
    console.log(`📦 Cached cryptos: solana, usd-coin, tether, euro-coin, bitcoin, ethereum`);
    console.log(`\n=== Staking Pools Available ===`);
    Object.entries(STAKE_POOLS).forEach(([key, pool]) => {
        console.log(`${key.toUpperCase()}: ${pool.name} (${pool.apy}% APY)`);
    });
    console.log(`Default Pool: ${selectedPool.name}`);
    console.log(`\n✅ All endpoints ready!`);
    console.log(`   - /api/zcash-rpc (POST)`);
    console.log(`   - /api/oracle/stake (POST)`);
    console.log(`   - /api/oracle/stake-pools (GET)`);
    console.log(`   - /api/proxy/coingecko/* (GET)`);
    console.log(`   - /api/cheat-report (POST)`);
    console.log(`   - /api/leaderboard/submit (POST)`);
    console.log(`   - /api/leaderboard (GET)`);
    console.log(`   - /api/leaderboard/user/:wallet (GET)`);
    console.log(`   - /api/health (GET)`);
    console.log(`   - /api/crypto-price (GET)`);
    console.log(`   - /api/payments/create (POST)`);
    console.log(`   - /api/payments/:paymentId (GET)`);
    console.log(`   - /api/merchant/stores (POST/GET)`);
    console.log(`   - /api/merchant/products (POST/GET/PUT/DELETE)`);
    console.log(`   - /api/merchant/orders (GET/PUT)`);
    console.log(`   - /api/merchant/analytics (GET)`);
    console.log(`   - /api/merchant/webhooks (POST)`);
});
