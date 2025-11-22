const fetch = require('node-fetch');

exports.handler = async (event, context) => {
    // Handle OPTIONS preflight
    if (event.httpMethod === 'OPTIONS') {
        return {
            statusCode: 200,
            headers: {
                'Access-Control-Allow-Origin': '*',
                'Access-Control-Allow-Headers': 'Content-Type',
                'Access-Control-Allow-Methods': 'GET, OPTIONS'
            },
            body: ''
        };
    }
    
    if (event.httpMethod !== 'GET') {
        return {
            statusCode: 405,
            headers: {
                'Access-Control-Allow-Origin': '*',
                'Content-Type': 'application/json'
            },
            body: JSON.stringify({ error: 'Method not allowed' })
        };
    }

    try {
        // Extract path from event - handle different path formats
        let path = event.path;
        if (path.includes('/api/proxy/coingecko/')) {
            path = path.replace('/api/proxy/coingecko/', '');
        } else if (path.includes('/.netlify/functions/coingecko-proxy/')) {
            path = path.replace('/.netlify/functions/coingecko-proxy/', '');
        } else if (path.startsWith('/coingecko-proxy/')) {
            path = path.replace('/coingecko-proxy/', '');
        }
        
        // Build query string from parameters
        const queryParams = new URLSearchParams();
        if (event.queryStringParameters) {
            Object.keys(event.queryStringParameters).forEach(key => {
                queryParams.append(key, event.queryStringParameters[key]);
            });
        }
        const queryString = queryParams.toString() ? `?${queryParams.toString()}` : '';
        
        const url = `https://api.coingecko.com/api/v3/${path}${queryString}`;
        console.log(`🔍 CoinGecko proxy calling: ${url}`);
        
        const controller = new AbortController();
        const timeoutId = setTimeout(() => controller.abort(), 10000);
        
        const response = await fetch(url, {
            headers: {
                'Accept': 'application/json',
                'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36'
            },
            signal: controller.signal
        });
        
        clearTimeout(timeoutId);
        
        if (!response.ok) {
            const errorText = await response.text();
            console.error(`❌ CoinGecko API error ${response.status}: ${errorText}`);
            return {
                statusCode: response.status,
                headers: {
                    'Access-Control-Allow-Origin': '*',
                    'Content-Type': 'application/json'
                },
                body: JSON.stringify({ 
                    error: 'CoinGecko API error',
                    status: response.status,
                    details: errorText
                })
            };
        }
        
        const data = await response.json();
        console.log(`✅ CoinGecko response received for ${path}`);
        
        return {
            statusCode: 200,
            headers: {
                'Access-Control-Allow-Origin': '*',
                'Content-Type': 'application/json'
            },
            body: JSON.stringify(data)
        };
    } catch (error) {
        console.error('❌ CoinGecko proxy error:', error);
        return {
            statusCode: 500,
            headers: {
                'Access-Control-Allow-Origin': '*',
                'Content-Type': 'application/json'
            },
            body: JSON.stringify({ 
                error: error.message,
                stack: process.env.NODE_ENV === 'development' ? error.stack : undefined
            })
        };
    }
};


            };
        }
        
        const data = await response.json();
        console.log(`✅ CoinGecko response received for ${path}`);
        
        return {
            statusCode: 200,
            headers: {
                'Access-Control-Allow-Origin': '*',
                'Content-Type': 'application/json'
            },
            body: JSON.stringify(data)
        };
    } catch (error) {
        console.error('❌ CoinGecko proxy error:', error);
        return {
            statusCode: 500,
            headers: {
                'Access-Control-Allow-Origin': '*',
                'Content-Type': 'application/json'
            },
            body: JSON.stringify({ 
                error: error.message,
                stack: process.env.NODE_ENV === 'development' ? error.stack : undefined
            })
        };
    }
};

