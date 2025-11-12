/**
 * ZCash → Solana Protocol API Service
 * Provides RESTful API endpoints for protocol operations
 */

class ProtocolAPI {
    constructor(config = {}) {
        this.baseUrl = config.baseUrl || window.location.origin;
        this.bridge = config.bridge || null;
        this.version = 'v1';
    }

    /**
     * Initialize API with bridge instance
     */
    init(bridgeInstance) {
        this.bridge = bridgeInstance;
    }

    /**
     * Get protocol status
     */
    async getStatus() {
        if (!this.bridge) {
            throw new Error('Bridge not initialized');
        }

        try {
            const stats = this.bridge.getPoolStats();
            
            // Validate stats
            if (!stats || typeof stats !== 'object') {
                throw new Error('Invalid pool stats returned from bridge');
            }
            
            // Ensure all values are valid numbers
            const safeStats = {
                poolBalance: typeof stats.poolBalance === 'number' ? stats.poolBalance : 0,
                totalTransactions: typeof stats.totalTransactions === 'number' ? stats.totalTransactions : 0,
                activeUsers: typeof stats.activeUsers === 'number' ? stats.activeUsers : 0,
                pendingTransactions: typeof stats.pendingTransactions === 'number' ? stats.pendingTransactions : 0
            };
            
            // Validate no NaN or Infinity
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

    /**
     * Bridge ZEC to Solana
     */
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

    /**
     * Check transaction status
     */
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
            
            // Validate result structure
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

    /**
     * Get pool integrity report
     */
    async getPoolIntegrity() {
        if (!this.bridge) {
            throw new Error('Bridge not initialized');
        }

        try {
            const report = await this.bridge.checkPoolIntegrity();
            // Always return success - RPC errors are handled silently
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
            // Silent fallback - return default structure
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

    /**
     * Get recent transactions
     */
    async getRecentTransactions(limit = 10) {
        if (!this.bridge) {
            throw new Error('Bridge not initialized');
        }

        // Validate and sanitize limit
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
            
            // Validate response
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

    /**
     * Send SOL payment (for games/services)
     */
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
            
            // Validate recipient address
            let recipientPubkey, senderPubkey;
            try {
                recipientPubkey = new this.bridge.SolanaWeb3.PublicKey(recipient);
                senderPubkey = new this.bridge.SolanaWeb3.PublicKey(this.bridge.solanaWallet);
            } catch (error) {
                throw new Error(`Invalid Solana address: ${error.message}`);
            }
            
            const lamports = Math.round(amount * 1e9);
            if (lamports <= 0) {
                throw new Error('Amount too small after conversion to lamports');
            }

            const transaction = new this.bridge.SolanaWeb3.Transaction().add(
                this.bridge.SolanaWeb3.SystemProgram.transfer({
                    fromPubkey: senderPubkey,
                    toPubkey: recipientPubkey,
                    lamports: lamports
                })
            );

            // Add memo if provided
            if (memo && memo.trim()) {
                const memoProgram = new this.bridge.SolanaWeb3.PublicKey('MemoSq4gqABAXKb96qnH8TysNcWxMyWCqXgDLGmfcHr');
                transaction.add(
                    new this.bridge.SolanaWeb3.TransactionInstruction({
                        keys: [{
                            pubkey: senderPubkey,
                            isSigner: true,
                            isWritable: false
                        }],
                        programId: memoProgram,
                        data: Buffer.from(memo, 'utf8')
                    })
                );
            }

            const { blockhash, lastValidBlockHeight } = await this.bridge.solanaConnection.getLatestBlockhash('confirmed');
            transaction.recentBlockhash = blockhash;
            transaction.feePayer = senderPubkey;

            const signed = await window.solana.signTransaction(transaction);
            const signature = await this.bridge.solanaConnection.sendRawTransaction(signed.serialize(), {
                skipPreflight: false,
                maxRetries: 3
            });
            
            const confirmation = await this.bridge.solanaConnection.confirmTransaction({
                signature: signature,
                blockhash: blockhash,
                lastValidBlockHeight: lastValidBlockHeight
            }, 'confirmed');

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

// Export for use
if (typeof window !== 'undefined') {
    window.ProtocolAPI = ProtocolAPI;
}

if (typeof module !== 'undefined' && module.exports) {
    module.exports = ProtocolAPI;
}

