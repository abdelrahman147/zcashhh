const fetch = require('node-fetch');

// In-memory storage (in production, use a database)
const payments = new Map();

// Load payment from Google Sheets if not found in memory
async function loadPaymentFromSheets(paymentId) {
    try {
        // Default sheet ID (can be overridden with query param)
        const sheetId = '1apjUM4vb-6TUx4cweIThML5TIKBg8E7HjLlaZyiw1e8';
        const sheetName = 'payment';
        
        // Call sheets-proxy to load payments
        const sheetsUrl = `https://zecit.online/api/sheets/payments?sheetId=${sheetId}&sheetName=${sheetName}`;
        const response = await fetch(sheetsUrl);
        
        if (!response.ok) {
            return null;
        }
        
        const data = await response.json();
        const allPayments = data.payments || [];
        
        // Find the payment by ID
        const payment = allPayments.find(p => p.id === paymentId);
        
        if (payment) {
            // Store in memory for future requests
            payments.set(paymentId, payment);
            return payment;
        }
        
        return null;
    } catch (error) {
        console.error('Failed to load payment from Google Sheets:', error);
        return null;
    }
}

exports.handler = async (event, context) => {
    // Handle OPTIONS preflight
    if (event.httpMethod === 'OPTIONS') {
        return {
            statusCode: 200,
            headers: {
                'Access-Control-Allow-Origin': '*',
                'Access-Control-Allow-Headers': 'Content-Type',
                'Access-Control-Allow-Methods': 'GET, POST, OPTIONS'
            },
            body: ''
        };
    }
    
    try {
        if (event.httpMethod === 'POST') {
            // Create payment
            const payment = JSON.parse(event.body);
            payments.set(payment.id, payment);
            return {
                statusCode: 200,
                headers: {
                    'Access-Control-Allow-Origin': '*',
                    'Content-Type': 'application/json'
                },
                body: JSON.stringify({ success: true, payment })
            };
        } else if (event.httpMethod === 'GET') {
            // Check if this is a verify endpoint
            const pathParts = event.path.split('/');
            const lastPart = pathParts[pathParts.length - 1];
            const secondLastPart = pathParts[pathParts.length - 2];
            
            // Handle /payments/:id/verify
            if (lastPart === 'verify' && secondLastPart) {
                const paymentId = secondLastPart;
                const payment = payments.get(paymentId);
                if (!payment) {
                    return {
                        statusCode: 404,
                        headers: {
                            'Access-Control-Allow-Origin': '*',
                            'Content-Type': 'application/json'
                        },
                        body: JSON.stringify({ error: 'Payment not found' })
                    };
                }
                return {
                    statusCode: 200,
                    headers: {
                        'Access-Control-Allow-Origin': '*',
                        'Content-Type': 'application/json'
                    },
                    body: JSON.stringify({ success: true, payment })
                };
            }
            
            // Get payment(s)
            // Extract paymentId from path
            const paymentId = lastPart;
            
            if (paymentId && paymentId !== 'payments' && paymentId !== 'oracle') {
                // Get single payment
                let payment = payments.get(paymentId);
                
                // If not found in memory, try loading from Google Sheets
                if (!payment) {
                    payment = await loadPaymentFromSheets(paymentId);
                }
                
                if (!payment) {
                    return {
                        statusCode: 404,
                        headers: {
                            'Access-Control-Allow-Origin': '*',
                            'Content-Type': 'application/json'
                        },
                        body: JSON.stringify({ error: 'Payment not found' })
                    };
                }
                return {
                    statusCode: 200,
                    headers: {
                        'Access-Control-Allow-Origin': '*',
                        'Content-Type': 'application/json'
                    },
                    body: JSON.stringify({ success: true, payment })
                };
            } else {
                // Get all payments
                // Try to load from Google Sheets if memory is empty
                let allPayments = Array.from(payments.values());
                
                if (allPayments.length === 0) {
                    // Try loading from Google Sheets
                    try {
                        const sheetId = '1apjUM4vb-6TUx4cweIThML5TIKBg8E7HjLlaZyiw1e8';
                        const sheetName = 'payment';
                        const sheetsUrl = `https://zecit.online/api/sheets/payments?sheetId=${sheetId}&sheetName=${sheetName}`;
                        const sheetsResponse = await fetch(sheetsUrl);
                        
                        if (sheetsResponse.ok) {
                            const sheetsData = await sheetsResponse.json();
                            allPayments = sheetsData.payments || [];
                            
                            // Cache in memory
                            allPayments.forEach(payment => {
                                payments.set(payment.id, payment);
                            });
                        }
                    } catch (error) {
                        console.error('Failed to load payments from Google Sheets:', error);
                    }
                }
                
                return {
                    statusCode: 200,
                    headers: {
                        'Access-Control-Allow-Origin': '*',
                        'Content-Type': 'application/json'
                    },
                    body: JSON.stringify({ success: true, payments: allPayments })
                };
            }
        } else if (event.httpMethod === 'POST' && event.path.includes('/verify')) {
            // Handle payment verification
            const pathParts = event.path.split('/');
            const paymentId = pathParts[pathParts.length - 2]; // Payment ID before /verify
            
            const body = JSON.parse(event.body || '{}');
            const { signature } = body;
            
            let payment = payments.get(paymentId);
            if (!payment) {
                // Try loading from Google Sheets as fallback
                try {
                    const baseUrl = process.env.URL || 'https://zecit.online';
                    const sheetsProxyUrl = `${baseUrl}/api/sheets/payments`;
                    const sheetId = process.env.GOOGLE_SHEET_ID || '1apjUM4vb-6TUx4cweIThML5TIKBg8E7HjLlaZyiw1e8';
                    
                    const loadResponse = await fetch(`${sheetsProxyUrl}?sheetId=${sheetId}&sheetName=payment`, {
                        method: 'GET',
                        headers: {
                            'Content-Type': 'application/json'
                        }
                    });
                    
                    if (loadResponse.ok) {
                        const loadData = await loadResponse.json();
                        if (loadData.payments && Array.isArray(loadData.payments)) {
                            const foundPayment = loadData.payments.find(p => p.id === paymentId);
                            if (foundPayment) {
                                payments.set(paymentId, foundPayment);
                                payment = foundPayment;
                                console.log(`✅ Loaded payment ${paymentId} from Google Sheets`);
                            }
                        }
                    } else {
                        console.warn(`⚠️ Failed to load payment from sheets: ${loadResponse.status}`);
                    }
                } catch (err) {
                    console.warn('Failed to load payment from sheets:', err);
                }
            }
            
            if (!payment) {
                return {
                    statusCode: 404,
                    headers: {
                        'Access-Control-Allow-Origin': '*',
                        'Content-Type': 'application/json'
                    },
                    body: JSON.stringify({ error: 'Payment not found' })
                };
            }
            
            // Update payment with transaction signature
            payment.transactionSignature = signature;
            payment.status = 'verified';
            payment.confirmedAt = Date.now();
            payments.set(paymentId, payment);
            
            // Also save to Google Sheets immediately
            try {
                // Construct the sheets-proxy URL correctly for Netlify
                const baseUrl = process.env.URL || 'https://zecit.online';
                const sheetsProxyUrl = `${baseUrl}/api/sheets/payment`;
                
                console.log(`💾 Saving verified payment ${paymentId} to Google Sheets via: ${sheetsProxyUrl}`);
                
                const saveResponse = await fetch(sheetsProxyUrl, {
                    method: 'POST',
                    headers: {
                        'Content-Type': 'application/json'
                    },
                    body: JSON.stringify({
                        payment: payment,
                        sheetId: process.env.GOOGLE_SHEET_ID || '1apjUM4vb-6TUx4cweIThML5TIKBg8E7HjLlaZyiw1e8',
                        sheetName: 'payment'
                    })
                });
                
                if (saveResponse.ok) {
                    const saveResult = await saveResponse.json();
                    console.log(`✅ Payment ${paymentId} verified and saved to Google Sheets`);
                    console.log(`   Sheet ID: ${saveResult.sheetId || 'N/A'}`);
                } else {
                    const errorText = await saveResponse.text();
                    console.error(`⚠️ Failed to save verified payment to sheets:`, errorText);
                    console.error(`   Status: ${saveResponse.status}`);
                }
            } catch (err) {
                console.error(`❌ Error saving verified payment to sheets:`, err);
                // Don't fail the verification if sheets save fails
            }
            
            return {
                statusCode: 200,
                headers: {
                    'Access-Control-Allow-Origin': '*',
                    'Content-Type': 'application/json'
                },
                body: JSON.stringify({ success: true, payment })
            };
        } else {
            return {
                statusCode: 405,
                headers: {
                    'Access-Control-Allow-Origin': '*',
                    'Content-Type': 'application/json'
                },
                body: JSON.stringify({ error: 'Method not allowed' })
            };
        }
    } catch (error) {
        console.error('Oracle payments error:', error);
        return {
            statusCode: 500,
            headers: {
                'Access-Control-Allow-Origin': '*',
                'Content-Type': 'application/json'
            },
            body: JSON.stringify({ error: error.message })
        };
    }
};

