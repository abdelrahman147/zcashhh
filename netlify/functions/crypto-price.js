const fetch = require('node-fetch');

// Price cache that updates every 3 minutes
const priceCache = new Map();
const CACHE_DURATION = 3 * 60 * 1000; // 3 minutes
const updatePromises = new Map(); // Prevent concurrent updates

async function getCachedPrice(crypto, fiat) {
    const key = `${crypto.toLowerCase()}_${fiat.toLowerCase()}`;
    const cached = priceCache.get(key);
    
    // Return cached price if still valid
    if (cached && cached.expiresAt > Date.now()) {
        console.log(`📦 Using cached price for ${crypto}: $${cached.price} (expires in ${Math.round((cached.expiresAt - Date.now()) / 1000)}s)`);
        return cached;
    }
    
    // If update is already in progress, wait for it
    if (updatePromises.has(key)) {
        console.log(`⏳ Waiting for price update for ${crypto}...`);
        return await updatePromises.get(key);
    }
    
    // Start new update
    const updatePromise = fetchPriceFromCoinGecko(crypto, fiat);
    updatePromises.set(key, updatePromise);
    
    try {
        const result = await updatePromise;
        return result;
    } finally {
        updatePromises.delete(key);
    }
}

async function fetchPriceFromCoinGecko(crypto, fiat) {
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
    
    // METHOD 1: Direct CoinGecko API call with retries
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
    
    // METHOD 2: Try CoinGecko search + price
    try {
        const searchUrl = `https://api.coingecko.com/api/v3/search?query=${coinId}`;
        console.log(`🔍 Searching CoinGecko for: ${coinId}`);
        
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
    
    // If we have a stale cache, use it
    const staleCache = priceCache.get(key);
    if (staleCache) {
        console.warn(`⚠️ Using stale cached price for ${crypto}: $${staleCache.price} (${Math.round((Date.now() - staleCache.fetchedAt) / 1000 / 60)} minutes old)`);
        return staleCache;
    }
    
    throw new Error(`Failed to fetch price for ${crypto} after multiple attempts`);
}

exports.handler = async (event, context) => {
    // Handle OPTIONS preflight
    if (event.httpMethod === 'OPTIONS') {
        return {
            statusCode: 200,
            headers: {
                'Access-Control-Allow-Origin': '*',
                'Access-Control-Allow-Headers': 'Content-Type',
                'Access-Control-Allow-Methods': 'GET, OPTIONS'
            },
            body: ''
        };
    }
    
    if (event.httpMethod !== 'GET') {
        return {
            statusCode: 405,
            headers: {
                'Access-Control-Allow-Origin': '*',
                'Content-Type': 'application/json'
            },
            body: JSON.stringify({ error: 'Method not allowed' })
        };
    }

    try {
        const { crypto, fiat = 'USD' } = event.queryStringParameters || {};
        
        if (!crypto) {
            return {
                statusCode: 400,
                headers: {
                    'Access-Control-Allow-Origin': '*',
                    'Content-Type': 'application/json'
                },
                body: JSON.stringify({ error: 'crypto parameter required' })
            };
        }
        
        // Map common symbols to CoinGecko IDs
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
        
        // Use cached price (updates every 3 minutes)
        try {
            const cached = await getCachedPrice(crypto, fiat);
            return {
                statusCode: 200,
                headers: {
                    'Access-Control-Allow-Origin': '*',
                    'Content-Type': 'application/json'
                },
                body: JSON.stringify({ 
                    crypto, 
                    fiat, 
                    price: cached.price, 
                    source: cached.source,
                    cached: true,
                    age: Math.round((Date.now() - cached.fetchedAt) / 1000),
                    expiresIn: Math.round((cached.expiresAt - Date.now()) / 1000)
                })
            };
        } catch (error) {
            console.error(`❌ Failed to get price for ${crypto}:`, error.message);
            return {
                statusCode: 503,
                headers: {
                    'Access-Control-Allow-Origin': '*',
                    'Content-Type': 'application/json'
                },
                body: JSON.stringify({ 
                    error: 'Failed to fetch price from CoinGecko after multiple attempts',
                    crypto: crypto,
                    fiat: fiat,
                    details: error.message
                })
            };
        }
        
    } catch (error) {
        console.error('Price API error:', error);
        return {
            statusCode: 500,
            headers: {
                'Access-Control-Allow-Origin': '*',
                'Content-Type': 'application/json'
            },
            body: JSON.stringify({ error: 'Failed to get price', details: error.message })
        };
    }
};

