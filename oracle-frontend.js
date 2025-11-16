
// Zcash Payment Oracle Frontend
(function() {
    'use strict';
    
    let oracle = null;
    
    function initOracle() {
        if (!window.SolanaPaymentOracle) {
            console.warn('SolanaPaymentOracle not loaded');
            return;
        }
        
        oracle = new SolanaPaymentOracle({
            baseUrl: window.location.origin,
            merchantAddress: localStorage.getItem('sol_merchant_address'),
            confirmationThreshold: parseInt(localStorage.getItem('sol_confirmation_threshold')) || 1
        });
        
        // Expose oracle to window for global access
        window.oracle = oracle;
        
        // Initialize Solana Pay integration
        if (window.SolanaPayIntegration) {
            window.solanaPay = new SolanaPayIntegration(oracle);
        }
        
        // Initialize webhook system
        if (window.WebhookSystem) {
            window.webhookSystem = new WebhookSystem(window.location.origin);
        }
        
        setupOracleEventListeners();
        loadOracleData();
    }
    
    function setupOracleEventListeners() {
        // Payment verification
        const verifyBtn = document.getElementById('verify-payment-btn');
        if (verifyBtn) {
            verifyBtn.addEventListener('click', async () => {
                const paymentId = document.getElementById('payment-id-input').value;
                const expectedAmount = parseFloat(document.getElementById('expected-amount').value);
                
                if (!paymentId || !expectedAmount) {
                    alert('Please enter payment ID and expected amount');
                    return;
                }
                
                verifyBtn.disabled = true;
                verifyBtn.textContent = 'Verifying...';
                
                try {
                    const result = await oracle.verifySolanaTransaction(paymentId, expectedAmount);
                    displayVerificationResult(result);
                } catch (error) {
                    displayVerificationError(error);
                } finally {
                    verifyBtn.disabled = false;
                    verifyBtn.textContent = 'Verify Payment with ZK Proof';
                }
            });
        }
        
        // ZK verification in merchant dashboard
        const zkVerifyBtn = document.getElementById('zk-verify-btn');
        if (zkVerifyBtn) {
            zkVerifyBtn.addEventListener('click', async () => {
                const txHash = document.getElementById('tx-hash-input').value;
                const amount = parseFloat(document.getElementById('verify-amount').value);
                
                if (!txHash || !amount) {
                    alert('Please enter transaction hash and amount');
                    return;
                }
                
                zkVerifyBtn.disabled = true;
                zkVerifyBtn.textContent = 'Generating ZK Proof...';
                
                try {
                    const result = await oracle.verifySolanaTransaction(txHash, amount);
                    displayZKVerificationResult(result);
                } catch (error) {
                    displayZKVerificationError(error);
                } finally {
                    zkVerifyBtn.disabled = false;
                    zkVerifyBtn.textContent = 'Generate & Verify ZK Proof';
                }
            });
        }
        
        // Create payment button
        const createPaymentBtn = document.getElementById('create-payment-btn');
        if (createPaymentBtn) {
            createPaymentBtn.addEventListener('click', (e) => {
                e.preventDefault();
                e.stopPropagation();
                // Remove any existing modals first
                document.querySelectorAll('.checkout-modal').forEach(m => m.remove());
                showCreatePaymentModal();
            });
        }
    }
    
    function displayVerificationResult(result) {
        const container = document.getElementById('verification-result');
        if (!container) return;
        
        if (result.verified) {
            container.innerHTML = `
                <div style="background: var(--bg-secondary); border: 1px solid var(--accent-success); border-radius: 8px; padding: 1.5rem;">
                    <div style="color: var(--accent-success); font-weight: 600; margin-bottom: 1rem;">✓ Payment Verified</div>
                    <div style="font-size: 0.9rem; color: var(--text-secondary); margin-bottom: 0.5rem;">
                        Amount: ${result.amount.toFixed(8)} SOL
                    </div>
                    <div style="font-size: 0.9rem; color: var(--text-secondary); margin-bottom: 0.5rem;">
                        Confirmations: ${result.confirmations}
                    </div>
                    <div style="font-size: 0.9rem; color: var(--text-secondary);">
                        ZK Proof ID: ${result.proof.id}
                    </div>
                </div>
            `;
        } else {
            container.innerHTML = `
                <div style="background: var(--bg-secondary); border: 1px solid var(--accent-error); border-radius: 8px; padding: 1.5rem;">
                    <div style="color: var(--accent-error); font-weight: 600;">✗ Payment Verification Failed</div>
                    <div style="font-size: 0.9rem; color: var(--text-secondary); margin-top: 0.5rem;">
                        The transaction could not be verified. Please check the transaction hash and amount.
                    </div>
                </div>
            `;
        }
    }
    
    function displayVerificationError(error) {
        const container = document.getElementById('verification-result');
        if (!container) return;
        
        container.innerHTML = `
            <div style="background: var(--bg-secondary); border: 1px solid var(--accent-error); border-radius: 8px; padding: 1.5rem;">
                <div style="color: var(--accent-error); font-weight: 600;">Error</div>
                <div style="font-size: 0.9rem; color: var(--text-secondary); margin-top: 0.5rem;">
                    ${error.message || 'Verification failed'}
                </div>
            </div>
        `;
    }
    
    function displayZKVerificationResult(result) {
        const container = document.getElementById('zk-verification-result');
        if (!container) return;
        
        if (result.verified) {
            container.innerHTML = `
                <div style="background: var(--bg-secondary); border: 1px solid var(--accent-success); border-radius: 8px; padding: 1.5rem;">
                    <div style="color: var(--accent-success); font-weight: 600; margin-bottom: 1rem;">✓ ZK Proof Verified</div>
                    <div style="font-size: 0.85rem; color: var(--text-secondary); margin-bottom: 0.5rem;">
                        <strong>Proof ID:</strong> ${result.proof.id}
                    </div>
                                    <div style="font-size: 0.85rem; color: var(--text-secondary); margin-bottom: 0.5rem;">
                        <strong>Amount:</strong> ${result.amount.toFixed(8)} SOL
                    </div>
                    <div style="font-size: 0.85rem; color: var(--text-secondary); margin-bottom: 0.5rem;">
                        <strong>Confirmations:</strong> ${result.confirmations}
                    </div>
                    <div style="font-size: 0.85rem; color: var(--text-secondary); margin-top: 1rem; padding-top: 1rem; border-top: 1px solid var(--border-color);">
                        <strong>ZK Proof Data:</strong>
                        <pre style="background: var(--bg-tertiary); padding: 0.5rem; border-radius: 4px; margin-top: 0.5rem; font-size: 0.75rem; overflow-x: auto;">${JSON.stringify(result.proof.proofData, null, 2)}</pre>
                    </div>
                </div>
            `;
        } else {
            container.innerHTML = `
                <div style="background: var(--bg-secondary); border: 1px solid var(--accent-error); border-radius: 8px; padding: 1.5rem;">
                    <div style="color: var(--accent-error); font-weight: 600;">✗ ZK Proof Verification Failed</div>
                </div>
            `;
        }
    }
    
    function displayZKVerificationError(error) {
        const container = document.getElementById('zk-verification-result');
        if (!container) return;
        
        container.innerHTML = `
            <div style="background: var(--bg-secondary); border: 1px solid var(--accent-error); border-radius: 8px; padding: 1.5rem;">
                <div style="color: var(--accent-error); font-weight: 600;">Error</div>
                <div style="font-size: 0.9rem; color: var(--text-secondary); margin-top: 0.5rem;">
                    ${error.message || 'ZK proof generation failed'}
                </div>
            </div>
        `;
    }
    
    async function loadOracleData() {
        if (!oracle) return;
        
        // Ensure monitoring is running
        if (oracle && oracle.startPaymentMonitoring) {
            oracle.startPaymentMonitoring();
        }
        
        // Load payments
        const payments = oracle.getAllPayments();
        
        // Calculate stats from verified payments only (permanent ones)
        const verifiedPayments = payments.filter(p => p.status === 'verified');
        
        const totalSOL = verifiedPayments
            .reduce((sum, p) => sum + (p.solAmount || 0), 0);
        
        // Calculate all-time volume in USD from verified payments
        const allTimeVolumeUSD = verifiedPayments
            .reduce((sum, p) => sum + (p.amount || 0), 0);
        
        const verifiedCount = verifiedPayments.length;
        const proofCount = verifiedPayments.filter(p => p.proof).length;
        const pendingCount = payments.filter(p => p.status === 'pending').length;
        
        const solEl = document.getElementById('stat-sol');
        const paymentsEl = document.getElementById('stat-payments');
        const proofsEl = document.getElementById('stat-proofs');
        const pendingEl = document.getElementById('stat-pending');
        const volumeEl = document.getElementById('stat-volume');
        
        if (solEl) solEl.textContent = `${totalSOL.toFixed(8)} SOL`;
        if (paymentsEl) paymentsEl.textContent = verifiedCount;
        if (proofsEl) proofsEl.textContent = proofCount;
        if (pendingEl) pendingEl.textContent = pendingCount;
        if (volumeEl) volumeEl.textContent = `$${allTimeVolumeUSD.toFixed(2)}`;
        
        // Display payments list
        displayPayments(payments);
        
        // Display Google Sheet link if available
        displaySheetLink();
        
        // Auto-refresh every 5 seconds to show updated payment status
        setTimeout(loadOracleData, 5000);
    }
    
    function displaySheetLink() {
        if (!oracle || !oracle.paymentStorage) return;
        
        const sheetLink = oracle.paymentStorage.getSheetLink();
        const sheetId = oracle.paymentStorage.getSheetId();
        
        if (!sheetLink) return;
        
        // Try to find or create sheet link display
        let linkContainer = document.getElementById('payment-sheet-link');
        if (!linkContainer) {
            // Create link display in settings or payments tab
            const settingsTab = document.getElementById('merchant-settings');
            if (settingsTab) {
                linkContainer = document.createElement('div');
                linkContainer.id = 'payment-sheet-link';
                linkContainer.style.cssText = 'margin-top: 1.5rem; padding: 1rem; background: var(--bg-tertiary); border: 1px solid var(--border-color); border-radius: 8px;';
                linkContainer.innerHTML = `
                    <h4 style="margin: 0 0 0.5rem 0;">Payment Database</h4>
                    <p style="color: var(--text-secondary); font-size: 0.9rem; margin: 0 0 0.5rem 0;">
                        Verified payments are stored in Google Sheets
                    </p>
                    <a href="${sheetLink}" target="_blank" class="btn-primary" style="display: inline-block;">
                        Open Google Sheet
                    </a>
                    <p style="color: var(--text-secondary); font-size: 0.85rem; margin: 0.5rem 0 0 0;">
                        Sheet ID: <code style="font-family: var(--font-mono);">${sheetId}</code>
                    </p>
                `;
                settingsTab.querySelector('.settings-form')?.appendChild(linkContainer);
            }
        } else {
            // Update existing link
            const link = linkContainer.querySelector('a');
            if (link) {
                link.href = sheetLink;
            }
            const code = linkContainer.querySelector('code');
            if (code) {
                code.textContent = sheetId;
            }
        }
    }
    
    function displayPayments(payments) {
        // Try multiple possible container IDs
        const paymentsContainer = document.getElementById('payments-list') || 
                                  document.getElementById('merchant-payments-list');
        if (!paymentsContainer) return;
        
        if (payments.length === 0) {
            paymentsContainer.innerHTML = '<p style="color: var(--text-secondary); text-align: center; padding: 2rem;">No payments yet</p>';
            return;
        }
        
        // Sort by creation date (newest first)
        const sortedPayments = [...payments].sort((a, b) => b.createdAt - a.createdAt);
        
        paymentsContainer.innerHTML = sortedPayments.map(payment => {
            const date = new Date(payment.createdAt);
            const statusClass = payment.status === 'verified' ? 'success' : 
                              payment.status === 'pending' ? 'warning' : 'error';
            const statusText = payment.status.toUpperCase();
            
            return `
                <div class="payment-card" style="background: var(--bg-secondary); border: 1px solid var(--border-color); border-radius: 8px; padding: 1.5rem; margin-bottom: 1rem;">
                    <div style="display: flex; justify-content: space-between; align-items: start; margin-bottom: 1rem;">
                        <div>
                            <h3 style="margin: 0 0 0.5rem 0;">Payment ${payment.id}</h3>
                            <p style="color: var(--text-secondary); font-size: 0.9rem; margin: 0;">
                                ${date.toLocaleString()}
                            </p>
                        </div>
                        <span class="status-badge status-${statusClass}" style="padding: 0.5rem 1rem; border-radius: 6px; font-size: 0.85rem; font-weight: 600;">
                            ${statusText}
                        </span>
                    </div>
                    <div style="display: grid; grid-template-columns: 1fr 1fr; gap: 1rem;">
                        <div>
                            <span style="color: var(--text-secondary);">Amount:</span>
                            <span style="display: block; font-weight: 600;">$${payment.amount.toFixed(2)}</span>
                        </div>
                        <div>
                            <span style="color: var(--text-secondary);">${payment.token || 'SOL'} Amount:</span>
                            <span style="display: block; font-weight: 600; color: var(--accent-primary);">
                                ${(payment.solAmount || payment.amount || 0).toFixed(8)} ${payment.token || 'SOL'}
                            </span>
                        </div>
                    </div>
                    ${payment.transactionSignature ? `
                        <div style="margin-top: 1rem; padding-top: 1rem; border-top: 1px solid var(--border-color);">
                            <span style="color: var(--text-secondary); font-size: 0.85rem;">Transaction:</span>
                            <a href="https://solscan.io/tx/${payment.transactionSignature}" target="_blank" 
                               style="color: var(--accent-primary); font-size: 0.85rem; word-break: break-all;">
                                ${payment.transactionSignature.substring(0, 20)}...
                            </a>
                        </div>
                    ` : ''}
                </div>
            `;
        }).join('');
    }
    
    function showCreatePaymentModal() {
        // Prevent multiple modals
        const existingModal = document.querySelector('.checkout-modal');
        if (existingModal) {
            existingModal.remove();
        }
        
        const modal = document.createElement('div');
        modal.className = 'checkout-modal';
        modal.setAttribute('data-modal-id', 'payment-create');
        modal.innerHTML = `
            <div class="cryptocommerce-modal-overlay"></div>
            <div class="checkout-content">
                <button class="cryptocommerce-modal-close">&times;</button>
                <h2>Create Payment Request</h2>
                <form id="create-payment-form">
                    <div class="checkout-form-group">
                        <label>Amount (USD)</label>
                        <input type="number" id="payment-amount" step="0.01" min="0" required>
                    </div>
                    <div class="checkout-form-group">
                        <label>Payment Token</label>
                        <select id="payment-token" class="checkout-form-group" style="width: 100%; padding: 0.75rem;">
                            <option value="SOL">SOL (Solana)</option>
                            <option value="USDC">USDC (USD Coin)</option>
                            <option value="USDT">USDT (Tether)</option>
                            <option value="EURC">EURC (Euro Coin)</option>
                        </select>
                    </div>
                    <div class="checkout-form-group">
                        <label>Order ID (Auto-generated if empty)</label>
                        <input type="text" id="payment-order-id" placeholder="Leave empty to auto-generate">
                        <small style="color: var(--text-secondary); font-size: 0.85rem; display: block; margin-top: 0.25rem;">
                            Custom order ID from your system, or leave empty to auto-generate one.
                        </small>
                    </div>
                    <div class="checkout-form-group">
                        <label>Token Amount</label>
                        <input type="text" id="payment-token-amount" readonly style="background: var(--bg-tertiary);">
                    </div>
                    <div class="checkout-form-group">
                        <label>Merchant Address</label>
                        <div style="display: flex; gap: 0.5rem; align-items: center;">
                            <input type="text" id="payment-address" value="${oracle?.merchantAddress || ''}" placeholder="Paste your Solana wallet address" style="flex: 1;">
                            <button type="button" class="btn-secondary" onclick="pasteMerchantAddress()" style="white-space: nowrap;">Paste</button>
                        </div>
                        <small style="color: var(--text-secondary); display: block; margin-top: 0.5rem;">Your Solana wallet address for receiving payments</small>
                    </div>
                    <div class="checkout-form-group">
                        <label>
                            <input type="checkbox" id="allow-partial"> Allow partial payments
                        </label>
                    </div>
                    <button type="submit" class="btn-primary" style="width: 100%; margin-top: 1rem;">Create Payment Request</button>
                </form>
            </div>
        `;
        
        document.body.appendChild(modal);
        
        // Close button
        modal.querySelector('.cryptocommerce-modal-close').addEventListener('click', (e) => {
            e.stopPropagation();
            modal.remove();
        });
        
        // Overlay click - only close if clicking the overlay itself, not the content
        modal.querySelector('.cryptocommerce-modal-overlay').addEventListener('click', (e) => {
            if (e.target === e.currentTarget) {
                modal.remove();
            }
        });
        
        // Prevent clicks inside content from closing modal
        modal.querySelector('.checkout-content').addEventListener('click', (e) => {
            e.stopPropagation();
        });
        
        // Update token amount when USD amount or token changes
        const amountInput = modal.querySelector('#payment-amount');
        const tokenSelect = modal.querySelector('#payment-token');
        const tokenAmountInput = modal.querySelector('#payment-token-amount');
        
            const updateTokenAmount = async () => {
                const amount = parseFloat(amountInput.value);
                const token = tokenSelect.value;
                if (amount > 0 && window.solanaPay) {
                    try {
                        const tokenAmount = await window.solanaPay.convertFiatToToken(amount, token, 'USD');
                        tokenAmountInput.value = `${tokenAmount.toFixed(8)} ${token}`;
                    } catch (error) {
                        console.error('Failed to get token price:', error);
                        tokenAmountInput.value = 'Error: ' + error.message;
                    }
                } else if (amount > 0 && oracle && token === 'SOL') {
                    try {
                        const solPrice = await oracle.getSOLPrice();
                        tokenAmountInput.value = (amount / solPrice).toFixed(8) + ' SOL';
                    } catch (error) {
                        console.error('Failed to get SOL price:', error);
                        tokenAmountInput.value = 'Error: ' + error.message;
                    }
                }
            };
        
        amountInput.addEventListener('input', updateTokenAmount);
        tokenSelect.addEventListener('change', updateTokenAmount);
        
        // Update merchant address when user types/pastes in the field
        const paymentAddressInput = modal.querySelector('#payment-address');
        if (paymentAddressInput) {
            paymentAddressInput.addEventListener('input', (e) => {
                const address = e.target.value.trim();
                if (oracle && address) {
                    oracle.merchantAddress = address;
                }
            });
        }
        
        modal.querySelector('#create-payment-form').addEventListener('submit', async (e) => {
            e.preventDefault();
            
            const amount = parseFloat(amountInput.value);
            // Auto-generate Order ID if not provided
            let orderId = modal.querySelector('#payment-order-id').value.trim();
            if (!orderId) {
                orderId = `ORDER-${Date.now()}-${Math.random().toString(36).substr(2, 9).toUpperCase()}`;
            }
            
            // Get merchant address from input (user may have pasted/edited it)
            const merchantAddress = modal.querySelector('#payment-address')?.value.trim();
            if (merchantAddress && oracle) {
                oracle.merchantAddress = merchantAddress;
                // Also save to localStorage
                localStorage.setItem('sol_merchant_address', merchantAddress);
            }
            
            const token = modal.querySelector('#payment-token')?.value || 'SOL';
            const allowPartial = modal.querySelector('#allow-partial')?.checked || false;
            
            try {
                const payment = await oracle.createPaymentRequest(amount, 'USD', orderId, {
                    token: token,
                    allowPartial: allowPartial
                });
                
                // Generate payment link and QR code
                if (window.solanaPay) {
                    const paymentLink = await window.solanaPay.createPaymentLink(payment);
                    const invoice = window.solanaPay.generateInvoice(payment);
                    
                    modal.remove();
                    showPaymentDetails(payment, paymentLink, invoice);
                } else {
                    modal.remove();
                    alert(`Payment request created!\nPayment ID: ${payment.id}\n${token} Amount: ${payment.solAmount.toFixed(8)} ${token}`);
                }
                loadOracleData();
            } catch (error) {
                alert('Failed to create payment: ' + error.message);
            }
        });
    }
    
    function showPaymentDetails(payment, paymentLink, invoice) {
        // Remove any existing modals first
        document.querySelectorAll('.checkout-modal').forEach(m => m.remove());
        
        const modal = document.createElement('div');
        modal.className = 'checkout-modal';
        modal.setAttribute('data-modal-id', 'payment-details');
        modal.innerHTML = `
            <div class="cryptocommerce-modal-overlay"></div>
            <div class="checkout-content" style="max-width: 700px;">
                <button class="cryptocommerce-modal-close">&times;</button>
                <h2>Payment Created</h2>
                <div style="margin-bottom: 1.5rem;">
                    <div style="background: var(--bg-secondary); border: 1px solid var(--border-color); border-radius: 8px; padding: 1.5rem; margin-bottom: 1rem;">
                        <div style="display: flex; justify-content: space-between; margin-bottom: 0.5rem;">
                            <span style="color: var(--text-secondary);">Payment ID:</span>
                            <span style="font-family: var(--font-mono);">${payment.id}</span>
                        </div>
                        <div style="display: flex; justify-content: space-between; margin-bottom: 0.5rem;">
                            <span style="color: var(--text-secondary);">Amount:</span>
                            <span style="font-weight: 600;">$${payment.amount.toFixed(2)}</span>
                        </div>
                        <div style="display: flex; justify-content: space-between;">
                            <span style="color: var(--text-secondary);">Token Amount:</span>
                            <span style="font-weight: 600; color: var(--accent-primary);">${payment.solAmount.toFixed(8)} ${payment.token}</span>
                        </div>
                    </div>
                    <div style="background: var(--bg-secondary); border: 1px solid var(--border-color); border-radius: 8px; padding: 1.5rem; text-align: center;">
                        <h4 style="margin-bottom: 1rem;">QR Code</h4>
                        <div id="payment-qr-code" style="display: flex; justify-content: center; margin-bottom: 1rem;"></div>
                        <a href="${paymentLink.url}" target="_blank" class="btn-primary" style="display: inline-block; margin-top: 1rem;">Open Payment Link</a>
                    </div>
                </div>
                <div style="display: flex; gap: 1rem;">
                    <button class="btn-secondary" onclick="copyToClipboard('${payment.id}')">Copy Payment ID</button>
                    <button class="btn-secondary" onclick="copyToClipboard('${paymentLink.url}')">Copy Payment Link</button>
                    <button class="btn-primary" onclick="downloadInvoice(${JSON.stringify(invoice).replace(/"/g, '&quot;')})">Download Invoice</button>
                </div>
            </div>
        `;
        
        document.body.appendChild(modal);
        
        // Close button
        modal.querySelector('.cryptocommerce-modal-close').addEventListener('click', (e) => {
            e.stopPropagation();
            modal.remove();
        });
        
        // Overlay click - only close if clicking the overlay itself, not the content
        modal.querySelector('.cryptocommerce-modal-overlay').addEventListener('click', (e) => {
            if (e.target === e.currentTarget) {
                modal.remove();
            }
        });
        
        // Prevent clicks inside content from closing modal
        modal.querySelector('.checkout-content').addEventListener('click', (e) => {
            e.stopPropagation();
        });
        
        // Generate QR code
        if (window.QRCode && paymentLink.qrCode) {
            const qrContainer = modal.querySelector('#payment-qr-code');
            const qrText = paymentLink.qrCode.url || paymentLink.qrCode.data || paymentLink.url;
            if (qrText) {
                window.QRCode.toCanvas(qrContainer, qrText, {
                    width: 256,
                    margin: 2,
                    color: {
                        dark: '#000000',
                        light: '#ffffff'
                    }
                }, function (error) {
                    if (error) {
                        console.error('QR code generation error:', error);
                        // Fallback: create img element
                        qrContainer.innerHTML = `<img src="https://api.qrserver.com/v1/create-qr-code/?size=256x256&data=${encodeURIComponent(qrText)}" alt="QR Code">`;
                    }
                });
            }
        } else if (paymentLink.qrCode) {
            // Fallback: use external QR code service
            const qrContainer = modal.querySelector('#payment-qr-code');
            const qrText = paymentLink.qrCode.url || paymentLink.qrCode.data || paymentLink.url;
            qrContainer.innerHTML = `<img src="https://api.qrserver.com/v1/create-qr-code/?size=256x256&data=${encodeURIComponent(qrText)}" alt="QR Code" style="max-width: 100%; height: auto;">`;
        }
    }
    
    window.copyToClipboard = function(text) {
        navigator.clipboard.writeText(text).then(() => {
            alert('Copied to clipboard!');
        });
    };
    
    window.downloadInvoice = function(invoice) {
        const invoiceHTML = `
            <!DOCTYPE html>
            <html>
            <head>
                <title>Invoice ${invoice.id}</title>
                <style>
                    body { font-family: Arial, sans-serif; padding: 2rem; }
                    .invoice-header { border-bottom: 2px solid #000; padding-bottom: 1rem; margin-bottom: 2rem; }
                    .invoice-details { display: grid; grid-template-columns: 1fr 1fr; gap: 2rem; margin-bottom: 2rem; }
                    .invoice-items { margin-bottom: 2rem; }
                    table { width: 100%; border-collapse: collapse; }
                    th, td { padding: 0.75rem; text-align: left; border-bottom: 1px solid #ddd; }
                    .total { font-weight: bold; font-size: 1.2rem; }
                </style>
            </head>
            <body>
                <div class="invoice-header">
                    <h1>Invoice ${invoice.id}</h1>
                    <p>Date: ${new Date(invoice.createdAt).toLocaleDateString()}</p>
                </div>
                <div class="invoice-details">
                    <div>
                        <h3>Merchant</h3>
                        <p>${invoice.merchant.name}</p>
                        <p>${invoice.merchant.address}</p>
                    </div>
                    <div>
                        <h3>Payment Details</h3>
                        <p>Order ID: ${invoice.orderId || 'N/A'}</p>
                        <p>Status: ${invoice.status}</p>
                    </div>
                </div>
                <div class="invoice-items">
                    <table>
                        <tr>
                            <th>Description</th>
                            <th>Amount</th>
                        </tr>
                        <tr>
                            <td>Payment</td>
                            <td>$${invoice.total.toFixed(2)}</td>
                        </tr>
                    </table>
                </div>
                <div class="total">
                    <p>Total: ${invoice.tokenAmount.toFixed(8)} ${invoice.token}</p>
                    <p>Total (USD): $${invoice.total.toFixed(2)}</p>
                </div>
            </body>
            </html>
        `;
        
        const blob = new Blob([invoiceHTML], { type: 'text/html' });
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = `invoice-${invoice.id}.html`;
        a.click();
        URL.revokeObjectURL(url);
    };
    
    window.showCreatePaymentModal = showCreatePaymentModal;
    
    // Load saved address when settings tab is opened
    function loadSavedAddress() {
        const savedAddress = localStorage.getItem('sol_merchant_address');
        const addressInput = document.getElementById('sol-address');
        if (addressInput && savedAddress) {
            addressInput.value = savedAddress;
        }
        
        const savedThreshold = localStorage.getItem('sol_confirmation_threshold');
        const thresholdInput = document.getElementById('confirmation-threshold');
        if (thresholdInput && savedThreshold) {
            thresholdInput.value = savedThreshold;
        }
        
        const savedToken = localStorage.getItem('sol_default_token');
        const tokenSelect = document.getElementById('default-token');
        if (tokenSelect && savedToken) {
            tokenSelect.value = savedToken;
        }
    }
    
    // Paste address from clipboard (for settings)
    window.pasteAddress = async function() {
        try {
            const text = await navigator.clipboard.readText();
            const addressInput = document.getElementById('sol-address');
            if (addressInput) {
                addressInput.value = text.trim();
                addressInput.focus();
                // Validate Solana address format (basic check)
                if (text.length >= 32 && text.length <= 44) {
                    addressInput.style.borderColor = 'var(--accent-success)';
                    setTimeout(() => {
                        addressInput.style.borderColor = '';
                    }, 2000);
                }
            }
        } catch (error) {
            console.error('Failed to paste:', error);
            alert('Failed to paste from clipboard. Please paste manually (Ctrl+V or Cmd+V).');
        }
    };
    
    // Paste merchant address from clipboard (for payment modal)
    window.pasteMerchantAddress = async function() {
        try {
            const text = await navigator.clipboard.readText();
            const addressInput = document.getElementById('payment-address');
            if (addressInput) {
                addressInput.value = text.trim();
                addressInput.focus();
                // Update oracle merchant address
                if (oracle) {
                    oracle.merchantAddress = text.trim();
                }
                // Validate Solana address format (basic check)
                if (text.length >= 32 && text.length <= 44) {
                    addressInput.style.borderColor = 'var(--accent-success)';
                    setTimeout(() => {
                        addressInput.style.borderColor = '';
                    }, 2000);
                }
            }
        } catch (error) {
            console.error('Failed to paste:', error);
            alert('Failed to paste from clipboard. Please paste manually (Ctrl+V or Cmd+V).');
        }
    };
    
    window.saveOracleSettings = async function() {
        const address = document.getElementById('sol-address')?.value.trim();
        const threshold = parseInt(document.getElementById('confirmation-threshold')?.value);
        const defaultToken = document.getElementById('default-token')?.value || 'SOL';
        
        // Validate Solana address format (basic check)
        if (address && (address.length < 32 || address.length > 44)) {
            alert('Invalid Solana address format. Solana addresses are typically 32-44 characters long.');
            return;
        }
        
        if (address) {
            localStorage.setItem('sol_merchant_address', address);
            if (oracle) {
                oracle.merchantAddress = address;
            }
        }
        
        if (threshold) {
            localStorage.setItem('sol_confirmation_threshold', threshold.toString());
            if (oracle) {
                oracle.confirmationThreshold = threshold;
            }
        }
        
        if (defaultToken) {
            localStorage.setItem('sol_default_token', defaultToken);
        }
        
        alert('Settings saved!');
    };
    
    // Load saved settings when settings tab is clicked
    document.addEventListener('click', (e) => {
        if (e.target.getAttribute('data-tab') === 'settings' || 
            e.target.closest('[data-tab="settings"]')) {
            setTimeout(loadSavedAddress, 100);
        }
    });
    
    // Initialize
    if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', initOracle);
    } else {
        initOracle();
    }
    
    setTimeout(initOracle, 1000);
    
    // Payment link creation
    const createPaymentLinkBtn = document.getElementById('create-payment-link-btn');
    if (createPaymentLinkBtn) {
        createPaymentLinkBtn.addEventListener('click', async () => {
            const amount = parseFloat(prompt('Enter payment amount (USD):'));
            if (!amount || amount <= 0) return;
            
            const token = prompt('Enter token (SOL/USDC/USDT/EURC):', 'SOL') || 'SOL';
            
            try {
                const payment = await oracle.createPaymentRequest(amount, 'USD', null, { token });
                if (window.solanaPay) {
                    const paymentLink = await window.solanaPay.createPaymentLink(payment, {
                        expiresIn: 3600 * 24 // 24 hours
                    });
                    
                    alert(`Payment link created!\n\nLink: ${paymentLink.url}\n\nShare this link with your customer.`);
                }
            } catch (error) {
                alert('Failed to create payment link: ' + error.message);
            }
        });
    }
    
    // Webhook management
    const viewWebhooksBtn = document.getElementById('view-webhooks-btn');
    if (viewWebhooksBtn) {
        viewWebhooksBtn.addEventListener('click', () => {
            document.querySelector('[data-tab="webhooks"]').click();
        });
    }
    
    const addWebhookBtn = document.getElementById('add-webhook-btn');
    if (addWebhookBtn) {
        addWebhookBtn.addEventListener('click', () => {
            showAddWebhookModal();
        });
    }
    
    function showAddWebhookModal() {
        const modal = document.createElement('div');
        modal.className = 'checkout-modal';
        modal.innerHTML = `
            <div class="cryptocommerce-modal-overlay"></div>
            <div class="checkout-content">
                <button class="cryptocommerce-modal-close">&times;</button>
                <h2>Add Webhook</h2>
                <form id="add-webhook-form">
                    <div class="checkout-form-group">
                        <label>Webhook URL *</label>
                        <input type="url" id="webhook-url-input" placeholder="https://your-site.com/webhook" required>
                    </div>
                    <div class="checkout-form-group">
                        <label>Events to Subscribe</label>
                        <div style="display: flex; flex-direction: column; gap: 0.5rem; margin-top: 0.5rem;">
                            <label><input type="checkbox" value="payment.created" checked> Payment Created</label>
                            <label><input type="checkbox" value="payment.verified" checked> Payment Verified</label>
                            <label><input type="checkbox" value="payment.failed"> Payment Failed</label>
                            <label><input type="checkbox" value="payment.refunded"> Payment Refunded</label>
                        </div>
                    </div>
                    <div class="checkout-form-group">
                        <label>Secret Key (Optional)</label>
                        <input type="text" id="webhook-secret" placeholder="For signing webhook payloads">
                        <small style="color: var(--text-secondary);">Used to verify webhook authenticity</small>
                    </div>
                    <button type="submit" class="btn-primary" style="width: 100%; margin-top: 1rem;">Add Webhook</button>
                </form>
            </div>
        `;
        
        document.body.appendChild(modal);
        
        // Close button
        modal.querySelector('.cryptocommerce-modal-close').addEventListener('click', (e) => {
            e.stopPropagation();
            modal.remove();
        });
        
        // Overlay click - only close if clicking the overlay itself, not the content
        modal.querySelector('.cryptocommerce-modal-overlay').addEventListener('click', (e) => {
            if (e.target === e.currentTarget) {
                modal.remove();
            }
        });
        
        // Prevent clicks inside content from closing modal
        modal.querySelector('.checkout-content').addEventListener('click', (e) => {
            e.stopPropagation();
        });
        
        modal.querySelector('#add-webhook-form').addEventListener('submit', async (e) => {
            e.preventDefault();
            
            const url = modal.querySelector('#webhook-url-input').value;
            const secret = modal.querySelector('#webhook-secret').value;
            const events = Array.from(modal.querySelectorAll('input[type="checkbox"]:checked'))
                .map(cb => cb.value);
            
            try {
                const webhook = await window.webhookSystem.registerWebhook({
                    url: url,
                    events: events,
                    secret: secret || null
                });
                
                modal.remove();
                alert('Webhook added successfully!');
                if (window.loadWebhooks) {
                    window.loadWebhooks();
                }
            } catch (error) {
                alert('Failed to add webhook: ' + error.message);
            }
        });
    }
    
    window.loadWebhooks = async function() {
        const container = document.getElementById('webhooks-list');
        if (!container || !window.webhookSystem) return;
        
        const webhooks = window.webhookSystem.listWebhooks();
        
        if (webhooks.length === 0) {
            container.innerHTML = '<div style="text-align: center; padding: 2rem; color: var(--text-secondary);">No webhooks configured</div>';
            return;
        }
        
        container.innerHTML = webhooks.map(wh => `
            <div class="order-card">
                <div style="display: flex; justify-content: space-between; align-items: start; margin-bottom: 1rem;">
                    <div>
                        <div style="font-weight: 600;">${wh.url}</div>
                        <div style="font-size: 0.85rem; color: var(--text-secondary); margin-top: 0.25rem;">
                            Created: ${new Date(wh.createdAt).toLocaleString()}
                        </div>
                    </div>
                    <span class="status-badge status-${wh.active ? 'confirmed' : 'expired'}">
                        ${wh.active ? 'Active' : 'Inactive'}
                    </span>
                </div>
                <div style="margin-bottom: 1rem;">
                    <div style="font-size: 0.9rem; color: var(--text-secondary); margin-bottom: 0.5rem;">Events:</div>
                    <div style="display: flex; flex-wrap: wrap; gap: 0.5rem;">
                        ${wh.events.map(e => `<span style="background: var(--bg-tertiary); padding: 0.25rem 0.5rem; border-radius: 4px; font-size: 0.85rem;">${e}</span>`).join('')}
                    </div>
                </div>
                <div style="display: flex; justify-content: space-between; align-items: center;">
                    <div style="font-size: 0.85rem; color: var(--text-secondary);">
                        Success: ${wh.successCount} | Failed: ${wh.failureCount}
                    </div>
                    <button class="btn-secondary" onclick="deleteWebhook('${wh.id}')">Delete</button>
                </div>
            </div>
        `).join('');
    };
    
    window.deleteWebhook = async function(webhookId) {
        if (!confirm('Delete this webhook?')) return;
        
        await window.webhookSystem.deleteWebhook(webhookId);
        if (window.loadWebhooks) {
            window.loadWebhooks();
        }
    };
    
    // Load webhooks when tab is clicked
    document.addEventListener('click', (e) => {
        if (e.target.getAttribute('data-tab') === 'webhooks') {
            setTimeout(() => {
                if (window.loadWebhooks) {
                    window.loadWebhooks();
                }
            }, 100);
        }
    });
})();

