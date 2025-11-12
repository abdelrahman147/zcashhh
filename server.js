require('dotenv').config();
const express = require('express');
const cors = require('cors');
const fetch = require('node-fetch');
const path = require('path');

const app = express();
const PORT = process.env.PORT || 3001;

app.use(cors({
    origin: '*',
    methods: ['GET', 'POST', 'OPTIONS'],
    allowedHeaders: ['Content-Type', 'Authorization']
}));

app.options('*', (req, res) => {
    res.header('Access-Control-Allow-Origin', '*');
    res.header('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
    res.header('Access-Control-Allow-Headers', 'Content-Type, Authorization');
    res.sendStatus(200);
});

app.use(express.json());
app.use(express.static('.'));

const ZCASH_RPC_URL = process.env.ZCASH_RPC_URL || 'https://zec.nownodes.io';
const ZCASH_RPC_USER = process.env.ZCASH_RPC_USER || '302b8045-dc7d-4e77-9ba8-b87b8fb4937b';

app.post('/api/zcash-rpc', async (req, res) => {
    try {
        const { method, params } = req.body;
        
        if (!method) {
            return res.status(400).json({ error: 'Method is required' });
        }
        
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
                return res.status(response.status).json({ 
                    error: `RPC HTTP ${response.status}: ${errorText}` 
                });
            }
            
            const data = await response.json();
            
            if (data.error) {
                return res.status(400).json({ 
                    error: `RPC error: ${data.error.message || JSON.stringify(data.error)}` 
                });
            }
            
            res.json({ result: data.result });
        } catch (fetchError) {
            clearTimeout(timeoutId);
            if (fetchError.name === 'AbortError') {
                return res.status(504).json({ error: 'RPC request timeout' });
            }
            throw fetchError;
        }
    } catch (error) {
        console.error('Zcash RPC proxy error:', error);
        res.status(500).json({ 
            error: `Proxy error: ${error.message}` 
        });
    }
});

app.get('/health', (req, res) => {
    res.json({ status: 'ok', service: 'zcash-rpc-proxy' });
});

app.listen(PORT, () => {
    console.log(`Zcash RPC Proxy server running on http://localhost:${PORT}`);
    console.log(`Zcash RPC endpoint: ${ZCASH_RPC_URL}`);
    console.log(`API Key configured: ${ZCASH_RPC_USER ? 'Yes' : 'No'}`);
});
