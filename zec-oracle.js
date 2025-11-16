
class SolanaPaymentOracle {
    constructor(config = {}) {
        this.baseUrl = config.baseUrl || window.location.origin;
        this.solanaRpcUrl = config.solanaRpcUrl || null;
        this.merchantAddress = config.merchantAddress || null;
        this.confirmationThreshold = config.confirmationThreshold || 1;
        this.payments = new Map();
        this.zkProofs = new Map();
        this.solanaConnection = null;
        this.paymentStorage = null;
        this.cleanupInterval = null;
        this.initSolana();
        this.initPaymentStorage();
        this.loadPaymentsFromStorage();
        this.startCleanupInterval();
    }
    
    async initSolana() {
        if (typeof window !== 'undefined' && window.SolanaWeb3) {
            try {
                const rpcUrl = this.solanaRpcUrl || 'https://api.mainnet-beta.solana.com';
                this.solanaConnection = new window.SolanaWeb3.Connection(rpcUrl, 'confirmed');
            } catch (error) {
                console.warn('Solana initialization failed:', error);
            }
        }
    }
    
    // Generate ZK proof for payment verification
    async generateZKProof(transactionHash, expectedAmount) {
        try {
            // In a real implementation, this would use zk-SNARKs or similar
            // For now, we'll create a proof structure that can be verified
            
            const proof = {
                id: `proof_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
                transactionHash: transactionHash,
                expectedAmount: expectedAmount,
                timestamp: Date.now(),
                proofData: await this.createProofData(transactionHash, expectedAmount),
                verified: false
            };
            
            // Verify the proof
            proof.verified = await this.verifyProof(proof);
            
            this.zkProofs.set(proof.id, proof);
            
            return proof;
        } catch (error) {
            console.error('ZK proof generation failed:', error);
            throw error;
        }
    }
    
    async createProofData(txHash, amount) {
        // Simulated ZK proof creation
        // In production, this would use actual zk-SNARK libraries
        // This creates a cryptographic proof that payment was made without revealing details
        
        const proofData = {
            commitment: await this.hashData(`${txHash}:${amount}:${Date.now()}`),
            nullifier: await this.hashData(`${txHash}:nullifier`),
            merkleRoot: await this.calculateMerkleRoot(txHash),
            signature: await this.signProof(txHash, amount)
        };
        
        return proofData;
    }
    
    async hashData(data) {
        // Use Web Crypto API for hashing
        const encoder = new TextEncoder();
        const dataBuffer = encoder.encode(data);
        const hashBuffer = await crypto.subtle.digest('SHA-256', dataBuffer);
        const hashArray = Array.from(new Uint8Array(hashBuffer));
        return hashArray.map(b => b.toString(16).padStart(2, '0')).join('');
    }
    
    async calculateMerkleRoot(txHash) {
        // Simplified merkle root calculation
        // In production, this would use actual Zcash merkle tree
        const hash1 = await this.hashData(txHash + '_1');
        const hash2 = await this.hashData(txHash + '_2');
        return await this.hashData(hash1 + hash2);
    }
    
    async signProof(txHash, amount) {
        // Simulated signature
        // In production, this would use actual cryptographic signatures
        const data = `${txHash}:${amount}:${this.merchantAddress}`;
        return await this.hashData(data);
    }
    
    async verifyProof(proof) {
        try {
            // Verify the ZK proof
            // Check that the proof is valid without revealing transaction details
            
            if (!proof.proofData) {
                return false;
            }
            
            // Verify commitment
            const expectedCommitment = await this.hashData(
                `${proof.transactionHash}:${proof.expectedAmount}:${proof.timestamp}`
            );
            
            // Verify merkle root (simplified)
            const expectedMerkleRoot = await this.calculateMerkleRoot(proof.transactionHash);
            
            // Verify signature
            const expectedSignature = await this.signProof(proof.transactionHash, proof.expectedAmount);
            
            const isValid = 
                proof.proofData.commitment === expectedCommitment &&
                proof.proofData.merkleRoot === expectedMerkleRoot &&
                proof.proofData.signature === expectedSignature;
            
            return isValid;
        } catch (error) {
            console.error('Proof verification failed:', error);
            return false;
        }
    }
    
    // Verify Solana transaction
    async verifySolanaTransaction(txSignature, expectedAmount) {
        try {
            if (!this.solanaConnection) {
                await this.initSolana();
            }
            
            if (!this.solanaConnection) {
                throw new Error('Solana connection not available');
            }
            
            // Get transaction from Solana
            const tx = await this.solanaConnection.getTransaction(txSignature, {
                commitment: 'confirmed',
                maxSupportedTransactionVersion: 0
            });
            
            if (!tx) {
                throw new Error('Transaction not found');
            }
            
            // Verify transaction is confirmed
            const isConfirmed = tx.meta && tx.meta.err === null;
            
            // Calculate SOL amount from transaction
            let amount = 0;
            if (tx.meta && tx.meta.postBalances && tx.meta.preBalances) {
                // Calculate net change (simplified - in production would need to check specific account)
                const balanceChange = tx.meta.postBalances[0] - tx.meta.preBalances[0];
                amount = balanceChange / 1e9; // Convert lamports to SOL
            }
            
            // Verify amount matches (allow small differences)
            const matchesAmount = Math.abs(Math.abs(amount) - expectedAmount) < 0.00000001;
            
            // Get confirmation status
            const confirmations = tx.meta ? (tx.meta.confirmations || 0) : 0;
            const isFullyConfirmed = confirmations >= this.confirmationThreshold;
            
            // Generate ZK proof
            const proof = await this.generateZKProof(txSignature, expectedAmount);
            
            return {
                verified: isConfirmed && matchesAmount && proof.verified && isFullyConfirmed,
                transaction: tx,
                proof: proof,
                amount: Math.abs(amount),
                confirmations: confirmations,
                signature: txSignature
            };
        } catch (error) {
            console.error('Transaction verification failed:', error);
            throw error;
        }
    }
    
    // Create payment request
    async createPaymentRequest(amount, currency = 'USD', orderId = null, options = {}) {
        try {
            const {
                token = 'SOL',
                allowPartial = false,
                metadata = {},
                expiresIn = 15 * 60 * 1000 // 15 minutes default
            } = options;

            // Get token price and calculate amount - MUST GET REAL PRICE
            let tokenAmount;
            try {
                if (token === 'SOL') {
                    const solPrice = await this.getSOLPrice(currency);
                    tokenAmount = amount / solPrice;
                } else {
                    // Use Solana Pay integration for token conversion
                    if (window.SolanaPayIntegration) {
                        const payIntegration = new window.SolanaPayIntegration(this);
                        tokenAmount = await payIntegration.convertFiatToToken(amount, token, currency);
                    } else {
                        throw new Error(`Solana Pay integration not available for ${token}`);
                    }
                }
            } catch (priceError) {
                console.error('Failed to get token price:', priceError);
                throw new Error(`Failed to fetch ${token} price: ${priceError.message}. Please check your connection and try again.`);
            }
            
            const payment = {
                id: `pay_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
                amount: amount,
                currency: currency,
                token: token,
                solAmount: tokenAmount,
                orderId: orderId,
                merchantAddress: this.merchantAddress,
                status: 'pending',
                createdAt: Date.now(),
                expiresAt: Date.now() + expiresIn,
                transactionSignature: null,
                proof: null,
                allowPartial: allowPartial,
                metadata: metadata,
                partialAmount: 0
            };
            
            this.payments.set(payment.id, payment);
            
            // Ensure PaymentStorage is initialized before saving
            if (!this.paymentStorage) {
                console.log('🔄 PaymentStorage not initialized, attempting to initialize...');
                const initialized = await this.initPaymentStorage();
                if (!initialized) {
                    console.error('❌ Failed to initialize PaymentStorage. Payment will not be saved to Google Sheets.');
                    console.error('❌ Make sure payment-storage.js is loaded before zec-oracle.js');
                }
            }
            
            // Save to backend (temporary storage) - this also saves to Google Sheets
            // savePaymentToBackend internally calls paymentStorage.savePayment() at line 379
            // So we don't need to call it again here to avoid duplicate saves
            await this.savePaymentToBackend(payment);
            
            // Trigger webhook
            if (window.webhookSystem) {
                await window.webhookSystem.triggerEvent('payment.created', payment);
            }
            
            return payment;
        } catch (error) {
            console.error('Failed to create payment request:', error);
            throw error;
        }
    }
    
    async getSOLPrice(currency = 'USD') {
        // Try multiple times with retries
        for (let attempt = 1; attempt <= 3; attempt++) {
            try {
                const response = await fetch(`${this.baseUrl}/api/crypto-price?crypto=solana&fiat=${currency}`);
                if (response.ok) {
                    const data = await response.json();
                    if (data.price && data.price > 0) {
                        console.log(`✅ Got SOL price: $${data.price} (source: ${data.source || 'unknown'})`);
                        return data.price;
                    }
                } else if (response.status === 503) {
                    // Service unavailable - retry
                    console.warn(`⚠️ Price API unavailable (attempt ${attempt}/3), retrying...`);
                    if (attempt < 3) {
                        await new Promise(resolve => setTimeout(resolve, 2000 * attempt));
                        continue;
                    }
                }
            } catch (error) {
                console.warn(`Failed to get SOL price (attempt ${attempt}/3):`, error);
                if (attempt < 3) {
                    await new Promise(resolve => setTimeout(resolve, 2000 * attempt));
                    continue;
                }
            }
        }
        
        // If all attempts fail, throw error instead of using fallback
        throw new Error('Failed to fetch SOL price after multiple attempts. Please check your connection and try again.');
    }
    
    async initPaymentStorage() {
        if (typeof window !== 'undefined' && window.PaymentStorage) {
            try {
                this.paymentStorage = new window.PaymentStorage();
                console.log('✅ PaymentStorage initialized successfully');
                return true;
            } catch (error) {
                console.error('❌ Failed to initialize PaymentStorage:', error);
                return false;
            }
        } else {
            console.warn('⚠️ PaymentStorage class not available. Make sure payment-storage.js is loaded.');
            return false;
        }
    }
    
    async loadPaymentsFromStorage() {
        if (!this.paymentStorage) {
            await this.initPaymentStorage();
        }
        
        if (this.paymentStorage) {
            try {
                const allPayments = await this.paymentStorage.loadPayments();
                allPayments.forEach(payment => {
                    // Load all payments from sheets (both pending and verified)
                    // This ensures payments persist across refreshes
                    this.payments.set(payment.id, payment);
                });
                const verifiedCount = allPayments.filter(p => p.status === 'verified').length;
                const pendingCount = allPayments.filter(p => p.status === 'pending').length;
                console.log(`✅ Loaded ${allPayments.length} payments from Google Sheets (${verifiedCount} verified, ${pendingCount} pending)`);
                
            } catch (error) {
                console.error('Failed to load payments from storage:', error);
            }
        }
    }
    
    async savePaymentToBackend(payment) {
        // Save to Netlify function (temporary storage)
        try {
            await fetch(`${this.baseUrl}/api/oracle/payments`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(payment)
            });
        } catch (error) {
            console.warn('Failed to save payment to backend:', error);
        }
        
        // Save ALL payments (pending and verified) to Google Sheets for persistence
        // This ensures payments don't disappear on refresh
        // Only verified payments are used for all-time volume calculation
        // Expired pending payments will be deleted after 1 hour
        if (this.paymentStorage) {
            await this.paymentStorage.savePayment(payment).catch(err => {
                console.warn('Failed to save payment to sheets:', err);
            });
            if (payment.status === 'verified') {
                console.log(`✅ Verified payment ${payment.id} saved to Google Sheets (used for all-time volume)`);
            }
        }
    }
    
    // Start cleanup interval for expired pending payments
    startCleanupInterval() {
        if (this.cleanupInterval) {
            return;
        }
        
        console.log('🧹 Starting payment cleanup interval...');
        
        this.cleanupInterval = setInterval(async () => {
            await this.cleanupExpiredPayments();
        }, 60000); // Check every minute
    }
    
    // Cleanup expired pending payments (older than 1 hour)
    async cleanupExpiredPayments() {
        const now = Date.now();
        const oneHour = 60 * 60 * 1000;
        
        const expiredPayments = Array.from(this.payments.values())
            .filter(p => p.status === 'pending' && (now - p.createdAt) > oneHour);
        
        for (const payment of expiredPayments) {
            console.log(`🗑️ Deleting expired pending payment: ${payment.id}`);
            this.payments.delete(payment.id);
            
            // Try to delete from backend (Netlify function)
            try {
                await fetch(`${this.baseUrl}/api/oracle/payments/${payment.id}`, {
                    method: 'DELETE'
                });
            } catch (error) {
                console.warn(`Failed to delete payment ${payment.id} from backend:`, error);
            }
            
            // Delete from Google Sheets (expired pending payments should be removed)
            if (this.paymentStorage) {
                try {
                    await this.paymentStorage.deleteExpiredPayment(payment.id);
                    console.log(`🗑️ Deleted expired payment ${payment.id} from Google Sheets`);
                } catch (error) {
                    console.warn(`Failed to delete payment ${payment.id} from Google Sheets:`, error);
                }
            }
        }
        
        if (expiredPayments.length > 0) {
            console.log(`✅ Cleaned up ${expiredPayments.length} expired pending payments`);
        }
    }
    
    // Monitor payment
    async monitorPayment(paymentId, txSignature) {
        const payment = this.payments.get(paymentId);
        if (!payment) {
            throw new Error('Payment not found');
        }
        
        // Verify transaction
        const verification = await this.verifySolanaTransaction(txSignature, payment.solAmount);
        
        if (verification.verified) {
            payment.status = 'verified';
            payment.transactionSignature = txSignature;
            payment.proof = verification.proof;
            payment.confirmedAt = Date.now();
            
            this.payments.set(paymentId, payment);
            await this.savePaymentToBackend(payment);
            
            // Trigger webhook if configured
            await this.triggerWebhook(payment);
        }
        
        return verification;
    }
    
    async triggerWebhook(payment) {
        if (window.webhookSystem) {
            await window.webhookSystem.triggerEvent('payment.verified', payment);
        }
    }
    
    // Process refund
    async processRefund(paymentId, amount = null, reason = null) {
        const payment = this.payments.get(paymentId);
        if (!payment) {
            throw new Error('Payment not found');
        }
        
        if (payment.status !== 'verified') {
            throw new Error('Can only refund verified payments');
        }
        
        const refundAmount = amount || payment.solAmount;
        
        const refund = {
            id: `refund_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
            paymentId: paymentId,
            amount: refundAmount,
            reason: reason,
            status: 'pending',
            createdAt: Date.now()
        };
        
        // In production, this would initiate actual refund transaction
        // For now, mark payment as refunded
        payment.refunded = true;
        payment.refundAmount = refundAmount;
        payment.refundedAt = Date.now();
        
        this.payments.set(paymentId, payment);
        await this.savePaymentToBackend(payment);
        
        // Trigger webhook
        if (window.webhookSystem) {
            await window.webhookSystem.triggerEvent('payment.refunded', refund);
        }
        
        return refund;
    }
    
    // Get payment status
    getPayment(paymentId) {
        return this.payments.get(paymentId);
    }
    
    // Get all payments
    getAllPayments() {
        return Array.from(this.payments.values());
    }
    
    // Start automatic payment monitoring
    startPaymentMonitoring() {
        if (this.monitoringInterval) {
            return; // Already monitoring
        }
        
        console.log('🔍 Starting automatic payment monitoring...');
        
        this.monitoringInterval = setInterval(async () => {
            await this.checkPendingPayments();
        }, 10000); // Check every 10 seconds
    }
    
    // Stop payment monitoring
    stopPaymentMonitoring() {
        if (this.monitoringInterval) {
            clearInterval(this.monitoringInterval);
            this.monitoringInterval = null;
            console.log('⏹️ Stopped payment monitoring');
        }
    }
    
    // Check all pending payments for transactions
    async checkPendingPayments() {
        if (!this.merchantAddress || !this.solanaConnection) {
            return;
        }
        
        const pendingPayments = Array.from(this.payments.values())
            .filter(p => p.status === 'pending' && p.merchantAddress === this.merchantAddress);
        
        if (pendingPayments.length === 0) {
            return;
        }
        
        try {
            // Get recent transactions for merchant address
            const publicKey = new window.SolanaWeb3.PublicKey(this.merchantAddress);
            const signatures = await this.solanaConnection.getSignaturesForAddress(publicKey, {
                limit: 20
            });
            
            // Check each pending payment
            for (const payment of pendingPayments) {
                // Check if we already have a transaction signature
                if (payment.transactionSignature) {
                    // Verify the existing transaction
                    try {
                        const verification = await this.verifySolanaTransaction(
                            payment.transactionSignature,
                            payment.solAmount
                        );
                        
                        if (verification.verified && payment.status !== 'verified') {
                            payment.status = 'verified';
                            payment.proof = verification.proof;
                            payment.confirmedAt = Date.now();
                            this.payments.set(payment.id, payment);
                            await this.savePaymentToBackend(payment);
                            await this.triggerWebhook(payment);
                            console.log(`✅ Payment ${payment.id} verified!`);
                        }
                    } catch (error) {
                        console.warn(`Failed to verify transaction for payment ${payment.id}:`, error);
                    }
                    continue;
                }
                
                // Check recent transactions for matching payment
                for (const sigInfo of signatures) {
                    try {
                        const tx = await this.solanaConnection.getTransaction(sigInfo.signature, {
                            commitment: 'confirmed',
                            maxSupportedTransactionVersion: 0
                        });
                        
                        if (!tx || !tx.meta || tx.meta.err) {
                            continue;
                        }
                        
                        // Check if transaction is to merchant address and amount matches
                        const amount = this.extractTransactionAmount(tx, publicKey);
                        const timeDiff = Math.abs(tx.blockTime * 1000 - payment.createdAt);
                        
                        // Transaction should be after payment creation and within 1 hour
                        if (amount > 0 && 
                            tx.blockTime * 1000 >= payment.createdAt && 
                            timeDiff < 3600000 && // 1 hour
                            Math.abs(amount - payment.solAmount) < 0.00000001) {
                            
                            // Found matching transaction!
                            payment.status = 'verified';
                            payment.transactionSignature = sigInfo.signature;
                            payment.confirmedAt = Date.now();
                            
                            // Generate proof
                            const verification = await this.verifySolanaTransaction(
                                sigInfo.signature,
                                payment.solAmount
                            );
                            payment.proof = verification.proof;
                            
                            this.payments.set(payment.id, payment);
                            await this.savePaymentToBackend(payment);
                            await this.triggerWebhook(payment);
                            
                            console.log(`✅ Payment ${payment.id} verified via transaction ${sigInfo.signature}`);
                            break;
                        }
                    } catch (error) {
                        console.warn(`Error checking transaction ${sigInfo.signature}:`, error);
                    }
                }
            }
        } catch (error) {
            console.error('Error checking pending payments:', error);
        }
    }
    
    // Extract transaction amount for a specific address
    extractTransactionAmount(tx, address) {
        if (!tx.meta || !tx.meta.postBalances || !tx.meta.preBalances) {
            return 0;
        }
        
        // Find the account index for our address
        const accountIndex = tx.transaction.message.accountKeys.findIndex(
            key => key.toString() === address.toString()
        );
        
        if (accountIndex === -1) {
            return 0;
        }
        
        const preBalance = tx.meta.preBalances[accountIndex];
        const postBalance = tx.meta.postBalances[accountIndex];
        const change = (postBalance - preBalance) / 1e9; // Convert lamports to SOL
        
        return change > 0 ? change : 0; // Only return positive changes (incoming)
    }
}

// Export
if (typeof window !== 'undefined') {
    window.SolanaPaymentOracle = SolanaPaymentOracle;
    // Keep old name for backwards compatibility
    window.ZcashPaymentOracle = SolanaPaymentOracle;
}

if (typeof module !== 'undefined' && module.exports) {
    module.exports = SolanaPaymentOracle;
}

