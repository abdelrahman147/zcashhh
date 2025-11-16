
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
                // Use Alchemy RPC as default (most reliable)
                const rpcUrl = this.solanaRpcUrl || 'https://solana-mainnet.g.alchemy.com/v2/xXPi6FAKVWJqv9Ie5TgvOHQgTlrlfbp5';
                this.solanaConnection = new window.SolanaWeb3.Connection(rpcUrl, 'confirmed');
                console.log(`✅ Solana connection initialized with Alchemy RPC`);
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
                
                // Clean up expired payments immediately after loading
                // This ensures expired payments are removed as soon as they're loaded
                setTimeout(async () => {
                    console.log('🧹 Running automatic cleanup after loading payments...');
                    await this.cleanupExpiredPayments();
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
        
        console.log('🧹 Starting automatic payment cleanup (runs every 30 seconds)...');
        
        // Run cleanup immediately
        setTimeout(async () => {
            await this.cleanupExpiredPayments();
        }, 3000); // Wait 3 seconds after initialization
        
        // Then run cleanup every 30 seconds automatically
        this.cleanupInterval = setInterval(async () => {
            await this.cleanupExpiredPayments();
        }, 30000); // Check every 30 seconds
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
                    console.log(`✅ Cleaned up ${expiredFromSheets.length} expired pending payments from Google Sheets`);
                }
            } catch (error) {
                console.warn('Failed to check Google Sheets for expired payments:', error);
            }
        }
        
        const totalCleaned = expiredPayments.length + expiredFromSheets.length;
        if (totalCleaned > 0) {
            console.log(`✅ Total cleaned up: ${totalCleaned} expired pending payments`);
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
            
            // Group payments by Order ID to find duplicates
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
            let duplicatesDeleted = 0;
            for (const [orderId, payments] of paymentsByOrderId.entries()) {
                if (payments.length > 1) {
                    console.log(`🔍 Found ${payments.length} duplicate payments with Order ID: ${orderId}`);
                    
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
                    
                    console.log(`✅ Keeping 1 payment: ${toKeep.id} (status: ${toKeep.status}, Order ID: ${orderId})`);
                    console.log(`🗑️ Deleting ${toDelete.length} duplicate(s): ${toDelete.map(p => p.id).join(', ')}`);
                    
                    for (const duplicate of toDelete) {
                        try {
                            await this.paymentStorage.deleteExpiredPayment(duplicate.id);
                            this.payments.delete(duplicate.id);
                            duplicatesDeleted++;
                            console.log(`   ✓ Deleted duplicate: ${duplicate.id}`);
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
                    console.log(`🔍 Found ${payments.length} duplicate payments with same transaction signature: ${txSig.substring(0, 20)}...`);
                    
                    // Keep ONLY the first one, delete ALL the rest
                    const toKeep = payments[0];
                    const toDelete = payments.slice(1); // All except the first one
                    
                    console.log(`✅ Keeping 1 payment: ${toKeep.id} (TX: ${txSig.substring(0, 20)}...)`);
                    console.log(`🗑️ Deleting ${toDelete.length} duplicate(s): ${toDelete.map(p => p.id).join(', ')}`);
                    
                    for (const duplicate of toDelete) {
                        try {
                            await this.paymentStorage.deleteExpiredPayment(duplicate.id);
                            this.payments.delete(duplicate.id);
                            duplicatesDeleted++;
                            console.log(`   ✓ Deleted duplicate: ${duplicate.id}`);
                        } catch (error) {
                            console.warn(`   ✗ Failed to delete duplicate ${duplicate.id}:`, error);
                        }
                    }
                }
            }
            
            if (duplicatesDeleted > 0) {
                console.log(`✅ Automatically deleted ${duplicatesDeleted} duplicate payment(s)`);
            }
        } catch (error) {
            console.warn('Failed to check for duplicate payments:', error);
        }
    }
    
    // Manual cleanup function - can be called to clean up all expired payments immediately
    async cleanupAllExpiredPayments() {
        console.log('🧹 Starting manual cleanup of all expired pending payments...');
        await this.cleanupExpiredPayments();
        console.log('✅ Manual cleanup complete');
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
        
        console.log('🔍 Starting automatic payment monitoring (checks every 1 minute)...');
        
        // Check immediately when starting
        this.checkPendingPayments();
        
        // Then check every 1 minute
        this.monitoringInterval = setInterval(async () => {
            await this.checkPendingPayments();
        }, 60000); // Check every 1 minute (60000ms)
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
            // Check more transactions (100) to catch payments sent before monitoring started
            const publicKey = new window.SolanaWeb3.PublicKey(this.merchantAddress);
            const signatures = await this.solanaConnection.getSignaturesForAddress(publicKey, {
                limit: 100 // Increased from 20 to catch older transactions
            });
            
            console.log(`🔍 Checking ${pendingPayments.length} pending payment(s) against ${signatures.length} recent transaction(s)...`);
            
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
                            console.log(`✅ Payment ${payment.id} automatically verified!`);
                            
                            // Trigger UI update immediately
                            this.triggerUIUpdate();
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
                        // Pass the token type to extractTransactionAmount for SPL token support
                        const amount = this.extractTransactionAmount(tx, publicKey, payment.token || 'SOL');
                        const timeDiff = Math.abs(tx.blockTime * 1000 - payment.createdAt);
                        
                        console.log(`🔍 Checking transaction ${sigInfo.signature.substring(0, 20)}...`);
                        console.log(`   Payment: ${payment.id}, Expected: ${payment.solAmount} ${payment.token || 'SOL'}, Found: ${amount} ${payment.token || 'SOL'}`);
                        console.log(`   Time diff: ${Math.round(timeDiff / 1000)}s, Payment created: ${new Date(payment.createdAt).toLocaleString()}`);
                        
                        // Transaction should be within 24 hours of payment creation (extended window)
                        // Also allow transactions slightly before payment creation (in case user sent manually first)
                        const maxTimeDiff = 24 * 60 * 60 * 1000; // 24 hours
                        const allowBeforeCreation = 5 * 60 * 1000; // Allow 5 minutes before payment creation
                        
                        if (amount > 0 && 
                            (tx.blockTime * 1000 >= payment.createdAt - allowBeforeCreation) && 
                            timeDiff < maxTimeDiff && // 24 hours
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
                            
                            console.log(`✅ Payment ${payment.id} automatically verified via transaction ${sigInfo.signature}`);
                            
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
            if (!tx || !tx.meta || !tx.meta.postTokenBalances || !tx.meta.preTokenBalances) {
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
            
            // Find token account for our address
            const postTokenBalances = tx.meta.postTokenBalances || [];
            const preTokenBalances = tx.meta.preTokenBalances || [];
            
            // Look for token account that matches our address and token mint
            for (const postBalance of postTokenBalances) {
                if (postBalance.owner && postBalance.owner === address.toString() && 
                    postBalance.mint && postBalance.mint === expectedMint) {
                    
                    // Find corresponding pre-balance
                    const preBalance = preTokenBalances.find(
                        pre => pre.accountIndex === postBalance.accountIndex
                    );
                    
                    const preAmount = preBalance ? parseFloat(preBalance.uiTokenAmount.uiAmount || 0) : 0;
                    const postAmount = parseFloat(postBalance.uiTokenAmount.uiAmount || 0);
                    const change = postAmount - preAmount;
                    
                    if (change > 0) {
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

