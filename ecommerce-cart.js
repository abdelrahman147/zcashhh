
class ShoppingCart {
    constructor() {
        this.items = [];
        this.discountCode = null;
        this.discountPercent = 0;
        this.shippingMethod = 'standard';
        this.shippingCost = 0;
        this.storageKey = 'cryptocommerce_cart';
        this.loadFromStorage();
    }
    
    loadFromStorage() {
        try {
            const saved = localStorage.getItem(this.storageKey);
            if (saved) {
                const data = JSON.parse(saved);
                this.items = data.items || [];
                this.discountCode = data.discountCode || null;
                this.discountPercent = data.discountPercent || 0;
                this.shippingMethod = data.shippingMethod || 'standard';
            }
        } catch (error) {
            console.warn('Failed to load cart from storage:', error);
        }
    }
    
    saveToStorage() {
        try {
            localStorage.setItem(this.storageKey, JSON.stringify({
                items: this.items,
                discountCode: this.discountCode,
                discountPercent: this.discountPercent,
                shippingMethod: this.shippingMethod
            }));
        } catch (error) {
            console.warn('Failed to save cart to storage:', error);
        }
    }
    
    addItem(product) {
        const existingItem = this.items.find(item => item.id === product.id);
        
        if (existingItem) {
            existingItem.quantity += product.quantity || 1;
        } else {
            this.items.push({
                id: product.id,
                name: product.name,
                price: product.price,
                currency: product.currency || 'USD',
                image: product.image || null,
                quantity: product.quantity || 1,
                description: product.description || null,
                sku: product.sku || null
            });
        }
        
        this.saveToStorage();
        this.triggerEvent('cart.updated', { items: this.items });
        return this.items;
    }
    
    removeItem(productId) {
        this.items = this.items.filter(item => item.id !== productId);
        this.saveToStorage();
        this.triggerEvent('cart.updated', { items: this.items });
        return this.items;
    }
    
    updateQuantity(productId, quantity) {
        const item = this.items.find(item => item.id === productId);
        if (item) {
            if (quantity <= 0) {
                return this.removeItem(productId);
            }
            item.quantity = quantity;
            this.saveToStorage();
            this.triggerEvent('cart.updated', { items: this.items });
        }
        return this.items;
    }
    
    clear() {
        this.items = [];
        this.discountCode = null;
        this.discountPercent = 0;
        this.saveToStorage();
        this.triggerEvent('cart.cleared');
    }
    
    getSubtotal() {
        return this.items.reduce((sum, item) => sum + (item.price * item.quantity), 0);
    }
    
    getDiscount() {
        if (this.discountPercent > 0) {
            return (this.getSubtotal() * this.discountPercent) / 100;
        }
        return 0;
    }
    
    getShippingCost() {
        const subtotal = this.getSubtotal();
        
        // Free shipping over $100
        if (subtotal >= 100) {
            return 0;
        }
        
        // Shipping costs by method
        const shippingCosts = {
            'standard': 5.99,
            'express': 12.99,
            'overnight': 24.99,
            'digital': 0 // Digital products have no shipping
        };
        
        return shippingCosts[this.shippingMethod] || 0;
    }
    
    getTotal() {
        const subtotal = this.getSubtotal();
        const discount = this.getDiscount();
        const shipping = this.getShippingCost();
        return subtotal - discount + shipping;
    }
    
    getItemCount() {
        return this.items.reduce((sum, item) => sum + item.quantity, 0);
    }
    
    applyDiscountCode(code) {
        // Discount codes (in production, this would check a database)
        const codes = {
            'SAVE10': 10,
            'SAVE20': 20,
            'WELCOME': 15,
            'CRYPTO': 25
        };
        
        if (codes[code.toUpperCase()]) {
            this.discountCode = code.toUpperCase();
            this.discountPercent = codes[code.toUpperCase()];
            this.saveToStorage();
            this.triggerEvent('discount.applied', { code: this.discountCode, percent: this.discountPercent });
            return true;
        }
        
        return false;
    }
    
    setShippingMethod(method) {
        this.shippingMethod = method;
        this.saveToStorage();
        this.triggerEvent('shipping.updated', { method: this.shippingMethod });
    }
    
    triggerEvent(event, data) {
        if (this.eventListeners && this.eventListeners.has(event)) {
            this.eventListeners.get(event).forEach(callback => {
                try {
                    callback(data);
                } catch (error) {
                    console.error('Cart event callback error:', error);
                }
            });
        }
    }
    
    on(event, callback) {
        if (!this.eventListeners) {
            this.eventListeners = new Map();
        }
        if (!this.eventListeners.has(event)) {
            this.eventListeners.set(event, []);
        }
        this.eventListeners.get(event).push(callback);
    }
}

// Product Catalog
class ProductCatalog {
    constructor() {
        this.products = [];
        this.categories = [];
        this.loadDefaultProducts();
    }
    
    loadDefaultProducts() {
        // Default product catalog
        this.products = [
            {
                id: 'prod_1',
                name: 'Premium Crypto Wallet',
                price: 99.99,
                currency: 'USD',
                description: 'Hardware wallet with advanced security features',
                image: 'https://via.placeholder.com/300x300?text=Crypto+Wallet',
                category: 'hardware',
                sku: 'WALLET-001',
                inStock: true,
                stock: 50
            },
            {
                id: 'prod_2',
                name: 'NFT Art Collection',
                price: 149.99,
                currency: 'USD',
                description: 'Exclusive digital art collection',
                image: 'https://via.placeholder.com/300x300?text=NFT+Art',
                category: 'digital',
                sku: 'NFT-001',
                inStock: true,
                stock: 100,
                digital: true
            },
            {
                id: 'prod_3',
                name: 'Crypto Trading Course',
                price: 199.99,
                currency: 'USD',
                description: 'Complete guide to cryptocurrency trading',
                image: 'https://via.placeholder.com/300x300?text=Trading+Course',
                category: 'education',
                sku: 'COURSE-001',
                inStock: true,
                stock: 999,
                digital: true
            },
            {
                id: 'prod_4',
                name: 'Blockchain Developer Kit',
                price: 299.99,
                currency: 'USD',
                description: 'Everything you need to build on blockchain',
                image: 'https://via.placeholder.com/300x300?text=Dev+Kit',
                category: 'tools',
                sku: 'DEV-001',
                inStock: true,
                stock: 25
            },
            {
                id: 'prod_5',
                name: 'Crypto Merch T-Shirt',
                price: 29.99,
                currency: 'USD',
                description: 'Premium cotton t-shirt with crypto design',
                image: 'https://via.placeholder.com/300x300?text=T-Shirt',
                category: 'merchandise',
                sku: 'TSHIRT-001',
                inStock: true,
                stock: 100
            },
            {
                id: 'prod_6',
                name: 'DeFi Yield Farming Guide',
                price: 49.99,
                currency: 'USD',
                description: 'Learn to maximize your crypto yields',
                image: 'https://via.placeholder.com/300x300?text=DeFi+Guide',
                category: 'education',
                sku: 'GUIDE-001',
                inStock: true,
                stock: 999,
                digital: true
            }
        ];
        
        this.categories = [
            { id: 'all', name: 'All Products' },
            { id: 'hardware', name: 'Hardware' },
            { id: 'digital', name: 'Digital Products' },
            { id: 'education', name: 'Education' },
            { id: 'tools', name: 'Developer Tools' },
            { id: 'merchandise', name: 'Merchandise' }
        ];
    }
    
    getProducts(category = 'all') {
        if (category === 'all') {
            return this.products;
        }
        return this.products.filter(p => p.category === category);
    }
    
    getProduct(id) {
        return this.products.find(p => p.id === id);
    }
    
    searchProducts(query) {
        const lowerQuery = query.toLowerCase();
        return this.products.filter(p => 
            p.name.toLowerCase().includes(lowerQuery) ||
            p.description.toLowerCase().includes(lowerQuery)
        );
    }
}

// Order Management
class OrderManager {
    constructor() {
        this.orders = [];
        this.storageKey = 'cryptocommerce_orders';
        this.loadFromStorage();
    }
    
    loadFromStorage() {
        try {
            const saved = localStorage.getItem(this.storageKey);
            if (saved) {
                this.orders = JSON.parse(saved);
            }
        } catch (error) {
            console.warn('Failed to load orders from storage:', error);
        }
    }
    
    saveToStorage() {
        try {
            localStorage.setItem(this.storageKey, JSON.stringify(this.orders));
        } catch (error) {
            console.warn('Failed to save orders to storage:', error);
        }
    }
    
    createOrder(cart, paymentInfo) {
        const order = {
            id: `order_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
            items: [...cart.items],
            subtotal: cart.getSubtotal(),
            discount: cart.getDiscount(),
            discountCode: cart.discountCode,
            shipping: cart.getShippingCost(),
            shippingMethod: cart.shippingMethod,
            total: cart.getTotal(),
            currency: 'USD',
            payment: {
                crypto: paymentInfo.crypto,
                cryptoAmount: paymentInfo.cryptoAmount,
                transactionHash: paymentInfo.transactionHash || null,
                status: paymentInfo.status || 'pending'
            },
            status: 'pending',
            createdAt: Date.now(),
            shippingAddress: paymentInfo.shippingAddress || null,
            customerEmail: paymentInfo.email || null
        };
        
        this.orders.push(order);
        this.saveToStorage();
        
        return order;
    }
    
    getOrder(orderId) {
        return this.orders.find(o => o.id === orderId);
    }
    
    updateOrderStatus(orderId, status) {
        const order = this.getOrder(orderId);
        if (order) {
            order.status = status;
            order.updatedAt = Date.now();
            this.saveToStorage();
        }
        return order;
    }
    
    getOrders() {
        return this.orders.sort((a, b) => b.createdAt - a.createdAt);
    }
}

// Export
if (typeof window !== 'undefined') {
    window.ShoppingCart = ShoppingCart;
    window.ProductCatalog = ProductCatalog;
    window.OrderManager = OrderManager;
    
    // Initialize global instances
    window.cart = new ShoppingCart();
    window.catalog = new ProductCatalog();
    window.orderManager = new OrderManager();
}

if (typeof module !== 'undefined' && module.exports) {
    module.exports = { ShoppingCart, ProductCatalog, OrderManager };
}

