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
        // Load payment sheet ID from localStorage, or null to create new one
        // Payments should be in a SEPARATE sheet from leaderboard
        this.sheetId = localStorage.getItem('payment_sheet_id') || null;
        this.paymentSheetName = 'payment'; // Sheet name for payments (must match tab name)
        
        console.log('✅ Payment Storage initialized');
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
            console.log(`✅ Payment ${payment.id} saved to Google Sheets`);
            
            // Update sheet ID if a new one was created
            if (result.sheetId) {
                this.sheetId = result.sheetId;
                localStorage.setItem('payment_sheet_id', result.sheetId);
                const sheetUrl = result.sheetUrl || `https://docs.google.com/spreadsheets/d/${result.sheetId}/edit`;
                console.log(`\n📊 ========== PAYMENT SHEET CREATED ==========`);
                console.log(`🔗 ${sheetUrl}`);
                console.log(`📋 Sheet ID: ${result.sheetId}`);
                console.log(`==========================================\n`);
            }
            
            return { success: true, result };
        } catch (error) {
            console.error(`❌ Failed to save payment ${payment.id}:`, error);
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
            console.log(`📥 Loaded ${payments.length} verified payments from Google Sheets`);
            return payments;
        } catch (error) {
            console.error('❌ Failed to load payments:', error);
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

            console.log(`🗑️ Deleted expired payment ${paymentId}`);
            return { success: true };
        } catch (error) {
            console.error(`❌ Failed to delete payment ${paymentId}:`, error);
            return { success: false, error: error.message };
        }
    }
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
                console.log(`\n📊 ========== PAYMENT DATABASE LINK ==========`);
                console.log(`🔗 ${link}`);
                console.log(`📋 Sheet ID: ${sheetId}`);
                console.log(`==========================================\n`);
                return link;
            } else {
                console.log('❌ Payment sheet not initialized yet');
                return null;
            }
        } else {
            console.log('❌ Payment storage not available. Make sure you have created at least one payment.');
            return null;
        }
    };
}

if (typeof module !== 'undefined' && module.exports) {
    module.exports = PaymentStorage;
}

