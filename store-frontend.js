
// Store Frontend - Handles UI for shopping cart and products
(function() {
    'use strict';
    
    let currentCategory = 'all';
    let currentProducts = [];
    
    async function initStore() {
        // Initialize product API
        if (!window.productAPI) {
            window.productAPI = new ProductAPI();
        }
        
        // Initialize catalog if not exists (fallback)
        if (!window.catalog) {
            window.catalog = new ProductCatalog();
        }
        
        if (!window.cart) {
            console.warn('Cart not loaded');
            return;
        }
        
        renderCategories();
        await renderProducts();
        renderCart();
        
        // Event listeners
        setupEventListeners();
        
        // Cart update listener
        window.cart.on('cart.updated', () => {
            renderCart();
        });
    }
    
    function setupEventListeners() {
        // Category filters
        document.addEventListener('click', (e) => {
            if (e.target.classList.contains('category-filter')) {
                const category = e.target.getAttribute('data-category');
                selectCategory(category);
            }
        });
        
        // Product search
        const searchInput = document.getElementById('product-search');
        if (searchInput) {
            searchInput.addEventListener('input', (e) => {
                searchProducts(e.target.value);
            });
        }
        
        // Sort products
        const sortSelect = document.getElementById('sort-products');
        if (sortSelect) {
            sortSelect.addEventListener('change', (e) => {
                sortProducts(e.target.value);
            });
        }
        
        // Add to cart buttons
        document.addEventListener('click', (e) => {
            if (e.target.classList.contains('btn-add-to-cart')) {
                const productId = e.target.getAttribute('data-product-id');
                addToCart(productId);
            }
        });
        
        // Cart quantity buttons
        document.addEventListener('click', (e) => {
            if (e.target.classList.contains('quantity-decrease')) {
                const productId = e.target.getAttribute('data-product-id');
                const item = window.cart.items.find(i => i.id === productId);
                if (item) {
                    window.cart.updateQuantity(productId, item.quantity - 1);
                }
            }
            if (e.target.classList.contains('quantity-increase')) {
                const productId = e.target.getAttribute('data-product-id');
                const item = window.cart.items.find(i => i.id === productId);
                if (item) {
                    window.cart.updateQuantity(productId, item.quantity + 1);
                }
            }
            if (e.target.classList.contains('cart-item-remove')) {
                const productId = e.target.getAttribute('data-product-id');
                window.cart.removeItem(productId);
            }
        });
        
        // Checkout button
        const checkoutBtn = document.getElementById('checkout-btn');
        if (checkoutBtn) {
            checkoutBtn.addEventListener('click', () => {
                showCheckout();
            });
        }
    }
    
    function renderCategories() {
        const container = document.getElementById('category-filters');
        if (!container || !window.catalog) return;
        
        container.innerHTML = window.catalog.categories.map(cat => `
            <div class="category-filter ${currentCategory === cat.id ? 'active' : ''}" 
                 data-category="${cat.id}">
                ${cat.name}
            </div>
        `).join('');
    }
    
    function selectCategory(category) {
        currentCategory = category;
        renderCategories();
        renderProducts();
    }
    
    async function renderProducts() {
        const container = document.getElementById('products-grid');
        if (!container) return;
        
        // Show loading
        container.innerHTML = '<div style="text-align: center; padding: 2rem; color: var(--text-secondary);">Loading products...</div>';
        
        // Fetch real products
        if (window.productAPI) {
            try {
                currentProducts = await window.productAPI.searchAllProducts('', { includeCrypto: true });
                
                // Filter by category
                if (currentCategory !== 'all') {
                    currentProducts = currentProducts.filter(p => p.category === currentCategory);
                }
            } catch (error) {
                console.error('Failed to fetch products:', error);
                // Fallback to catalog
                if (window.catalog) {
                    currentProducts = window.catalog.getProducts(currentCategory);
                } else {
                    currentProducts = [];
                }
            }
        } else if (window.catalog) {
            currentProducts = window.catalog.getProducts(currentCategory);
        } else {
            currentProducts = [];
        }
        
        if (currentProducts.length === 0) {
            container.innerHTML = '<div style="text-align: center; padding: 2rem; color: var(--text-secondary);">No products found</div>';
            return;
        }
        
        container.innerHTML = currentProducts.map(product => `
            <div class="product-card">
                <img src="${product.image}" alt="${product.name}" class="product-image" 
                     onerror="this.src='https://via.placeholder.com/300x300?text=Product'">
                <div class="product-info">
                    <div class="product-name">${product.name}</div>
                    <div class="product-description">${product.description}</div>
                    <div class="product-footer">
                        <div class="product-price">$${product.price.toFixed(2)}</div>
                        <button class="btn-add-to-cart" 
                                data-product-id="${product.id}"
                                ${!product.inStock ? 'disabled' : ''}>
                            ${product.inStock ? 'Add to Cart' : 'Out of Stock'}
                        </button>
                    </div>
                </div>
            </div>
        `).join('');
    }
    
    async function searchProducts(query) {
        const container = document.getElementById('products-grid');
        if (!container) return;
        
        if (!query || query.trim() === '') {
            await renderProducts();
            return;
        }
        
        // Show loading
        container.innerHTML = '<div style="text-align: center; padding: 2rem; color: var(--text-secondary);">Searching...</div>';
        
        // Search real products
        if (window.productAPI) {
            try {
                currentProducts = await window.productAPI.searchAllProducts(query, { includeCrypto: true });
            } catch (error) {
                console.error('Search failed:', error);
                if (window.catalog) {
                    currentProducts = window.catalog.searchProducts(query);
                } else {
                    currentProducts = [];
                }
            }
        } else if (window.catalog) {
            currentProducts = window.catalog.searchProducts(query);
        } else {
            currentProducts = [];
        }
        
        if (currentProducts.length === 0) {
            container.innerHTML = '<div style="text-align: center; padding: 2rem; color: var(--text-secondary);">No products found</div>';
            return;
        }
        
        container.innerHTML = currentProducts.map(product => `
            <div class="product-card">
                <img src="${product.image}" alt="${product.name}" class="product-image"
                     onerror="this.src='https://via.placeholder.com/300x300?text=Product'">
                <div class="product-info">
                    <div class="product-name">${product.name}</div>
                    <div class="product-description">${product.description}</div>
                    <div class="product-footer">
                        <div class="product-price">$${product.price.toFixed(2)}</div>
                        <button class="btn-add-to-cart" 
                                data-product-id="${product.id}"
                                ${!product.inStock ? 'disabled' : ''}>
                            ${product.inStock ? 'Add to Cart' : 'Out of Stock'}
                        </button>
                    </div>
                </div>
            </div>
        `).join('');
    }
    
    function sortProducts(sortBy) {
        if (!currentProducts.length) return;
        
        const sorted = [...currentProducts].sort((a, b) => {
            switch(sortBy) {
                case 'price-low':
                    return a.price - b.price;
                case 'price-high':
                    return b.price - a.price;
                case 'name':
                default:
                    return a.name.localeCompare(b.name);
            }
        });
        
        const container = document.getElementById('products-grid');
        if (!container) return;
        
        container.innerHTML = sorted.map(product => `
            <div class="product-card">
                <img src="${product.image}" alt="${product.name}" class="product-image"
                     onerror="this.src='https://via.placeholder.com/300x300?text=Product'">
                <div class="product-info">
                    <div class="product-name">${product.name}</div>
                    <div class="product-description">${product.description}</div>
                    <div class="product-footer">
                        <div class="product-price">$${product.price.toFixed(2)}</div>
                        <button class="btn-add-to-cart" 
                                data-product-id="${product.id}"
                                ${!product.inStock ? 'disabled' : ''}>
                            ${product.inStock ? 'Add to Cart' : 'Out of Stock'}
                        </button>
                    </div>
                </div>
            </div>
        `).join('');
    }
    
    function addToCart(productId) {
        if (!window.catalog || !window.cart) return;
        
        const product = window.catalog.getProduct(productId);
        if (!product) return;
        
        if (!product.inStock) {
            alert('Product is out of stock');
            return;
        }
        
        window.cart.addItem(product);
        
        // Visual feedback
        const btn = document.querySelector(`[data-product-id="${productId}"]`);
        if (btn) {
            const originalText = btn.textContent;
            btn.textContent = 'Added!';
            btn.style.background = 'var(--accent-success)';
            setTimeout(() => {
                btn.textContent = originalText;
                btn.style.background = '';
            }, 1000);
        }
    }
    
    function renderCart() {
        const container = document.getElementById('cart-items');
        const totalsContainer = document.getElementById('cart-totals');
        
        if (!container || !totalsContainer || !window.cart) return;
        
        if (window.cart.items.length === 0) {
            container.innerHTML = '<p style="color: var(--text-secondary); text-align: center; padding: 1rem;">Cart is empty</p>';
            totalsContainer.innerHTML = '';
            return;
        }
        
        container.innerHTML = window.cart.items.map(item => `
            <div class="cart-item">
                <div class="cart-item-info">
                    <div class="cart-item-name">${item.name}</div>
                    <div class="cart-item-price">$${item.price.toFixed(2)} × ${item.quantity}</div>
                </div>
                <div class="cart-item-quantity">
                    <button class="quantity-btn quantity-decrease" data-product-id="${item.id}">-</button>
                    <span>${item.quantity}</span>
                    <button class="quantity-btn quantity-increase" data-product-id="${item.id}">+</button>
                </div>
                <button class="cart-item-remove" data-product-id="${item.id}">×</button>
            </div>
        `).join('');
        
        const subtotal = window.cart.getSubtotal();
        const discount = window.cart.getDiscount();
        const shipping = window.cart.getShippingCost();
        const total = window.cart.getTotal();
        
        totalsContainer.innerHTML = `
            <div class="cart-total-line">
                <span>Subtotal:</span>
                <span>$${subtotal.toFixed(2)}</span>
            </div>
            ${discount > 0 ? `
            <div class="cart-total-line">
                <span>Discount (${window.cart.discountCode}):</span>
                <span style="color: var(--accent-success);">-$${discount.toFixed(2)}</span>
            </div>
            ` : ''}
            <div class="cart-total-line">
                <span>Shipping:</span>
                <span>$${shipping.toFixed(2)}</span>
            </div>
            <div class="cart-total-line total">
                <span>Total:</span>
                <span>$${total.toFixed(2)}</span>
            </div>
        `;
    }
    
    async function showCheckout() {
        if (!window.cart || window.cart.items.length === 0) {
            alert('Your cart is empty');
            return;
        }
        
        if (!window.cryptocommerce) {
            alert('Payment system not initialized');
            return;
        }
        
        // Create checkout modal
        const modal = document.createElement('div');
        modal.className = 'checkout-modal';
        modal.innerHTML = `
            <div class="cryptocommerce-modal-overlay"></div>
            <div class="checkout-content">
                <button class="cryptocommerce-modal-close">&times;</button>
                <h2>Checkout</h2>
                
                <div class="checkout-section">
                    <h3>Shipping Information</h3>
                    <div class="checkout-form-group">
                        <label>Email</label>
                        <input type="email" id="checkout-email" placeholder="your@email.com" required>
                    </div>
                    <div class="checkout-form-group">
                        <label>Full Name</label>
                        <input type="text" id="checkout-name" placeholder="John Doe" required>
                    </div>
                    <div class="checkout-form-group">
                        <label>Address</label>
                        <input type="text" id="checkout-address" placeholder="123 Main St" required>
                    </div>
                    <div class="checkout-form-group">
                        <label>City</label>
                        <input type="text" id="checkout-city" placeholder="New York" required>
                    </div>
                    <div class="checkout-form-group">
                        <label>State/Province</label>
                        <input type="text" id="checkout-state" placeholder="NY" required>
                    </div>
                    <div class="checkout-form-group">
                        <label>ZIP/Postal Code</label>
                        <input type="text" id="checkout-zip" placeholder="10001" required>
                    </div>
                    <div class="checkout-form-group">
                        <label>Country</label>
                        <input type="text" id="checkout-country" placeholder="USA" required>
                    </div>
                </div>
                
                <div class="checkout-section">
                    <h3>Shipping Method</h3>
                    <div class="shipping-options">
                        <div class="shipping-option ${window.cart.shippingMethod === 'standard' ? 'selected' : ''}" 
                             data-method="standard">
                            <span>Standard Shipping (5-7 days)</span>
                            <span>$${window.cart.getShippingCost() === 0 ? '0.00 (Free)' : '5.99'}</span>
                        </div>
                        <div class="shipping-option ${window.cart.shippingMethod === 'express' ? 'selected' : ''}" 
                             data-method="express">
                            <span>Express Shipping (2-3 days)</span>
                            <span>$12.99</span>
                        </div>
                        <div class="shipping-option ${window.cart.shippingMethod === 'overnight' ? 'selected' : ''}" 
                             data-method="overnight">
                            <span>Overnight Shipping</span>
                            <span>$24.99</span>
                        </div>
                    </div>
                </div>
                
                <div class="checkout-section">
                    <h3>Discount Code</h3>
                    <div class="discount-code-section">
                        <input type="text" id="discount-code" placeholder="Enter code">
                        <button class="btn-primary" id="apply-discount">Apply</button>
                    </div>
                </div>
                
                <div class="checkout-section">
                    <h3>Payment Method</h3>
                    <select id="payment-crypto" class="checkout-form-group" style="width: 100%; padding: 0.75rem;">
                        <option value="SOL">Solana (SOL)</option>
                        <option value="USDC">USD Coin (USDC)</option>
                        <option value="USDT">Tether (USDT)</option>
                    </select>
                </div>
                
                <div class="checkout-section">
                    <div style="display: flex; justify-content: space-between; font-size: 1.2rem; font-weight: 700; padding-top: 1rem; border-top: 1px solid var(--border-color);">
                        <span>Total:</span>
                        <span>$${window.cart.getTotal().toFixed(2)}</span>
                    </div>
                </div>
                
                <button class="btn-primary" id="proceed-payment" style="width: 100%; margin-top: 1rem; padding: 1rem;">
                    Proceed to Payment
                </button>
            </div>
        `;
        
        document.body.appendChild(modal);
        
        // Close button
        modal.querySelector('.cryptocommerce-modal-close').addEventListener('click', () => {
            modal.remove();
        });
        
        modal.querySelector('.cryptocommerce-modal-overlay').addEventListener('click', () => {
            modal.remove();
        });
        
        // Shipping method selection
        modal.querySelectorAll('.shipping-option').forEach(option => {
            option.addEventListener('click', () => {
                modal.querySelectorAll('.shipping-option').forEach(o => o.classList.remove('selected'));
                option.classList.add('selected');
                const method = option.getAttribute('data-method');
                window.cart.setShippingMethod(method);
                // Update totals
                const totalEl = modal.querySelector('.checkout-section:last-of-type span:last-child');
                if (totalEl) {
                    totalEl.textContent = `$${window.cart.getTotal().toFixed(2)}`;
                }
            });
        });
        
        // Apply discount
        modal.querySelector('#apply-discount').addEventListener('click', () => {
            const code = modal.querySelector('#discount-code').value;
            if (window.cart.applyDiscountCode(code)) {
                alert(`Discount code "${code}" applied!`);
                const totalEl = modal.querySelector('.checkout-section:last-of-type span:last-child');
                if (totalEl) {
                    totalEl.textContent = `$${window.cart.getTotal().toFixed(2)}`;
                }
            } else {
                alert('Invalid discount code');
            }
        });
        
        // Proceed to payment
        modal.querySelector('#proceed-payment').addEventListener('click', async () => {
            const email = modal.querySelector('#checkout-email').value;
            const name = modal.querySelector('#checkout-name').value;
            const address = modal.querySelector('#checkout-address').value;
            const city = modal.querySelector('#checkout-city').value;
            const state = modal.querySelector('#checkout-state').value;
            const zip = modal.querySelector('#checkout-zip').value;
            const country = modal.querySelector('#checkout-country').value;
            const crypto = modal.querySelector('#payment-crypto').value;
            
            if (!email || !name || !address || !city || !state || !zip || !country) {
                alert('Please fill in all shipping information');
                return;
            }
            
            const shippingAddress = {
                name: name,
                address: address,
                city: city,
                state: state,
                zip: zip,
                country: country
            };
            
            try {
                modal.remove();
                
                // Create payment
                const payment = await window.cryptocommerce.checkout(window.cart, {
                    crypto: crypto,
                    shippingAddress: shippingAddress,
                    email: email
                });
                
                // Show payment modal
                payment.showModal();
                
                // Clear cart after successful payment
                window.cryptocommerce.on('payment.confirmed', () => {
                    window.cart.clear();
                });
                
            } catch (error) {
                alert('Payment failed: ' + error.message);
            }
        });
    }
    
    // Initialize when DOM is ready
    if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', initStore);
    } else {
        initStore();
    }
    
    // Also initialize after a delay to ensure dependencies are loaded
    setTimeout(initStore, 1000);
})();


            }
        });
        
        // Proceed to payment
        modal.querySelector('#proceed-payment').addEventListener('click', async () => {
            const email = modal.querySelector('#checkout-email').value;
            const name = modal.querySelector('#checkout-name').value;
            const address = modal.querySelector('#checkout-address').value;
            const city = modal.querySelector('#checkout-city').value;
            const state = modal.querySelector('#checkout-state').value;
            const zip = modal.querySelector('#checkout-zip').value;
            const country = modal.querySelector('#checkout-country').value;
            const crypto = modal.querySelector('#payment-crypto').value;
            
            if (!email || !name || !address || !city || !state || !zip || !country) {
                alert('Please fill in all shipping information');
                return;
            }
            
            const shippingAddress = {
                name: name,
                address: address,
                city: city,
                state: state,
                zip: zip,
                country: country
            };
            
            try {
                modal.remove();
                
                // Create payment
                const payment = await window.cryptocommerce.checkout(window.cart, {
                    crypto: crypto,
                    shippingAddress: shippingAddress,
                    email: email
                });
                
                // Show payment modal
                payment.showModal();
                
                // Clear cart after successful payment
                window.cryptocommerce.on('payment.confirmed', () => {
                    window.cart.clear();
                });
                
            } catch (error) {
                alert('Payment failed: ' + error.message);
            }
        });
    }
    
    // Initialize when DOM is ready
    if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', initStore);
    } else {
        initStore();
    }
    
    // Also initialize after a delay to ensure dependencies are loaded
    setTimeout(initStore, 1000);
})();

