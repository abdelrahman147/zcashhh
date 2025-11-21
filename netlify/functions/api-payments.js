const fetch = require('node-fetch');
const { loadPaymentFromSheets } = require('./oracle-payments');

const SITE_URL = (process.env.URL || 'https://zecit.online').replace(/\/$/, '');
const MERCHANT_ADDRESS = process.env.MERCHANT_ADDRESS || null;
const PAYMENT_PAGE_URL = process.env.PAYMENT_PAGE_URL || `${SITE_URL}/pay`;

const SUPPORTED_TOKENS = {
    SOL: { priceKey: 'solana', decimals: 9 },
    USDC: { priceKey: 'usd-coin', decimals: 6 },
    USDT: { priceKey: 'tether', decimals: 6 },
    EURC: { priceKey: 'euro-coin', decimals: 6 }
};

const baseHeaders = {
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Headers': 'Content-Type, Authorization',
    'Access-Control-Allow-Methods': 'GET, POST, OPTIONS'
};

exports.handler = async (event) => {
    if (event.httpMethod === 'OPTIONS') {
        return {
            statusCode: 200,
            headers: baseHeaders,
            body: ''
        };
    }
    
    const method = event.httpMethod || 'GET';
    const normalizedPath = normalizePath(event.path || '');
    
    try {
        if (method === 'POST' && normalizedPath === '/api/payments') {
            return await handleCreatePayment(event);
        }
        
        if (method === 'GET') {
            const parts = normalizedPath.split('/').filter(Boolean);
            if (parts.length >= 3 && parts[0] === 'api' && parts[1] === 'payments') {
                const paymentId = parts[2];
                return await handleGetPayment(paymentId);
            }
        }
        
        return jsonResponse(405, { error: 'Method not allowed' });
    } catch (error) {
        console.error('API payments error:', error);
        return jsonResponse(500, { error: error.message || 'Internal server error' });
    }
};

async function handleCreatePayment(event) {
    let payload;
    try {
        payload = JSON.parse(event.body || '{}');
    } catch {
        return jsonResponse(400, { error: 'Invalid JSON body' });
    }
    
    const amount = Number(payload.amount);
    if (!Number.isFinite(amount) || amount <= 0) {
        return jsonResponse(400, { error: 'amount must be a positive number' });
    }
    
    const currency = String(payload.currency || 'USD').toUpperCase();
    const token = String(payload.token || 'SOL').toUpperCase();
    const tokenInfo = SUPPORTED_TOKENS[token];
    
    if (!tokenInfo) {
        return jsonResponse(400, { error: `Unsupported token "${token}". Supported tokens: ${Object.keys(SUPPORTED_TOKENS).join(', ')}` });
    }
    
    const merchantAddress = String(payload.merchantAddress || MERCHANT_ADDRESS || '').trim();
    if (!merchantAddress) {
        return jsonResponse(400, { error: 'merchantAddress required. Pass it in the request body or configure MERCHANT_ADDRESS.' });
    }
    
    const allowPartial = Boolean(payload.allowPartial);
    const metadata = typeof payload.metadata === 'object' && payload.metadata !== null ? payload.metadata : {};
    
    let orderId = payload.orderId ? String(payload.orderId).trim() : '';
    if (!orderId) {
        orderId = `ORDER-${Date.now()}-${Math.random().toString(36).substr(2, 9).toUpperCase()}`;
    }
    
    const tokenPrice = await fetchTokenPrice(tokenInfo.priceKey, currency);
    const tokenAmount = roundTokenAmount(amount / tokenPrice, tokenInfo.decimals);
    
    const now = Date.now();
    const payment = {
        id: generatePaymentId(),
        amount,
        currency,
        token,
        solAmount: tokenAmount,
        orderId,
        merchantAddress,
        status: 'pending',
        createdAt: now,
        expiresAt: now + 15 * 60 * 1000,
        transactionSignature: null,
        proof: null,
        allowPartial,
        metadata,
        source: 'api'
    };
    
    await persistPayment(payment);
    
    const paymentUrl = `${PAYMENT_PAGE_URL.replace(/\/$/, '')}/${encodeURIComponent(payment.id)}`;
    
    return jsonResponse(201, {
        success: true,
        payment: {
            id: payment.id,
            amount: payment.amount,
            currency: payment.currency,
            token: payment.token,
            solAmount: payment.solAmount,
            tokenAmount: payment.solAmount,
            orderId: payment.orderId,
            status: payment.status,
            createdAt: payment.createdAt,
            expiresAt: payment.expiresAt,
            merchantAddress: payment.merchantAddress,
            paymentUrl
        }
    });
}

async function handleGetPayment(paymentId) {
    if (!paymentId) {
        return jsonResponse(400, { error: 'Payment ID required' });
    }
    
    const payment = await loadPaymentFromSheets(paymentId);
    if (!payment) {
        return jsonResponse(404, { error: 'Payment not found' });
    }
    
    const paymentUrl = `${PAYMENT_PAGE_URL.replace(/\/$/, '')}/${encodeURIComponent(payment.id)}`;
    const proof = payment.proof && Object.keys(payment.proof || {}).length > 0 ? payment.proof : null;
    
    return jsonResponse(200, {
        paymentId: payment.id,
        status: payment.status,
        amount: payment.amount,
        currency: payment.currency,
        token: payment.token,
        solAmount: payment.solAmount,
        tokenAmount: payment.solAmount,
        merchantAddress: payment.merchantAddress,
        orderId: payment.orderId,
        createdAt: payment.createdAt,
        confirmedAt: payment.confirmedAt || null,
        transactionSignature: payment.transactionSignature || null,
        paymentUrl,
        proof
    });
}

async function fetchTokenPrice(cryptoKey, currency) {
    const fiatLower = (currency || 'USD').toLowerCase();
    const coinId = cryptoKey.toLowerCase();
    const url = `https://api.coingecko.com/api/v3/simple/price?ids=${encodeURIComponent(coinId)}&vs_currencies=${encodeURIComponent(fiatLower)}`;
    
    for (let attempt = 1; attempt <= 3; attempt++) {
        try {
            const controller = new AbortController();
            const timeout = setTimeout(() => controller.abort(), 5000);
            const response = await fetch(url, { signal: controller.signal, headers: { 'accept': 'application/json' } });
            clearTimeout(timeout);
            if (response.ok) {
                const data = await response.json();
                const price = data[coinId]?.[fiatLower];
                if (price && price > 0) {
                    return price;
                }
            }
        } catch (error) {
            if (attempt === 3) {
                console.warn(`Token price fetch failed for ${coinId}:`, error.message || error);
            }
        }
        await new Promise(resolve => setTimeout(resolve, attempt * 500));
    }
    
    // Fallbacks for stablecoins to avoid blocking API
    const fallback = {
        'tether': 1,
        'usd-coin': 1,
        'euro-coin': fiatLower === 'usd' ? 1.09 : 1,
        'solana': 100
    }[coinId];
    
    if (fallback) {
        return fallback;
    }
    
    throw new Error('Unable to fetch token price');
}

function roundTokenAmount(value, decimals = 6) {
    const multiplier = Math.pow(10, decimals);
    return Math.round(value * multiplier) / multiplier;
}

async function persistPayment(payment) {
    const saveUrl = `${SITE_URL}/api/oracle/payments`;
    const response = await fetch(saveUrl, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payment)
    });
    
    if (!response.ok) {
        const text = await response.text().catch(() => '');
        console.error('Failed to save payment via oracle endpoint:', response.status, text);
        throw new Error('Failed to persist payment');
    }
}

function generatePaymentId() {
    return `pay_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
}

function normalizePath(path) {
    if (!path) return '/api/payments';
    if (path.startsWith('/.netlify/functions/api-payments')) {
        return path.replace('/.netlify/functions/api-payments', '/api/payments');
    }
    return path;
}

function jsonResponse(statusCode, body) {
    return {
        statusCode,
        headers: {
            ...baseHeaders,
            'Content-Type': 'application/json'
        },
        body: JSON.stringify(body)
    };
}

