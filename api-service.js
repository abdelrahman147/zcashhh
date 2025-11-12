

class ProtocolAPI {
    constructor(config = {}) {
        this.baseUrl = config.baseUrl || window.location.origin;
        this.bridge = config.bridge || null;
        this.version = 'v1';
    }

    
    init(bridgeInstance) {
        this.bridge = bridgeInstance;
    }

    
    async getStatus() {
        if (!this.bridge) {
            throw new Error('Bridge not initialized');
        }

        try {
            const stats = this.bridge.getPoolStats();
            
            
            if (!stats || typeof stats !== 'object') {
                throw new Error('Invalid pool stats returned from bridge');
            }
            
            
            const safeStats = {
                poolBalance: typeof stats.poolBalance === 'number' ? stats.poolBalance : 0,
                totalTransactions: typeof stats.totalTransactions === 'number' ? stats.totalTransactions : 0,
                activeUsers: typeof stats.activeUsers === 'number' ? stats.activeUsers : 0,
                pendingTransactions: typeof stats.pendingTransactions === 'number' ? stats.pendingTransactions : 0
            };
            
            
            Object.keys(safeStats).forEach(key => {
                if (isNaN(safeStats[key]) || !isFinite(safeStats[key])) {
                    safeStats[key] = 0;
                }
            });
            
            return {
                status: 'operational',
                version: this.version,
                pool: {
                    balance: safeStats.poolBalance,
                    totalTransactions: safeStats.totalTransactions,
                    activeUsers: safeStats.activeUsers,
                    pendingTransactions: safeStats.pendingTransactions
                },
                chains: {
                    zcash: {
                        connected: this.bridge.shieldedPoolAddress !== null && this.bridge.shieldedPoolAddress !== undefined,
                        poolAddress: this.bridge.shieldedPoolAddress || null
                    },
                    solana: {
                        connected: this.bridge.solanaConnection !== null && this.bridge.solanaConnection !== undefined,
                        wallet: this.bridge.solanaWallet || null
                    }
                },
                timestamp: Date.now()
            };
        } catch (error) {
            throw new Error(`Failed to get status: ${error.message}`);
        }
    }

    
    async bridgeZecToSolana(amount, recipient) {
        if (!this.bridge) {
            throw new Error('Bridge not initialized');
        }

        try {
            const result = await this.bridge.bridgeZecToSolana(amount, recipient);
            return {
                success: true,
                data: {
                    zcashTxid: result.zcashTxid,
                    solanaTxid: result.solanaTxid,
                    amount: result.amount,
                    recipient: result.recipient
                },
                timestamp: Date.now()
            };
        } catch (error) {
            return {
                success: false,
                error: error.message,
                timestamp: Date.now()
            };
        }
    }

    
    async checkTransaction(txid) {
        if (!this.bridge) {
            throw new Error('Bridge not initialized');
        }

        if (!txid || typeof txid !== 'string' || txid.trim() === '') {
            return {
                success: false,
                error: 'Invalid transaction ID: must be a non-empty string',
                timestamp: Date.now()
            };
        }

        try {
            const result = await this.bridge.checkTransaction(txid.trim());
            
            
            if (!result || typeof result !== 'object') {
                return {
                    success: false,
                    error: 'Invalid response from bridge',
                    timestamp: Date.now()
                };
            }
            
            return {
                success: true,
                data: result,
                timestamp: Date.now()
            };
        } catch (error) {
            return {
                success: false,
                error: error.message || 'Failed to check transaction',
                timestamp: Date.now()
            };
        }
    }

    
    async getPoolIntegrity() {
        if (!this.bridge) {
            throw new Error('Bridge not initialized');
        }

        try {
            const report = await this.bridge.checkPoolIntegrity();
            
            return {
                success: true,
                data: report || {
                    valid: false,
                    zcashConnected: false,
                    solanaConnected: false,
                    checks: {},
                    warnings: []
                },
                timestamp: Date.now()
            };
        } catch (error) {
            
            return {
                success: true,
                data: {
                    valid: false,
                    zcashConnected: false,
                    solanaConnected: false,
                    checks: {},
                    warnings: []
                },
                timestamp: Date.now()
            };
        }
    }

    
    async getRecentTransactions(limit = 10) {
        if (!this.bridge) {
            throw new Error('Bridge not initialized');
        }

        
        const safeLimit = Math.max(1, Math.min(1000, parseInt(limit) || 10));
        
        if (isNaN(safeLimit) || safeLimit <= 0) {
            return {
                success: false,
                error: 'Invalid limit: must be a positive number between 1 and 1000',
                timestamp: Date.now()
            };
        }

        try {
            const transactions = this.bridge.getRecentTransactions(safeLimit);
            
            
            if (!Array.isArray(transactions)) {
                return {
                    success: false,
                    error: 'Invalid response: expected array of transactions',
                    timestamp: Date.now()
                };
            }
            
            return {
                success: true,
                data: transactions,
                count: transactions.length,
                limit: safeLimit,
                timestamp: Date.now()
            };
        } catch (error) {
            return {
                success: false,
                error: error.message || 'Failed to get recent transactions',
                timestamp: Date.now()
            };
        }
    }

    
    async sendPayment(amount, recipient, memo = '') {
        if (!this.bridge) {
            throw new Error('Bridge not initialized');
        }

        if (!this.bridge.solanaConnection) {
            throw new Error('Solana connection not initialized');
        }

        if (!this.bridge.solanaWallet) {
            throw new Error('Solana wallet not connected');
        }

        if (!window.solana || !window.solana.isPhantom) {
            throw new Error('Phantom wallet required');
        }

        if (!amount || amount <= 0 || isNaN(amount)) {
            throw new Error('Invalid amount: must be a positive number');
        }

        if (!recipient || typeof recipient !== 'string') {
            throw new Error('Invalid recipient: must be a valid Solana address');
        }

        try {
            await this.bridge.loadSolanaWeb3();
            
            
            let recipientPubkey, senderPubkey;
            try {
                recipientPubkey = new this.bridge.SolanaWeb3.PublicKey(recipient);
                senderPubkey = new this.bridge.SolanaWeb3.PublicKey(this.bridge.solanaWallet);
            } catch (error) {
                throw new Error(`Invalid Solana address: ${error.message}`);
            }
            
            const LAMPORTS_PER_SOL = this.bridge.SolanaWeb3?.LAMPORTS_PER_SOL || 1000000000;
            const lamportsValue = parseFloat(amount) * LAMPORTS_PER_SOL;
            let lamports = Math.floor(lamportsValue);
            
            if (!Number.isFinite(lamports) || lamports <= 0 || lamports > Number.MAX_SAFE_INTEGER) {
                throw new Error('Invalid amount: must be a positive number within safe range');
            }
            
            lamports = Number(lamports);
            
            if (typeof lamports !== 'number' || !Number.isInteger(lamports)) {
                throw new Error(`Invalid lamports type: ${typeof lamports}, value: ${lamports}`);
            }

            const transaction = new this.bridge.SolanaWeb3.Transaction();
            
            try {
                const SystemProgram = this.bridge.SolanaWeb3.SystemProgram;
                
                if (!SystemProgram || !SystemProgram.transfer) {
                    throw new Error('SystemProgram.transfer not available');
                }
                
                const transferParams = {
                    fromPubkey: senderPubkey,
                    toPubkey: recipientPubkey,
                    lamports: lamports
                };
                
                console.log('Creating transfer instruction with params:', {
                    fromPubkey: senderPubkey.toString(),
                    toPubkey: recipientPubkey.toString(),
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

            if (memo && memo.trim()) {
                const memoProgram = new this.bridge.SolanaWeb3.PublicKey('MemoSq4gqABAXKb96qnH8TysNcWxMyWCqXgDLGmfcHr');
                let memoData;
                try {
                    if (typeof Buffer !== 'undefined' && typeof Buffer.from === 'function') {
                        memoData = Buffer.from(memo, 'utf8');
                    } else if (typeof window !== 'undefined' && typeof window.Buffer !== 'undefined' && typeof window.Buffer.from === 'function') {
                        memoData = window.Buffer.from(memo, 'utf8');
                    } else {
                        const encoder = new TextEncoder();
                        memoData = encoder.encode(memo);
                    }
                } catch (e) {
                    const encoder = new TextEncoder();
                    memoData = encoder.encode(memo);
                }
                transaction.add(
                    new this.bridge.SolanaWeb3.TransactionInstruction({
                        keys: [{
                            pubkey: senderPubkey,
                            isSigner: true,
                            isWritable: false
                        }],
                        programId: memoProgram,
                        data: memoData
                    })
                );
            }

            if (!this.bridge.solanaConnection) {
                throw new Error('Solana connection not established');
            }
            
            const { blockhash, lastValidBlockHeight } = await Promise.race([
                this.bridge.solanaConnection.getLatestBlockhash('confirmed'),
                new Promise((_, reject) => setTimeout(() => reject(new Error('Blockhash request timeout')), 10000))
            ]);
            
            transaction.recentBlockhash = blockhash;
            transaction.feePayer = senderPubkey;
            
            try {
                transaction.serialize({ requireAllSignatures: false, verifySignatures: false });
            } catch (serializeError) {
                throw new Error(`Transaction serialization failed: ${serializeError.message}`);
            }

            let signed, signature, confirmation;
            
            try {
                if (!window.solana || !window.solana.isPhantom) {
                    throw new Error('Phantom wallet not available');
                }
                
                if (window.solana.signAndSendTransaction) {
                    try {
                        const result = await window.solana.signAndSendTransaction({
                            transaction: transaction,
                            options: {
                                skipPreflight: false,
                                maxRetries: 3,
                                preflightCommitment: 'confirmed'
                            }
                        });
                        signature = result.signature;
                    } catch (signError) {
                        if (signError.code === 4001) {
                            throw new Error('Transaction rejected by user');
                        }
                        throw signError;
                    }
                } else if (window.solana.signTransaction) {
                    signed = await window.solana.signTransaction(transaction);
                    if (!signed) {
                        throw new Error('Transaction signing returned null');
                    }
                    const serialized = signed.serialize();
                    signature = await this.bridge.solanaConnection.sendRawTransaction(serialized, {
                        skipPreflight: false,
                        maxRetries: 3,
                        preflightCommitment: 'confirmed'
                    });
                } else {
                    throw new Error('Phantom wallet signing methods not available');
                }
            } catch (signError) {
                if (signError.code === 4001) {
                    throw new Error('Transaction rejected by user');
                }
                throw new Error(`Transaction signing failed: ${signError.message}`);
            }
            
            try {
                confirmation = await Promise.race([
                    this.bridge.solanaConnection.confirmTransaction({
                        signature: signature,
                        blockhash: blockhash,
                        lastValidBlockHeight: lastValidBlockHeight
                    }, 'confirmed'),
                    new Promise((_, reject) => setTimeout(() => reject(new Error('Transaction confirmation timeout')), 30000))
                ]);
            } catch (confirmError) {
                throw new Error(`Transaction confirmation failed: ${confirmError.message}`);
            }

            if (confirmation.value.err) {
                throw new Error(`Transaction failed: ${JSON.stringify(confirmation.value.err)}`);
            }

            return {
                success: true,
                signature: signature,
                amount: amount,
                recipient: recipient,
                memo: memo || '',
                timestamp: Date.now()
            };
        } catch (error) {
            throw new Error(`Payment failed: ${error.message}`);
        }
    }
}


if (typeof window !== 'undefined') {
    window.ProtocolAPI = ProtocolAPI;
}

if (typeof module !== 'undefined' && module.exports) {
    module.exports = ProtocolAPI;
}

