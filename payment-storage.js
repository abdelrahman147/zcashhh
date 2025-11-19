/**
 * Google Sheets Payment Storage Service
 * Stores verified payments and manages pending payment expiration
 */
class PaymentStorage {
    constructor() {
        let origin = window.location.origin;
        if (origin === 'null' || origin.startsWith('file://')) {
            origin = 'https://zecit.online';
        }
        this.apiBase = origin + '/api/sheets';
        // Use default sheet ID (same as leaderboard) - payments are in separate tab
        // This ensures all browsers use the same sheet
        const defaultSheetId = '1apjUM4vb-6TUx4cweIThML5TIKBg8E7HjLlaZyiw1e8';
        // Load payment sheet ID from localStorage, or use default
        // Payments should be in a SEPARATE sheet from leaderboard
        this.sheetId = localStorage.getItem('payment_sheet_id') || defaultSheetId;
        this.paymentSheetName = 'payment'; // Sheet name for payments (must match tab name)
        
        console.log('[OK] Payment Storage initialized');
        console.log(`   API Base: ${this.apiBase}`);
        if (this.sheetId) {
            console.log(`   Sheet ID: ${this.sheetId}`);
        } else {
            console.log(`   Sheet ID: Will be created automatically on first payment save`);
        }
        console.log(`   Payments are stored in a SEPARATE sheet from leaderboard`);
        console.log(`   Run getPaymentSheetLink() in console to get the Google Sheet link`);
    }

    /**
     * Save verified payment to Google Sheets
     */
    async savePayment(payment) {
        // Save all payments (pending and verified) for persistence
        // Verified payments will be marked as verified in the sheet
        // This ensures payments don't disappear on refresh

        try {
            const response = await fetch(`${this.apiBase}/payment`, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json'
                },
                body: JSON.stringify({
                    payment: payment,
                    sheetId: this.sheetId,
                    sheetName: this.paymentSheetName
                })
            });

            if (!response.ok) {
                const errorData = await response.json().catch(() => ({}));
                throw new Error(errorData.error || `HTTP ${response.status}`);
            }

            const result = await response.json();
            console.log(`[OK] Payment ${payment.id} saved to Google Sheets`);
            
            // Update sheet ID if a new one was created
            if (result.sheetId) {
                this.sheetId = result.sheetId;
                localStorage.setItem('payment_sheet_id', result.sheetId);
                const sheetUrl = result.sheetUrl || `https://docs.google.com/spreadsheets/d/${result.sheetId}/edit`;
                console.log(`\n[INFO] ========== PAYMENT SHEET CREATED ==========`);
                console.log(`[LINK] ${sheetUrl}`);
                console.log(`[ID] Sheet ID: ${result.sheetId}`);
                console.log(`==========================================\n`);
            }
            
            return { success: true, result };
        } catch (error) {
            console.error(`[ERR] Failed to save payment ${payment.id}:`, error);
            return { success: false, error: error.message };
        }
    }

    /**
     * Load all verified payments from Google Sheets
     */
    async loadPayments() {
        try {
            // If no sheet ID, return empty (no payments yet)
            if (!this.sheetId) {
                return [];
            }
            const response = await fetch(`${this.apiBase}/payments?sheetId=${this.sheetId}&sheetName=${this.paymentSheetName}`);
            
            if (!response.ok) {
                if (response.status === 404) {
                    // Sheet doesn't exist yet, return empty array
                    return [];
                }
                throw new Error(`HTTP ${response.status}`);
            }

            const data = await response.json();
            const payments = data.payments || [];
            console.log(`[LOAD] Loaded ${payments.length} verified payments from Google Sheets`);
            return payments;
        } catch (error) {
            console.error('[ERR] Failed to load payments:', error);
            return [];
        }
    }

    /**
     * Get the Google Sheet link
     */
    getSheetLink() {
        if (!this.sheetId) {
            return null;
        }
        return `https://docs.google.com/spreadsheets/d/${this.sheetId}/edit`;
    }
    
    /**
     * Get sheet ID
     */
    getSheetId() {
        return this.sheetId;
    }
    
    /**
     * Delete expired pending payment
     */
    async deleteExpiredPayment(paymentId) {
        try {
            const response = await fetch(`${this.apiBase}/payment/${paymentId}`, {
                method: 'DELETE',
                headers: {
                    'Content-Type': 'application/json'
                },
                body: JSON.stringify({
                    sheetId: this.sheetId,
                    sheetName: this.paymentSheetName
                })
            });

            if (!response.ok) {
                throw new Error(`HTTP ${response.status}`);
            }

            const result = await response.json();
            const deletedCount = result.deletedCount || 0;
            
            if (deletedCount > 0) {
                console.log(`🗑️ Deleted ${deletedCount} instance(s) of payment ${paymentId}`);
            } else {
                console.log(`[INFO] Payment ${paymentId} not found in sheet (may have been deleted already)`);
            }
            
            return { success: true, deletedCount: deletedCount };
        } catch (error) {
            console.error(`[ERR] Failed to delete payment ${paymentId}:`, error);
            return { success: false, error: error.message };
        }
    }
    
    /**
     * Delete payment by ID (can be called multiple times to remove duplicates)
     */
    async deletePayment(paymentId) {
        return await this.deleteExpiredPayment(paymentId);
    }
}

// Global helper function to manually clean up all expired payments
if (typeof window !== 'undefined') {
    window.cleanupAllExpiredPayments = async function() {
        if (window.oracle && window.oracle.cleanupAllExpiredPayments) {
            await window.oracle.cleanupAllExpiredPayments();
        } else {
                console.error('[ERR] Oracle not initialized. Make sure the page is fully loaded.');
        }
    };
}

// Global helper function to delete duplicate payments by Order ID
if (typeof window !== 'undefined') {
    window.deletePaymentsByOrderId = async function(orderId) {
        let paymentStorage = null;
        
        // Try multiple ways to get paymentStorage
        if (window.oracle && window.oracle.paymentStorage) {
            paymentStorage = window.oracle.paymentStorage;
        } else if (window.paymentStorage) {
            paymentStorage = window.paymentStorage;
        } else {
            if (window.PaymentStorage) {
                console.log('⚠️ Creating temporary PaymentStorage instance...');
                paymentStorage = new window.PaymentStorage();
            } else {
                console.error('[ERR] PaymentStorage not available.');
                return { deleted: 0, error: 'PaymentStorage not available' };
            }
        }
        
        console.log(`🗑️ Deleting all payments with Order ID: ${orderId}...`);
        
        try {
            const response = await fetch(`${paymentStorage.apiBase}/payment/by-order/${encodeURIComponent(orderId)}`, {
                method: 'DELETE',
                headers: {
                    'Content-Type': 'application/json'
                },
                body: JSON.stringify({
                    sheetId: paymentStorage.sheetId,
                    sheetName: paymentStorage.paymentSheetName
                })
            });

            if (!response.ok) {
                throw new Error(`HTTP ${response.status}`);
            }

            const result = await response.json();
            const deletedCount = result.deletedCount || 0;
            
            if (deletedCount > 0) {
                console.log(`[OK] Deleted ${deletedCount} payment(s) with Order ID ${orderId}`);
            } else {
                console.log(`[INFO] No payments found with Order ID ${orderId}`);
            }
            
            return { deleted: deletedCount, success: true };
        } catch (error) {
            console.error(`[ERR] Failed to delete payments by Order ID:`, error);
            return { deleted: 0, success: false, error: error.message };
        }
    };
    
    window.deleteDuplicatePayments = async function(paymentId) {
        let paymentStorage = null;
        
        // Try multiple ways to get paymentStorage
        if (window.oracle && window.oracle.paymentStorage) {
            paymentStorage = window.oracle.paymentStorage;
        } else if (window.paymentStorage) {
            paymentStorage = window.paymentStorage;
        } else {
            // Try to create a new PaymentStorage instance as fallback
            if (window.PaymentStorage) {
                console.log('⚠️ Creating temporary PaymentStorage instance...');
                paymentStorage = new window.PaymentStorage();
            } else {
                console.error('❌ PaymentStorage not available. Make sure the page is fully loaded.');
                console.error('   Available objects:', {
                    hasOracle: !!window.oracle,
                    hasPaymentStorage: !!window.paymentStorage,
                    hasPaymentStorageClass: !!window.PaymentStorage
                });
                return { deleted: 0, attempts: 0, error: 'PaymentStorage not available' };
            }
        }
        
        console.log(`🗑️ Deleting all instances of payment ${paymentId}...`);
        
        // The delete function now finds and deletes ALL instances at once
        const result = await paymentStorage.deletePayment(paymentId);
        
        if (result.success) {
            const deletedCount = result.deletedCount || 1;
            console.log(`[OK] Deleted ${deletedCount} instance(s) of payment ${paymentId} in one operation`);
            return { deleted: deletedCount, attempts: 1 };
        } else {
            console.log(`[INFO] No instances found or deletion failed: ${result.error || 'Unknown error'}`);
            return { deleted: 0, attempts: 1, error: result.error };
        }
    };
}

// Export
if (typeof window !== 'undefined') {
    window.PaymentStorage = PaymentStorage;
    
    // Global function to get payment sheet link (for owner)
    window.getPaymentSheetLink = function() {
        if (window.oracle && window.oracle.paymentStorage) {
            const link = window.oracle.paymentStorage.getSheetLink();
            const sheetId = window.oracle.paymentStorage.getSheetId();
            if (link) {
                console.log(`\n[INFO] ========== PAYMENT DATABASE LINK ==========`);
                console.log(`[LINK] ${link}`);
                console.log(`[ID] Sheet ID: ${sheetId}`);
                console.log(`==========================================\n`);
                return link;
            } else {
                console.log('[ERR] Payment sheet not initialized yet');
                return null;
            }
        } else {
            console.log('[ERR] Payment storage not available. Make sure you have created at least one payment.');
            return null;
        }
    };
}

if (typeof module !== 'undefined' && module.exports) {
    module.exports = PaymentStorage;
}

