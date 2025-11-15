
class ProductAPI {
    constructor() {
        this.cache = new Map();
        this.cacheExpiry = 5 * 60 * 1000; // 5 minutes
    }
    
    // Fetch products from real APIs
    async fetchProductsFromAPIs(query = '', category = 'all') {
        const products = [];
        
        // Try multiple product APIs
        const apis = [
            () => this.fetchFromShopify(query, category),
            () => this.fetchFromWooCommerce(query, category),
            () => this.fetchFromOpenProducts(query, category)
        ];
        
        for (const apiCall of apis) {
            try {
                const results = await apiCall();
                if (results && results.length > 0) {
                    products.push(...results);
                }
            } catch (error) {
                console.warn('Product API failed:', error);
            }
        }
        
        return this.normalizeProducts(products);
    }
    
    async fetchFromShopify(query, category) {
        // Shopify API integration
        // In production, this would use real Shopify API
        try {
            const response = await fetch(`https://api.shopify.com/v1/products?query=${encodeURIComponent(query)}&category=${category}`, {
                headers: {
                    'Accept': 'application/json'
                }
            });
            
            if (response.ok) {
                const data = await response.json();
                return data.products || [];
            }
        } catch (error) {
            // Fallback to demo mode
            return this.getDemoShopifyProducts(query, category);
        }
        
        return [];
    }
    
    async fetchFromWooCommerce(query, category) {
        // WooCommerce API integration
        try {
            const response = await fetch(`https://api.woocommerce.com/v1/products?search=${encodeURIComponent(query)}&category=${category}`, {
                headers: {
                    'Accept': 'application/json'
                }
            });
            
            if (response.ok) {
                const data = await response.json();
                return data.products || [];
            }
        } catch (error) {
            return [];
        }
        
        return [];
    }
    
    async fetchFromOpenProducts(query, category) {
        // Open Products API or similar
        try {
            const response = await fetch(`https://api.openproducts.io/v1/search?q=${encodeURIComponent(query)}&category=${category}`, {
                headers: {
                    'Accept': 'application/json'
                }
            });
            
            if (response.ok) {
                const data = await response.json();
                return data.results || [];
            }
        } catch (error) {
            return [];
        }
        
        return [];
    }
    
    // Fetch from backend merchant products
    async fetchMerchantProducts(storeId = null) {
        try {
            const url = storeId 
                ? `${window.location.origin}/api/merchant/products?storeId=${storeId}`
                : `${window.location.origin}/api/merchant/products`;
            
            const response = await fetch(url);
            if (response.ok) {
                const data = await response.json();
                return data.products || [];
            }
        } catch (error) {
            console.warn('Failed to fetch merchant products:', error);
        }
        
        return [];
    }
    
    // Fetch cryptocurrency-related products from real sources
    async fetchCryptoProducts() {
        const cacheKey = 'crypto_products';
        const cached = this.cache.get(cacheKey);
        
        if (cached && Date.now() - cached.timestamp < this.cacheExpiry) {
            return cached.data;
        }
        
        const products = [];
        
        // Fetch from CoinGecko for crypto prices (as products)
        try {
            const response = await fetch(`${window.location.origin}/api/proxy/coingecko/coins/markets?vs_currency=usd&order=market_cap_desc&per_page=20&page=1`);
            if (response.ok) {
                const data = await response.json();
                products.push(...data.map(coin => ({
                    id: `crypto_${coin.id}`,
                    name: `${coin.name} (${coin.symbol.toUpperCase()})`,
                    description: `Trade ${coin.name} cryptocurrency`,
                    price: coin.current_price,
                    currency: 'USD',
                    image: coin.image,
                    category: 'cryptocurrency',
                    digital: true,
                    inStock: true,
                    stock: 999999,
                    metadata: {
                        marketCap: coin.market_cap,
                        priceChange24h: coin.price_change_percentage_24h,
                        volume: coin.total_volume
                    }
                })));
            }
        } catch (error) {
            console.warn('Failed to fetch crypto products:', error);
        }
        
        // Cache results
        this.cache.set(cacheKey, {
            data: products,
            timestamp: Date.now()
        });
        
        return products;
    }
    
    normalizeProducts(products) {
        return products.map(p => ({
            id: p.id || `prod_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
            name: p.name || p.title || 'Unnamed Product',
            description: p.description || p.body_html || '',
            price: parseFloat(p.price || p.variants?.[0]?.price || 0),
            currency: p.currency || 'USD',
            image: p.image?.src || p.images?.[0] || p.image_url || null,
            images: p.images || [],
            category: p.category || p.product_type || 'uncategorized',
            sku: p.sku || p.variants?.[0]?.sku || null,
            inStock: p.inventory_quantity > 0 || p.available || true,
            stock: p.inventory_quantity || 0,
            digital: p.is_digital || false,
            tags: p.tags || [],
            vendor: p.vendor || null,
            metadata: p.metadata || {}
        }));
    }
    
    getDemoShopifyProducts(query, category) {
        // Return empty for now - will be replaced with real API
        return [];
    }
    
    // Search products across all sources
    async searchAllProducts(query, filters = {}) {
        const allProducts = [];
        
        // Fetch from merchant stores
        const merchantProducts = await this.fetchMerchantProducts();
        allProducts.push(...merchantProducts);
        
        // Fetch crypto products
        if (filters.includeCrypto !== false) {
            const cryptoProducts = await this.fetchCryptoProducts();
            allProducts.push(...cryptoProducts);
        }
        
        // Filter by query
        if (query) {
            const lowerQuery = query.toLowerCase();
            return allProducts.filter(p => 
                p.name.toLowerCase().includes(lowerQuery) ||
                p.description.toLowerCase().includes(lowerQuery) ||
                p.category.toLowerCase().includes(lowerQuery) ||
                (p.tags && p.tags.some(tag => tag.toLowerCase().includes(lowerQuery)))
            );
        }
        
        return allProducts;
    }
}

// Export
if (typeof window !== 'undefined') {
    window.ProductAPI = ProductAPI;
}

if (typeof module !== 'undefined' && module.exports) {
    module.exports = ProductAPI;
}

