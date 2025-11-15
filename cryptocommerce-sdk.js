
class CryptoCommerce {
    constructor(config = {}) {
        this.apiKey = config.apiKey || null;
        this.network = config.network || 'mainnet';
        this.baseUrl = config.baseUrl || window.location.origin;
        this.webhookUrl = config.webhookUrl || null;
        this.payments = new Map(); // Store payment requests
        this.eventListeners = new Map(); // Event handlers
        this.supportedCryptos = ['SOL', 'USDC', 'USDT', 'BTC', 'ETH'];
        this.supportedFiats = ['USD', 'EUR', 'GBP', 'JPY'];
        
        // Initialize Solana connection if available
        this.solanaConnection = null;
        this.solanaWallet = null;
        this.initSolana();
    }
    
    async initSolana() {
        if (typeof window !== 'undefined' && window.solana && window.solana.isPhantom) {
            try {
                // Load Solana Web3
                if (!window.SolanaWeb3) {
                    const script = document.createElement('script');
                    script.src = 'https://unpkg.com/@solana/web3.js@latest/lib/index.iife.min.js';
                    document.head.appendChild(script);
                    await new Promise((resolve) => {
                        script.onload = resolve;
                        setTimeout(resolve, 2000); // Fallback timeout
                    });
                }
                
                if (window.SolanaWeb3) {
                    const rpcUrl = this.network === 'mainnet' 
                        ? 'https://api.mainnet-beta.solana.com'
                        : 'https://api.devnet.solana.com';
                    this.solanaConnection = new window.SolanaWeb3.Connection(rpcUrl, 'confirmed');
                }
            } catch (error) {
                console.warn('Solana initialization failed:', error);
            }
        }
    }
    
    async createPayment(options) {
        const { amount, currency = 'USD', crypto = 'SOL', orderId, cart, shippingAddress, email } = options;
        
        if (!amount || amount <= 0) {
            throw new Error('Invalid amount: must be greater than 0');
        }
        
        if (!this.supportedFiats.includes(currency)) {
            throw new Error(`Unsupported fiat currency: ${currency}`);
        }
        
        if (!this.supportedCryptos.includes(crypto)) {
            throw new Error(`Unsupported cryptocurrency: ${crypto}`);
        }
        
        // Get current crypto price
        const cryptoAmount = await this.convertFiatToCrypto(amount, currency, crypto);
        
        // Generate payment ID
        const paymentId = `pay_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
        
        // Create payment request
        const payment = {
            id: paymentId,
            amount: parseFloat(amount),
            currency: currency,
            crypto: crypto,
            cryptoAmount: cryptoAmount,
            orderId: orderId || null,
            cart: cart || null,
            shippingAddress: shippingAddress || null,
            email: email || null,
            status: 'pending',
            createdAt: Date.now(),
            expiresAt: Date.now() + (15 * 60 * 1000), // 15 minutes
            qrCode: null,
            transactionHash: null,
            confirmedAt: null
        };
        
        // Generate QR code data
        payment.qrCode = this.generateQRCodeData(payment);
        
        // Store payment
        this.payments.set(paymentId, payment);
        
        // Start payment monitoring
        this.monitorPayment(paymentId);
        
        return {
            id: paymentId,
            amount: payment.amount,
            currency: payment.currency,
            crypto: payment.crypto,
            cryptoAmount: payment.cryptoAmount,
            qrCode: payment.qrCode,
            expiresAt: payment.expiresAt,
            showQRCode: () => this.showQRCodeModal(paymentId),
            showModal: () => this.showPaymentModal(paymentId)
        };
    }
    
    async checkout(cart, options = {}) {
        if (!cart || !cart.items || cart.items.length === 0) {
            throw new Error('Cart is empty');
        }
        
        const { crypto = 'SOL', shippingAddress, email } = options;
        const total = cart.getTotal();
        
        // Create payment
        const payment = await this.createPayment({
            amount: total,
            currency: 'USD',
            crypto: crypto,
            cart: cart.items,
            shippingAddress: shippingAddress,
            email: email
        });
        
        // Create order if order manager is available
        if (window.orderManager) {
            const order = window.orderManager.createOrder(cart, {
                crypto: crypto,
                cryptoAmount: payment.cryptoAmount,
                shippingAddress: shippingAddress,
                email: email
            });
            payment.orderId = order.id;
        }
        
        return payment;
    }
    
    async convertFiatToCrypto(fiatAmount, fiatCurrency, crypto) {
        try {
            // Try to get price from backend API
            const response = await fetch(`${this.baseUrl}/api/crypto-price?crypto=${crypto}&fiat=${fiatCurrency}`);
            if (response.ok) {
                const data = await response.json();
                if (data.price) {
                    return parseFloat((fiatAmount / data.price).toFixed(8));
                }
            }
        } catch (error) {
            console.warn('Price API failed, using fallback:', error);
        }
        
        // Fallback prices (approximate)
        const fallbackPrices = {
            'SOL': { 'USD': 100 },
            'USDC': { 'USD': 1 },
            'USDT': { 'USD': 1 },
            'BTC': { 'USD': 45000 },
            'ETH': { 'USD': 2500 }
        };
        
        const price = fallbackPrices[crypto]?.[fiatCurrency] || 1;
        return parseFloat((fiatAmount / price).toFixed(8));
    }
    
    generateQRCodeData(payment) {
        // Generate payment URI based on cryptocurrency
        let uri = '';
        
        if (payment.crypto === 'SOL') {
            // Solana payment URI
            const recipient = this.getMerchantAddress(payment.crypto);
            uri = `solana:${recipient}?amount=${payment.cryptoAmount}&reference=${payment.id}`;
        } else if (payment.crypto === 'USDC' || payment.crypto === 'USDT') {
            // SPL Token payment URI
            const recipient = this.getMerchantAddress(payment.crypto);
            const tokenMint = payment.crypto === 'USDC' 
                ? 'EPjFWdd5AufqSSqeM2qN1xzybapC8G4wEGGkZwyTDt1v' // USDC mainnet
                : 'Es9vMFrzaCERmJfrF4H2FYD4KCoNkY11McCe8BenwNYB'; // USDT mainnet
            uri = `solana:${recipient}?amount=${payment.cryptoAmount}&spl-token=${tokenMint}&reference=${payment.id}`;
        } else {
            // Generic format
            uri = `${payment.crypto.toLowerCase()}:${this.getMerchantAddress(payment.crypto)}?amount=${payment.cryptoAmount}&order=${payment.id}`;
        }
        
        return {
            uri: uri,
            data: payment.id,
            amount: payment.cryptoAmount,
            crypto: payment.crypto
        };
    }
    
    getMerchantAddress(crypto) {
        // Get merchant address from config or use default
        // In production, this would come from your backend/API
        if (crypto === 'SOL' || crypto === 'USDC' || crypto === 'USDT') {
            // Return merchant's Solana address
            return this.solanaWallet || 'Hw87YF66ND8v7yAyJKEJqMvDxZrHAHiHy8qsWghddC2Z';
        }
        // For other cryptos, return appropriate address format
        return 'default-address';
    }
    
    async getPaymentStatus(paymentId) {
        const payment = this.payments.get(paymentId);
        
        if (!payment) {
            throw new Error('Payment not found');
        }
        
        // Check if payment expired
        if (Date.now() > payment.expiresAt) {
            payment.status = 'expired';
            return {
                id: paymentId,
                status: 'expired',
                amount: payment.amount,
                currency: payment.currency
            };
        }
        
        // Check blockchain for payment confirmation
        if (payment.crypto === 'SOL' || payment.crypto === 'USDC' || payment.crypto === 'USDT') {
            await this.checkSolanaPayment(payment);
        }
        
        return {
            id: paymentId,
            status: payment.status,
            amount: payment.amount,
            currency: payment.currency,
            crypto: payment.crypto,
            cryptoAmount: payment.cryptoAmount,
            transactionHash: payment.transactionHash,
            confirmedAt: payment.confirmedAt
        };
    }
    
    async checkSolanaPayment(payment) {
        if (!this.solanaConnection) {
            return;
        }
        
        try {
            const merchantAddress = this.getMerchantAddress(payment.crypto);
            const pubkey = new window.SolanaWeb3.PublicKey(merchantAddress);
            
            // Get recent signatures for the merchant address
            const signatures = await this.solanaConnection.getSignaturesForAddress(pubkey, {
                limit: 10
            });
            
            // Check if any transaction matches our payment
            for (const sigInfo of signatures) {
                if (sigInfo.blockTime && sigInfo.blockTime * 1000 >= payment.createdAt) {
                    const tx = await this.solanaConnection.getTransaction(sigInfo.signature, {
                        commitment: 'confirmed'
                    });
                    
                    if (tx && tx.meta && !tx.meta.err) {
                        // Check if transaction amount matches
                        const postBalances = tx.meta.postBalances || [];
                        const preBalances = tx.meta.preBalances || [];
                        const balanceChange = (postBalances[0] - preBalances[0]) / 1e9; // Convert lamports to SOL
                        
                        // Check memo for payment ID
                        const memo = this.extractMemo(tx);
                        if (memo && memo.includes(payment.id)) {
                            payment.status = 'confirmed';
                            payment.transactionHash = sigInfo.signature;
                            payment.confirmedAt = sigInfo.blockTime * 1000;
                            this.triggerEvent('payment.confirmed', payment);
                            return;
                        }
                        
                        // Check if amount matches (within 1% tolerance)
                        const expectedAmount = payment.cryptoAmount;
                        if (Math.abs(balanceChange - expectedAmount) / expectedAmount < 0.01) {
                            payment.status = 'confirmed';
                            payment.transactionHash = sigInfo.signature;
                            payment.confirmedAt = sigInfo.blockTime * 1000;
                            this.triggerEvent('payment.confirmed', payment);
                            return;
                        }
                    }
                }
            }
        } catch (error) {
            console.error('Error checking Solana payment:', error);
        }
    }
    
    extractMemo(tx) {
        if (!tx || !tx.transaction || !tx.transaction.message) {
            return null;
        }
        
        const instructions = tx.transaction.message.instructions || [];
        for (const ix of instructions) {
            if (ix.programId && ix.data) {
                try {
                    const memoProgram = new window.SolanaWeb3.PublicKey('MemoSq4gqABAXKb96qnH8TysNcWxMyWCqXgDLGmfcHr');
                    if (ix.programId.equals(memoProgram)) {
                        return Buffer.from(ix.data).toString('utf8');
                    }
                } catch (e) {
                    // Ignore
                }
            }
        }
        return null;
    }
    
    monitorPayment(paymentId) {
        // Check payment status every 5 seconds
        const interval = setInterval(async () => {
            const payment = this.payments.get(paymentId);
            
            if (!payment) {
                clearInterval(interval);
                return;
            }
            
            if (payment.status === 'confirmed' || payment.status === 'expired' || payment.status === 'cancelled') {
                clearInterval(interval);
                return;
            }
            
            // Check payment status
            await this.getPaymentStatus(paymentId);
        }, 5000);
    }
    
    showQRCodeModal(paymentId) {
        const payment = this.payments.get(paymentId);
        if (!payment) {
            throw new Error('Payment not found');
        }
        
        // Create and show modal
        this.createPaymentModal(payment);
    }
    
    showPaymentModal(paymentId) {
        this.showQRCodeModal(paymentId);
    }
    
    createPaymentModal(payment) {
        // Remove existing modal if any
        const existing = document.getElementById('cryptocommerce-modal');
        if (existing) {
            existing.remove();
        }
        
        // Create modal
        const modal = document.createElement('div');
        modal.id = 'cryptocommerce-modal';
        modal.className = 'cryptocommerce-modal';
        modal.innerHTML = `
            <div class="cryptocommerce-modal-overlay"></div>
            <div class="cryptocommerce-modal-content">
                <button class="cryptocommerce-modal-close">&times;</button>
                <h2>Pay with ${payment.crypto}</h2>
                <div class="cryptocommerce-payment-info">
                    <div class="payment-amount">
                        <span class="fiat-amount">${payment.amount} ${payment.currency}</span>
                        <span class="crypto-amount">≈ ${payment.cryptoAmount} ${payment.crypto}</span>
                    </div>
                    <div class="payment-status" id="payment-status-${payment.id}">
                        Status: <span class="status-badge status-${payment.status}">${payment.status}</span>
                    </div>
                </div>
                <div class="cryptocommerce-qr-code" id="qr-code-${payment.id}">
                    <div class="qr-placeholder">Loading QR code...</div>
                </div>
                <div class="cryptocommerce-payment-actions">
                    <button class="btn-copy-address" data-address="${this.getMerchantAddress(payment.crypto)}">
                        Copy Address
                    </button>
                    <button class="btn-connect-wallet" onclick="window.cryptocommerce?.connectWallet()">
                        Connect Wallet & Pay
                    </button>
                </div>
                <div class="cryptocommerce-payment-expiry">
                    Expires in: <span id="expiry-${payment.id}">15:00</span>
                </div>
            </div>
        `;
        
        document.body.appendChild(modal);
        
        // Generate QR code
        this.generateQRCodeImage(payment.qrCode.uri, `qr-code-${payment.id}`);
        
        // Close button
        modal.querySelector('.cryptocommerce-modal-close').addEventListener('click', () => {
            modal.remove();
        });
        
        modal.querySelector('.cryptocommerce-modal-overlay').addEventListener('click', () => {
            modal.remove();
        });
        
        // Copy address button
        modal.querySelector('.btn-copy-address').addEventListener('click', (e) => {
            const address = e.target.getAttribute('data-address');
            navigator.clipboard.writeText(address);
            e.target.textContent = 'Copied!';
            setTimeout(() => {
                e.target.textContent = 'Copy Address';
            }, 2000);
        });
        
        // Update expiry timer
        this.startExpiryTimer(payment.id, payment.expiresAt);
    }
    
    generateQRCodeImage(data, containerId) {
        // Use QR code library or API
        const container = document.getElementById(containerId);
        if (!container) return;
        
        // Simple QR code using API
        const qrUrl = `https://api.qrserver.com/v1/create-qr-code/?size=300x300&data=${encodeURIComponent(data)}`;
        container.innerHTML = `<img src="${qrUrl}" alt="Payment QR Code" />`;
    }
    
    startExpiryTimer(paymentId, expiresAt) {
        const updateTimer = () => {
            const remaining = Math.max(0, expiresAt - Date.now());
            const minutes = Math.floor(remaining / 60000);
            const seconds = Math.floor((remaining % 60000) / 1000);
            const timeString = `${minutes}:${seconds.toString().padStart(2, '0')}`;
            
            const expiryEl = document.getElementById(`expiry-${paymentId}`);
            if (expiryEl) {
                expiryEl.textContent = timeString;
            }
            
            if (remaining > 0) {
                setTimeout(updateTimer, 1000);
            }
        };
        updateTimer();
    }
    
    async connectWallet() {
        if (!window.solana || !window.solana.isPhantom) {
            alert('Please install Phantom wallet from https://phantom.app');
            return;
        }
        
        try {
            const resp = await window.solana.connect();
            this.solanaWallet = resp.publicKey.toString();
            return this.solanaWallet;
        } catch (error) {
            console.error('Wallet connection failed:', error);
            throw error;
        }
    }
    
    getSupportedCurrencies() {
        return {
            cryptocurrencies: this.supportedCryptos,
            fiatCurrencies: this.supportedFiats
        };
    }
    
    on(event, callback) {
        if (!this.eventListeners.has(event)) {
            this.eventListeners.set(event, []);
        }
        this.eventListeners.get(event).push(callback);
    }
    
    off(event, callback) {
        if (this.eventListeners.has(event)) {
            const listeners = this.eventListeners.get(event);
            const index = listeners.indexOf(callback);
            if (index > -1) {
                listeners.splice(index, 1);
            }
        }
    }
    
    triggerEvent(event, data) {
        if (this.eventListeners.has(event)) {
            this.eventListeners.get(event).forEach(callback => {
                try {
                    callback(data);
                } catch (error) {
                    console.error('Event callback error:', error);
                }
            });
        }
        
        // Also trigger webhook if configured
        if (this.webhookUrl && event === 'payment.confirmed') {
            this.sendWebhook(event, data);
        }
    }
    
    async sendWebhook(event, data) {
        try {
            await fetch(this.webhookUrl, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json'
                },
                body: JSON.stringify({
                    event: event,
                    data: data,
                    timestamp: Date.now()
                })
            });
        } catch (error) {
            console.error('Webhook failed:', error);
        }
    }
}

// Export for use
if (typeof window !== 'undefined') {
    window.CryptoCommerce = CryptoCommerce;
    window.cryptocommerce = new CryptoCommerce();
}

if (typeof module !== 'undefined' && module.exports) {
    module.exports = CryptoCommerce;
}

