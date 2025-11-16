/**
 * Netlify Function to proxy Google Sheets API requests using Service Account
 * This keeps the service account credentials secure on the server
 */

exports.handler = async function(event, context) {
    // CORS headers
    const headers = {
        'Access-Control-Allow-Origin': '*',
        'Access-Control-Allow-Headers': 'Content-Type',
        'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
        'Content-Type': 'application/json'
    };

    // Handle preflight
    if (event.httpMethod === 'OPTIONS') {
        return { statusCode: 200, headers, body: '' };
    }

    // Service account credentials from environment variables
    const serviceAccount = {
        type: 'service_account',
        project_id: process.env.GOOGLE_PROJECT_ID,
        private_key_id: process.env.GOOGLE_PRIVATE_KEY_ID,
        private_key: process.env.GOOGLE_PRIVATE_KEY?.replace(/\\n/g, '\n'), // Fix newlines
        client_email: process.env.GOOGLE_CLIENT_EMAIL,
        client_id: process.env.GOOGLE_CLIENT_ID,
        auth_uri: 'https://accounts.google.com/o/oauth2/auth',
        token_uri: 'https://oauth2.googleapis.com/token',
        auth_provider_x509_cert_url: 'https://www.googleapis.com/oauth2/v1/certs',
        client_x509_cert_url: process.env.GOOGLE_CERT_URL
    };

    // Validate environment variables
    if (!serviceAccount.client_email || !serviceAccount.private_key) {
        return {
            statusCode: 500,
            headers,
            body: JSON.stringify({ 
                success: false, 
                error: 'Service account not configured. Please set GOOGLE_* environment variables in Netlify.' 
            })
        };
    }

    try {
        // Get access token
        const accessToken = await getAccessToken(serviceAccount);

        // Handle payment storage endpoints
        // Log the path for debugging
        console.log(`[Sheets Proxy] Checking path: ${event.path}, Method: ${event.httpMethod}`);
        console.log(`[Sheets Proxy] Path includes /payment: ${event.path.includes('/payment')}`);
        console.log(`[Sheets Proxy] Path includes /payments: ${event.path.includes('/payments')}`);
        
        if (event.path.includes('/payment') || event.path.includes('/payments')) {
            console.log(`[Sheets Proxy] Routing to handlePaymentStorage`);
            return await handlePaymentStorage(event, accessToken, serviceAccount);
        }
        
        // Extract path - handle both direct function calls and redirects
        let path = event.path || '';
        
        // Remove function base path
        if (path.includes('/sheets-proxy')) {
            // Extract everything after /sheets-proxy
            const parts = path.split('/sheets-proxy');
            path = parts.length > 1 ? parts[1] : '';
        } else if (path.startsWith('/api/sheets')) {
            path = path.replace('/api/sheets', '');
        }
        
        // Normalize path - remove leading slash, add if needed for matching
        path = path.replace(/^\/+/, ''); // Remove leading slashes
        if (path && !path.startsWith('/')) {
            path = '/' + path; // Add leading slash for matching
        }
        if (!path) {
            path = '';
        }
        
        const sheetId = event.queryStringParameters?.sheetId || '1apjUM4vb-6TUx4cweIThML5TIKBg8E7HjLlaZyiw1e8';

        console.log(`[Sheets Proxy] Path: ${event.path} -> ${path}, Method: ${event.httpMethod}`);

        // Handle different operations
        if (event.httpMethod === 'GET' && (path === '/scores' || path === 'scores')) {
            // Read scores
            const response = await fetch(
                `https://sheets.googleapis.com/v4/spreadsheets/${sheetId}/values/Sheet1!A2:H1000`,
                {
                    headers: { 'Authorization': `Bearer ${accessToken}` }
                }
            );

            if (!response.ok) {
                const error = await response.text();
                return {
                    statusCode: response.status,
                    headers,
                    body: JSON.stringify({ success: false, error: `Sheets API error: ${error}` })
                };
            }

            const data = await response.json();
            const scores = (data.values || []).map(row => ({
                timestamp: row[0],
                wallet: row[1],
                score: parseInt(row[2]),
                time: parseInt(row[3]),
                scorePerSecond: parseFloat(row[4]),
                difficulty: parseInt(row[5]),
                signature: row[6],
                hash: row[7]
            }));

            return {
                statusCode: 200,
                headers,
                body: JSON.stringify({ success: true, scores })
            };
        } 
        else if (event.httpMethod === 'POST' && (path === '/submit' || path === 'submit')) {
            // Submit score
            const body = JSON.parse(event.body);
            const { wallet, score, time, signature, difficulty = 1 } = body;

            if (!wallet || score === undefined || !time) {
                return {
                    statusCode: 400,
                    headers,
                    body: JSON.stringify({ success: false, error: 'Missing required fields' })
                };
            }

            const timestamp = new Date().toISOString();
            const scorePerSecond = time > 0 ? (score / (time / 1000)).toFixed(2) : 0;
            
            // Generate hash (using built-in crypto)
            const crypto = require('crypto');
            const hash = crypto.createHash('sha256')
                .update(`${wallet}${score}${time}${signature}`)
                .digest('hex').substring(0, 16);

            const values = [[
                timestamp,
                wallet,
                score.toString(),
                time.toString(),
                scorePerSecond,
                difficulty.toString(),
                signature || 'game-' + Date.now(),
                hash
            ]];

            const response = await fetch(
                `https://sheets.googleapis.com/v4/spreadsheets/${sheetId}/values/Sheet1!A:H:append?valueInputOption=RAW`,
                {
                    method: 'POST',
                    headers: {
                        'Authorization': `Bearer ${accessToken}`,
                        'Content-Type': 'application/json'
                    },
                    body: JSON.stringify({ values })
                }
            );

            if (!response.ok) {
                const error = await response.text();
                return {
                    statusCode: response.status,
                    headers,
                    body: JSON.stringify({ success: false, error: `Sheets API error: ${error}` })
                };
            }

            const result = await response.json();
            return {
                statusCode: 200,
                headers,
                body: JSON.stringify({ success: true, result })
            };
        } 
        else {
            console.log(`[Sheets Proxy] 404 - Path: ${path}, Method: ${event.httpMethod}, Full path: ${event.path}`);
            return {
                statusCode: 404,
                headers,
                body: JSON.stringify({ 
                    error: 'Not found',
                    debug: {
                        path: path,
                        eventPath: event.path,
                        method: event.httpMethod,
                        queryParams: event.queryStringParameters
                    }
                })
            };
        }
    } catch (error) {
        console.error('Function error:', error);
        return {
            statusCode: 500,
            headers,
            body: JSON.stringify({ success: false, error: error.message })
        };
    }
};

/**
 * Generate JWT and exchange for access token
 */
async function getAccessToken(serviceAccount) {
    const crypto = require('crypto');

    // Create JWT header
    const jwtHeader = Buffer.from(JSON.stringify({
        alg: 'RS256',
        typ: 'JWT'
    })).toString('base64url');

    // Create JWT claim set
    const now = Math.floor(Date.now() / 1000);
    const jwtClaimSet = {
        iss: serviceAccount.client_email,
        scope: 'https://www.googleapis.com/auth/spreadsheets https://www.googleapis.com/auth/drive.file',
        aud: serviceAccount.token_uri,
        exp: now + 3600,
        iat: now
    };

    const jwtClaimSetEncoded = Buffer.from(JSON.stringify(jwtClaimSet)).toString('base64url');
    const signatureInput = `${jwtHeader}.${jwtClaimSetEncoded}`;

    // Sign with private key
    const sign = crypto.createSign('RSA-SHA256');
    sign.update(signatureInput);
    const signature = sign.sign(serviceAccount.private_key).toString('base64url');

    const jwt = `${signatureInput}.${signature}`;

    // Exchange JWT for access token
    const response = await fetch(serviceAccount.token_uri, {
        method: 'POST',
        headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
        body: `grant_type=urn:ietf:params:oauth:grant-type:jwt-bearer&assertion=${jwt}`
    });

    const data = await response.json();
    if (!response.ok) {
        throw new Error(`Failed to get access token: ${JSON.stringify(data)}`);
    }

    return data.access_token;
}

/**
 * Handle payment storage operations
 */
async function handlePaymentStorage(event, accessToken, serviceAccount) {
    const headers = {
        'Access-Control-Allow-Origin': '*',
        'Access-Control-Allow-Headers': 'Content-Type',
        'Access-Control-Allow-Methods': 'GET, POST, DELETE, OPTIONS',
        'Content-Type': 'application/json'
    };

    if (event.httpMethod === 'OPTIONS') {
        return { statusCode: 200, headers, body: '' };
    }

    try {
        const body = event.body ? JSON.parse(event.body) : {};
        // For payments, if no sheetId provided, create a new one (separate from leaderboard)
        let sheetId = body.sheetId || event.queryStringParameters?.sheetId;
        const sheetName = body.sheetName || event.queryStringParameters?.sheetName || 'payment';
        
        // If no sheet ID provided for payments, we'll create a new one
        if (!sheetId && event.path.includes('/payment')) {
            sheetId = null; // Will trigger new sheet creation
        }

        console.log(`[Payment Storage] Method: ${event.httpMethod}, Path: ${event.path}`);
        console.log(`[Payment Storage] Body keys:`, Object.keys(body || {}));
        
        if (event.httpMethod === 'POST' && event.path.includes('/payment')) {
            // Save payment
            console.log(`[Payment Storage] Processing payment save request`);
            const payment = body.payment;
            if (!payment) {
                console.error(`[Payment Storage] No payment data in body`);
                return { statusCode: 400, headers, body: JSON.stringify({ success: false, error: 'Payment data required' }) };
            }
            
            console.log(`[Payment Storage] Payment ID: ${payment.id}, Amount: ${payment.amount}, Status: ${payment.status}`);

            // For payments, use existing sheet if no sheetId provided
            // Try to use the leaderboard sheet first, or create tab in it
            let actualSheetId;
            if (!sheetId) {
                // Try to use the leaderboard sheet ID from environment or default
                // This avoids permission issues with creating new sheets
                const defaultSheetId = process.env.GOOGLE_SHEET_ID || '1apjUM4vb-6TUx4cweIThML5TIKBg8E7HjLlaZyiw1e8';
                console.log(`[Payment Storage] No sheet ID provided, using default sheet: ${defaultSheetId}`);
                actualSheetId = await ensurePaymentSheet(defaultSheetId, sheetName, accessToken);
            } else {
                // Use existing sheet or create tab if needed
                actualSheetId = await ensurePaymentSheet(sheetId, sheetName, accessToken);
            }
            
            // ALWAYS ensure headers are correct before saving/updating
            // This fixes the "Merchant Addre: Status" combined header issue
            await ensurePaymentSheet(actualSheetId, sheetName, accessToken);

                // Append payment row - ensure all values are properly formatted
                // Column mapping: A=ID, B=Amount, C=Currency, D=Token, E=TokenAmount, F=OrderID, G=MerchantAddress, H=Status, I=TransactionSignature, J=CreatedAt, K=ConfirmedAt, L=ZKProof
                // CRITICAL: Use the FULL payment ID, not truncated, when updating
                const fullPaymentId = String(payment.id || '').trim();
                const values = [
                    fullPaymentId, // Use full ID - Google Sheets may truncate display but we store full value
                    String(payment.amount || 0),
                    String(payment.currency || 'USD'),
                    String(payment.token || 'SOL'),
                    String(payment.solAmount || payment.amount || 0),
                    String(payment.orderId || '').trim(),
                    String(payment.merchantAddress || '').trim(),
                    String(payment.status || 'pending'), // Ensure status is always set
                    String(payment.transactionSignature || '').trim(), // Transaction signature
                    payment.createdAt ? new Date(payment.createdAt).toISOString() : new Date().toISOString(),
                    payment.confirmedAt ? new Date(payment.confirmedAt).toISOString() : '',
                    JSON.stringify(payment.proof || {})
                ];
                
                console.log(`[Payment Storage] Preparing values array for payment ${fullPaymentId}`);
                console.log(`[Payment Storage]    Status: "${values[7]}", Signature: "${values[8]}"`);
                console.log(`[Payment Storage]    Full values array:`, values);

            // Ensure the sheet tab exists before appending
            const tabExists = await checkSheetTabExists(actualSheetId, sheetName, accessToken);
            if (!tabExists) {
                console.log(`[Payment Storage] Tab "${sheetName}" doesn't exist, creating it...`);
                await createSheetTab(actualSheetId, sheetName, accessToken);
            }
            
            // Check if payment already exists in the sheet (by Payment ID in column A)
            // Read all payment IDs to find existing row
            const readUrl = `https://sheets.googleapis.com/v4/spreadsheets/${actualSheetId}/values/${sheetName}!A2:A`;
            const readResponse = await fetch(readUrl, {
                headers: {
                    'Authorization': `Bearer ${accessToken}`
                }
            });
            
            let existingRowIndex = null;
            let duplicateRowIndices = [];
            if (readResponse.ok) {
                const readData = await readResponse.json();
                const rows = readData.values || [];
                
                console.log(`[Payment Storage] Checking ${rows.length} rows for payment ID: ${payment.id}`);
                
                // Find ALL rows with this payment ID (to handle duplicates and truncation)
                // Match by exact payment ID OR by first part (in case of truncation in sheet)
                const paymentIdToFind = String(payment.id || '').trim();
                const paymentIdPrefix = paymentIdToFind.substring(0, 25); // First 25 chars for matching truncated IDs
                console.log(`[Payment Storage] Searching for payment ID: "${paymentIdToFind}" (prefix: "${paymentIdPrefix}")`);
                console.log(`[Payment Storage] Checking ${rows.length} rows for matches...`);
                
                for (let i = 0; i < rows.length; i++) {
                    const rowPaymentId = rows[i] && rows[i][0] ? String(rows[i][0]).trim() : '';
                    
                    // Exact match
                    if (rowPaymentId === paymentIdToFind) {
                        const rowIndex = i + 2;
                        duplicateRowIndices.push(rowIndex);
                        console.log(`[Payment Storage] ✅ Found EXACT match for payment "${paymentIdToFind}" at row ${rowIndex}`);
                    }
                    // Prefix match - if sheet has truncated ID, check if our full ID starts with it
                    else if (rowPaymentId && paymentIdToFind.startsWith(rowPaymentId)) {
                        const rowIndex = i + 2;
                        duplicateRowIndices.push(rowIndex);
                        console.log(`[Payment Storage] ✅ Found PREFIX match: sheet has "${rowPaymentId}", we have "${paymentIdToFind}" at row ${rowIndex}`);
                    }
                    // Reverse prefix match - if our ID is truncated in sheet, check if sheet ID starts with our prefix
                    else if (rowPaymentId && rowPaymentId.startsWith(paymentIdPrefix) && paymentIdPrefix.length >= 20) {
                        const rowIndex = i + 2;
                        duplicateRowIndices.push(rowIndex);
                        console.log(`[Payment Storage] ✅ Found REVERSE PREFIX match: sheet has "${rowPaymentId}", we have "${paymentIdToFind}" at row ${rowIndex}`);
                    }
                }
                
                console.log(`[Payment Storage] Found ${duplicateRowIndices.length} matching row(s) for payment "${paymentIdToFind}"`);
                
                if (duplicateRowIndices.length > 0) {
                    // If there are duplicates, keep the FIRST one (oldest) and delete the rest
                    existingRowIndex = duplicateRowIndices[0];
                    
                    if (duplicateRowIndices.length > 1) {
                        console.log(`[Payment Storage] Found ${duplicateRowIndices.length} duplicate rows for ${payment.id}. Will keep row ${existingRowIndex} and delete the rest.`);
                        
                        // Delete duplicate rows (except the first one)
                        // Get the actual sheet (tab) ID
                        const spreadsheetUrl = `https://sheets.googleapis.com/v4/spreadsheets/${actualSheetId}`;
                        const spreadsheetResponse = await fetch(spreadsheetUrl, {
                            headers: {
                                'Authorization': `Bearer ${accessToken}`
                            }
                        });
                        
                        if (spreadsheetResponse.ok) {
                            const spreadsheetData = await spreadsheetResponse.json();
                            const paymentSheet = spreadsheetData.sheets.find(s => 
                                s.properties.title.toLowerCase() === sheetName.toLowerCase()
                            );
                            
                            if (paymentSheet) {
                                const actualSheetTabId = paymentSheet.properties.sheetId;
                                
                                // Delete duplicate rows (from highest to lowest to maintain indices)
                                const rowsToDelete = duplicateRowIndices.slice(1).sort((a, b) => b - a);
                                const deleteRequests = rowsToDelete.map(rowIndex => ({
                                    deleteDimension: {
                                        range: {
                                            sheetId: actualSheetTabId,
                                            dimension: 'ROWS',
                                            startIndex: rowIndex - 1,
                                            endIndex: rowIndex
                                        }
                                    }
                                }));
                                
                                if (deleteRequests.length > 0) {
                                    const deleteUrl = `https://sheets.googleapis.com/v4/spreadsheets/${actualSheetId}:batchUpdate`;
                                    const deleteResponse = await fetch(deleteUrl, {
                                        method: 'POST',
                                        headers: {
                                            'Authorization': `Bearer ${accessToken}`,
                                            'Content-Type': 'application/json'
                                        },
                                        body: JSON.stringify({
                                            requests: deleteRequests
                                        })
                                    });
                                    
                                    if (deleteResponse.ok) {
                                        console.log(`[Payment Storage] ✅ Deleted ${rowsToDelete.length} duplicate row(s) for payment ${payment.id}`);
                                    } else {
                                        const errorText = await deleteResponse.text();
                                        console.warn(`[Payment Storage] ⚠️ Failed to delete duplicates: ${errorText}`);
                                    }
                                }
                            }
                        }
                    }
                    
                    console.log(`[Payment Storage] Will update row ${existingRowIndex} with status: ${payment.status}`);
                } else {
                    console.log(`[Payment Storage] Payment ${payment.id} not found in sheet, will append new row`);
                }
            } else {
                console.warn(`[Payment Storage] Failed to read sheet to check for existing payment: ${readResponse.status}`);
            }
            
                if (existingRowIndex) {
                    // UPDATE existing row - FORCE UPDATE with all fields
                    console.log(`[Payment Storage] 🔄 FORCE UPDATING row ${existingRowIndex} for payment ${payment.id}`);
                    console.log(`[Payment Storage] Payment data: status=${payment.status}, signature=${payment.transactionSignature || 'N/A'}, confirmedAt=${payment.confirmedAt || 'N/A'}`);
                    console.log(`[Payment Storage] Values to update:`, values);
                    
                    // Force update with explicit column mapping to ensure correct data placement
                    // Column mapping: A=ID, B=Amount, C=Currency, D=Token, E=TokenAmount, F=OrderID, G=MerchantAddress, H=Status, I=TransactionSignature, J=CreatedAt, K=ConfirmedAt, L=ZKProof
                    const updateUrl = `https://sheets.googleapis.com/v4/spreadsheets/${actualSheetId}/values/${sheetName}!A${existingRowIndex}:L${existingRowIndex}?valueInputOption=RAW`;
                    
                    console.log(`[Payment Storage] Update URL: ${updateUrl}`);
                    console.log(`[Payment Storage] FORCE UPDATING with status: "${payment.status}", signature: "${payment.transactionSignature || ''}"`);
                    console.log(`[Payment Storage] Full values array:`, JSON.stringify([values]));
                    
                    const updateResponse = await fetch(updateUrl, {
                        method: 'PUT',
                        headers: {
                            'Authorization': `Bearer ${accessToken}`,
                            'Content-Type': 'application/json'
                        },
                        body: JSON.stringify({ values: [values] })
                    });
        
                if (!updateResponse.ok) {
                    const errorText = await updateResponse.text();
                    console.error(`[Payment Storage] ❌ Failed to update payment in Google Sheets:`, errorText);
                    console.error(`[Payment Storage] Update URL: ${updateUrl}`);
                    console.error(`[Payment Storage] Response status: ${updateResponse.status}`);
                    console.error(`[Payment Storage] Payment ID: ${payment.id}, Status: ${payment.status}, Signature: ${payment.transactionSignature}`);
                    
                    // Try to read the current row to see what's there
                    try {
                        const readCurrentUrl = `https://sheets.googleapis.com/v4/spreadsheets/${actualSheetId}/values/${sheetName}!A${existingRowIndex}:L${existingRowIndex}`;
                        const readCurrentResponse = await fetch(readCurrentUrl, {
                            headers: { 'Authorization': `Bearer ${accessToken}` }
                        });
                        if (readCurrentResponse.ok) {
                            const currentData = await readCurrentResponse.json();
                            console.error(`[Payment Storage] Current row data:`, currentData.values);
                        }
                    } catch (readErr) {
                        console.error(`[Payment Storage] Could not read current row:`, readErr);
                    }
                    
                    throw new Error(`Failed to update payment: ${errorText}`);
                }
        
                    const updateResult = await updateResponse.json();
                    console.log(`[Payment Storage] ✅ Payment ${payment.id} successfully updated in Google Sheets (row ${existingRowIndex})`);
                    console.log(`[Payment Storage] Status: ${payment.status}, Transaction: ${payment.transactionSignature || 'N/A'}`);
                    console.log(`[Payment Storage] Updated range: ${updateResult.updatedRange || 'N/A'}`);
                    console.log(`[Payment Storage] Update response:`, JSON.stringify(updateResult));
                    
                    // Verify the update by reading back the row IMMEDIATELY
                    try {
                        // Wait 500ms for Google Sheets to sync
                        await new Promise(resolve => setTimeout(resolve, 500));
                        
                        const verifyUrl = `https://sheets.googleapis.com/v4/spreadsheets/${actualSheetId}/values/${sheetName}!A${existingRowIndex}:L${existingRowIndex}`;
                        const verifyResponse = await fetch(verifyUrl, {
                            headers: { 'Authorization': `Bearer ${accessToken}` }
                        });
                        if (verifyResponse.ok) {
                            const verifyData = await verifyResponse.json();
                            const updatedRow = verifyData.values?.[0] || [];
                            console.log(`[Payment Storage] ✅ VERIFIED UPDATE - Row ${existingRowIndex} now contains:`);
                            console.log(`[Payment Storage]    Status (col H): "${updatedRow[7] || 'MISSING'}"`);
                            console.log(`[Payment Storage]    Signature (col I): "${updatedRow[8] || 'MISSING'}"`);
                            console.log(`[Payment Storage]    Full row:`, updatedRow);
                            
                            // If status or signature didn't update, log warning
                            if (updatedRow[7] !== payment.status) {
                                console.error(`[Payment Storage] ❌ STATUS MISMATCH! Expected "${payment.status}", got "${updatedRow[7]}"`);
                            }
                            if (updatedRow[8] !== payment.transactionSignature && payment.transactionSignature) {
                                console.error(`[Payment Storage] ❌ SIGNATURE MISMATCH! Expected "${payment.transactionSignature}", got "${updatedRow[8]}"`);
                            }
                        } else {
                            console.warn(`[Payment Storage] Could not verify update: HTTP ${verifyResponse.status}`);
                        }
                    } catch (verifyErr) {
                        console.warn(`[Payment Storage] Could not verify update:`, verifyErr);
                    }
            } else {
                // APPEND new row (payment doesn't exist yet)
                const appendUrl = `https://sheets.googleapis.com/v4/spreadsheets/${actualSheetId}/values/${sheetName}!A:L:append?valueInputOption=RAW`;
                const appendResponse = await fetch(appendUrl, {
                    method: 'POST',
                    headers: {
                        'Authorization': `Bearer ${accessToken}`,
                        'Content-Type': 'application/json'
                    },
                    body: JSON.stringify({ values: [values] })
                });

                if (!appendResponse.ok) {
                    const errorText = await appendResponse.text();
                    console.error(`[Payment Storage] ❌ Failed to append payment to Google Sheets:`, errorText);
                    throw new Error(`Failed to append payment: ${errorText}`);
                }

                const appendResult = await appendResponse.json();
                console.log(`[Payment Storage] ✅ Payment ${payment.id} successfully appended to Google Sheets`);
                console.log(`[Payment Storage] Sheet ID: ${actualSheetId}, Updated range: ${appendResult.updates?.updatedRange || 'N/A'}`);
            }

            return { 
                statusCode: 200, 
                headers, 
                body: JSON.stringify({ 
                    success: true, 
                    sheetId: actualSheetId,
                    sheetUrl: `https://docs.google.com/spreadsheets/d/${actualSheetId}/edit`
                }) 
            };
        } else if (event.httpMethod === 'GET' && event.path.includes('/payment/fix-headers')) {
            // Fix headers immediately - force fix regardless of current state
            if (!sheetId) {
                return { statusCode: 400, headers, body: JSON.stringify({ success: false, error: 'Sheet ID required' }) };
            }
            try {
                // First, get the actual tab names from the sheet
                const metadataUrl = `https://sheets.googleapis.com/v4/spreadsheets/${sheetId}`;
                const metadataResponse = await fetch(metadataUrl, {
                    headers: { 'Authorization': `Bearer ${accessToken}` }
                });
                
                if (!metadataResponse.ok) {
                    throw new Error(`Failed to get sheet metadata: ${await metadataResponse.text()}`);
                }
                
                const metadata = await metadataResponse.json();
                const actualTabNames = metadata.sheets?.map(s => s.properties.title) || [];
                console.log(`Found tabs: ${actualTabNames.join(', ')}`);
                
                // Find the payment tab (case-insensitive)
                const paymentTab = actualTabNames.find(t => t.toLowerCase() === 'payment') || actualTabNames.find(t => t.toLowerCase().includes('payment')) || 'payment';
                const paymentSheetId = metadata.sheets?.find(s => s.properties.title === paymentTab)?.properties.sheetId;
                console.log(`Using tab: ${paymentTab}, sheetId: ${paymentSheetId}`);
                
                // Force update headers by directly calling the update API
                const correctHeaders = [
                    'Payment ID', 'Amount (USD)', 'Currency', 'Token', 'Token Amount',
                    'Order ID', 'Merchant Address', 'Status', 'Transaction Signature',
                    'Created At', 'Confirmed At', 'ZK Proof'
                ];
                
                // Update headers with explicit column widths to prevent truncation
                const updateUrl = `https://sheets.googleapis.com/v4/spreadsheets/${sheetId}/values/${encodeURIComponent(paymentTab)}!A1:L1?valueInputOption=RAW`;
                const updateResponse = await fetch(updateUrl, {
                    method: 'PUT',
                    headers: {
                        'Authorization': `Bearer ${accessToken}`,
                        'Content-Type': 'application/json'
                    },
                    body: JSON.stringify({
                        values: [correctHeaders]
                    })
                });
                
                // Also update column widths to prevent truncation
                const batchUpdateUrl = `https://sheets.googleapis.com/v4/spreadsheets/${sheetId}:batchUpdate`;
                await fetch(batchUpdateUrl, {
                    method: 'POST',
                    headers: {
                        'Authorization': `Bearer ${accessToken}`,
                        'Content-Type': 'application/json'
                    },
                    body: JSON.stringify({
                        requests: [
                            {
                                updateDimensionProperties: {
                                    range: {
                                        sheetId: paymentSheetId,
                                        dimension: 'COLUMNS',
                                        startIndex: 8, // Column I (0-indexed, so I=8)
                                        endIndex: 9   // Column J
                                    },
                                    properties: {
                                        pixelSize: 200 // Set width to 200px to show full "Transaction Signature"
                                    },
                                    fields: 'pixelSize'
                                }
                            }
                        ]
                    })
                }).catch(err => console.log('Could not update column width:', err));

                if (!updateResponse.ok) {
                    const errorText = await updateResponse.text();
                    throw new Error(`Failed to update headers: ${errorText}`);
                }
                
                const updateResult = await updateResponse.json();
                
                // Read back the updated headers to confirm - wait a moment for Google to sync
                await new Promise(resolve => setTimeout(resolve, 1000));
                
                const verifyUrl = `https://sheets.googleapis.com/v4/spreadsheets/${sheetId}/values/${encodeURIComponent(paymentTab)}!A1:L1`;
                const verifyResponse = await fetch(verifyUrl, {
                    headers: { 'Authorization': `Bearer ${accessToken}` }
                });
                
                let verifiedHeaders = [];
                if (verifyResponse.ok) {
                    const verifyData = await verifyResponse.json();
                    verifiedHeaders = verifyData.values?.[0] || [];
                    console.log('Verified headers after update:', JSON.stringify(verifiedHeaders));
                } else {
                    console.log('Could not verify headers:', await verifyResponse.text());
                }
                
                // Also read specific columns to verify G and H are separate
                const ghUrl = `https://sheets.googleapis.com/v4/spreadsheets/${sheetId}/values/${encodeURIComponent(paymentTab)}!G1:H1`;
                const ghResponse = await fetch(ghUrl, {
                    headers: { 'Authorization': `Bearer ${accessToken}` }
                });
                
                let ghHeaders = [];
                if (ghResponse.ok) {
                    const ghData = await ghResponse.json();
                    ghHeaders = ghData.values?.[0] || [];
                }
                
                return { 
                    statusCode: 200, 
                    headers, 
                    body: JSON.stringify({ 
                        success: true, 
                        message: 'Headers fixed successfully',
                        sheetId: sheetId,
                        tabName: paymentTab,
                        actualTabs: actualTabNames,
                        result: updateResult,
                        verifiedHeaders: verifiedHeaders,
                        columnsGH: ghHeaders,
                        columnG: verifiedHeaders[6] || 'missing',
                        columnH: verifiedHeaders[7] || 'missing',
                        columnI: verifiedHeaders[8] || 'missing',
                        columnJ: verifiedHeaders[9] || 'missing'
                    }) 
                };
            } catch (error) {
                return { 
                    statusCode: 500, 
                    headers, 
                    body: JSON.stringify({ success: false, error: error.message }) 
                };
            }
        } else if (event.httpMethod === 'GET' && event.path.includes('/payments')) {
            // Load all payments
            if (!sheetId) {
                // No sheet ID means no payments yet
                return { statusCode: 200, headers, body: JSON.stringify({ success: true, payments: [] }) };
            }
            const readUrl = `https://sheets.googleapis.com/v4/spreadsheets/${sheetId}/values/${sheetName}!A2:L`;
            const readResponse = await fetch(readUrl, {
                headers: {
                    'Authorization': `Bearer ${accessToken}`
                }
            });

            if (!readResponse.ok) {
                if (readResponse.status === 400 || readResponse.status === 404) {
                    // Sheet doesn't exist, return empty
                    return { statusCode: 200, headers, body: JSON.stringify({ success: true, payments: [] }) };
                }
                const errorText = await readResponse.text().catch(() => 'Unknown error');
                console.error(`Failed to read payments from Google Sheets: ${readResponse.status} - ${errorText}`);
                // Return empty array instead of throwing to prevent 500 errors
                return { statusCode: 200, headers, body: JSON.stringify({ success: true, payments: [] }) };
            }

            let data;
            try {
                data = await readResponse.json();
            } catch (e) {
                console.error('Failed to parse response JSON:', e);
                return { statusCode: 200, headers, body: JSON.stringify({ success: true, payments: [] }) };
            }
            
            const rows = data.values || [];
            
            const payments = rows.map(row => {
                // Ensure row has enough columns
                if (!row || row.length < 12) {
                    // Pad row with empty strings if needed
                    while (row.length < 12) {
                        row.push('');
                    }
                }
                
                let proof = null;
                try {
                    if (row[11] && row[11].trim()) {
                        proof = JSON.parse(row[11]);
                    }
                } catch (e) {
                    // Invalid JSON, set to empty object
                    console.warn(`Failed to parse proof JSON for payment ${row[0]}:`, e.message);
                    proof = {};
                }
                
                const payment = {
                    id: row[0] || '',
                    amount: parseFloat(row[1] || 0) || 0,
                    currency: row[2] || 'USD',
                    token: row[3] || 'SOL',
                    solAmount: parseFloat(row[4] || 0) || 0,
                    orderId: row[5] || '',
                    merchantAddress: row[6] || '',
                    status: row[7] || 'pending',
                    transactionSignature: row[8] || '',
                    createdAt: row[9] ? (new Date(row[9]).getTime() || Date.now()) : Date.now(),
                    confirmedAt: row[10] && row[10].trim() ? new Date(row[10]).getTime() : null,
                    proof: proof
                };
                
                // If payment has verified proof or transaction signature, ensure status is verified
                if ((proof && proof.verified) || payment.transactionSignature) {
                    if (payment.status !== 'verified') {
                        payment.status = 'verified';
                        if (!payment.confirmedAt) {
                            payment.confirmedAt = Date.now();
                        }
                    }
                }
                
                return payment;
            }).filter(p => p.id); // Return all payments, not just verified

            return { statusCode: 200, headers, body: JSON.stringify({ success: true, payments }) };
        } else if (event.httpMethod === 'DELETE') {
            // Delete payment (for expired pending payments)
            const pathParts = event.path.split('/');
            const lastPart = pathParts[pathParts.length - 1];
            
            // Check if deleting by Order ID
            if (event.path.includes('/by-order/')) {
                const orderId = decodeURIComponent(lastPart);
                return await deletePaymentsByOrderId(event, accessToken, sheetId, sheetName, orderId);
            }
            
            // Otherwise delete by Payment ID
            const paymentId = lastPart;
            
            if (!sheetId) {
                return { statusCode: 200, headers, body: JSON.stringify({ success: true, message: 'No sheet to delete from' }) };
            }
            
            // Find ALL rows containing this payment ID
            // Payment ID is in column A (index 0)
            const readUrl = `https://sheets.googleapis.com/v4/spreadsheets/${sheetId}/values/${sheetName}!A2:A`;
            const readResponse = await fetch(readUrl, {
                headers: {
                    'Authorization': `Bearer ${accessToken}`
                }
            });
            
            if (!readResponse.ok) {
                throw new Error(`Failed to read sheet: ${readResponse.statusText}`);
            }
            
            const readData = await readResponse.json();
            const rows = readData.values || [];
            
            // Find ALL row indices that match this payment ID (1-based, +1 for header row)
            const rowIndices = [];
            for (let i = 0; i < rows.length; i++) {
                if (rows[i] && rows[i][0] === paymentId) {
                    rowIndices.push(i + 2); // +2 because: +1 for 0-based to 1-based, +1 for header row
                }
            }
            
            if (rowIndices.length === 0) {
                // Payment not found in sheet, but that's okay (might have been deleted already)
                return { statusCode: 200, headers, body: JSON.stringify({ success: true, message: 'Payment not found in sheet (may have been deleted already)', deletedCount: 0 }) };
            }
            
            // Get the actual sheet (tab) ID for the payment tab
            const spreadsheetUrl = `https://sheets.googleapis.com/v4/spreadsheets/${sheetId}`;
            const spreadsheetResponse = await fetch(spreadsheetUrl, {
                headers: {
                    'Authorization': `Bearer ${accessToken}`
                }
            });
            
            if (!spreadsheetResponse.ok) {
                throw new Error(`Failed to get spreadsheet info: ${spreadsheetResponse.statusText}`);
            }
            
            const spreadsheetData = await spreadsheetResponse.json();
            const paymentSheet = spreadsheetData.sheets.find(s => 
                s.properties.title.toLowerCase() === sheetName.toLowerCase()
            );
            
            if (!paymentSheet) {
                throw new Error(`Payment sheet "${sheetName}" not found`);
            }
            
            const actualSheetId = paymentSheet.properties.sheetId;
            
            // Delete ALL matching rows at once using batchUpdate
            // Sort row indices in descending order to avoid index shifting issues
            const sortedIndices = [...rowIndices].sort((a, b) => b - a);
            const deleteRequests = sortedIndices.map(rowIndex => ({
                deleteDimension: {
                    range: {
                        sheetId: actualSheetId,
                        dimension: 'ROWS',
                        startIndex: rowIndex - 1, // 0-based index
                        endIndex: rowIndex // Delete single row
                    }
                }
            }));
            
            const deleteUrl = `https://sheets.googleapis.com/v4/spreadsheets/${sheetId}:batchUpdate`;
            const deleteResponse = await fetch(deleteUrl, {
                method: 'POST',
                headers: {
                    'Authorization': `Bearer ${accessToken}`,
                    'Content-Type': 'application/json'
                },
                body: JSON.stringify({
                    requests: deleteRequests
                })
            });
            
            if (!deleteResponse.ok) {
                const errorText = await deleteResponse.text();
                console.error('Failed to delete rows:', errorText);
                throw new Error(`Failed to delete payment rows: ${errorText}`);
            }
            
            return { statusCode: 200, headers, body: JSON.stringify({ success: true, deletedRows: sortedIndices, deletedCount: sortedIndices.length }) };
        }
    } catch (error) {
        console.error('Payment storage error:', error);
        return { statusCode: 500, headers, body: JSON.stringify({ success: false, error: error.message }) };
    }
}

/**
 * Delete payments by Order ID
 */
async function deletePaymentsByOrderId(event, accessToken, sheetId, sheetName, orderId) {
    const headers = {
        'Access-Control-Allow-Origin': '*'
    };
    
    try {
        if (!sheetId) {
            return { statusCode: 200, headers, body: JSON.stringify({ success: true, message: 'No sheet to delete from', deletedCount: 0 }) };
        }
        
        // Read all payment data to find by Order ID (Order ID is in column F, index 5)
        const readUrl = `https://sheets.googleapis.com/v4/spreadsheets/${sheetId}/values/${sheetName}!A2:F`;
        const readResponse = await fetch(readUrl, {
            headers: {
                'Authorization': `Bearer ${accessToken}`
            }
        });
        
        if (!readResponse.ok) {
            throw new Error(`Failed to read sheet: ${readResponse.statusText}`);
        }
        
        const readData = await readResponse.json();
        const rows = readData.values || [];
        
        // Find ALL row indices that match this Order ID (Order ID is in column F, index 5)
        const rowIndices = [];
        for (let i = 0; i < rows.length; i++) {
            if (rows[i] && rows[i][5] === orderId) {
                rowIndices.push(i + 2); // +2 because: +1 for 0-based to 1-based, +1 for header row
            }
        }
        
        if (rowIndices.length === 0) {
            return { statusCode: 200, headers, body: JSON.stringify({ success: true, message: 'No payments found with this Order ID', deletedCount: 0 }) };
        }
        
        // Get the actual sheet (tab) ID
        const spreadsheetUrl = `https://sheets.googleapis.com/v4/spreadsheets/${sheetId}`;
        const spreadsheetResponse = await fetch(spreadsheetUrl, {
            headers: {
                'Authorization': `Bearer ${accessToken}`
            }
        });
        
        if (!spreadsheetResponse.ok) {
            throw new Error(`Failed to get spreadsheet info: ${spreadsheetResponse.statusText}`);
        }
        
        const spreadsheetData = await spreadsheetResponse.json();
        const paymentSheet = spreadsheetData.sheets.find(s => 
            s.properties.title.toLowerCase() === sheetName.toLowerCase()
        );
        
        if (!paymentSheet) {
            throw new Error(`Payment sheet "${sheetName}" not found`);
        }
        
        const actualSheetId = paymentSheet.properties.sheetId;
        
        // Delete ALL matching rows at once
        const sortedIndices = [...rowIndices].sort((a, b) => b - a);
        const deleteRequests = sortedIndices.map(rowIndex => ({
            deleteDimension: {
                range: {
                    sheetId: actualSheetId,
                    dimension: 'ROWS',
                    startIndex: rowIndex - 1,
                    endIndex: rowIndex
                }
            }
        }));
        
        const deleteUrl = `https://sheets.googleapis.com/v4/spreadsheets/${sheetId}:batchUpdate`;
        const deleteResponse = await fetch(deleteUrl, {
            method: 'POST',
            headers: {
                'Authorization': `Bearer ${accessToken}`,
                'Content-Type': 'application/json'
            },
            body: JSON.stringify({
                requests: deleteRequests
            })
        });
        
        if (!deleteResponse.ok) {
            const errorText = await deleteResponse.text();
            throw new Error(`Failed to delete payment rows: ${errorText}`);
        }
        
        return { statusCode: 200, headers, body: JSON.stringify({ success: true, deletedRows: sortedIndices, deletedCount: sortedIndices.length }) };
    } catch (error) {
        console.error('Delete by Order ID error:', error);
        return { statusCode: 500, headers, body: JSON.stringify({ success: false, error: error.message }) };
    }
}

/**
 * Create a new Google Sheet for payments
 */
async function createNewPaymentSheet(accessToken) {
    try {
        const createUrl = 'https://sheets.googleapis.com/v4/spreadsheets';
        const response = await fetch(createUrl, {
            method: 'POST',
            headers: {
                'Authorization': `Bearer ${accessToken}`,
                'Content-Type': 'application/json'
            },
            body: JSON.stringify({
                properties: {
                    title: 'Solana Payment Oracle - Payments Database'
                },
                sheets: [{
                    properties: {
                        title: 'payment',
                        gridProperties: {
                            rowCount: 1000,
                            columnCount: 12
                        }
                    }
                }]
            })
        });

        if (!response.ok) {
            const error = await response.text();
            throw new Error(`Failed to create sheet: ${error}`);
        }

        const data = await response.json();
        const newSheetId = data.spreadsheetId;
        
        // Add headers
        const headersUrl = `https://sheets.googleapis.com/v4/spreadsheets/${newSheetId}/values/payment!A1:L1?valueInputOption=RAW`;
        await fetch(headersUrl, {
            method: 'PUT',
            headers: {
                'Authorization': `Bearer ${accessToken}`,
                'Content-Type': 'application/json'
            },
            body: JSON.stringify({
                values: [[
                    'Payment ID', 'Amount (USD)', 'Currency', 'Token', 'Token Amount',
                    'Order ID', 'Merchant Address', 'Status', 'Transaction Signature',
                    'Created At', 'Confirmed At', 'ZK Proof'
                ]]
            })
        });

        console.log(`✅ Created new payment sheet: ${newSheetId}`);
        return newSheetId;
    } catch (error) {
        console.error('Failed to create new payment sheet:', error);
        throw error;
    }
}

/**
 * Ensure payment sheet exists with headers
 */
async function ensurePaymentSheet(sheetId, sheetName, accessToken) {
    try {
        // Check if sheet exists
        const metadataUrl = `https://sheets.googleapis.com/v4/spreadsheets/${sheetId}`;
        const metadataResponse = await fetch(metadataUrl, {
            headers: { 'Authorization': `Bearer ${accessToken}` }
        });

        if (!metadataResponse.ok) {
            // Sheet doesn't exist, create a new one
            console.log('Sheet not found, creating new payment sheet...');
            const newSheetId = await createNewPaymentSheet(accessToken);
            return newSheetId;
        }

        const metadata = await metadataResponse.json();
        const sheetExists = metadata.sheets?.some(s => s.properties.title === sheetName);

        if (!sheetExists) {
            // Create sheet tab
            console.log(`Creating new sheet tab: ${sheetName}`);
            const createSheetUrl = `https://sheets.googleapis.com/v4/spreadsheets/${sheetId}:batchUpdate`;
            const createResponse = await fetch(createSheetUrl, {
                method: 'POST',
                headers: {
                    'Authorization': `Bearer ${accessToken}`,
                    'Content-Type': 'application/json'
                },
                body: JSON.stringify({
                    requests: [{
                        addSheet: {
                            properties: {
                                title: 'payment' // Use lowercase 'payment' to match existing tab
                            }
                        }
                    }]
                })
            });

            if (!createResponse.ok) {
                throw new Error(`Failed to create sheet tab: ${await createResponse.text()}`);
            }
        }

        // Ensure headers exist and are correct
        const headersUrl = `https://sheets.googleapis.com/v4/spreadsheets/${sheetId}/values/${sheetName}!A1:L1`;
        const headersResponse = await fetch(headersUrl, {
            headers: { 'Authorization': `Bearer ${accessToken}` }
        });

        const correctHeaders = [
            'Payment ID', 'Amount (USD)', 'Currency', 'Token', 'Token Amount',
            'Order ID', 'Merchant Address', 'Status', 'Transaction Signature',
            'Created At', 'Confirmed At', 'ZK Proof'
        ];

        let needsHeaderFix = false;
        let existingHeaders = [];

        if (headersResponse.ok) {
            const headersData = await headersResponse.json();
            if (!headersData.values || headersData.values.length === 0) {
                // No headers at all - add them
                console.log('No headers found, will add them');
                needsHeaderFix = true;
            } else {
                // Check if headers are correct
                existingHeaders = headersData.values[0] || [];
                console.log(`Found ${existingHeaders.length} existing headers`);
                if (existingHeaders.length !== correctHeaders.length) {
                    console.log(`Header count mismatch: ${existingHeaders.length} vs ${correctHeaders.length}`);
                    needsHeaderFix = true;
                } else {
                    // Check each header matches (case-insensitive and trim whitespace)
                    for (let i = 0; i < correctHeaders.length; i++) {
                        const existing = (existingHeaders[i] || '').trim();
                        const correct = (correctHeaders[i] || '').trim();
                        // Also check for combined headers like "Merchant Address Status"
                        if (existing.toLowerCase() !== correct.toLowerCase() && 
                            !existing.toLowerCase().includes(correct.toLowerCase()) &&
                            !correct.toLowerCase().includes(existing.toLowerCase())) {
                            console.log(`Header mismatch at column ${i}: "${existing}" vs "${correct}"`);
                            needsHeaderFix = true;
                            break;
                        }
                    }
                }
            }
        } else {
            // Can't read headers, try to add them
            console.log(`Cannot read headers (status: ${headersResponse.status}), will add them`);
            needsHeaderFix = true;
        }

        if (needsHeaderFix) {
            // Fix/Add headers
            console.log('🔧 Fixing headers in payment sheet...');
            console.log(`Sheet ID: ${sheetId}, Tab: ${sheetName}`);
            console.log(`Current headers: ${JSON.stringify(existingHeaders || [])}`);
            console.log(`Correct headers: ${JSON.stringify(correctHeaders)}`);
            
            // Try multiple tab name variations in case of case sensitivity
            const possibleTabNames = [sheetName, 'payment', 'Payment', 'PAYMENT'];
            let headerFixed = false;
            
            for (const tabName of possibleTabNames) {
                try {
                    const updateUrl = `https://sheets.googleapis.com/v4/spreadsheets/${sheetId}/values/${encodeURIComponent(tabName)}!A1:L1?valueInputOption=RAW`;
                    const updateResponse = await fetch(updateUrl, {
                        method: 'PUT',
                        headers: {
                            'Authorization': `Bearer ${accessToken}`,
                            'Content-Type': 'application/json'
                        },
                        body: JSON.stringify({
                            values: [correctHeaders]
                        })
                    });

                    if (updateResponse.ok) {
                        const updateResult = await updateResponse.json();
                        console.log(`✅ Headers fixed in payment sheet using tab name: ${tabName}`);
                        console.log(`Update result: ${JSON.stringify(updateResult)}`);
                        headerFixed = true;
                        break;
                    } else {
                        const errorText = await updateResponse.text();
                        console.warn(`Failed to fix headers with tab name "${tabName}": ${errorText}`);
                    }
                } catch (err) {
                    console.warn(`Error fixing headers with tab name "${tabName}":`, err);
                }
            }
            
            if (!headerFixed) {
                const errorText = `Failed to fix headers with any tab name variation`;
                console.error(`❌ ${errorText}`);
                // Don't throw - continue anyway, headers might be close enough
                console.warn(`⚠️ Continuing without header fix - data might be misaligned`);
            }
        } else {
            console.log('✅ Headers are already correct');
        }

        // Always update column widths to ensure headers display properly
        // This fixes the issue where headers look combined due to narrow columns
        try {
            const metadataUrl = `https://sheets.googleapis.com/v4/spreadsheets/${sheetId}`;
            const metadataResponse = await fetch(metadataUrl, {
                headers: { 'Authorization': `Bearer ${accessToken}` }
            });
            
            if (metadataResponse.ok) {
                const metadata = await metadataResponse.json();
                const actualTabNames = metadata.sheets?.map(s => s.properties.title) || [];
                const paymentTab = actualTabNames.find(t => t.toLowerCase() === sheetName.toLowerCase()) || 
                                 actualTabNames.find(t => t.toLowerCase().includes('payment')) || 
                                 sheetName;
                const paymentSheetId = metadata.sheets?.find(s => s.properties.title === paymentTab)?.properties.sheetId;
                
                if (paymentSheetId) {
                    const batchUpdateUrl = `https://sheets.googleapis.com/v4/spreadsheets/${sheetId}:batchUpdate`;
                    const columnWidths = [
                        { startIndex: 0, endIndex: 1, pixelSize: 150 },  // A: Payment ID
                        { startIndex: 1, endIndex: 2, pixelSize: 100 },   // B: Amount (USD)
                        { startIndex: 2, endIndex: 3, pixelSize: 80 },     // C: Currency
                        { startIndex: 3, endIndex: 4, pixelSize: 80 },    // D: Token
                        { startIndex: 4, endIndex: 5, pixelSize: 120 },   // E: Token Amount
                        { startIndex: 5, endIndex: 6, pixelSize: 200 },    // F: Order ID
                        { startIndex: 6, endIndex: 7, pixelSize: 180 },  // G: Merchant Address
                        { startIndex: 7, endIndex: 8, pixelSize: 100 },  // H: Status
                        { startIndex: 8, endIndex: 9, pixelSize: 250 },   // I: Transaction Signature
                        { startIndex: 9, endIndex: 10, pixelSize: 180 },  // J: Created At
                        { startIndex: 10, endIndex: 11, pixelSize: 180 }, // K: Confirmed At
                        { startIndex: 11, endIndex: 12, pixelSize: 150 }  // L: ZK Proof
                    ];
                    
                    const widthUpdateResponse = await fetch(batchUpdateUrl, {
                        method: 'POST',
                        headers: {
                            'Authorization': `Bearer ${accessToken}`,
                            'Content-Type': 'application/json'
                        },
                        body: JSON.stringify({
                            requests: [{
                                updateDimensionProperties: {
                                    range: {
                                        sheetId: paymentSheetId,
                                        dimension: 'COLUMNS',
                                        startIndex: 0,
                                        endIndex: 12
                                    },
                                    properties: {
                                        pixelSize: 150 // Default width
                                    },
                                    fields: 'pixelSize'
                                }
                            }, ...columnWidths.map((width, idx) => ({
                                updateDimensionProperties: {
                                    range: {
                                        sheetId: paymentSheetId,
                                        dimension: 'COLUMNS',
                                        startIndex: width.startIndex,
                                        endIndex: width.endIndex
                                    },
                                    properties: {
                                        pixelSize: width.pixelSize
                                    },
                                    fields: 'pixelSize'
                                }
                            }))]
                        })
                    });
                    
                    if (widthUpdateResponse.ok) {
                        console.log('✅ Column widths updated successfully');
                    } else {
                        const errorText = await widthUpdateResponse.text();
                        console.warn('⚠️ Could not update column widths:', errorText);
                    }
                }
            }
        } catch (err) {
            console.warn('⚠️ Error updating column widths:', err);
            // Don't fail if width update fails
        }

        return sheetId;
    } catch (error) {
        console.error('Failed to ensure payment sheet:', error);
        // Try to create a new sheet if the existing one fails
        try {
            console.log('Attempting to create new payment sheet...');
            return await createNewPaymentSheet(accessToken);
        } catch (createError) {
            throw new Error(`Failed to ensure or create payment sheet: ${createError.message}`);
        }
    }
}

/**
 * Check if a sheet tab exists
 */
async function checkSheetTabExists(sheetId, tabName, accessToken) {
    try {
        const metadataUrl = `https://sheets.googleapis.com/v4/spreadsheets/${sheetId}`;
        const response = await fetch(metadataUrl, {
            headers: { 'Authorization': `Bearer ${accessToken}` }
        });
        
        if (!response.ok) {
            return false;
        }
        
        const metadata = await response.json();
        return metadata.sheets?.some(s => s.properties.title === tabName) || false;
    } catch (error) {
        console.error('Error checking sheet tab:', error);
        return false;
    }
}

/**
 * Create a new sheet tab
 */
async function createSheetTab(sheetId, tabName, accessToken) {
    try {
        const batchUpdateUrl = `https://sheets.googleapis.com/v4/spreadsheets/${sheetId}:batchUpdate`;
        const response = await fetch(batchUpdateUrl, {
            method: 'POST',
            headers: {
                'Authorization': `Bearer ${accessToken}`,
                'Content-Type': 'application/json'
            },
            body: JSON.stringify({
                requests: [{
                    addSheet: {
                        properties: {
                            title: tabName,
                            gridProperties: {
                                rowCount: 1000,
                                columnCount: 12
                            }
                        }
                    }
                }]
            })
        });
        
        if (!response.ok) {
            const error = await response.text();
            throw new Error(`Failed to create sheet tab: ${error}`);
        }
        
        // Add headers to the new tab
        const headers = [
            'Payment ID', 'Amount (USD)', 'Currency', 'Token', 'Token Amount',
            'Order ID', 'Merchant Address', 'Status', 'Transaction Signature',
            'Created At', 'Confirmed At', 'ZK Proof'
        ];
        
        const headersUrl = `https://sheets.googleapis.com/v4/spreadsheets/${sheetId}/values/${tabName}!A1:L1?valueInputOption=RAW`;
        await fetch(headersUrl, {
            method: 'PUT',
            headers: {
                'Authorization': `Bearer ${accessToken}`,
                'Content-Type': 'application/json'
            },
            body: JSON.stringify({ values: [headers] })
        });
        
        console.log(`✅ Created sheet tab "${tabName}" with headers`);
        return true;
    } catch (error) {
        console.error('Failed to create sheet tab:', error);
        throw error;
    }
}

