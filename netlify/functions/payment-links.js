const fetch = require('node-fetch');

// In-memory storage (in production, use a database)
const paymentLinks = new Map();

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
            // Create payment link
            const link = JSON.parse(event.body);
            paymentLinks.set(link.id, link);
            return {
                statusCode: 200,
                headers: {
                    'Access-Control-Allow-Origin': '*',
                    'Content-Type': 'application/json'
                },
                body: JSON.stringify({ success: true, link })
            };
        } else if (event.httpMethod === 'GET') {
            // Get payment link
            // Extract linkId from path
            const pathParts = event.path.split('/');
            const linkId = pathParts[pathParts.length - 1];
            
            if (!linkId || linkId === 'payment-links') {
                return {
                    statusCode: 400,
                    headers: {
                        'Access-Control-Allow-Origin': '*',
                        'Content-Type': 'application/json'
                    },
                    body: JSON.stringify({ error: 'Link ID required' })
                };
            }
            
            let link = paymentLinks.get(linkId);
            
            // If not found in memory, try to reconstruct from payment
            if (!link) {
                console.log(`Payment link ${linkId} not found in memory, attempting to load from payment...`);
                
                // Try to extract payment ID from linkId
                let paymentId = null;
                if (linkId.startsWith('pay_')) {
                    paymentId = linkId;
                } else if (linkId.startsWith('link_')) {
                    // Extract timestamp from linkId: link_<timestamp>_<random>
                    const linkParts = linkId.split('_');
                    if (linkParts.length >= 2) {
                        const timestamp = linkParts[1];
                        // Try to find payment by loading from Google Sheets
                        try {
                            const baseUrl = process.env.URL || 'https://zk-paylink.xyz';
                            const sheetsUrl = `${baseUrl}/api/sheets/payments?sheetId=${process.env.GOOGLE_SHEET_ID || '1apjUM4vb-6TUx4cweIThML5TIKBg8E7HjLlaZyiw1e8'}&sheetName=payment`;
                            const sheetsResponse = await fetch(sheetsUrl);
                            
                            if (sheetsResponse.ok) {
                                const sheetsData = await sheetsResponse.json();
                                const allPayments = sheetsData.payments || [];
                                
                                // Find payment with matching timestamp
                                const matchingPayment = allPayments.find(p => {
                                    if (p.id && p.id.startsWith('pay_')) {
                                        const paymentParts = p.id.split('_');
                                        return paymentParts.length >= 2 && paymentParts[1] === timestamp;
                                    }
                                    return false;
                                });
                                
                                if (matchingPayment) {
                                    paymentId = matchingPayment.id;
                                    console.log(`Found payment by timestamp: ${paymentId}`);
                                }
                            }
                        } catch (e) {
                            console.warn('Could not load payments from sheets:', e);
                        }
                        
                        // Fallback: try direct conversion
                        if (!paymentId) {
                            paymentId = linkId.replace('link_', 'pay_');
                        }
                    }
                }
                
                // If we found a payment ID, reconstruct the link
                if (paymentId) {
                    try {
                        const baseUrl = process.env.URL || 'https://zk-paylink.xyz';
                        const paymentResponse = await fetch(`${baseUrl}/api/oracle/payments/${paymentId}`);
                        if (paymentResponse.ok) {
                            const paymentData = await paymentResponse.json();
                            const payment = paymentData.payment;
                            
                            if (payment) {
                                // Reconstruct link from payment
                                link = {
                                    id: linkId,
                                    paymentId: payment.id,
                                    amount: payment.amount,
                                    currency: payment.currency,
                                    token: payment.token,
                                    solAmount: payment.solAmount,
                                    orderId: payment.orderId,
                                    merchantAddress: payment.merchantAddress,
                                    status: payment.status,
                                    createdAt: payment.createdAt,
                                    url: `${baseUrl}/pay/${linkId}`
                                };
                                console.log(`Reconstructed payment link from payment ${paymentId}`);
                            }
                        }
                    } catch (e) {
                        console.warn('Could not reconstruct link from payment:', e);
                    }
                }
            }
            
            if (!link) {
                return {
                    statusCode: 404,
                    headers: {
                        'Access-Control-Allow-Origin': '*',
                        'Content-Type': 'application/json'
                    },
                    body: JSON.stringify({ error: 'Payment link not found' })
                };
            }
            
            return {
                statusCode: 200,
                headers: {
                    'Access-Control-Allow-Origin': '*',
                    'Content-Type': 'application/json'
                },
                body: JSON.stringify({ success: true, link })
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
        console.error('Payment links error:', error);
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

