const fetch = require('node-fetch');

// SIMPLIFIED: No in-memory cache - Google Sheets is single source of truth
// This eliminates sync issues and makes the system more reliable

// Load payment from Google Sheets (single source of truth)
async function loadPaymentFromSheets(paymentId, orderId = null) {
    try {
        // Default sheet ID (can be overridden with query param)
        const sheetId = '1apjUM4vb-6TUx4cweIThML5TIKBg8E7HjLlaZyiw1e8';
        const sheetName = 'payment';
        
        // Use the actual production URL
        const baseUrl = process.env.URL || 'https://zk-paylink.xyz';
        const sheetsUrl = `${baseUrl}/api/sheets/payments?sheetId=${sheetId}&sheetName=${sheetName}`;
        console.log('[Oracle Payments] Loading payments from:', sheetsUrl);
        const response = await fetch(sheetsUrl);
        
        if (!response.ok) {
            return null;
        }
        
        const data = await response.json();
        const allPayments = data.payments || [];
        
        // SIMPLIFIED: Find by Order ID first (most reliable), then Payment ID
        let payment = null;
        if (orderId) {
            payment = allPayments.find(p => p.orderId === orderId);
            if (payment) {
                console.log(`✅ Found payment by Order ID: ${orderId}`);
            }
        }
        if (!payment) {
            payment = allPayments.find(p => p.id === paymentId);
        }
        
        if (payment) {
            // If payment has transaction signature but status is pending, derive status from blockchain
            if (payment.transactionSignature && payment.status === 'pending') {
                // Check if transaction is verified on blockchain
                try {
                    const rpcUrl = 'https://solana-mainnet.g.alchemy.com/v2/xXPi6FAKVWJqv9Ie5TgvOHQgTlrlfbp5';
                    const verifyResponse = await fetch(rpcUrl, {
                        method: 'POST',
                        headers: { 'Content-Type': 'application/json' },
                        body: JSON.stringify({
                            jsonrpc: '2.0',
                            id: 1,
                            method: 'getTransaction',
                            params: [
                                payment.transactionSignature,
                                { encoding: 'jsonParsed', commitment: 'confirmed', maxSupportedTransactionVersion: 0 }
                            ]
                        })
                    });
                    
                    if (verifyResponse.ok) {
                        const verifyData = await verifyResponse.json();
                        if (verifyData.result && verifyData.result.meta && !verifyData.result.meta.err) {
                            // Transaction confirmed - update status
                            payment.status = 'verified';
                            payment.confirmedAt = verifyData.result.blockTime ? verifyData.result.blockTime * 1000 : Date.now();
                            console.log(`✅ Derived verified status for payment ${paymentId} from blockchain`);
                        }
                    }
                } catch (err) {
                    console.warn(`Could not verify transaction for payment ${paymentId}:`, err);
                }
            }
            
            // SIMPLIFIED: Don't cache in memory - always read from sheets (single source of truth)
            return payment;
        }
        
        return null;
    } catch (error) {
        console.error('Failed to load payment from Google Sheets:', error);
        return null;
    }
}

exports.loadPaymentFromSheets = loadPaymentFromSheets;

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
        if (event.httpMethod === 'POST' && !event.path.includes('/verify')) {
            // Create payment - SIMPLIFIED: Save directly to Google Sheets, no in-memory cache
            const payment = JSON.parse(event.body);
            
            // Save to Google Sheets immediately (single source of truth)
            const baseUrl = process.env.URL || 'https://zk-paylink.xyz';
            const sheetsProxyUrl = `${baseUrl}/api/sheets/payment`;
            try {
                const saveResponse = await fetch(sheetsProxyUrl, {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({
                        payment: payment,
                        sheetId: process.env.GOOGLE_SHEET_ID || '1apjUM4vb-6TUx4cweIThML5TIKBg8E7HjLlaZyiw1e8',
                        sheetName: 'payment'
                    })
                });
                
                if (!saveResponse.ok) {
                    console.error(`Failed to save payment to sheets: ${saveResponse.status}`);
                }
            } catch (err) {
                console.error('Error saving to sheets:', err);
            }
            
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
                // SIMPLIFIED: Always load from Google Sheets (single source of truth)
                const payment = await loadPaymentFromSheets(paymentId);
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
                // SIMPLIFIED: Always load from Google Sheets (single source of truth)
                let payment = await loadPaymentFromSheets(paymentId);
                
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
                
                // CRITICAL: If payment has transaction signature, ALWAYS verify it's actually on blockchain
                // and update status accordingly (no mock data - real blockchain check)
                // This ensures the status is ALWAYS correct, even if Google Sheets has old data
                if (payment.transactionSignature) {
                    try {
                        const rpcUrl = 'https://solana-mainnet.g.alchemy.com/v2/xXPi6FAKVWJqv9Ie5TgvOHQgTlrlfbp5';
                        const verifyResponse = await fetch(rpcUrl, {
                            method: 'POST',
                            headers: { 'Content-Type': 'application/json' },
                            body: JSON.stringify({
                                jsonrpc: '2.0',
                                id: 1,
                                method: 'getTransaction',
                                params: [
                                    payment.transactionSignature,
                                    { encoding: 'jsonParsed', commitment: 'confirmed', maxSupportedTransactionVersion: 0 }
                                ]
                            })
                        });
                        
                        if (verifyResponse.ok) {
                            const verifyData = await verifyResponse.json();
                            if (verifyData.result && verifyData.result.meta && !verifyData.result.meta.err) {
                                // Transaction confirmed on blockchain - REAL verification
                                // ALWAYS set status to verified if transaction exists on chain
                                console.log(`✅ Payment ${paymentId} has verified transaction on blockchain, FORCING status to verified`);
                                payment.status = 'verified';
                                payment.confirmedAt = verifyData.result.blockTime ? verifyData.result.blockTime * 1000 : Date.now();
                                payment.blockTime = verifyData.result.blockTime;
                                payment.slot = verifyData.result.slot;
                                
                                // SIMPLIFIED: No in-memory cache - Google Sheets is source of truth
                                
                                // Also update Google Sheets in background (don't wait)
                                const baseUrl = process.env.URL || 'https://zk-paylink.xyz';
                                const sheetsProxyUrl = `${baseUrl}/api/sheets/payment`;
                                fetch(sheetsProxyUrl, {
                                    method: 'POST',
                                    headers: { 'Content-Type': 'application/json' },
                                    body: JSON.stringify({
                                        payment: payment,
                                        sheetId: process.env.GOOGLE_SHEET_ID || '1apjUM4vb-6TUx4cweIThML5TIKBg8E7HjLlaZyiw1e8',
                                        sheetName: 'payment'
                                    })
                                }).then(() => {
                                    console.log(`✅ Updated payment ${paymentId} status to verified in Google Sheets`);
                                }).catch(sheetError => {
                                    console.warn(`⚠️ Failed to update Google Sheet:`, sheetError);
                                });
                            } else {
                                // Transaction not found or failed - keep current status
                                console.log(`⚠️ Payment ${paymentId} transaction ${payment.transactionSignature} not found or failed on blockchain`);
                            }
                        }
                    } catch (verifyError) {
                        console.warn(`⚠️ Error verifying transaction for payment ${paymentId}:`, verifyError);
                    }
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
                // SIMPLIFIED: Load all payments from Google Sheets (single source of truth)
                let allPayments = [];
                try {
                    const sheetId = '1apjUM4vb-6TUx4cweIThML5TIKBg8E7HjLlaZyiw1e8';
                    const sheetName = 'payment';
                    const baseUrl = process.env.URL || 'https://zk-paylink.xyz';
                    const sheetsUrl = `${baseUrl}/api/sheets/payments?sheetId=${sheetId}&sheetName=${sheetName}`;
                    const response = await fetch(sheetsUrl);
                    if (response.ok) {
                        const data = await response.json();
                        allPayments = data.payments || [];
                    }
                } catch (err) {
                    console.error('Failed to load payments from sheets:', err);
                }
                
                if (allPayments.length === 0) {
                    // Try loading from Google Sheets
                    try {
                        const sheetId = '1apjUM4vb-6TUx4cweIThML5TIKBg8E7HjLlaZyiw1e8';
                        const sheetName = 'payment';
                        const baseUrl = process.env.URL || 'https://zk-paylink.xyz';
                        const sheetsUrl = `${baseUrl}/api/sheets/payments?sheetId=${sheetId}&sheetName=${sheetName}`;
                        const sheetsResponse = await fetch(sheetsUrl);
                        
                        if (sheetsResponse.ok) {
                            const sheetsData = await sheetsResponse.json();
                            allPayments = sheetsData.payments || [];
                            
                            // SIMPLIFIED: No in-memory cache - Google Sheets is single source of truth
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
            
            // SIMPLIFIED: Always load from Google Sheets (single source of truth)
            let payment = await loadPaymentFromSheets(paymentId);
            if (!payment) {
                // Try loading from Google Sheets with different method
                try {
                    const baseUrl = process.env.URL || 'https://zk-paylink.xyz';
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
            
            // REAL BLOCKCHAIN VERIFICATION - Verify transaction exists on chain
            const txSignature = signature || body.signature || payment.transactionSignature;
            let blockchainVerified = false;
            let blockTime = body.blockTime;
            let slot = body.slot;
            
            if (txSignature) {
                try {
                    // Use Alchemy RPC for verification
                    const rpcUrl = 'https://solana-mainnet.g.alchemy.com/v2/xXPi6FAKVWJqv9Ie5TgvOHQgTlrlfbp5';
                    const verifyResponse = await fetch(rpcUrl, {
                        method: 'POST',
                        headers: {
                            'Content-Type': 'application/json'
                        },
                        body: JSON.stringify({
                            jsonrpc: '2.0',
                            id: 1,
                            method: 'getTransaction',
                            params: [
                                txSignature,
                                {
                                    encoding: 'jsonParsed',
                                    commitment: 'confirmed',
                                    maxSupportedTransactionVersion: 0
                                }
                            ]
                        })
                    });
                    
                    if (verifyResponse.ok) {
                        const verifyData = await verifyResponse.json();
                        if (verifyData.result && verifyData.result.meta && !verifyData.result.meta.err) {
                            // Transaction confirmed on blockchain - REAL verification
                            blockchainVerified = true;
                            blockTime = verifyData.result.blockTime || blockTime;
                            slot = verifyData.result.slot || slot;
                            console.log(`✅ Transaction ${txSignature} verified on blockchain`);
                            console.log(`   Block time: ${blockTime ? new Date(blockTime * 1000).toISOString() : 'N/A'}`);
                            console.log(`   Slot: ${slot || 'N/A'}`);
                        } else if (verifyData.result && verifyData.result.meta && verifyData.result.meta.err) {
                            console.warn(`⚠️ Transaction ${txSignature} found but failed on chain`);
                        } else {
                            console.warn(`⚠️ Transaction ${txSignature} not found on blockchain yet`);
                        }
                    }
                } catch (verifyError) {
                    console.warn('⚠️ Error verifying transaction on blockchain:', verifyError);
                    // If verification fails, still update with signature but mark as pending
                }
            }
            
            // Update payment with REAL blockchain data
            payment.transactionSignature = txSignature;
            // CRITICAL: If blockchain verified, ALWAYS set to verified. Otherwise use body.status or keep current.
            payment.status = blockchainVerified ? 'verified' : (body.status || payment.status || 'pending');
            payment.confirmedAt = blockTime ? blockTime * 1000 : (body.confirmedAt || payment.confirmedAt || Date.now());
            payment.blockTime = blockTime;
            payment.slot = slot;
            
            // Add ZK commitment if provided
            if (body.zkCommitment) {
                payment.zkCommitment = body.zkCommitment;
                payment.zkEnabled = body.zkEnabled || true;
                console.log(`[Oracle Payments] 🔐 ZK Commitment received: ${body.zkCommitment.substring(0, 16)}...`);
            }
            
            // SIMPLIFIED: No in-memory cache - Google Sheets is source of truth
            
            console.log(`[Oracle Payments] ✅ Payment ${paymentId} ready to save to Google Sheets`);
            console.log(`[Oracle Payments]    Status: ${payment.status} (${blockchainVerified ? 'BLOCKCHAIN VERIFIED' : body.status || 'pending'})`);
            console.log(`[Oracle Payments]    Signature: ${txSignature}`);
            console.log(`[Oracle Payments]    Confirmed: ${new Date(payment.confirmedAt).toISOString()}`);
            console.log(`[Oracle Payments]    ZK Enabled: ${payment.zkEnabled ? 'Yes' : 'No'}`);
            
            // Also save to Google Sheets immediately - FORCE UPDATE
            try {
                // Construct the sheets-proxy URL correctly for Netlify
                const baseUrl = process.env.URL || 'https://zk-paylink.xyz';
                const sheetsProxyUrl = `${baseUrl}/api/sheets/payment`;
                
                console.log(`[Oracle Payments] 💾 Saving payment ${paymentId} to Google Sheets`);
                console.log(`[Oracle Payments]    Status: ${payment.status}, Signature: ${payment.transactionSignature}`);
                
                // Ensure payment has all required fields - use the status we just set
                const paymentToSave = {
                    ...payment,
                    id: payment.id || paymentId,
                    status: payment.status, // Use the status we just determined
                    transactionSignature: payment.transactionSignature || txSignature || '',
                    confirmedAt: payment.confirmedAt || Date.now(),
                    createdAt: payment.createdAt || Date.now()
                };
                
                console.log(`[Oracle Payments]    Payment to save:`, JSON.stringify(paymentToSave, null, 2));
                console.log(`[Oracle Payments]    Full payment object keys:`, Object.keys(paymentToSave));
                console.log(`[Oracle Payments]    Payment ID: "${paymentToSave.id}", Order ID: "${paymentToSave.orderId}"`);
                
                const saveResponse = await fetch(sheetsProxyUrl, {
                    method: 'POST',
                    headers: {
                        'Content-Type': 'application/json'
                    },
                    body: JSON.stringify({
                        payment: paymentToSave,
                        sheetId: process.env.GOOGLE_SHEET_ID || '1apjUM4vb-6TUx4cweIThML5TIKBg8E7HjLlaZyiw1e8',
                        sheetName: 'payment'
                    })
                });
                
                if (saveResponse.ok) {
                    const saveResult = await saveResponse.json();
                    console.log(`[Oracle Payments] ✅ Payment ${paymentId} saved to Google Sheets successfully`);
                    console.log(`[Oracle Payments]    Sheet ID: ${saveResult.sheetId || 'N/A'}`);
                    console.log(`[Oracle Payments]    Response:`, JSON.stringify(saveResult));
                } else {
                    const errorText = await saveResponse.text();
                    console.error(`[Oracle Payments] ❌❌❌ CRITICAL: Failed to save to Google Sheets: HTTP ${saveResponse.status}`);
                    console.error(`[Oracle Payments]    Error: ${errorText}`);
                    console.error(`[Oracle Payments]    Payment ID: ${paymentId}, Status: ${payment.status}, Signature: ${txSignature}`);
                    console.error(`[Oracle Payments]    Order ID: ${payment.orderId}`);
                    console.error(`[Oracle Payments]    Sheets URL: ${sheetsProxyUrl}`);
                    
                    // RETRY immediately
                    console.log(`[Oracle Payments] 🔄 RETRYING save to Google Sheets...`);
                    try {
                        const retryResponse = await fetch(sheetsProxyUrl, {
                            method: 'POST',
                            headers: {
                                'Content-Type': 'application/json'
                            },
                            body: JSON.stringify({
                                payment: paymentToSave,
                                sheetId: process.env.GOOGLE_SHEET_ID || '1apjUM4vb-6TUx4cweIThML5TIKBg8E7HjLlaZyiw1e8',
                                sheetName: 'payment'
                            })
                        });
                        if (retryResponse.ok) {
                            console.log(`[Oracle Payments] ✅ RETRY SUCCESS - Payment saved to Google Sheets`);
                        } else {
                            console.error(`[Oracle Payments] ❌ RETRY FAILED:`, await retryResponse.text());
                        }
                    } catch (retryErr) {
                        console.error(`[Oracle Payments] ❌ RETRY ERROR:`, retryErr);
                    }
                }
            } catch (err) {
                console.error(`[Oracle Payments] ❌ Error saving to sheets:`, err);
                console.error(`[Oracle Payments]    Payment ID: ${paymentId}, Signature: ${txSignature}`);
                // Don't fail the verification if sheets save fails
            }
            
            // Return the updated payment with verified status
            return {
                statusCode: 200,
                headers: {
                    'Access-Control-Allow-Origin': '*',
                    'Content-Type': 'application/json'
                },
                body: JSON.stringify({ 
                    success: true, 
                    payment: {
                        ...payment,
                        status: payment.status, // Ensure status is included
                        transactionSignature: payment.transactionSignature,
                        confirmedAt: payment.confirmedAt
                    },
                    message: blockchainVerified ? 'Payment verified on blockchain' : 'Payment updated',
                    blockchainVerified: blockchainVerified
                })
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

