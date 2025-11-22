# ZK-PayLink

**Privacy-Preserving Payment Gateway on Solana**

Accept payments in SOL, USDC, USDT, and EURC with zero-knowledge proof privacy.

🔗 **Live Demo**: [zk-paylink.xyz](https://zk-paylink.xyz)

---

## What is ZK-PayLink?

ZK-PayLink is a payment gateway that lets you accept cryptocurrency payments while protecting transaction privacy using zero-knowledge proofs.

### Key Features

🔐 **Zero-Knowledge Privacy**
- Payment amounts hidden in cryptographic commitments
- Verify payments without revealing transaction details
- Real SHA-256 cryptographic proofs

💰 **Multi-Token Support**
- SOL (Solana)
- USDC (USD Coin)
- USDT (Tether)
- EURC (Euro Coin)

⚡ **Fast & Simple**
- Instant payment verification
- QR code payments
- RESTful API
- No complex setup

---

## How It Works

### For Customers

1. **Scan QR Code** or click "Pay with Wallet"
2. **Approve transaction** in your Solana wallet
3. **Payment verified** instantly on blockchain
4. **Privacy protected** with zero-knowledge proof

### For Merchants

1. **Create payment request** via API
2. **Share payment link** with customer
3. **Receive confirmation** when paid
4. **Verify payment** without seeing blockchain details

---

## Zero-Knowledge Technology

### What is Zero-Knowledge?

Zero-knowledge proofs allow you to prove something is true without revealing the underlying information.

**Example**: Prove you paid $100 without showing the transaction to everyone.

### How We Use It

When a payment is completed:
1. System generates a cryptographic commitment: `Hash(paymentID + amount + token + secret)`
2. Only the hash is stored publicly
3. Merchant can verify payment using the commitment
4. Transaction details remain private

**Privacy Benefits**:
- ✅ Payment amounts hidden
- ✅ Token types protected
- ✅ Selective disclosure (share only with who needs to know)
- ✅ Verifiable without blockchain explorer

---

## API Usage

### Create Payment

```bash
POST https://zk-paylink.xyz/api/payments
Content-Type: application/json

{
  "amount": 100,
  "currency": "USD",
  "token": "USDT",
  "merchantAddress": "YOUR_SOLANA_ADDRESS"
}
```

**Response**:
```json
{
  "success": true,
  "payment": {
    "id": "pay_123...",
    "amount": 100,
    "token": "USDT",
    "tokenAmount": 100.5,
    "status": "pending",
    "paymentUrl": "https://zk-paylink.xyz/pay/pay_123...",
    "merchantAddress": "YOUR_SOLANA_ADDRESS"
  }
}
```

### Check Payment Status

```bash
GET https://zk-paylink.xyz/api/payments/{paymentId}
```

**Response**:
```json
{
  "paymentId": "pay_123...",
  "status": "verified",
  "amount": 100,
  "token": "USDT",
  "zkCommitment": "7f3d8e9a2b1c...",
  "zkEnabled": true,
  "confirmedAt": "2025-11-21T15:56:10.000Z"
}
```

---

## Use Cases

### E-Commerce
Accept crypto payments on your online store with privacy protection.

### Subscription Services
Recurring payments with transaction privacy.

### Peer-to-Peer
Private payments between individuals.

### B2B Transactions
Business payments without exposing amounts to competitors.

---

## Supported Wallets

- Phantom
- Solflare
- Backpack
- Any Solana-compatible wallet

---

## Security

- ✅ **Cryptographic commitments** using SHA-256
- ✅ **Blockchain verification** on Solana mainnet
- ✅ **No private keys stored** - non-custodial
- ✅ **Open source** - auditable code

---

## Getting Started

### For Merchants

1. Visit [zk-paylink.xyz](https://zk-paylink.xyz)
2. Connect your Solana wallet
3. Create a payment request
4. Share the payment link with your customer

### For Developers

Check out our [API Documentation](https://zk-paylink.xyz/api-docs) for integration guides.

---

## Demo

Try the interactive zero-knowledge proof demo:
👉 [zk-paylink.xyz/zk-demo.html](https://zk-paylink.xyz/zk-demo.html)

See how commitments are generated and verified without revealing payment details.

---

## FAQ

**Q: Is this really private?**  
A: Yes. Payment amounts and tokens are hidden in cryptographic commitments. Only those with the secret can verify the details.

**Q: Can I use this for my business?**  
A: Absolutely! Use our API to integrate ZK-PayLink into your application.

**Q: What fees do you charge?**  
A: Only standard Solana network fees (typically < $0.01). No platform fees.

**Q: Is my wallet safe?**  
A: Yes. We never store private keys. All transactions are signed in your wallet.

**Q: Which tokens are supported?**  
A: SOL, USDC, USDT, and EURC on Solana mainnet.

---

## Links

- 🌐 **Website**: [zk-paylink.xyz](https://zk-paylink.xyz)
- 📚 **API Docs**: [zk-paylink.xyz/api-docs](https://zk-paylink.xyz/api-docs)
- 🔐 **ZK Demo**: [zk-paylink.xyz/zk-demo.html](https://zk-paylink.xyz/zk-demo.html)

---

## License

MIT License - Free to use for personal and commercial projects.

---

## Support

Need help? Open an issue or contact us through the website.

---

**Built with privacy in mind. Powered by Solana. Protected by zero-knowledge proofs.**
