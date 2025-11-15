
class MerchantAPI {
    constructor(config = {}) {
        this.apiKey = config.apiKey || null;
        this.baseUrl = config.baseUrl || window.location.origin;
        this.merchantId = config.merchantId || null;
        this.stores = new Map();
        this.products = new Map();
        this.orders = new Map();
        this.analytics = {
            totalRevenue: 0,
            totalOrders: 0,
            totalCustomers: 0,
            averageOrderValue: 0,
            topProducts: [],
            salesByDay: [],
            paymentMethods: {}
        };
    }
    
    // Store Management
    async createStore(storeData) {
        const store = {
            id: `store_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
            name: storeData.name,
            description: storeData.description || '',
            domain: storeData.domain || null,
            logo: storeData.logo || null,
            currency: storeData.currency || 'USD',
            taxRate: storeData.taxRate || 0,
            shippingEnabled: storeData.shippingEnabled !== false,
            createdAt: Date.now(),
            settings: {
                acceptCrypto: storeData.acceptCrypto || ['SOL', 'USDC', 'USDT'],
                autoFulfill: storeData.autoFulfill || false,
                requireEmail: storeData.requireEmail !== false
            }
        };
        
        this.stores.set(store.id, store);
        await this.saveToBackend('stores', store);
        
        return store;
    }
    
    async getStore(storeId) {
        // Try local first
        if (this.stores.has(storeId)) {
            return this.stores.get(storeId);
        }
        
        // Fetch from backend
        try {
            const response = await fetch(`${this.baseUrl}/api/merchant/stores/${storeId}`);
            if (response.ok) {
                const data = await response.json();
                this.stores.set(storeId, data.store);
                return data.store;
            }
        } catch (error) {
            console.error('Failed to fetch store:', error);
        }
        
        return null;
    }
    
    // Product Management
    async addProduct(storeId, productData) {
        const product = {
            id: `prod_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
            storeId: storeId,
            name: productData.name,
            description: productData.description || '',
            price: parseFloat(productData.price),
            currency: productData.currency || 'USD',
            sku: productData.sku || null,
            image: productData.image || null,
            images: productData.images || [],
            category: productData.category || 'uncategorized',
            tags: productData.tags || [],
            inStock: productData.inStock !== false,
            stock: productData.stock || 0,
            digital: productData.digital || false,
            weight: productData.weight || null,
            dimensions: productData.dimensions || null,
            createdAt: Date.now(),
            updatedAt: Date.now()
        };
        
        this.products.set(product.id, product);
        await this.saveToBackend('products', product);
        
        return product;
    }
    
    async updateProduct(productId, updates) {
        const product = this.products.get(productId);
        if (!product) {
            throw new Error('Product not found');
        }
        
        Object.assign(product, updates, { updatedAt: Date.now() });
        this.products.set(productId, product);
        await this.saveToBackend('products', product, 'PUT');
        
        return product;
    }
    
    async deleteProduct(productId) {
        this.products.delete(productId);
        await this.saveToBackend('products', { id: productId }, 'DELETE');
    }
    
    async getProducts(storeId, filters = {}) {
        // Try backend first
        try {
            const params = new URLSearchParams({
                storeId: storeId,
                ...filters
            });
            const response = await fetch(`${this.baseUrl}/api/merchant/products?${params}`);
            if (response.ok) {
                const data = await response.json();
                return data.products || [];
            }
        } catch (error) {
            console.warn('Backend fetch failed, using local:', error);
        }
        
        // Fallback to local
        const allProducts = Array.from(this.products.values());
        return allProducts.filter(p => p.storeId === storeId);
    }
    
    // Order Management
    async getOrders(storeId, filters = {}) {
        try {
            const params = new URLSearchParams({
                storeId: storeId,
                ...filters
            });
            const response = await fetch(`${this.baseUrl}/api/merchant/orders?${params}`);
            if (response.ok) {
                const data = await response.json();
                return data.orders || [];
            }
        } catch (error) {
            console.warn('Backend fetch failed:', error);
        }
        
        return [];
    }
    
    async updateOrderStatus(orderId, status, notes = null) {
        try {
            const response = await fetch(`${this.baseUrl}/api/merchant/orders/${orderId}`, {
                method: 'PUT',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ status, notes })
            });
            
            if (response.ok) {
                const data = await response.json();
                return data.order;
            }
        } catch (error) {
            console.error('Failed to update order:', error);
            throw error;
        }
    }
    
    // Analytics
    async getAnalytics(storeId, period = '30d') {
        try {
            const response = await fetch(`${this.baseUrl}/api/merchant/analytics?storeId=${storeId}&period=${period}`);
            if (response.ok) {
                const data = await response.json();
                return data.analytics;
            }
        } catch (error) {
            console.warn('Analytics fetch failed, calculating locally:', error);
        }
        
        // Calculate from local orders
        return this.calculateLocalAnalytics(storeId);
    }
    
    calculateLocalAnalytics(storeId) {
        const orders = Array.from(this.orders.values()).filter(o => o.storeId === storeId);
        const totalRevenue = orders.reduce((sum, o) => sum + (o.status === 'completed' ? o.total : 0), 0);
        const totalOrders = orders.length;
        const completedOrders = orders.filter(o => o.status === 'completed');
        const averageOrderValue = completedOrders.length > 0 ? totalRevenue / completedOrders.length : 0;
        
        // Top products
        const productSales = {};
        orders.forEach(order => {
            order.items.forEach(item => {
                productSales[item.productId] = (productSales[item.productId] || 0) + item.quantity;
            });
        });
        
        const topProducts = Object.entries(productSales)
            .sort((a, b) => b[1] - a[1])
            .slice(0, 10)
            .map(([productId, sales]) => ({
                productId,
                sales,
                product: this.products.get(productId)
            }));
        
        return {
            totalRevenue,
            totalOrders,
            completedOrders: completedOrders.length,
            averageOrderValue,
            topProducts,
            paymentMethods: this.getPaymentMethodStats(orders)
        };
    }
    
    getPaymentMethodStats(orders) {
        const stats = {};
        orders.forEach(order => {
            const method = order.payment?.crypto || 'unknown';
            stats[method] = (stats[method] || 0) + 1;
        });
        return stats;
    }
    
    // Inventory Management
    async updateInventory(productId, quantity, operation = 'set') {
        const product = this.products.get(productId);
        if (!product) {
            throw new Error('Product not found');
        }
        
        if (operation === 'set') {
            product.stock = quantity;
        } else if (operation === 'add') {
            product.stock += quantity;
        } else if (operation === 'subtract') {
            product.stock = Math.max(0, product.stock - quantity);
        }
        
        product.inStock = product.stock > 0;
        product.updatedAt = Date.now();
        
        this.products.set(productId, product);
        await this.saveToBackend('products', product, 'PUT');
        
        return product;
    }
    
    // Fulfillment
    async fulfillOrder(orderId, trackingNumber = null) {
        const order = await this.updateOrderStatus(orderId, 'fulfilled', trackingNumber);
        
        // Update inventory
        if (order && order.items) {
            for (const item of order.items) {
                await this.updateInventory(item.productId, item.quantity, 'subtract');
            }
        }
        
        return order;
    }
    
    // Backend sync
    async saveToBackend(endpoint, data, method = 'POST') {
        if (!this.apiKey) {
            return; // No API key, skip backend sync
        }
        
        try {
            const url = `${this.baseUrl}/api/merchant/${endpoint}`;
            const options = {
                method: method,
                headers: {
                    'Content-Type': 'application/json',
                    'Authorization': `Bearer ${this.apiKey}`
                },
                body: JSON.stringify(data)
            };
            
            if (method === 'DELETE') {
                options.body = JSON.stringify({ id: data.id });
            }
            
            await fetch(url, options);
        } catch (error) {
            console.warn(`Failed to sync ${endpoint} to backend:`, error);
        }
    }
    
    // Webhook Management
    async setWebhook(storeId, webhookUrl, events = ['order.created', 'order.completed', 'payment.confirmed']) {
        try {
            const response = await fetch(`${this.baseUrl}/api/merchant/webhooks`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    storeId,
                    url: webhookUrl,
                    events
                })
            });
            
            if (response.ok) {
                return await response.json();
            }
        } catch (error) {
            console.error('Failed to set webhook:', error);
            throw error;
        }
    }
}

// Export
if (typeof window !== 'undefined') {
    window.MerchantAPI = MerchantAPI;
}

if (typeof module !== 'undefined' && module.exports) {
    module.exports = MerchantAPI;
}

