const fetch = require('node-fetch');

// In-memory storage (in production, use a database)
const payments = new Map();

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
            } else {
                // Get all payments
                const allPayments = Array.from(payments.values());
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
            
            // Update payment with transaction signature
            payment.transactionSignature = signature;
            payment.status = 'verified';
            payment.confirmedAt = Date.now();
            payments.set(paymentId, payment);
            
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

