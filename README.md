# ZK-PayLink API

**Privacy-Preserving Payment Gateway on Solana**

Accept payments in SOL, USDC, USDT, and EURC with zero-knowledge proof privacy.

🔗 **Live API**: [zk-paylink.xyz/api](https://zk-paylink.xyz/api)

---

## What is ZK-PayLink?

A payment gateway API that lets you accept cryptocurrency payments while protecting transaction privacy using zero-knowledge proofs.

### Key Features

🔐 **Zero-Knowledge Privacy**
- Payment amounts hidden in cryptographic commitments
- Verify payments without revealing transaction details

💰 **Multi-Token Support**
- SOL, USDC, USDT, EURC on Solana

⚡ **Simple REST API**
- Create payment requests
- Check payment status
- Webhook notifications

---

## API Documentation

### Base URL
```
https://zk-paylink.xyz/api
```

### Create Payment

**Endpoint**: `POST /payments`

**Request**:
```bash
curl -X POST https://zk-paylink.xyz/api/payments \
  -H "Content-Type: application/json" \
  -d '{
    "amount": 100,
    "currency": "USD",
    "token": "USDT",
    "merchantAddress": "YOUR_SOLANA_ADDRESS"
  }'
```

**Response**:
```json
{
  "success": true,
  "payment": {
    "id": "pay_1234567890_abc123",
    "amount": 100,
    "currency": "USD",
    "token": "USDT",
    "tokenAmount": 100.5,
    "orderId": "ORDER-1234567890-ABC123",
    "status": "pending",
    "createdAt": 1700000000000,
    "expiresAt": 1700000900000,
    "merchantAddress": "YOUR_SOLANA_ADDRESS",
    "paymentUrl": "https://zk-paylink.xyz/pay/pay_1234567890_abc123"
  }
}
```

### Check Payment Status

**Endpoint**: `GET /payments/{paymentId}`

**Request**:
```bash
curl https://zk-paylink.xyz/api/payments/pay_1234567890_abc123
```

**Response**:
```json
{
  "paymentId": "pay_1234567890_abc123",
  "status": "verified",
  "amount": 100,
  "currency": "USD",
  "token": "USDT",
  "tokenAmount": 100.5,
  "merchantAddress": "YOUR_SOLANA_ADDRESS",
  "orderId": "ORDER-1234567890-ABC123",
  "createdAt": 1700000000000,
  "confirmedAt": 1700000050000,
  "transactionSignature": "4mQvH...",
  "zkCommitment": "7f3d8e9a2b1c4f5e...",
  "zkEnabled": true,
  "paymentUrl": "https://zk-paylink.xyz/pay/pay_1234567890_abc123"
}
```

### Payment Status Values

- `pending` - Waiting for payment
- `verified` - Payment confirmed on blockchain

---

## Zero-Knowledge Privacy

### How It Works

When a payment is verified:
1. System generates cryptographic commitment: `Hash(paymentID + amount + token + secret)`
2. Only the commitment hash is stored publicly
3. Payment details remain private
4. Merchant receives confirmation without exposing transaction to third parties

### Privacy Benefits

- ✅ Payment amounts hidden
- ✅ Token types protected  
- ✅ Selective disclosure
- ✅ Cryptographically secure (SHA-256)

---

## Integration Examples

### Node.js

```javascript
const axios = require('axios');

// Create payment
const createPayment = async () => {
  const response = await axios.post('https://zk-paylink.xyz/api/payments', {
    amount: 100,
    currency: 'USD',
    token: 'USDT',
    merchantAddress: 'YOUR_SOLANA_ADDRESS'
  });
  
  console.log('Payment URL:', response.data.payment.paymentUrl);
  return response.data.payment.id;
};

// Check payment status
const checkPayment = async (paymentId) => {
  const response = await axios.get(`https://zk-paylink.xyz/api/payments/${paymentId}`);
  console.log('Status:', response.data.status);
  return response.data;
};
```

### Python

```python
import requests

# Create payment
def create_payment():
    response = requests.post('https://zk-paylink.xyz/api/payments', json={
        'amount': 100,
        'currency': 'USD',
        'token': 'USDT',
        'merchantAddress': 'YOUR_SOLANA_ADDRESS'
    })
    data = response.json()
    print(f"Payment URL: {data['payment']['paymentUrl']}")
    return data['payment']['id']

# Check payment status
def check_payment(payment_id):
    response = requests.get(f'https://zk-paylink.xyz/api/payments/{payment_id}')
    data = response.json()
    print(f"Status: {data['status']}")
    return data
```

### PHP

```php
<?php
// Create payment
function createPayment() {
    $ch = curl_init('https://zk-paylink.xyz/api/payments');
    curl_setopt($ch, CURLOPT_POST, 1);
    curl_setopt($ch, CURLOPT_POSTFIELDS, json_encode([
        'amount' => 100,
        'currency' => 'USD',
        'token' => 'USDT',
        'merchantAddress' => 'YOUR_SOLANA_ADDRESS'
    ]));
    curl_setopt($ch, CURLOPT_HTTPHEADER, ['Content-Type: application/json']);
    curl_setopt($ch, CURLOPT_RETURNTRANSFER, true);
    
    $response = curl_exec($ch);
    curl_close($ch);
    
    $data = json_decode($response, true);
    echo "Payment URL: " . $data['payment']['paymentUrl'] . "\n";
    return $data['payment']['id'];
}

// Check payment status
function checkPayment($paymentId) {
    $ch = curl_init("https://zk-paylink.xyz/api/payments/$paymentId");
    curl_setopt($ch, CURLOPT_RETURNTRANSFER, true);
    
    $response = curl_exec($ch);
    curl_close($ch);
    
    $data = json_decode($response, true);
    echo "Status: " . $data['status'] . "\n";
    return $data;
}
?>
```

---

## Supported Tokens

| Token | Name | Decimals |
|-------|------|----------|
| SOL | Solana | 9 |
| USDC | USD Coin | 6 |
| USDT | Tether | 6 |
| EURC | Euro Coin | 6 |

---

## Error Handling

### Error Response Format

```json
{
  "error": "Error message description"
}
```

### Common Errors

- `400` - Invalid request (missing required fields)
- `404` - Payment not found
- `500` - Server error

---

## Rate Limits

- **100 requests per minute** per IP address
- Contact us for higher limits

---

## Security

- ✅ HTTPS only
- ✅ No API keys required for read operations
- ✅ Non-custodial (we never hold funds)
- ✅ Open source and auditable

---

## License

MIT License - See [LICENSE](LICENSE) file for details.

---

**Built with privacy in mind. Powered by Solana. Protected by zero-knowledge proofs.**
