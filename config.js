// Default configuration - can be overridden by environment variables
const CONFIG = {
    GOOGLE_SHEETS: {
        SHEET_ID: '1apjUM4vb-6TUx4cweIThML5TIKBg8E7HjLlaZyiw1e8',
        API_KEY: null // Not needed - using service account
    },
    SOLANA_RPC: [
        // PREMIUM ENDPOINTS (with API keys) - Try these first
        'https://solana-mainnet.g.alchemy.com/v2/xXPi6FAKVWJqv9Ie5TgvOHQgTlrlfbp5', // Alchemy (your API key)
        'https://solana-mainnet.infura.io/v3/99ccf21fb60b46f994ba7af18b8fdc23', // Infura (your API key)
        // Official Solana RPCs
        'https://api.mainnet-beta.solana.com',
        'https://solana-api.projectserum.com',
        // Public RPCs
        'https://rpc.ankr.com/solana',
        'https://solana.public-rpc.com',
        // Additional providers
        'https://solana-mainnet.quicknode.com',
        'https://mainnet.helius-rpc.com',
        'https://solana-mainnet.g.alchemy.com/v2/demo', // Alchemy demo (fallback)
        'https://solana-mainnet-rpc.allthatnode.com',
        'https://ssc-dao.genesysgo.net',
    ],
    ZCASH_RPC: {
        URL: 'https://zec.nownodes.io',
        USER: null,
        PASSWORD: ''
    },
    STAKING_POOL_ADDRESS: null // Must be set from real API - no test data
};

if (typeof window !== 'undefined') {
    window.CONFIG = CONFIG;
}
