
class SolanaPayIntegration {
    constructor(oracle) {
        this.oracle = oracle;
        this.supportedTokens = {
            'SOL': { mint: 'So11111111111111111111111111111111111111112', decimals: 9 },
            'USDC': { mint: 'EPjFWdd5AufqSSqeM2qN1xzybapC8G4wEGGkZwyTDt1v', decimals: 6 },
            'USDT': { mint: 'Es9vMFrzaCERmJfrF4H2FYD4KCoNkY11McCe8BenwNYB', decimals: 6 },
            'EURC': { mint: 'HzwqbKZw8HxNE6WvK5kfvm6hrKjXUYkLRPvXjrao1HGk', decimals: 6 }
        };
    }
    
    // Generate Solana Pay URL
    generatePaymentURL(payment, options = {}) {
        if (!this.oracle || !this.oracle.merchantAddress) {
            console.error('Merchant address not set');
            return '';
        }
        
        const recipient = this.oracle.merchantAddress;
        const amount = payment.solAmount || payment.amount || 0;
        const token = payment.token || 'SOL';
        
        // Solana Pay URL format: solana:<recipient>?amount=<amount>&reference=<reference>
        if (token === 'SOL') {
            return `solana:${recipient}?amount=${amount}&reference=${payment.id}`;
        } else {
            const tokenMint = this.supportedTokens[token]?.mint;
            if (tokenMint) {
                return `solana:${recipient}?amount=${amount}&spl-token=${tokenMint}&reference=${payment.id}`;
            }
            return `solana:${recipient}?amount=${amount}&reference=${payment.id}`;
        }
    }
    
    // Generate QR code data for Solana Pay
    generateQRCodeData(payment, options = {}) {
        // Generate Solana Pay URL using the helper method
        const paymentURL = this.generatePaymentURL(payment, options);
        
        if (!paymentURL) {
            console.error('Failed to generate payment URL');
            return {
                url: '',
                data: '',
                format: 'solana-pay'
            };
        }
        
        return {
            url: paymentURL,
            data: paymentURL,
            format: 'solana-pay'
        };
    }
    
    // Create payment link (shareable URL)
    async createPaymentLink(payment, options = {}) {
        const {
            expiresIn = 3600, // 1 hour default
            allowPartial = false,
            metadata = {}
        } = options;
        
        const linkId = `link_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
        const expiresAt = Date.now() + (expiresIn * 1000);
        
        const paymentLink = {
            id: linkId,
            paymentId: payment.id,
            url: `${window.location.origin}/pay/${linkId}`,
            qrCode: this.generateQRCodeData(payment, options),
            expiresAt: expiresAt,
            allowPartial: allowPartial,
            metadata: metadata,
            status: 'active',
            createdAt: Date.now()
        };
        
        // Store in backend
        await this.savePaymentLink(paymentLink);
        
        return paymentLink;
    }
    
    async savePaymentLink(link) {
        try {
            await fetch(`${this.oracle.baseUrl}/api/payment-links`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(link)
            });
        } catch (error) {
            console.warn('Failed to save payment link:', error);
        }
    }
    
    // Generate invoice
    generateInvoice(payment, orderDetails = {}) {
        const invoice = {
            id: `inv_${Date.now()}`,
            paymentId: payment.id,
            orderId: payment.orderId || orderDetails.orderId,
            merchant: {
                name: orderDetails.merchantName || 'Merchant',
                address: payment.merchantAddress,
                email: orderDetails.merchantEmail
            },
            customer: {
                email: orderDetails.customerEmail,
                address: orderDetails.customerAddress
            },
            items: orderDetails.items || [],
            subtotal: payment.amount,
            tax: orderDetails.tax || 0,
            total: payment.amount + (orderDetails.tax || 0),
            currency: payment.currency || 'USD',
            token: payment.token || 'SOL',
            tokenAmount: payment.solAmount || payment.amount,
            status: payment.status,
            createdAt: payment.createdAt,
            dueDate: payment.expiresAt,
            paymentURL: this.generatePaymentURL(payment),
            qrCode: this.generateQRCodeData(payment)
        };
        
        return invoice;
    }
    
    // Validate Solana Pay transaction
    async validateTransaction(signature, expectedPayment) {
        try {
            const verification = await this.oracle.verifySolanaTransaction(
                signature,
                expectedPayment.solAmount || expectedPayment.amount
            );
            
            return {
                valid: verification.verified,
                transaction: verification.transaction,
                proof: verification.proof,
                amount: verification.amount
            };
        } catch (error) {
            return {
                valid: false,
                error: error.message
            };
        }
    }
    
    // Get token price - NO FALLBACK, MUST GET REAL PRICE
    async getTokenPrice(token, currency = 'USD') {
        const tokenMap = {
            'SOL': 'solana',
            'USDC': 'usd-coin',
            'USDT': 'tether',
            'EURC': 'euro-coin'
        };
        
        const coinId = tokenMap[token] || token;
        
        // Try multiple times with retries
        for (let attempt = 1; attempt <= 3; attempt++) {
            try {
                const response = await fetch(
                    `${this.oracle.baseUrl}/api/crypto-price?crypto=${coinId}&fiat=${currency}`
                );
                
                if (response.ok) {
                    const data = await response.json();
                    if (data.price && data.price > 0) {
                        console.log(`✅ Got ${token} price: $${data.price} (source: ${data.source || 'unknown'})`);
                        return data.price;
                    }
                } else if (response.status === 503) {
                    console.warn(`⚠️ Price API unavailable (attempt ${attempt}/3), retrying...`);
                    if (attempt < 3) {
                        await new Promise(resolve => setTimeout(resolve, 2000 * attempt));
                        continue;
                    }
                }
            } catch (error) {
                console.warn(`Failed to get ${token} price (attempt ${attempt}/3):`, error);
                if (attempt < 3) {
                    await new Promise(resolve => setTimeout(resolve, 2000 * attempt));
                    continue;
                }
            }
        }
        
        // If all attempts fail, throw error
        throw new Error(`Failed to fetch ${token} price after multiple attempts. Please check your connection and try again.`);
    }
    
    // Convert fiat to token amount
    async convertFiatToToken(fiatAmount, token, currency = 'USD') {
        const price = await this.getTokenPrice(token, currency);
        const tokenInfo = this.supportedTokens[token] || this.supportedTokens['SOL'];
        const amount = fiatAmount / price;
        
        // Round to token decimals
        const decimals = tokenInfo.decimals;
        return Math.round(amount * Math.pow(10, decimals)) / Math.pow(10, decimals);
    }
}

// Export
if (typeof window !== 'undefined') {
    window.SolanaPayIntegration = SolanaPayIntegration;
}

if (typeof module !== 'undefined' && module.exports) {
    module.exports = SolanaPayIntegration;
}

