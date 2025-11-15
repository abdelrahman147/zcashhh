// Price cache that updates every 3 minutes
class PriceCache {
    constructor() {
        this.cache = new Map();
        this.updateInterval = 3 * 60 * 1000; // 3 minutes
        this.updatePromises = new Map(); // Prevent concurrent updates
    }
    
    async getPrice(crypto, fiat = 'USD', forceRefresh = false) {
        const key = `${crypto.toLowerCase()}_${fiat.toLowerCase()}`;
        const cached = this.cache.get(key);
        
        // Return cached price if still valid and not forcing refresh
        if (!forceRefresh && cached && cached.expiresAt > Date.now()) {
            console.log(`📦 Using cached price for ${crypto}: $${cached.price} (expires in ${Math.round((cached.expiresAt - Date.now()) / 1000)}s)`);
            return cached.price;
        }
        
        // If update is already in progress, wait for it
        if (this.updatePromises.has(key)) {
            console.log(`⏳ Waiting for price update for ${crypto}...`);
            return await this.updatePromises.get(key);
        }
        
        // Start new update
        const updatePromise = this.fetchPrice(crypto, fiat);
        this.updatePromises.set(key, updatePromise);
        
        try {
            const price = await updatePromise;
            return price;
        } finally {
            this.updatePromises.delete(key);
        }
    }
    
    async fetchPrice(crypto, fiat = 'USD') {
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
                        const key = `${crypto.toLowerCase()}_${fiatLower}`;
                        this.cache.set(key, {
                            price: price,
                            fetchedAt: Date.now(),
                            expiresAt: Date.now() + this.updateInterval,
                            source: 'coingecko-direct'
                        });
                        console.log(`✅ Got real price for ${crypto}: $${price} (cached for 3 minutes)`);
                        return price;
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
                            const key = `${crypto.toLowerCase()}_${fiatLower}`;
                            this.cache.set(key, {
                                price: price,
                                fetchedAt: Date.now(),
                                expiresAt: Date.now() + this.updateInterval,
                                source: 'coingecko-search'
                            });
                            console.log(`✅ Got real price via search for ${crypto}: $${price} (cached for 3 minutes)`);
                            return price;
                        }
                    }
                }
            }
        } catch (error) {
            console.warn('Search method failed:', error.message);
        }
        
        // If we have a stale cache, use it
        const key = `${crypto.toLowerCase()}_${fiatLower}`;
        const staleCache = this.cache.get(key);
        if (staleCache) {
            console.warn(`⚠️ Using stale cached price for ${crypto}: $${staleCache.price} (${Math.round((Date.now() - staleCache.fetchedAt) / 1000 / 60)} minutes old)`);
            return staleCache.price;
        }
        
        throw new Error(`Failed to fetch price for ${crypto} after multiple attempts`);
    }
    
    // Start background updates every 3 minutes
    startAutoUpdate(cryptos = ['solana', 'usd-coin', 'tether', 'euro-coin']) {
        console.log(`🔄 Starting price cache auto-update (every 3 minutes) for: ${cryptos.join(', ')}`);
        
        // Initial fetch
        this.updateAll(cryptos);
        
        // Set up interval
        setInterval(() => {
            this.updateAll(cryptos);
        }, this.updateInterval);
    }
    
    async updateAll(cryptos) {
        console.log(`🔄 Updating price cache for ${cryptos.length} cryptos...`);
        const promises = cryptos.map(crypto => 
            this.getPrice(crypto, 'USD', true).catch(err => {
                console.warn(`Failed to update price for ${crypto}:`, err.message);
            })
        );
        await Promise.all(promises);
        console.log(`✅ Price cache update complete`);
    }
    
    getCacheInfo() {
        const info = {};
        for (const [key, value] of this.cache.entries()) {
            info[key] = {
                price: value.price,
                age: Math.round((Date.now() - value.fetchedAt) / 1000),
                expiresIn: Math.round((value.expiresAt - Date.now()) / 1000),
                source: value.source
            };
        }
        return info;
    }
}

// Create global instance
if (typeof module !== 'undefined' && module.exports) {
    module.exports = PriceCache;
}

