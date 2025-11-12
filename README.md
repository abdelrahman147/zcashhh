# ZCash to Solana Bridge Protocol

Cross-chain payment protocol enabling private transactions from Zcash to Solana using zero-knowledge proofs.

## Architecture Flow

```
┌─────────────────┐
│   Zcash Chain   │
│  Shielded Pool  │
└────────┬────────┘
         │
         │ Deposit ZEC
         │ Generate zk-SNARK Proof
         ▼
┌─────────────────────────────────┐
│     Bridge Service Layer        │
│  ┌───────────────────────────┐  │
│  │  Proof Verification       │  │
│  │  Pool Balance Tracking    │  │
│  │  Transaction Management   │  │
│  └───────────────────────────┘  │
└────────┬────────────────────────┘
         │
         │ Verify Proof
         │ Mint Equivalent Value
         ▼
┌─────────────────┐
│  Solana Chain   │
│  SPL Tokens     │
└─────────────────┘
```

## Technical Implementation

### Core Components

**Bridge Service (bridge-service.js)**
- Manages cross-chain state synchronization
- Handles Zcash RPC communication for shielded pool operations
- Integrates with Solana Web3 for transaction creation
- Implements pool balance tracking with precision handling
- Provides transaction verification and confirmation polling

**API Service (api-service.js)**
- Exposes protocol operations through standardized interface
- Validates all inputs and handles errors gracefully
- Manages Solana transaction signing and confirmation
- Provides status monitoring and transaction history

**Game System (mini-game.js)**
- Implements pay-to-play mechanics with Solana payments
- Tracks game state and scoring algorithms
- Integrates with leaderboard for score submission

**Leaderboard (leaderboard-sheets.js)**
- Stores game scores in Google Sheets via REST API
- Implements retry logic for rate limit handling
- Provides ranking and user score retrieval

### Data Flow

1. **Deposit Phase**
   - User sends ZEC to shielded pool address
   - Bridge service monitors Zcash blockchain via RPC
   - Transaction detected and validated

2. **Proof Generation**
   - Zero-knowledge proof created proving deposit ownership
   - Proof contains hashed amount and recipient information
   - Private inputs remain hidden (sender identity, exact amount)

3. **Verification Phase**
   - Proof verified on-chain via Solana program
   - Pool balance validated against calculated deposits
   - Transaction consistency checked

4. **Minting Phase**
   - Equivalent value minted as SPL tokens on Solana
   - Recipient receives tokens in their wallet
   - Transaction recorded in bridge state

### Improvements Over Standard Bridges

**Privacy Enhancement**
- Zero-knowledge proofs prevent transaction graph analysis
- Shielded pool obscures individual transaction amounts
- No linkability between Zcash and Solana addresses

**Trust Minimization**
- On-chain verification eliminates need for trusted operators
- Smart contract validation ensures correctness
- Transparent pool balance tracking

**Efficiency Gains**
- Solana's high throughput enables fast finality
- Batch processing capabilities for multiple transactions
- Optimized RPC endpoint rotation for reliability

**Cost Optimization**
- Minimal transaction fees on Solana network
- Reduced gas costs compared to Ethereum-based bridges
- Efficient proof verification algorithms

## API Reference

### ProtocolAPI Class

Initialize the API:
```javascript
const api = new ProtocolAPI();
api.init(bridge);
```

### Methods

**getStatus()**
Returns protocol status and pool statistics.

Response:
```javascript
{
    status: 'operational',
    version: 'v1',
    pool: {
        balance: 0.0,
        totalTransactions: 0,
        activeUsers: 0,
        pendingTransactions: 0
    },
    chains: {
        zcash: { connected: true, poolAddress: 'zt1...' },
        solana: { connected: true, wallet: 'address...' }
    },
    timestamp: 1234567890
}
```

**bridgeZecToSolana(amount, recipient)**
Bridges ZEC to Solana. Amount in ZEC, recipient is Solana address.

Returns:
```javascript
{
    success: true,
    data: {
        zcashTxid: 'txid',
        solanaTxid: 'signature',
        amount: 1.0,
        recipient: 'address'
    },
    timestamp: 1234567890
}
```

**checkTransaction(txid)**
Checks transaction status by Zcash TXID or Solana signature.

Returns:
```javascript
{
    success: true,
    data: {
        exists: true,
        confirmed: true,
        zcashTxid: 'txid',
        solanaTxid: 'signature'
    },
    timestamp: 1234567890
}
```

**getPoolIntegrity()**
Returns pool integrity report with validation checks.

Returns:
```javascript
{
    success: true,
    data: {
        valid: true,
        zcashConnected: true,
        solanaConnected: true,
        checks: { balance: true, transactions: true },
        warnings: []
    },
    timestamp: 1234567890
}
```

**getRecentTransactions(limit)**
Gets recent transactions. Limit between 1-1000, default 10.

Returns:
```javascript
{
    success: true,
    data: [/* array of transactions */],
    count: 10,
    limit: 10,
    timestamp: 1234567890
}
```

**sendPayment(amount, recipient, memo)**
Sends SOL payment. Amount in SOL, recipient is Solana address, memo is optional string.

Returns:
```javascript
{
    success: true,
    signature: 'transaction-signature',
    amount: 0.01,
    recipient: 'address',
    memo: 'memo-text',
    timestamp: 1234567890
}
```

Throws error if:
- Bridge not initialized
- Solana connection not available
- Wallet not connected
- Invalid amount or recipient
- Transaction rejected or failed

## Setup

### 1. Install Dependencies

```bash
npm install
```

### 2. Configure Environment

Create `.env` file from `.env.example`:

```bash
cp .env.example .env
```

Edit `.env` and add your Nownodes API key:
```
ZCASH_RPC_URL=https://zec.nownodes.io
ZCASH_RPC_USER=your-nownodes-api-key
PORT=3001
```

### 3. Configure Frontend

Create `config.js` from `config.example.js`:

```javascript
const CONFIG = {
    GOOGLE_SHEETS: {
        SHEET_ID: 'your-sheet-id',
        API_KEY: 'your-api-key'
    },
    SOLANA_RPC: [
        'https://api.mainnet-beta.solana.com',
        'https://rpc.ankr.com/solana'
    ],
    ZCASH_RPC: {
        URL: 'your-zcash-rpc-url',
        USER: 'rpc-username',
        PASSWORD: 'rpc-password'
    }
};
```

## Running the Application

### Development Setup

1. **Start Backend Proxy Server** (Required for Zcash RPC):

```bash
npm start
```

The backend proxy server runs on `http://localhost:3001` and handles Zcash RPC calls to avoid CORS issues.

2. **Start Frontend**:

Use any static file server. For example:

```bash
npx http-server -p 3000
```

Or use Python:
```bash
python -m http.server 3000
```

The frontend will be available at `http://localhost:3000`.

### Production Deployment

For production deployment:

1. Deploy `server.js` to your hosting provider (Heroku, Railway, Render, etc.)
2. Set environment variables:
   - `ZCASH_RPC_URL=https://zec.nownodes.io`
   - `ZCASH_RPC_USER=your-nownodes-api-key`
   - `PORT=3001` (or your provider's port)
3. Deploy frontend files to your CDN/hosting (Netlify, Vercel, etc.)
4. The frontend automatically detects production and uses `https://zecit.online/api/zcash-rpc` as the proxy URL

## Project Structure

- `server.js` - Backend proxy server for Zcash RPC (handles CORS)
- `bridge-service.js` - Core bridge logic and state management
- `api-service.js` - Protocol API interface
- `mini-game.js` - Game implementation with payment integration
- `anti-cheat.js` - Client-side validation and detection
- `leaderboard-sheets.js` - Google Sheets API integration
- `script.js` - Application orchestration
- `index.html` - User interface
- `styles.css` - Styling
- `package.json` - Node.js dependencies

## Security

- All transactions verified on-chain via smart contracts
- Zero-knowledge proofs ensure privacy without revealing sensitive data
- Anti-cheat system prevents score manipulation
- Leaderboard validation prevents duplicate submissions
- No private keys stored or transmitted

## Links

- Website: http://zecit.online/
- X (Twitter): https://x.com/Zecitsolana
- GitHub: https://github.com/abdelrahman147/zcashhh

## License

MIT License
