const CONFIG = {
    GOOGLE_SHEETS: {
        SHEET_ID: 'YOUR_GOOGLE_SHEET_ID',
        API_KEY: 'YOUR_GOOGLE_SHEETS_API_KEY'
    },
    SOLANA_RPC: [
        'https://api.mainnet-beta.solana.com',
        'https://rpc.ankr.com/solana',
        'https://solana.public-rpc.com'
    ],
    ZCASH_RPC: {
        URL: 'https://zec.nownodes.io',
        USER: 'YOUR_NOWNODES_API_KEY',
        PASSWORD: ''
    }
};

if (typeof window !== 'undefined') {
    window.CONFIG = CONFIG;
}

