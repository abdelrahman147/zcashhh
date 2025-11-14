const fetch = require('node-fetch');

exports.handler = async (event, context) => {
    // Handle OPTIONS preflight
    if (event.httpMethod === 'OPTIONS') {
        return {
            statusCode: 200,
            headers: {
                'Access-Control-Allow-Origin': '*',
                'Access-Control-Allow-Headers': 'Content-Type',
                'Access-Control-Allow-Methods': 'POST, OPTIONS'
            },
            body: ''
        };
    }
    
    if (event.httpMethod !== 'POST') {
        return {
            statusCode: 405,
            headers: {
                'Access-Control-Allow-Origin': '*',
                'Access-Control-Allow-Headers': 'Content-Type',
                'Access-Control-Allow-Methods': 'POST, OPTIONS',
                'Content-Type': 'application/json'
            },
            body: JSON.stringify({ error: 'Method not allowed' })
        };
    }

    try {
        const { method, params } = JSON.parse(event.body || '{}');
        
        if (!method || typeof method !== 'string') {
            return {
                statusCode: 400,
                headers: {
                    'Access-Control-Allow-Origin': '*',
                    'Content-Type': 'application/json'
                },
                body: JSON.stringify({ error: 'Method is required and must be a string' })
            };
        }
        
        // ALLOWED METHODS - Security check (expanded to include shielded address methods)
        const allowedMethods = [
            'getinfo', 'getblockchaininfo', 'getnetworkinfo', 'getblock', 
            'getrawtransaction', 'getbalance', 'listtransactions',
            'z_getnewaddress', 'z_listaddresses', 'z_getbalance', 'z_listunspent',
            'z_sendmany', 'z_shieldcoinbase', 'z_getoperationstatus', 'z_getoperationresult'
        ];
        if (!allowedMethods.includes(method.toLowerCase())) {
            return {
                statusCode: 403,
                headers: {
                    'Access-Control-Allow-Origin': '*',
                    'Content-Type': 'application/json'
                },
                body: JSON.stringify({ error: `Method ${method} not allowed` })
            };
        }
        
        const ZCASH_RPC_URL = process.env.ZCASH_RPC_URL || 'https://zec.nownodes.io';
        const ZCASH_RPC_USER = process.env.ZCASH_RPC_USER || process.env.VITE_ZCASH_RPC_USER || '';
        
        const rpcUrl = ZCASH_RPC_USER ? `${ZCASH_RPC_URL}/${ZCASH_RPC_USER}` : ZCASH_RPC_URL;
        
        const controller = new AbortController();
        const timeoutId = setTimeout(() => controller.abort(), 15000);
        
        try {
            const response = await fetch(rpcUrl, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json'
                },
                body: JSON.stringify({
                    jsonrpc: '2.0',
                    id: 1,
                    method: method,
                    params: params || []
                }),
                signal: controller.signal
            });
            
            clearTimeout(timeoutId);
            
            if (!response.ok) {
                const errorText = await response.text();
            return {
                statusCode: response.status,
                headers: {
                    'Access-Control-Allow-Origin': '*',
                    'Content-Type': 'application/json'
                },
                body: JSON.stringify({ 
                    error: `RPC HTTP ${response.status}: ${errorText}`,
                    result: null
                })
            };
            }
            
            const data = await response.json();
            
            if (data.error) {
                return {
                    statusCode: 400,
                    headers: {
                        'Access-Control-Allow-Origin': '*',
                        'Content-Type': 'application/json'
                    },
                    body: JSON.stringify({ 
                        error: `RPC error: ${data.error.message || JSON.stringify(data.error)}` 
                    })
                };
            }
            
            return {
                statusCode: 200,
                headers: {
                    'Access-Control-Allow-Origin': '*',
                    'Content-Type': 'application/json'
                },
                body: JSON.stringify({ result: data.result })
            };
        } catch (fetchError) {
            clearTimeout(timeoutId);
            if (fetchError.name === 'AbortError') {
                return {
                    statusCode: 504,
                    headers: {
                        'Access-Control-Allow-Origin': '*',
                        'Content-Type': 'application/json'
                    },
                    body: JSON.stringify({ error: 'RPC request timeout' })
                };
            }
            throw fetchError;
        }
    } catch (error) {
        console.error('Zcash RPC proxy error:', error);
        return {
            statusCode: 500,
            headers: {
                'Access-Control-Allow-Origin': '*',
                'Content-Type': 'application/json'
            },
            body: JSON.stringify({ 
                error: `Proxy error: ${error.message}` 
            })
        };
    }
};

