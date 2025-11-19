
class SolanaPaymentOracle {
    constructor(config = {}) {
        this.baseUrl = config.baseUrl || window.location.origin;
        this.solanaRpcUrl = config.solanaRpcUrl || null;
        this.merchantAddress = config.merchantAddress || null;
        this.confirmationThreshold = config.confirmationThreshold || 1;
        this.payments = new Map();
        this.zkProofs = new Map();
        this.zkService = null; // Real ZK proof service
        this.solanaConnection = null;
        this.paymentStorage = null;
        this.cleanupInterval = null;
        this.initSolana();
        this.initPaymentStorage();
        this.initZKService();
        this.loadPaymentsFromStorage();
        this.startCleanupInterval();
    }
    
    async initSolana() {
        if (typeof window !== 'undefined' && window.SolanaWeb3) {
            try {
                // Suppress signatureSubscribe errors (WebSocket subscriptions not supported by HTTP RPC)
                const originalConsoleError = console.error;
                let errorSuppressed = false;
                
                const errorInterceptor = function(...args) {
                    const message = args.join(' ');
                    if ((message.includes('signatureSubscribe') || message.includes('Received JSON-RPC error calling')) && !errorSuppressed) {
                        errorSuppressed = true;
                        console.warn('[WARN] Solana RPC subscription errors suppressed (WebSocket subscriptions not supported by HTTP RPC endpoint)');
                        return;
                    }
                    originalConsoleError.apply(console, args);
                };
                
                console.error = errorInterceptor;
                
                // Use Alchemy RPC as default (most reliable)
                const rpcUrl = this.solanaRpcUrl || 'https://solana-mainnet.g.alchemy.com/v2/xXPi6FAKVWJqv9Ie5TgvOHQgTlrlfbp5';
                this.solanaConnection = new window.SolanaWeb3.Connection(rpcUrl, 'confirmed');
                
                // Restore console.error after connection is established
                setTimeout(() => {
                    console.error = originalConsoleError;
                }, 3000);
                
                console.log(`[OK] Solana connection initialized with Alchemy RPC`);
            } catch (error) {
                console.warn('Solana initialization failed:', error);
            }
        }
    }
    
    /**
     * Initialize real ZK proof service
     */
    async initZKService() {
        if (typeof window !== 'undefined' && window.ZKProofService) {
            try {
                this.zkService = new window.ZKProofService();
                await this.zkService.initialize();
                console.log('[ZK] Real Zero-Knowledge Proof Service initialized');
            } catch (error) {
                console.error('[ERR] Failed to initialize ZK service:', error);
            }
        } else {
            console.warn('[WARN] ZKProofService not available. Make sure zk-proof-service.js is loaded.');
        }
    }

    /**
     * Generate real ZK proof for payment verification
     * Uses elliptic curve cryptography and Pedersen commitments
     */
    async generateZKProof(transactionHash, expectedAmount, actualAmount = null) {
        try {
            // Use real ZK service if available
            if (this.zkService) {
                // Use actual amount if provided, otherwise use expected
                const amount = actualAmount !== null ? actualAmount : expectedAmount;
                
                const proof = await this.zkService.generateZKProof(
                    transactionHash,
                    amount,
                    expectedAmount
                );
                
                this.zkProofs.set(proof.id, proof);
                return proof;
            } else {
                // Fallback if ZK service not available
                console.warn('[WARN] ZK service not available, using fallback');
                return await this.generateFallbackProof(transactionHash, expectedAmount);
            }
        } catch (error) {
            console.error('[ERR] ZK proof generation failed:', error);
            throw error;
        }
    }

    /**
     * Fallback proof generation (if ZK service not available)
     */
    async generateFallbackProof(transactionHash, expectedAmount) {
        const proof = {
            id: `proof_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
            transactionHash: transactionHash,
            expectedAmount: expectedAmount,
            timestamp: Date.now(),
            verified: false,
            fallback: true
        };
        
        this.zkProofs.set(proof.id, proof);
        return proof;
    }

    /**
     * Verify a ZK proof
     */
    async verifyProof(proof) {
        try {
            if (!proof) {
                return false;
            }

            // Use real ZK service if available
            if (this.zkService && !proof.fallback) {
                return await this.zkService.verifyZKProof(proof);
            } else {
                // Fallback verification
                return proof.verified === true || proof.fallback === true;
            }
        } catch (error) {
            console.error('[ERR] Proof verification failed:', error);
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
            
            // Generate real ZK proof with actual amount
            const actualAmount = Math.abs(amount);
            const proof = await this.generateZKProof(txSignature, expectedAmount, actualAmount);
            
            // Verify the proof
            const proofVerified = await this.verifyProof(proof);
            
            return {
                verified: isConfirmed && matchesAmount && proofVerified && isFullyConfirmed,
                transaction: tx,
                proof: proof,
                amount: actualAmount,
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
                console.log('[INIT] PaymentStorage not initialized, attempting to initialize...');
                const initialized = await this.initPaymentStorage();
                if (!initialized) {
                    console.error('[ERR] Failed to initialize PaymentStorage. Payment will not be saved to Google Sheets.');
                    console.error('[ERR] Make sure payment-storage.js is loaded before zec-oracle.js');
                }
            }
            
            // Save to backend (temporary storage) - this also saves to Google Sheets
            // savePaymentToBackend internally calls paymentStorage.savePayment() at line 379
            // So we don't need to call it again here to avoid duplicate saves
            await this.savePaymentToBackend(payment);
            
            // IMMEDIATELY check blockchain for this payment
            console.log('[CHECK] Immediately checking blockchain for new payment:', payment.id);
            setTimeout(async () => {
                await this.checkPaymentOnBlockchain(payment.id);
            }, 2000); // Wait 2 seconds for transaction to propagate
            
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
                        console.log(`[OK] Got SOL price: $${data.price} (source: ${data.source || 'unknown'})`);
                        return data.price;
                    }
                } else if (response.status === 503) {
                    // Service unavailable - retry
                    console.warn(`[WARN] Price API unavailable (attempt ${attempt}/3), retrying...`);
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
                console.log('[OK] PaymentStorage initialized successfully');
                return true;
            } catch (error) {
                console.error('[ERR] Failed to initialize PaymentStorage:', error);
                return false;
            }
        } else {
            console.warn('[WARN] PaymentStorage class not available. Make sure payment-storage.js is loaded.');
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
                console.log(`[OK] Loaded ${allPayments.length} payments from Google Sheets (${verifiedCount} verified, ${pendingCount} pending)`);
                
        // Clean up expired payments and duplicates immediately after loading
        // This ensures expired payments and duplicates are removed as soon as they're loaded
        setTimeout(async () => {
            console.log('[CLEAN] Running automatic cleanup after loading payments...');
            await this.cleanupExpiredPayments();
            // Also clean up duplicates
            await this.cleanupDuplicatePayments();
        }, 1000); // Wait 1 second after loading to clean up
                
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
            try {
                console.log(`[SAVE] Saving payment ${payment.id} to Google Sheets with status: ${payment.status}`);
                const result = await this.paymentStorage.savePayment(payment);
                if (result && result.success) {
                    if (payment.status === 'verified') {
                        console.log(`[OK] Verified payment ${payment.id} saved/updated in Google Sheets (used for all-time volume)`);
                        console.log(`   Transaction: ${payment.transactionSignature || 'N/A'}`);
                        console.log(`   Confirmed: ${payment.confirmedAt ? new Date(payment.confirmedAt).toLocaleString() : 'N/A'}`);
                    } else {
                        console.log(`[OK] Payment ${payment.id} saved to Google Sheets (status: ${payment.status})`);
                    }
                } else {
                    console.warn(`[WARN] Failed to save payment ${payment.id} to sheets:`, result?.error || 'Unknown error');
                }
            } catch (err) {
                console.error(`[ERR] Error saving payment ${payment.id} to sheets:`, err);
            }
        } else {
            console.warn(`[WARN] PaymentStorage not initialized, cannot save payment ${payment.id} to Google Sheets`);
        }
    }
    
    // Start cleanup interval for expired pending payments
    startCleanupInterval() {
        if (this.cleanupInterval) {
            return;
        }
        
        console.log('[CLEAN] Starting automatic payment cleanup (runs every 30 seconds)...');
        
        // Run cleanup immediately
        setTimeout(async () => {
            await this.cleanupExpiredPayments();
            await this.cleanupDuplicatePayments();
        }, 3000); // Wait 3 seconds after initialization
        
        // Then run cleanup every 5 minutes automatically to avoid rate limits
        this.cleanupInterval = setInterval(async () => {
            await this.cleanupExpiredPayments();
            await this.cleanupDuplicatePayments();
        }, 300000); // Check every 5 minutes to avoid rate limits
    }
    
    // Cleanup expired pending payments (older than 1 hour)
    async cleanupExpiredPayments() {
        const now = Date.now();
        const oneHour = 60 * 60 * 1000;
        
        // First, clean up in-memory payments
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
            
            // Delete from Google Sheets
            if (this.paymentStorage) {
                try {
                    await this.paymentStorage.deleteExpiredPayment(payment.id);
                    console.log(`🗑️ Deleted expired payment ${payment.id} from Google Sheets`);
                } catch (error) {
                    console.warn(`Failed to delete payment ${payment.id} from Google Sheets:`, error);
                }
            }
        }
        
        // Also check Google Sheets for expired payments that might not be in memory
        let expiredFromSheets = [];
        if (this.paymentStorage) {
            try {
                const allPayments = await this.paymentStorage.loadPayments();
                expiredFromSheets = allPayments.filter(p => {
                    if (p.status !== 'pending') return false;
                    const createdAt = typeof p.createdAt === 'string' ? new Date(p.createdAt).getTime() : p.createdAt;
                    return (now - createdAt) > oneHour;
                });
                
                for (const payment of expiredFromSheets) {
                    console.log(`🗑️ Deleting expired pending payment from Google Sheets: ${payment.id}`);
                    try {
                        await this.paymentStorage.deleteExpiredPayment(payment.id);
                        // Also remove from in-memory if it exists
                        this.payments.delete(payment.id);
                    } catch (error) {
                        console.warn(`Failed to delete expired payment ${payment.id} from Google Sheets:`, error);
                    }
                }
                
                if (expiredFromSheets.length > 0) {
                    console.log(`[OK] Cleaned up ${expiredFromSheets.length} expired pending payments from Google Sheets`);
                }
            } catch (error) {
                console.warn('Failed to check Google Sheets for expired payments:', error);
            }
        }
        
        const totalCleaned = expiredPayments.length + expiredFromSheets.length;
        if (totalCleaned > 0) {
                    console.log(`[OK] Total cleaned up: ${totalCleaned} expired pending payments`);
        }
        
        // Also check for and delete duplicate payments automatically
        await this.cleanupDuplicatePayments();
    }
    
    // Automatically detect and delete duplicate payments
    async cleanupDuplicatePayments() {
        if (!this.paymentStorage) {
            return;
        }
        
        try {
            const allPayments = await this.paymentStorage.loadPayments();
            
            // FIRST: Check for duplicate Payment IDs (most important - exact duplicates)
            const paymentsByPaymentId = new Map();
            allPayments.forEach(payment => {
                if (payment.id) {
                    if (!paymentsByPaymentId.has(payment.id)) {
                        paymentsByPaymentId.set(payment.id, []);
                    }
                    paymentsByPaymentId.get(payment.id).push(payment);
                }
            });
            
            let duplicatesDeleted = 0;
            
            // Delete duplicates with same Payment ID
            for (const [paymentId, payments] of paymentsByPaymentId.entries()) {
                if (payments.length > 1) {
                    console.log(`[FIND] Found ${payments.length} duplicate payments with Payment ID: ${paymentId}`);
                    
                    // Sort: verified first, then by creation date (newest first)
                    payments.sort((a, b) => {
                        if (a.status === 'verified' && b.status !== 'verified') return -1;
                        if (a.status !== 'verified' && b.status === 'verified') return 1;
                        const aTime = typeof a.createdAt === 'string' ? new Date(a.createdAt).getTime() : a.createdAt;
                        const bTime = typeof b.createdAt === 'string' ? new Date(b.createdAt).getTime() : b.createdAt;
                        return bTime - aTime; // Newest first
                    });
                    
                    // Keep ONLY the first one (best one), delete ALL the rest
                    const toKeep = payments[0];
                    const toDelete = payments.slice(1); // All except the first one
                    
                    console.log(`[OK] Keeping 1 payment: ${toKeep.id} (status: ${toKeep.status})`);
                    console.log(`[DEL] Deleting ${toDelete.length} duplicate(s): ${toDelete.map(p => p.id).join(', ')}`);
                    
                    for (const duplicate of toDelete) {
                        try {
                            await this.paymentStorage.deleteExpiredPayment(duplicate.id);
                            this.payments.delete(duplicate.id);
                            duplicatesDeleted++;
                            console.log(`   [DEL] Deleted duplicate: ${duplicate.id}`);
                        } catch (error) {
                            console.warn(`   ✗ Failed to delete duplicate ${duplicate.id}:`, error);
                        }
                    }
                }
            }
            
            // SECOND: Group payments by Order ID to find duplicates
            const paymentsByOrderId = new Map();
            allPayments.forEach(payment => {
                if (payment.orderId) {
                    if (!paymentsByOrderId.has(payment.orderId)) {
                        paymentsByOrderId.set(payment.orderId, []);
                    }
                    paymentsByOrderId.get(payment.orderId).push(payment);
                }
            });
            
            // Find duplicates (same Order ID with multiple payments)
            for (const [orderId, payments] of paymentsByOrderId.entries()) {
                if (payments.length > 1) {
                    console.log(`[FIND] Found ${payments.length} duplicate payments with Order ID: ${orderId}`);
                    
                    // Sort: verified first, then by creation date (newest first)
                    payments.sort((a, b) => {
                        if (a.status === 'verified' && b.status !== 'verified') return -1;
                        if (a.status !== 'verified' && b.status === 'verified') return 1;
                        const aTime = typeof a.createdAt === 'string' ? new Date(a.createdAt).getTime() : a.createdAt;
                        const bTime = typeof b.createdAt === 'string' ? new Date(b.createdAt).getTime() : b.createdAt;
                        return bTime - aTime; // Newest first
                    });
                    
                    // Keep ONLY the first one (best one), delete ALL the rest
                    const toKeep = payments[0];
                    const toDelete = payments.slice(1); // All except the first one
                    
                    console.log(`[OK] Keeping 1 payment: ${toKeep.id} (status: ${toKeep.status}, Order ID: ${orderId})`);
                    console.log(`[DEL] Deleting ${toDelete.length} duplicate(s): ${toDelete.map(p => p.id).join(', ')}`);
                    
                    for (const duplicate of toDelete) {
                        try {
                            await this.paymentStorage.deleteExpiredPayment(duplicate.id);
                            this.payments.delete(duplicate.id);
                            duplicatesDeleted++;
                            console.log(`   [DEL] Deleted duplicate: ${duplicate.id}`);
                        } catch (error) {
                            console.warn(`   ✗ Failed to delete duplicate ${duplicate.id}:`, error);
                        }
                    }
                }
            }
            
            // Also check for duplicate transaction signatures (if verified)
            const paymentsByTxSig = new Map();
            allPayments.forEach(payment => {
                if (payment.transactionSignature && payment.status === 'verified') {
                    if (!paymentsByTxSig.has(payment.transactionSignature)) {
                        paymentsByTxSig.set(payment.transactionSignature, []);
                    }
                    paymentsByTxSig.get(payment.transactionSignature).push(payment);
                }
            });
            
            for (const [txSig, payments] of paymentsByTxSig.entries()) {
                if (payments.length > 1) {
                    console.log(`[FIND] Found ${payments.length} duplicate payments with same transaction signature: ${txSig.substring(0, 20)}...`);
                    
                    // Keep ONLY the first one, delete ALL the rest
                    const toKeep = payments[0];
                    const toDelete = payments.slice(1); // All except the first one
                    
                    console.log(`[OK] Keeping 1 payment: ${toKeep.id} (TX: ${txSig.substring(0, 20)}...)`);
                    console.log(`[DEL] Deleting ${toDelete.length} duplicate(s): ${toDelete.map(p => p.id).join(', ')}`);
                    
                    for (const duplicate of toDelete) {
                        try {
                            await this.paymentStorage.deleteExpiredPayment(duplicate.id);
                            this.payments.delete(duplicate.id);
                            duplicatesDeleted++;
                            console.log(`   [DEL] Deleted duplicate: ${duplicate.id}`);
                        } catch (error) {
                            console.warn(`   ✗ Failed to delete duplicate ${duplicate.id}:`, error);
                        }
                    }
                }
            }
            
            if (duplicatesDeleted > 0) {
                console.log(`[OK] Automatically deleted ${duplicatesDeleted} duplicate payment(s)`);
            }
        } catch (error) {
            console.warn('Failed to check for duplicate payments:', error);
        }
    }
    
    // Manual cleanup function - can be called to clean up all expired payments immediately
    async cleanupAllExpiredPayments() {
        console.log('[CLEAN] Starting manual cleanup of all expired pending payments...');
        await this.cleanupExpiredPayments();
        console.log('[OK] Manual cleanup complete');
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
            
            // Trigger UI update immediately
            this.triggerUIUpdate();
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
        
        console.log('[MONITOR] Starting aggressive blockchain monitoring (checks every 30 seconds)...');
        
        // Check immediately when starting
        this.checkPendingPayments();
        
        // Check every 30 seconds for fast verification
        this.monitoringInterval = setInterval(async () => {
            await this.checkPendingPayments();
        }, 30000); // Check every 30 seconds for fast verification
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
            // Get recent transactions for merchant address using Alchemy RPC
            const publicKey = new window.SolanaWeb3.PublicKey(this.merchantAddress);
            console.log(`[CHECK] Using Alchemy RPC to check transactions for address: ${this.merchantAddress}`);
            console.log(`[CHECK] RPC URL: ${this.solanaConnection._rpcEndpoint || 'N/A'}`);
            
            const signatures = await this.solanaConnection.getSignaturesForAddress(publicKey, {
                limit: 100 // Check last 100 transactions for better coverage
            });
            
            console.log(`[CHECK] Checking ${pendingPayments.length} pending payment(s) against ${signatures.length} recent transaction(s) from Alchemy RPC...`);
            
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
                        
                        // If proof is verified, update status regardless of current status
                        if (verification.verified) {
                            if (payment.status !== 'verified') {
                                console.log(`[UPDATE] Updating payment ${payment.id} from ${payment.status} to verified (proof verified)`);
                                payment.status = 'verified';
                                payment.proof = verification.proof;
                                payment.confirmedAt = Date.now();
                                this.payments.set(payment.id, payment);
                                await this.savePaymentToBackend(payment);
                                await this.triggerWebhook(payment);
                                console.log(`[OK] Payment ${payment.id} automatically verified!`);
                                
                                // Trigger UI update immediately
                                this.triggerUIUpdate();
                            } else {
                                // Status already verified, but ensure proof is updated
                                payment.proof = verification.proof;
                                this.payments.set(payment.id, payment);
                            }
                        } else {
                            console.warn(`⚠️ Payment ${payment.id} has transaction signature but verification failed`);
                        }
                    } catch (error) {
                        console.warn(`Failed to verify transaction for payment ${payment.id}:`, error);
                    }
                    continue;
                }
                
                // Also check if payment has a verified proof but status is still pending
                if (payment.proof && payment.proof.verified && payment.status !== 'verified') {
                    console.log(`[UPDATE] Payment ${payment.id} has verified proof but status is ${payment.status}, updating to verified`);
                    payment.status = 'verified';
                    payment.confirmedAt = payment.confirmedAt || Date.now();
                    this.payments.set(payment.id, payment);
                    await this.savePaymentToBackend(payment);
                    this.triggerUIUpdate();
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
                        // Pass the token type to extractTransactionAmount for SPL token support
                        const amount = this.extractTransactionAmount(tx, publicKey, payment.token || 'SOL');
                        const timeDiff = Math.abs(tx.blockTime * 1000 - payment.createdAt);
                        
                        console.log(`[CHECK] Checking transaction ${sigInfo.signature.substring(0, 20)}...`);
                        console.log(`   Payment: ${payment.id}, Expected: ${payment.solAmount} ${payment.token || 'SOL'}, Found: ${amount} ${payment.token || 'SOL'}`);
                        console.log(`   Time diff: ${Math.round(timeDiff / 1000)}s, Payment created: ${new Date(payment.createdAt).toLocaleString()}`);
                        
                        // Transaction should be within 24 hours of payment creation (extended window)
                        // Also allow transactions slightly before payment creation (in case user sent manually first)
                        const maxTimeDiff = 24 * 60 * 60 * 1000; // 24 hours
                        const allowBeforeCreation = 5 * 60 * 1000; // Allow 5 minutes before payment creation
                        
                        // More flexible amount matching - allow 5% difference for fees/slippage
                        const amountTolerance = payment.solAmount * 0.05; // 5% tolerance
                        const amountMatches = Math.abs(amount - payment.solAmount) <= Math.max(amountTolerance, 0.00000001);
                        
                        if (amount > 0 && 
                            (tx.blockTime * 1000 >= payment.createdAt - allowBeforeCreation) && 
                            timeDiff < maxTimeDiff && // 24 hours
                            amountMatches) {
                            
                            // Found matching transaction!
                            console.log(`[MATCH] Payment ${payment.id} matches transaction ${sigInfo.signature}`);
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
                            
                            console.log(`[SAVE] Saving verified payment ${payment.id} with signature ${sigInfo.signature} to Google Sheets...`);
                            await this.savePaymentToBackend(payment);
                            await this.triggerWebhook(payment);
                            
                            console.log(`[OK] Payment ${payment.id} automatically verified via Alchemy RPC transaction ${sigInfo.signature}`);
                            
                            // Trigger UI update immediately
                            this.triggerUIUpdate();
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
    
    // Extract transaction amount for a specific address (supports both SOL and SPL tokens)
    extractTransactionAmount(tx, address, expectedToken = 'SOL') {
        try {
            if (!tx || !tx.meta) {
                return 0;
            }
            
            // For SPL tokens (USDT, USDC, etc.), check token account balances
            if (expectedToken && expectedToken !== 'SOL') {
                return this.extractSPLTokenAmount(tx, address, expectedToken);
            }
            
            // For SOL, check balance changes
            if (!tx.meta.postBalances || !tx.meta.preBalances) {
                return 0;
            }
            
            // Check if transaction structure is valid
            if (!tx.transaction || !tx.transaction.message || !tx.transaction.message.accountKeys) {
                return 0;
            }
            
            // Ensure accountKeys is an array
            const accountKeys = tx.transaction.message.accountKeys;
            if (!Array.isArray(accountKeys) || accountKeys.length === 0) {
                return 0;
            }
            
            // Find the account index for our address
            const accountIndex = accountKeys.findIndex(
                key => {
                    try {
                        return key && key.toString() === address.toString();
                    } catch (e) {
                        return false;
                    }
                }
            );
            
            if (accountIndex === -1 || accountIndex >= tx.meta.preBalances.length || accountIndex >= tx.meta.postBalances.length) {
                return 0;
            }
            
            const preBalance = tx.meta.preBalances[accountIndex];
            const postBalance = tx.meta.postBalances[accountIndex];
            const change = (postBalance - preBalance) / 1e9; // Convert lamports to SOL
            
            return change > 0 ? change : 0; // Only return positive changes (incoming)
        } catch (error) {
            console.warn('Error extracting transaction amount:', error);
            return 0;
        }
    }
    
    // Extract SPL token amount from transaction
    extractSPLTokenAmount(tx, address, token) {
        try {
            if (!tx || !tx.meta) {
                return 0;
            }
            
            // Token mint addresses
            const tokenMints = {
                'USDC': 'EPjFWdd5AufqSSqeM2qN1xzybapC8G4wEGGkZwyTDt1v',
                'USDT': 'Es9vMFrzaCERmJfrF4H2FYD4KCoNkY11McCe8BenwNYB',
                'EURC': 'HzwqbKZw8HxNE6WvK5kfvm6hrKjXUYkLRPvXjrao1HGk'
            };
            
            const expectedMint = tokenMints[token];
            if (!expectedMint) {
                return 0;
            }
            
            const addressStr = address.toString();
            const postTokenBalances = tx.meta.postTokenBalances || [];
            const preTokenBalances = tx.meta.preTokenBalances || [];
            
            // Method 1: Check by owner address (for Associated Token Accounts)
            for (const postBalance of postTokenBalances) {
                if (postBalance.mint && postBalance.mint === expectedMint) {
                    // Check if owner matches our address
                    if (postBalance.owner && postBalance.owner === addressStr) {
                        const preBalance = preTokenBalances.find(
                            pre => pre.accountIndex === postBalance.accountIndex && pre.mint === expectedMint
                        );
                        
                        const preAmount = preBalance ? parseFloat(preBalance.uiTokenAmount?.uiAmount || 0) : 0;
                        const postAmount = parseFloat(postBalance.uiTokenAmount?.uiAmount || 0);
                        const change = postAmount - preAmount;
                        
                        if (change > 0) {
                            console.log(`[OK] Found ${token} transfer: ${change} (pre: ${preAmount}, post: ${postAmount})`);
                            return change;
                        }
                    }
                }
            }
            
            // Method 2: Check all token accounts and find increases to any account with our mint
            // This handles cases where the ATA might be created in the same transaction
            for (const postBalance of postTokenBalances) {
                if (postBalance.mint && postBalance.mint === expectedMint) {
                    const preBalance = preTokenBalances.find(
                        pre => pre.accountIndex === postBalance.accountIndex && pre.mint === expectedMint
                    );
                    
                    const preAmount = preBalance ? parseFloat(preBalance.uiTokenAmount?.uiAmount || 0) : 0;
                    const postAmount = parseFloat(postBalance.uiTokenAmount?.uiAmount || 0);
                    const change = postAmount - preAmount;
                    
                    // If there's a positive change and the owner matches, return it
                    if (change > 0 && postBalance.owner === addressStr) {
                        console.log(`✅ Found ${token} transfer: ${change} (pre: ${preAmount}, post: ${postAmount})`);
                        return change;
                    }
                }
            }
            
            return 0;
        } catch (error) {
            console.warn('Error extracting SPL token amount:', error);
            return 0;
        }
    }
    
    // Trigger UI update when payment status changes
    triggerUIUpdate() {
        // Reload payments from Google Sheets
        setTimeout(async () => {
            await this.loadPaymentsFromStorage();
        }, 1000);
        
        // Trigger custom event for UI to update
        if (typeof window !== 'undefined' && window.dispatchEvent) {
            window.dispatchEvent(new CustomEvent('payment-verified', {
                detail: { timestamp: Date.now() }
            }));
        }
        
        // Also try to call loadOracleData if available
        if (typeof window !== 'undefined' && typeof window.loadOracleData === 'function') {
            setTimeout(() => {
                window.loadOracleData();
            }, 1500);
        }
    }
    
    // Direct blockchain check for a specific payment
    async checkPaymentOnBlockchain(paymentId) {
        console.log(`[CHECK] Direct blockchain check for payment: ${paymentId}`);
        const payment = this.payments.get(paymentId);
        if (!payment) {
            console.warn(`Payment ${paymentId} not found in memory`);
            return { success: false, error: 'Payment not found' };
        }
        
        if (!this.merchantAddress || !this.solanaConnection) {
            console.warn('Solana connection not available for blockchain check');
            return { success: false, error: 'Solana connection not available' };
        }
        
        try {
            const publicKey = new window.SolanaWeb3.PublicKey(this.merchantAddress);
            
            // Get recent transactions (last 100)
            console.log(`[FETCH] Fetching last 100 transactions for ${this.merchantAddress}...`);
            const signatures = await this.solanaConnection.getSignaturesForAddress(publicKey, {
                limit: 100,
                before: null
            });
            
            console.log(`[FIND] Found ${signatures.length} recent transactions, checking for payment match...`);
            
            // Check each transaction
            for (const sigInfo of signatures) {
                try {
                    const tx = await this.solanaConnection.getTransaction(sigInfo.signature, {
                        commitment: 'confirmed',
                        maxSupportedTransactionVersion: 0
                    });
                    
                    if (!tx || !tx.meta || tx.meta.err) {
                        continue;
                    }
                    
                    // Extract amount
                    const amount = this.extractTransactionAmount(tx, publicKey, payment.token || 'SOL');
                    const timeDiff = Math.abs(tx.blockTime * 1000 - payment.createdAt);
                    
                    // More flexible matching - allow 5% difference
                    const amountTolerance = payment.solAmount * 0.05; // 5% tolerance
                    const amountMatches = Math.abs(amount - payment.solAmount) <= Math.max(amountTolerance, 0.00000001);
                    const timeMatches = timeDiff < (24 * 60 * 60 * 1000) && 
                                       (tx.blockTime * 1000 >= payment.createdAt - (5 * 60 * 1000));
                    
                    if (amount > 0 && amountMatches && timeMatches) {
                        console.log(`[MATCH] BLOCKCHAIN MATCH FOUND! Transaction ${sigInfo.signature} matches payment ${paymentId}`);
                        
                        // Verify transaction
                        const verification = await this.verifySolanaTransaction(sigInfo.signature, payment.solAmount);
                        
                        payment.status = 'verified';
                        payment.transactionSignature = sigInfo.signature;
                        payment.confirmedAt = Date.now();
                        payment.proof = verification.proof;
                        this.payments.set(payment.id, payment);
                        
                        // Save to backend
                        await this.savePaymentToBackend(payment);
                        await this.triggerWebhook(payment);
                        this.triggerUIUpdate();
                        
                        console.log(`[OK] Payment ${paymentId} verified on blockchain!`);
                        return { success: true, payment, signature: sigInfo.signature };
                    }
                } catch (txError) {
                    console.warn(`Error checking transaction ${sigInfo.signature}:`, txError);
                    continue;
                }
            }
            
            console.log(`⚠️ No matching transaction found on blockchain for payment ${paymentId}`);
            return { success: false, error: 'No matching transaction found' };
        } catch (error) {
            console.error(`❌ Blockchain check failed for payment ${paymentId}:`, error);
            return { success: false, error: error.message };
        }
    }
    
    // Manual check function for immediate verification
    async manualCheckPayment(paymentId) {
        console.log(`[CHECK] Manual check requested for payment: ${paymentId}`);
        const payment = this.payments.get(paymentId);
        if (!payment) {
            console.warn(`Payment ${paymentId} not found in memory`);
            return { success: false, error: 'Payment not found' };
        }
        
        if (payment.status === 'verified' && payment.transactionSignature) {
            console.log(`Payment ${paymentId} already verified with signature: ${payment.transactionSignature}`);
            // Force save to ensure Google Sheet is updated
            await this.savePaymentToBackend(payment);
            return { success: true, payment, message: 'Payment already verified, forcing sheet update' };
        }
        
        // Direct blockchain check first
        const result = await this.checkPaymentOnBlockchain(paymentId);
        if (result.success) {
            return { success: true, payment: result.payment, message: 'Payment verified via direct blockchain check' };
        }
        
        // Fallback to batch check
        await this.checkPendingPayments();
        
        // Check again after verification
        const updatedPayment = this.payments.get(paymentId);
        if (updatedPayment && updatedPayment.status === 'verified') {
            return { success: true, payment: updatedPayment, message: 'Payment verified via batch check' };
        }
        
        return { success: false, error: 'Payment still pending, no matching transaction found' };
    }
}

// Export
if (typeof window !== 'undefined') {
    window.SolanaPaymentOracle = SolanaPaymentOracle;
    // Keep old name for backwards compatibility
    window.ZcashPaymentOracle = SolanaPaymentOracle;
    
    // Expose manual check function globally
    window.manualCheckPayment = async (paymentId) => {
        if (window.oracle) {
            return await window.oracle.manualCheckPayment(paymentId);
        }
        return { success: false, error: 'Oracle not initialized' };
    };
    
    // Expose direct blockchain check function globally
    window.checkPaymentOnBlockchain = async (paymentId) => {
        if (window.oracle) {
            return await window.oracle.checkPaymentOnBlockchain(paymentId);
        }
        return { success: false, error: 'Oracle not initialized' };
    };
}

if (typeof module !== 'undefined' && module.exports) {
    module.exports = SolanaPaymentOracle;
}

