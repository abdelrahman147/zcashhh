
// Merchant Dashboard Frontend
(function() {
    'use strict';
    
    let currentStore = null;
    let merchantAPI = null;
    
    function initMerchantDashboard() {
        if (!window.MerchantAPI) {
            console.warn('MerchantAPI not loaded');
            return;
        }
        
        merchantAPI = new MerchantAPI({
            apiKey: localStorage.getItem('merchant_api_key'),
            baseUrl: window.location.origin
        });
        
        setupMerchantTabs();
        setupMerchantActions();
        loadMerchantData();
    }
    
    function setupMerchantTabs() {
        document.querySelectorAll('.merchant-tab').forEach(tab => {
            tab.addEventListener('click', () => {
                const tabName = tab.getAttribute('data-tab');
                
                // Update tabs
                document.querySelectorAll('.merchant-tab').forEach(t => t.classList.remove('active'));
                tab.classList.add('active');
                
                // Update content
                document.querySelectorAll('.merchant-tab-content').forEach(c => c.classList.remove('active'));
                const content = document.getElementById(`merchant-${tabName}`);
                if (content) {
                    content.classList.add('active');
                }
                
                // Load tab data
                loadTabData(tabName);
            });
        });
    }
    
    function setupMerchantActions() {
        // Create payment button
        const createPaymentBtn = document.getElementById('create-payment-btn');
        if (createPaymentBtn) {
            createPaymentBtn.addEventListener('click', () => {
                if (window.showCreatePaymentModal) {
                    window.showCreatePaymentModal();
                }
            });
        }
        
        // View payments button
        const viewPaymentsBtn = document.getElementById('view-payments-btn');
        if (viewPaymentsBtn) {
            viewPaymentsBtn.addEventListener('click', () => {
                document.querySelector('[data-tab="payments"]').click();
            });
        }
        
        // Payment filter
        const paymentFilter = document.getElementById('payment-filter');
        if (paymentFilter) {
            paymentFilter.addEventListener('change', () => {
                loadTabData('payments');
            });
        }
        
        // View analytics button
        const viewAnalyticsBtn = document.getElementById('view-analytics-btn');
        if (viewAnalyticsBtn) {
            viewAnalyticsBtn.addEventListener('click', () => {
                document.querySelector('[data-tab="analytics"]').click();
            });
        }
        
        // Order filter
        const orderFilter = document.getElementById('order-filter');
        if (orderFilter) {
            orderFilter.addEventListener('change', () => {
                loadTabData('orders');
            });
        }
    }
    
    async function loadMerchantData() {
        // Load or create default store
        const storeId = localStorage.getItem('current_store_id');
        if (storeId) {
            currentStore = await merchantAPI.getStore(storeId);
        }
        
        if (!currentStore) {
            // Create default store
            currentStore = await merchantAPI.createStore({
                name: 'My CryptoCommerce Store',
                description: 'Accept cryptocurrency payments',
                acceptCrypto: ['SOL', 'USDC', 'USDT']
            });
            localStorage.setItem('current_store_id', currentStore.id);
        }
        
        loadTabData('overview');
    }
    
    async function loadTabData(tab) {
        if (!currentStore) return;
        
        switch(tab) {
            case 'overview':
                await loadOverview();
                break;
            case 'payments':
                await loadPayments();
                break;
            case 'orders':
                await loadOrders();
                break;
            case 'analytics':
                await loadAnalytics();
                break;
            case 'settings':
                loadSettings();
                break;
            case 'webhooks':
                if (window.loadWebhooks) {
                    window.loadWebhooks();
                }
                break;
        }
    }
    
    async function loadOverview() {
        const analytics = await merchantAPI.getAnalytics(currentStore.id);
        
        const revenueEl = document.getElementById('stat-revenue');
        const ordersEl = document.getElementById('stat-orders');
        const productsEl = document.getElementById('stat-products');
        const aovEl = document.getElementById('stat-aov');
        
        if (revenueEl) revenueEl.textContent = `$${analytics.totalRevenue.toFixed(2)}`;
        if (ordersEl) ordersEl.textContent = analytics.totalOrders;
        if (productsEl) {
            const products = await merchantAPI.getProducts(currentStore.id);
            productsEl.textContent = products.length;
        }
        if (aovEl) aovEl.textContent = `$${analytics.averageOrderValue.toFixed(2)}`;
    }
    
    async function loadPayments() {
        const container = document.getElementById('merchant-payments-list');
        if (!container) return;
        
        container.innerHTML = '<div style="text-align: center; padding: 2rem; color: var(--text-secondary);">Loading payments...</div>';
        
        try {
            const response = await fetch(`${window.location.origin}/api/oracle/payments`);
            if (response.ok) {
                const data = await response.json();
                const payments = data.payments || [];
                
                if (payments.length === 0) {
                    container.innerHTML = '<div style="text-align: center; padding: 2rem; color: var(--text-secondary);">No payments yet</div>';
                    return;
                }
                
                container.innerHTML = `
                    <div class="payments-list">
                        ${payments.map(payment => `
                            <div class="order-card">
                                <div style="display: flex; justify-content: space-between; align-items: start; margin-bottom: 1rem;">
                                    <div>
                                        <div style="font-weight: 600; font-size: 1.1rem;">Payment ${payment.id.substring(0, 12)}</div>
                                        <div style="font-size: 0.85rem; color: var(--text-secondary); margin-top: 0.25rem;">
                                            ${new Date(payment.createdAt).toLocaleString()}
                                        </div>
                                    </div>
                                    <span class="status-badge status-${payment.status}">${payment.status}</span>
                                </div>
                                <div style="margin-bottom: 1rem;">
                                    <div style="display: flex; justify-content: space-between; padding: 0.5rem 0;">
                                        <span style="color: var(--text-secondary);">Amount:</span>
                                        <span style="font-weight: 600;">$${payment.amount.toFixed(2)}</span>
                                    </div>
                                    <div style="display: flex; justify-content: space-between; padding: 0.5rem 0;">
                                        <span style="color: var(--text-secondary);">SOL Amount:</span>
                                        <span style="font-weight: 600; color: var(--accent-primary);">${payment.solAmount.toFixed(8)} SOL</span>
                                    </div>
                                    ${payment.transactionSignature ? `
                                    <div style="display: flex; justify-content: space-between; padding: 0.5rem 0;">
                                        <span style="color: var(--text-secondary);">Transaction:</span>
                                        <span style="font-family: var(--font-mono); font-size: 0.85rem;">${payment.transactionSignature.substring(0, 16)}...</span>
                                    </div>
                                    ` : ''}
                                    ${payment.proof ? `
                                    <div style="display: flex; justify-content: space-between; padding: 0.5rem 0;">
                                        <span style="color: var(--text-secondary);">ZK Proof:</span>
                                        <span style="font-family: var(--font-mono); font-size: 0.85rem; color: var(--accent-success);">✓ Verified</span>
                                    </div>
                                    ` : ''}
                                </div>
                            </div>
                        `).join('')}
                    </div>
                `;
            }
        } catch (error) {
            console.error('Failed to load payments:', error);
            container.innerHTML = '<div style="text-align: center; padding: 2rem; color: var(--accent-error);">Failed to load payments</div>';
        }
    }
    
    async function loadProducts() {
        const container = document.getElementById('merchant-products-list');
        if (!container) return;
        
        container.innerHTML = '<div style="text-align: center; padding: 2rem; color: var(--text-secondary);">Loading products...</div>';
        
        const products = await merchantAPI.getProducts(currentStore.id);
        
        if (products.length === 0) {
            container.innerHTML = `
                <div style="text-align: center; padding: 2rem;">
                    <p style="color: var(--text-secondary); margin-bottom: 1rem;">No products yet</p>
                    <button class="btn-primary" onclick="document.getElementById('add-product-btn').click()">Add Your First Product</button>
                </div>
            `;
            return;
        }
        
        container.innerHTML = `
            <div class="products-table">
                <table style="width: 100%; border-collapse: collapse;">
                    <thead>
                        <tr style="border-bottom: 1px solid var(--border-color);">
                            <th style="padding: 1rem; text-align: left;">Product</th>
                            <th style="padding: 1rem; text-align: left;">Price</th>
                            <th style="padding: 1rem; text-align: left;">Stock</th>
                            <th style="padding: 1rem; text-align: left;">Status</th>
                            <th style="padding: 1rem; text-align: right;">Actions</th>
                        </tr>
                    </thead>
                    <tbody>
                        ${products.map(product => `
                            <tr style="border-bottom: 1px solid var(--border-color);">
                                <td style="padding: 1rem;">
                                    <div style="display: flex; align-items: center; gap: 1rem;">
                                        ${product.image ? `<img src="${product.image}" style="width: 50px; height: 50px; object-fit: cover; border-radius: 4px;">` : ''}
                                        <div>
                                            <div style="font-weight: 600;">${product.name}</div>
                                            <div style="font-size: 0.85rem; color: var(--text-secondary);">${product.sku || 'No SKU'}</div>
                                        </div>
                                    </div>
                                </td>
                                <td style="padding: 1rem;">$${product.price.toFixed(2)}</td>
                                <td style="padding: 1rem;">${product.stock}</td>
                                <td style="padding: 1rem;">
                                    <span class="status-badge status-${product.inStock ? 'confirmed' : 'expired'}">
                                        ${product.inStock ? 'In Stock' : 'Out of Stock'}
                                    </span>
                                </td>
                                <td style="padding: 1rem; text-align: right;">
                                    <button class="btn-secondary" onclick="editProduct('${product.id}')" style="margin-right: 0.5rem;">Edit</button>
                                    <button class="btn-secondary" onclick="deleteProduct('${product.id}')">Delete</button>
                                </td>
                            </tr>
                        `).join('')}
                    </tbody>
                </table>
            </div>
        `;
    }
    
    async function loadOrders() {
        const container = document.getElementById('merchant-orders-list');
        if (!container) return;
        
        const filter = document.getElementById('order-filter')?.value || 'all';
        const filters = filter !== 'all' ? { status: filter } : {};
        
        container.innerHTML = '<div style="text-align: center; padding: 2rem; color: var(--text-secondary);">Loading orders...</div>';
        
        const orders = await merchantAPI.getOrders(currentStore.id, filters);
        
        if (orders.length === 0) {
            container.innerHTML = '<div style="text-align: center; padding: 2rem; color: var(--text-secondary);">No orders found</div>';
            return;
        }
        
        container.innerHTML = `
            <div class="orders-list">
                ${orders.map(order => `
                    <div class="order-card" style="background: var(--bg-secondary); border: 1px solid var(--border-color); border-radius: 8px; padding: 1.5rem; margin-bottom: 1rem;">
                        <div style="display: flex; justify-content: space-between; align-items: start; margin-bottom: 1rem;">
                            <div>
                                <div style="font-weight: 600; font-size: 1.1rem;">Order #${order.id.substring(0, 12)}</div>
                                <div style="font-size: 0.85rem; color: var(--text-secondary); margin-top: 0.25rem;">
                                    ${new Date(order.createdAt).toLocaleString()}
                                </div>
                            </div>
                            <span class="status-badge status-${order.status}">${order.status}</span>
                        </div>
                        <div style="margin-bottom: 1rem;">
                            <div style="font-size: 0.9rem; color: var(--text-secondary); margin-bottom: 0.5rem;">Items:</div>
                            ${order.items ? order.items.map(item => `
                                <div style="display: flex; justify-content: space-between; padding: 0.5rem 0; border-bottom: 1px solid var(--border-color);">
                                    <span>${item.name || 'Unknown'} × ${item.quantity}</span>
                                    <span>$${(item.price * item.quantity).toFixed(2)}</span>
                                </div>
                            `).join('') : ''}
                        </div>
                        <div style="display: flex; justify-content: space-between; align-items: center; padding-top: 1rem; border-top: 1px solid var(--border-color);">
                            <div>
                                <div style="font-size: 0.9rem; color: var(--text-secondary);">Total:</div>
                                <div style="font-size: 1.2rem; font-weight: 700; color: var(--accent-primary);">$${order.total.toFixed(2)}</div>
                            </div>
                            <div>
                                ${order.status === 'paid' ? `
                                    <button class="btn-primary" onclick="fulfillOrder('${order.id}')">Fulfill Order</button>
                                ` : ''}
                                ${order.status === 'pending' ? `
                                    <button class="btn-secondary" onclick="cancelOrder('${order.id}')">Cancel</button>
                                ` : ''}
                            </div>
                        </div>
                    </div>
                `).join('')}
            </div>
        `;
    }
    
    async function loadAnalytics() {
        const container = document.getElementById('merchant-analytics-content');
        if (!container) return;
        
        const analytics = await merchantAPI.getAnalytics(currentStore.id);
        
        container.innerHTML = `
            <div class="analytics-grid">
                <div class="analytics-card">
                    <h4>Revenue Overview</h4>
                    <div style="font-size: 2rem; font-weight: 700; color: var(--accent-primary); margin: 1rem 0;">
                        $${analytics.totalRevenue.toFixed(2)}
                    </div>
                    <div style="color: var(--text-secondary);">From ${analytics.completedOrders} completed orders</div>
                </div>
                <div class="analytics-card">
                    <h4>Top Products</h4>
                    <div style="margin-top: 1rem;">
                        ${analytics.topProducts.length > 0 ? analytics.topProducts.map(p => `
                            <div style="display: flex; justify-content: space-between; padding: 0.75rem 0; border-bottom: 1px solid var(--border-color);">
                                <span>${p.product?.name || 'Unknown'}</span>
                                <span style="color: var(--accent-primary);">${p.sales} sold</span>
                            </div>
                        `).join('') : '<p style="color: var(--text-secondary);">No sales yet</p>'}
                    </div>
                </div>
                <div class="analytics-card">
                    <h4>Payment Methods</h4>
                    <div style="margin-top: 1rem;">
                        ${Object.entries(analytics.paymentMethods).map(([method, count]) => `
                            <div style="display: flex; justify-content: space-between; padding: 0.75rem 0;">
                                <span>${method.toUpperCase()}</span>
                                <span>${count} orders</span>
                            </div>
                        `).join('')}
                    </div>
                </div>
            </div>
        `;
    }
    
    function loadSettings() {
        const container = document.getElementById('merchant-settings-content');
        if (!container || !currentStore) return;
        
        container.innerHTML = `
            <div class="settings-form">
                <div class="checkout-form-group">
                    <label>Store Name</label>
                    <input type="text" id="store-name" value="${currentStore.name}">
                </div>
                <div class="checkout-form-group">
                    <label>Store Description</label>
                    <textarea id="store-description" rows="3">${currentStore.description || ''}</textarea>
                </div>
                <div class="checkout-form-group">
                    <label>Accepted Cryptocurrencies</label>
                    <div style="display: flex; gap: 1rem; margin-top: 0.5rem;">
                        ${['SOL', 'USDC', 'USDT', 'BTC', 'ETH'].map(crypto => `
                            <label style="display: flex; align-items: center; gap: 0.5rem;">
                                <input type="checkbox" value="${crypto}" 
                                       ${currentStore.settings?.acceptCrypto?.includes(crypto) ? 'checked' : ''}>
                                ${crypto}
                            </label>
                        `).join('')}
                    </div>
                </div>
                <button class="btn-primary" onclick="saveStoreSettings()" style="margin-top: 1rem;">Save Settings</button>
            </div>
        `;
    }
    
    function showAddProductModal() {
        const modal = document.createElement('div');
        modal.className = 'checkout-modal';
        modal.innerHTML = `
            <div class="cryptocommerce-modal-overlay"></div>
            <div class="checkout-content">
                <button class="cryptocommerce-modal-close">&times;</button>
                <h2>Add Product</h2>
                <form id="add-product-form">
                    <div class="checkout-form-group">
                        <label>Product Name *</label>
                        <input type="text" id="product-name" required>
                    </div>
                    <div class="checkout-form-group">
                        <label>Description</label>
                        <textarea id="product-description" rows="3"></textarea>
                    </div>
                    <div class="checkout-form-group">
                        <label>Price (USD) *</label>
                        <input type="number" id="product-price" step="0.01" min="0" required>
                    </div>
                    <div class="checkout-form-group">
                        <label>SKU</label>
                        <input type="text" id="product-sku">
                    </div>
                    <div class="checkout-form-group">
                        <label>Image URL</label>
                        <input type="url" id="product-image">
                    </div>
                    <div class="checkout-form-group">
                        <label>Category</label>
                        <select id="product-category">
                            <option value="uncategorized">Uncategorized</option>
                            <option value="hardware">Hardware</option>
                            <option value="digital">Digital</option>
                            <option value="education">Education</option>
                            <option value="tools">Tools</option>
                            <option value="merchandise">Merchandise</option>
                        </select>
                    </div>
                    <div class="checkout-form-group">
                        <label>Stock Quantity</label>
                        <input type="number" id="product-stock" min="0" value="0">
                    </div>
                    <div class="checkout-form-group">
                        <label>
                            <input type="checkbox" id="product-digital"> Digital Product (no shipping)
                        </label>
                    </div>
                    <button type="submit" class="btn-primary" style="width: 100%; margin-top: 1rem;">Add Product</button>
                </form>
            </div>
        `;
        
        document.body.appendChild(modal);
        
        modal.querySelector('.cryptocommerce-modal-close').addEventListener('click', () => modal.remove());
        modal.querySelector('.cryptocommerce-modal-overlay').addEventListener('click', () => modal.remove());
        
        modal.querySelector('#add-product-form').addEventListener('submit', async (e) => {
            e.preventDefault();
            
            const productData = {
                name: document.getElementById('product-name').value,
                description: document.getElementById('product-description').value,
                price: parseFloat(document.getElementById('product-price').value),
                sku: document.getElementById('product-sku').value,
                image: document.getElementById('product-image').value,
                category: document.getElementById('product-category').value,
                stock: parseInt(document.getElementById('product-stock').value) || 0,
                digital: document.getElementById('product-digital').checked
            };
            
            try {
                await merchantAPI.addProduct(currentStore.id, productData);
                modal.remove();
                loadTabData('products');
                alert('Product added successfully!');
            } catch (error) {
                alert('Failed to add product: ' + error.message);
            }
        });
    }
    
    // Global functions for buttons
    window.editProduct = async function(productId) {
        const product = merchantAPI.products.get(productId);
        if (!product) return;
        
        // Similar modal to add product but pre-filled
        alert('Edit product feature - coming soon!');
    };
    
    window.deleteProduct = async function(productId) {
        if (!confirm('Are you sure you want to delete this product?')) return;
        
        try {
            await merchantAPI.deleteProduct(productId);
            loadTabData('products');
        } catch (error) {
            alert('Failed to delete product: ' + error.message);
        }
    };
    
    window.fulfillOrder = async function(orderId) {
        try {
            await merchantAPI.fulfillOrder(orderId);
            loadTabData('orders');
            alert('Order fulfilled!');
        } catch (error) {
            alert('Failed to fulfill order: ' + error.message);
        }
    };
    
    window.cancelOrder = async function(orderId) {
        if (!confirm('Cancel this order?')) return;
        
        try {
            await merchantAPI.updateOrderStatus(orderId, 'cancelled');
            loadTabData('orders');
        } catch (error) {
            alert('Failed to cancel order: ' + error.message);
        }
    };
    
    window.saveStoreSettings = async function() {
        const name = document.getElementById('store-name').value;
        const description = document.getElementById('store-description').value;
        const acceptCrypto = Array.from(document.querySelectorAll('#merchant-settings-content input[type="checkbox"]:checked'))
            .map(cb => cb.value);
        
        currentStore.name = name;
        currentStore.description = description;
        currentStore.settings.acceptCrypto = acceptCrypto;
        
        // Save to backend
        await merchantAPI.saveToBackend('stores', currentStore, 'PUT');
        
        alert('Settings saved!');
    };
    
    // Initialize
    if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', initMerchantDashboard);
    } else {
        initMerchantDashboard();
    }
    
    setTimeout(initMerchantDashboard, 1000);
})();


(function() {
    'use strict';
    
    let currentStore = null;
    let merchantAPI = null;
    
    function initMerchantDashboard() {
        if (!window.MerchantAPI) {
            console.warn('MerchantAPI not loaded');
            return;
        }
        
        merchantAPI = new MerchantAPI({
            apiKey: localStorage.getItem('merchant_api_key'),
            baseUrl: window.location.origin
        });
        
        setupMerchantTabs();
        setupMerchantActions();
        loadMerchantData();
    }
    
    function setupMerchantTabs() {
        document.querySelectorAll('.merchant-tab').forEach(tab => {
            tab.addEventListener('click', () => {
                const tabName = tab.getAttribute('data-tab');
                
                // Update tabs
                document.querySelectorAll('.merchant-tab').forEach(t => t.classList.remove('active'));
                tab.classList.add('active');
                
                // Update content
                document.querySelectorAll('.merchant-tab-content').forEach(c => c.classList.remove('active'));
                const content = document.getElementById(`merchant-${tabName}`);
                if (content) {
                    content.classList.add('active');
                }
                
                // Load tab data
                loadTabData(tabName);
            });
        });
    }
    
    function setupMerchantActions() {
        // Create payment button
        const createPaymentBtn = document.getElementById('create-payment-btn');
        if (createPaymentBtn) {
            createPaymentBtn.addEventListener('click', () => {
                if (window.showCreatePaymentModal) {
                    window.showCreatePaymentModal();
                }
            });
        }
        
        // View payments button
        const viewPaymentsBtn = document.getElementById('view-payments-btn');
        if (viewPaymentsBtn) {
            viewPaymentsBtn.addEventListener('click', () => {
                document.querySelector('[data-tab="payments"]').click();
            });
        }
        
        // Payment filter
        const paymentFilter = document.getElementById('payment-filter');
        if (paymentFilter) {
            paymentFilter.addEventListener('change', () => {
                loadTabData('payments');
            });
        }
        
        // View analytics button
        const viewAnalyticsBtn = document.getElementById('view-analytics-btn');
        if (viewAnalyticsBtn) {
            viewAnalyticsBtn.addEventListener('click', () => {
                document.querySelector('[data-tab="analytics"]').click();
            });
        }
        
        // Order filter
        const orderFilter = document.getElementById('order-filter');
        if (orderFilter) {
            orderFilter.addEventListener('change', () => {
                loadTabData('orders');
            });
        }
    }
    
    async function loadMerchantData() {
        // Load or create default store
        const storeId = localStorage.getItem('current_store_id');
        if (storeId) {
            currentStore = await merchantAPI.getStore(storeId);
        }
        
        if (!currentStore) {
            // Create default store
            currentStore = await merchantAPI.createStore({
                name: 'My CryptoCommerce Store',
                description: 'Accept cryptocurrency payments',
                acceptCrypto: ['SOL', 'USDC', 'USDT']
            });
            localStorage.setItem('current_store_id', currentStore.id);
        }
        
        loadTabData('overview');
    }
    
    async function loadTabData(tab) {
        if (!currentStore) return;
        
        switch(tab) {
            case 'overview':
                await loadOverview();
                break;
            case 'payments':
                await loadPayments();
                break;
            case 'orders':
                await loadOrders();
                break;
            case 'analytics':
                await loadAnalytics();
                break;
            case 'settings':
                loadSettings();
                break;
            case 'webhooks':
                if (window.loadWebhooks) {
                    window.loadWebhooks();
                }
                break;
        }
    }
    
    async function loadOverview() {
        const analytics = await merchantAPI.getAnalytics(currentStore.id);
        
        const revenueEl = document.getElementById('stat-revenue');
        const ordersEl = document.getElementById('stat-orders');
        const productsEl = document.getElementById('stat-products');
        const aovEl = document.getElementById('stat-aov');
        
        if (revenueEl) revenueEl.textContent = `$${analytics.totalRevenue.toFixed(2)}`;
        if (ordersEl) ordersEl.textContent = analytics.totalOrders;
        if (productsEl) {
            const products = await merchantAPI.getProducts(currentStore.id);
            productsEl.textContent = products.length;
        }
        if (aovEl) aovEl.textContent = `$${analytics.averageOrderValue.toFixed(2)}`;
    }
    
    async function loadPayments() {
        const container = document.getElementById('merchant-payments-list');
        if (!container) return;
        
        container.innerHTML = '<div style="text-align: center; padding: 2rem; color: var(--text-secondary);">Loading payments...</div>';
        
        try {
            const response = await fetch(`${window.location.origin}/api/oracle/payments`);
            if (response.ok) {
                const data = await response.json();
                const payments = data.payments || [];
                
                if (payments.length === 0) {
                    container.innerHTML = '<div style="text-align: center; padding: 2rem; color: var(--text-secondary);">No payments yet</div>';
                    return;
                }
                
                container.innerHTML = `
                    <div class="payments-list">
                        ${payments.map(payment => `
                            <div class="order-card">
                                <div style="display: flex; justify-content: space-between; align-items: start; margin-bottom: 1rem;">
                                    <div>
                                        <div style="font-weight: 600; font-size: 1.1rem;">Payment ${payment.id.substring(0, 12)}</div>
                                        <div style="font-size: 0.85rem; color: var(--text-secondary); margin-top: 0.25rem;">
                                            ${new Date(payment.createdAt).toLocaleString()}
                                        </div>
                                    </div>
                                    <span class="status-badge status-${payment.status}">${payment.status}</span>
                                </div>
                                <div style="margin-bottom: 1rem;">
                                    <div style="display: flex; justify-content: space-between; padding: 0.5rem 0;">
                                        <span style="color: var(--text-secondary);">Amount:</span>
                                        <span style="font-weight: 600;">$${payment.amount.toFixed(2)}</span>
                                    </div>
                                    <div style="display: flex; justify-content: space-between; padding: 0.5rem 0;">
                                        <span style="color: var(--text-secondary);">SOL Amount:</span>
                                        <span style="font-weight: 600; color: var(--accent-primary);">${payment.solAmount.toFixed(8)} SOL</span>
                                    </div>
                                    ${payment.transactionSignature ? `
                                    <div style="display: flex; justify-content: space-between; padding: 0.5rem 0;">
                                        <span style="color: var(--text-secondary);">Transaction:</span>
                                        <span style="font-family: var(--font-mono); font-size: 0.85rem;">${payment.transactionSignature.substring(0, 16)}...</span>
                                    </div>
                                    ` : ''}
                                    ${payment.proof ? `
                                    <div style="display: flex; justify-content: space-between; padding: 0.5rem 0;">
                                        <span style="color: var(--text-secondary);">ZK Proof:</span>
                                        <span style="font-family: var(--font-mono); font-size: 0.85rem; color: var(--accent-success);">✓ Verified</span>
                                    </div>
                                    ` : ''}
                                </div>
                            </div>
                        `).join('')}
                    </div>
                `;
            }
        } catch (error) {
            console.error('Failed to load payments:', error);
            container.innerHTML = '<div style="text-align: center; padding: 2rem; color: var(--accent-error);">Failed to load payments</div>';
        }
    }
    
    async function loadProducts() {
        const container = document.getElementById('merchant-products-list');
        if (!container) return;
        
        container.innerHTML = '<div style="text-align: center; padding: 2rem; color: var(--text-secondary);">Loading products...</div>';
        
        const products = await merchantAPI.getProducts(currentStore.id);
        
        if (products.length === 0) {
            container.innerHTML = `
                <div style="text-align: center; padding: 2rem;">
                    <p style="color: var(--text-secondary); margin-bottom: 1rem;">No products yet</p>
                    <button class="btn-primary" onclick="document.getElementById('add-product-btn').click()">Add Your First Product</button>
                </div>
            `;
            return;
        }
        
        container.innerHTML = `
            <div class="products-table">
                <table style="width: 100%; border-collapse: collapse;">
                    <thead>
                        <tr style="border-bottom: 1px solid var(--border-color);">
                            <th style="padding: 1rem; text-align: left;">Product</th>
                            <th style="padding: 1rem; text-align: left;">Price</th>
                            <th style="padding: 1rem; text-align: left;">Stock</th>
                            <th style="padding: 1rem; text-align: left;">Status</th>
                            <th style="padding: 1rem; text-align: right;">Actions</th>
                        </tr>
                    </thead>
                    <tbody>
                        ${products.map(product => `
                            <tr style="border-bottom: 1px solid var(--border-color);">
                                <td style="padding: 1rem;">
                                    <div style="display: flex; align-items: center; gap: 1rem;">
                                        ${product.image ? `<img src="${product.image}" style="width: 50px; height: 50px; object-fit: cover; border-radius: 4px;">` : ''}
                                        <div>
                                            <div style="font-weight: 600;">${product.name}</div>
                                            <div style="font-size: 0.85rem; color: var(--text-secondary);">${product.sku || 'No SKU'}</div>
                                        </div>
                                    </div>
                                </td>
                                <td style="padding: 1rem;">$${product.price.toFixed(2)}</td>
                                <td style="padding: 1rem;">${product.stock}</td>
                                <td style="padding: 1rem;">
                                    <span class="status-badge status-${product.inStock ? 'confirmed' : 'expired'}">
                                        ${product.inStock ? 'In Stock' : 'Out of Stock'}
                                    </span>
                                </td>
                                <td style="padding: 1rem; text-align: right;">
                                    <button class="btn-secondary" onclick="editProduct('${product.id}')" style="margin-right: 0.5rem;">Edit</button>
                                    <button class="btn-secondary" onclick="deleteProduct('${product.id}')">Delete</button>
                                </td>
                            </tr>
                        `).join('')}
                    </tbody>
                </table>
            </div>
        `;
    }
    
    async function loadOrders() {
        const container = document.getElementById('merchant-orders-list');
        if (!container) return;
        
        const filter = document.getElementById('order-filter')?.value || 'all';
        const filters = filter !== 'all' ? { status: filter } : {};
        
        container.innerHTML = '<div style="text-align: center; padding: 2rem; color: var(--text-secondary);">Loading orders...</div>';
        
        const orders = await merchantAPI.getOrders(currentStore.id, filters);
        
        if (orders.length === 0) {
            container.innerHTML = '<div style="text-align: center; padding: 2rem; color: var(--text-secondary);">No orders found</div>';
            return;
        }
        
        container.innerHTML = `
            <div class="orders-list">
                ${orders.map(order => `
                    <div class="order-card" style="background: var(--bg-secondary); border: 1px solid var(--border-color); border-radius: 8px; padding: 1.5rem; margin-bottom: 1rem;">
                        <div style="display: flex; justify-content: space-between; align-items: start; margin-bottom: 1rem;">
                            <div>
                                <div style="font-weight: 600; font-size: 1.1rem;">Order #${order.id.substring(0, 12)}</div>
                                <div style="font-size: 0.85rem; color: var(--text-secondary); margin-top: 0.25rem;">
                                    ${new Date(order.createdAt).toLocaleString()}
                                </div>
                            </div>
                            <span class="status-badge status-${order.status}">${order.status}</span>
                        </div>
                        <div style="margin-bottom: 1rem;">
                            <div style="font-size: 0.9rem; color: var(--text-secondary); margin-bottom: 0.5rem;">Items:</div>
                            ${order.items ? order.items.map(item => `
                                <div style="display: flex; justify-content: space-between; padding: 0.5rem 0; border-bottom: 1px solid var(--border-color);">
                                    <span>${item.name || 'Unknown'} × ${item.quantity}</span>
                                    <span>$${(item.price * item.quantity).toFixed(2)}</span>
                                </div>
                            `).join('') : ''}
                        </div>
                        <div style="display: flex; justify-content: space-between; align-items: center; padding-top: 1rem; border-top: 1px solid var(--border-color);">
                            <div>
                                <div style="font-size: 0.9rem; color: var(--text-secondary);">Total:</div>
                                <div style="font-size: 1.2rem; font-weight: 700; color: var(--accent-primary);">$${order.total.toFixed(2)}</div>
                            </div>
                            <div>
                                ${order.status === 'paid' ? `
                                    <button class="btn-primary" onclick="fulfillOrder('${order.id}')">Fulfill Order</button>
                                ` : ''}
                                ${order.status === 'pending' ? `
                                    <button class="btn-secondary" onclick="cancelOrder('${order.id}')">Cancel</button>
                                ` : ''}
                            </div>
                        </div>
                    </div>
                `).join('')}
            </div>
        `;
    }
    
    async function loadAnalytics() {
        const container = document.getElementById('merchant-analytics-content');
        if (!container) return;
        
        const analytics = await merchantAPI.getAnalytics(currentStore.id);
        
        container.innerHTML = `
            <div class="analytics-grid">
                <div class="analytics-card">
                    <h4>Revenue Overview</h4>
                    <div style="font-size: 2rem; font-weight: 700; color: var(--accent-primary); margin: 1rem 0;">
                        $${analytics.totalRevenue.toFixed(2)}
                    </div>
                    <div style="color: var(--text-secondary);">From ${analytics.completedOrders} completed orders</div>
                </div>
                <div class="analytics-card">
                    <h4>Top Products</h4>
                    <div style="margin-top: 1rem;">
                        ${analytics.topProducts.length > 0 ? analytics.topProducts.map(p => `
                            <div style="display: flex; justify-content: space-between; padding: 0.75rem 0; border-bottom: 1px solid var(--border-color);">
                                <span>${p.product?.name || 'Unknown'}</span>
                                <span style="color: var(--accent-primary);">${p.sales} sold</span>
                            </div>
                        `).join('') : '<p style="color: var(--text-secondary);">No sales yet</p>'}
                    </div>
                </div>
                <div class="analytics-card">
                    <h4>Payment Methods</h4>
                    <div style="margin-top: 1rem;">
                        ${Object.entries(analytics.paymentMethods).map(([method, count]) => `
                            <div style="display: flex; justify-content: space-between; padding: 0.75rem 0;">
                                <span>${method.toUpperCase()}</span>
                                <span>${count} orders</span>
                            </div>
                        `).join('')}
                    </div>
                </div>
            </div>
        `;
    }
    
    function loadSettings() {
        const container = document.getElementById('merchant-settings-content');
        if (!container || !currentStore) return;
        
        container.innerHTML = `
            <div class="settings-form">
                <div class="checkout-form-group">
                    <label>Store Name</label>
                    <input type="text" id="store-name" value="${currentStore.name}">
                </div>
                <div class="checkout-form-group">
                    <label>Store Description</label>
                    <textarea id="store-description" rows="3">${currentStore.description || ''}</textarea>
                </div>
                <div class="checkout-form-group">
                    <label>Accepted Cryptocurrencies</label>
                    <div style="display: flex; gap: 1rem; margin-top: 0.5rem;">
                        ${['SOL', 'USDC', 'USDT', 'BTC', 'ETH'].map(crypto => `
                            <label style="display: flex; align-items: center; gap: 0.5rem;">
                                <input type="checkbox" value="${crypto}" 
                                       ${currentStore.settings?.acceptCrypto?.includes(crypto) ? 'checked' : ''}>
                                ${crypto}
                            </label>
                        `).join('')}
                    </div>
                </div>
                <button class="btn-primary" onclick="saveStoreSettings()" style="margin-top: 1rem;">Save Settings</button>
            </div>
        `;
    }
    
    function showAddProductModal() {
        const modal = document.createElement('div');
        modal.className = 'checkout-modal';
        modal.innerHTML = `
            <div class="cryptocommerce-modal-overlay"></div>
            <div class="checkout-content">
                <button class="cryptocommerce-modal-close">&times;</button>
                <h2>Add Product</h2>
                <form id="add-product-form">
                    <div class="checkout-form-group">
                        <label>Product Name *</label>
                        <input type="text" id="product-name" required>
                    </div>
                    <div class="checkout-form-group">
                        <label>Description</label>
                        <textarea id="product-description" rows="3"></textarea>
                    </div>
                    <div class="checkout-form-group">
                        <label>Price (USD) *</label>
                        <input type="number" id="product-price" step="0.01" min="0" required>
                    </div>
                    <div class="checkout-form-group">
                        <label>SKU</label>
                        <input type="text" id="product-sku">
                    </div>
                    <div class="checkout-form-group">
                        <label>Image URL</label>
                        <input type="url" id="product-image">
                    </div>
                    <div class="checkout-form-group">
                        <label>Category</label>
                        <select id="product-category">
                            <option value="uncategorized">Uncategorized</option>
                            <option value="hardware">Hardware</option>
                            <option value="digital">Digital</option>
                            <option value="education">Education</option>
                            <option value="tools">Tools</option>
                            <option value="merchandise">Merchandise</option>
                        </select>
                    </div>
                    <div class="checkout-form-group">
                        <label>Stock Quantity</label>
                        <input type="number" id="product-stock" min="0" value="0">
                    </div>
                    <div class="checkout-form-group">
                        <label>
                            <input type="checkbox" id="product-digital"> Digital Product (no shipping)
                        </label>
                    </div>
                    <button type="submit" class="btn-primary" style="width: 100%; margin-top: 1rem;">Add Product</button>
                </form>
            </div>
        `;
        
        document.body.appendChild(modal);
        
        modal.querySelector('.cryptocommerce-modal-close').addEventListener('click', () => modal.remove());
        modal.querySelector('.cryptocommerce-modal-overlay').addEventListener('click', () => modal.remove());
        
        modal.querySelector('#add-product-form').addEventListener('submit', async (e) => {
            e.preventDefault();
            
            const productData = {
                name: document.getElementById('product-name').value,
                description: document.getElementById('product-description').value,
                price: parseFloat(document.getElementById('product-price').value),
                sku: document.getElementById('product-sku').value,
                image: document.getElementById('product-image').value,
                category: document.getElementById('product-category').value,
                stock: parseInt(document.getElementById('product-stock').value) || 0,
                digital: document.getElementById('product-digital').checked
            };
            
            try {
                await merchantAPI.addProduct(currentStore.id, productData);
                modal.remove();
                loadTabData('products');
                alert('Product added successfully!');
            } catch (error) {
                alert('Failed to add product: ' + error.message);
            }
        });
    }
    
    // Global functions for buttons
    window.editProduct = async function(productId) {
        const product = merchantAPI.products.get(productId);
        if (!product) return;
        
        // Similar modal to add product but pre-filled
        alert('Edit product feature - coming soon!');
    };
    
    window.deleteProduct = async function(productId) {
        if (!confirm('Are you sure you want to delete this product?')) return;
        
        try {
            await merchantAPI.deleteProduct(productId);
            loadTabData('products');
        } catch (error) {
            alert('Failed to delete product: ' + error.message);
        }
    };
    
    window.fulfillOrder = async function(orderId) {
        try {
            await merchantAPI.fulfillOrder(orderId);
            loadTabData('orders');
            alert('Order fulfilled!');
        } catch (error) {
            alert('Failed to fulfill order: ' + error.message);
        }
    };
    
    window.cancelOrder = async function(orderId) {
        if (!confirm('Cancel this order?')) return;
        
        try {
            await merchantAPI.updateOrderStatus(orderId, 'cancelled');
            loadTabData('orders');
        } catch (error) {
            alert('Failed to cancel order: ' + error.message);
        }
    };
    
    window.saveStoreSettings = async function() {
        const name = document.getElementById('store-name').value;
        const description = document.getElementById('store-description').value;
        const acceptCrypto = Array.from(document.querySelectorAll('#merchant-settings-content input[type="checkbox"]:checked'))
            .map(cb => cb.value);
        
        currentStore.name = name;
        currentStore.description = description;
        currentStore.settings.acceptCrypto = acceptCrypto;
        
        // Save to backend
        await merchantAPI.saveToBackend('stores', currentStore, 'PUT');
        
        alert('Settings saved!');
    };
    
    // Initialize
    if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', initMerchantDashboard);
    } else {
        initMerchantDashboard();
    }
    
    setTimeout(initMerchantDashboard, 1000);
})();

