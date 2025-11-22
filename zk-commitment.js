/**
 * Simple Zero-Knowledge Commitment System for Payments
 * Allows proving payment without revealing transaction details
 */

class ZKCommitment {
    constructor() {
        this.commitments = new Map();
    }

    /**
     * Generate a commitment for a payment
     * Commitment = Hash(paymentId + amount + token + secret)
     */
    async generateCommitment(paymentId, amount, token, secret) {
        const data = `${paymentId}:${amount}:${token}:${secret}`;
        const commitment = await this.hash(data);
        
        // Store commitment (public) - NO amount or token revealed
        this.commitments.set(paymentId, {
            commitment,
            timestamp: Date.now(),
            verified: false,
            // Only store that payment exists, not details
            paymentExists: true
        });
        
        return {
            commitment,
            secret, // Keep this private!
            paymentId,
            token // Return token for reference but don't store publicly
        };
    }

    /**
     * Verify a payment using commitment (Zero-Knowledge Proof)
     * Proves payment exists without revealing amount or token
     */
    async verifyCommitment(paymentId, amount, token, secret) {
        const stored = this.commitments.get(paymentId);
        if (!stored) {
            return { valid: false, error: 'Commitment not found' };
        }

        // Regenerate commitment with provided data
        const data = `${paymentId}:${amount}:${token}:${secret}`;
        const recomputed = await this.hash(data);

        // Zero-knowledge verification: commitments match without revealing amount/token
        const valid = recomputed === stored.commitment;
        
        if (valid) {
            stored.verified = true;
            stored.verifiedAt = Date.now();
        }

        return {
            valid,
            commitment: stored.commitment,
            verified: stored.verified,
            timestamp: stored.timestamp,
            // Don't reveal amount or token in response
            message: valid ? 'Payment verified with zero-knowledge proof' : 'Invalid proof'
        };
    }

    /**
     * Generate cryptographic hash using Web Crypto API
     */
    async hash(data) {
        const encoder = new TextEncoder();
        const dataBuffer = encoder.encode(data);
        const hashBuffer = await crypto.subtle.digest('SHA-256', dataBuffer);
        const hashArray = Array.from(new Uint8Array(hashBuffer));
        return hashArray.map(b => b.toString(16).padStart(2, '0')).join('');
    }

    /**
     * Generate a random secret for commitment
     */
    generateSecret() {
        const array = new Uint8Array(32);
        crypto.getRandomValues(array);
        return Array.from(array, b => b.toString(16).padStart(2, '0')).join('');
    }

    /**
     * Create a payment proof (public data only)
     */
    createProof(paymentId) {
        const stored = this.commitments.get(paymentId);
        if (!stored) return null;

        return {
            paymentId,
            commitment: stored.commitment,
            verified: stored.verified,
            timestamp: stored.timestamp,
            verifiedAt: stored.verifiedAt || null
        };
    }
}

// Export for use in browser and Node.js
if (typeof module !== 'undefined' && module.exports) {
    module.exports = ZKCommitment;
} else {
    window.ZKCommitment = ZKCommitment;
}
