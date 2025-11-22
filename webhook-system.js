
class WebhookSystem {
    constructor(baseUrl) {
        this.baseUrl = baseUrl || window.location.origin;
        this.webhooks = new Map();
        this.eventQueue = [];
        this.retryAttempts = 3;
        this.retryDelay = 5000; // 5 seconds
    }
    
    // Register webhook
    async registerWebhook(config) {
        const {
            url,
            events = ['payment.created', 'payment.verified', 'payment.failed'],
            secret = null,
            active = true
        } = config;
        
        const webhook = {
            id: `wh_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
            url: url,
            events: events,
            secret: secret,
            active: active,
            createdAt: Date.now(),
            lastTriggered: null,
            successCount: 0,
            failureCount: 0
        };
        
        this.webhooks.set(webhook.id, webhook);
        
        // Save to backend
        await this.saveWebhook(webhook);
        
        return webhook;
    }
    
    async saveWebhook(webhook) {
        try {
            await fetch(`${this.baseUrl}/api/webhooks`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(webhook)
            });
        } catch (error) {
            console.warn('Failed to save webhook:', error);
        }
    }
    
    // Trigger webhook
    async triggerWebhook(webhookId, event, data) {
        const webhook = this.webhooks.get(webhookId);
        
        if (!webhook || !webhook.active) {
            return { success: false, error: 'Webhook not found or inactive' };
        }
        
        if (!webhook.events.includes(event)) {
            return { success: false, error: 'Event not subscribed' };
        }
        
        const payload = {
            event: event,
            data: data,
            timestamp: Date.now(),
            webhookId: webhookId
        };
        
        // Sign payload if secret exists
        if (webhook.secret) {
            payload.signature = await this.signPayload(payload, webhook.secret);
        }
        
        // Send webhook
        return await this.sendWebhook(webhook, payload);
    }
    
    async signPayload(payload, secret) {
        const encoder = new TextEncoder();
        const data = encoder.encode(JSON.stringify(payload));
        const key = await crypto.subtle.importKey(
            'raw',
            encoder.encode(secret),
            { name: 'HMAC', hash: 'SHA-256' },
            false,
            ['sign']
        );
        const signature = await crypto.subtle.sign('HMAC', key, data);
        return Array.from(new Uint8Array(signature))
            .map(b => b.toString(16).padStart(2, '0'))
            .join('');
    }
    
    async sendWebhook(webhook, payload, attempt = 1) {
        try {
            const response = await fetch(webhook.url, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    'User-Agent': 'SolanaPaymentOracle/1.0'
                },
                body: JSON.stringify(payload),
                signal: AbortSignal.timeout(10000) // 10 second timeout
            });
            
            const success = response.ok;
            
            if (success) {
                webhook.successCount++;
                webhook.lastTriggered = Date.now();
            } else {
                webhook.failureCount++;
                
                // Retry if not last attempt
                if (attempt < this.retryAttempts) {
                    await this.delay(this.retryDelay * attempt);
                    return await this.sendWebhook(webhook, payload, attempt + 1);
                }
            }
            
            this.webhooks.set(webhook.id, webhook);
            await this.saveWebhook(webhook);
            
            return { success, status: response.status };
        } catch (error) {
            webhook.failureCount++;
            
            // Retry on network errors
            if (attempt < this.retryAttempts && error.name !== 'AbortError') {
                await this.delay(this.retryDelay * attempt);
                return await this.sendWebhook(webhook, payload, attempt + 1);
            }
            
            this.webhooks.set(webhook.id, webhook);
            await this.saveWebhook(webhook);
            
            return { success: false, error: error.message };
        }
    }
    
    // Trigger webhooks for event
    async triggerEvent(event, data) {
        const results = [];
        
        for (const [id, webhook] of this.webhooks.entries()) {
            if (webhook.active && webhook.events.includes(event)) {
                const result = await this.triggerWebhook(id, event, data);
                results.push({ webhookId: id, ...result });
            }
        }
        
        return results;
    }
    
    // Get webhook
    getWebhook(webhookId) {
        return this.webhooks.get(webhookId);
    }
    
    // List webhooks
    listWebhooks() {
        return Array.from(this.webhooks.values());
    }
    
    // Delete webhook
    async deleteWebhook(webhookId) {
        this.webhooks.delete(webhookId);
        
        try {
            await fetch(`${this.baseUrl}/api/webhooks/${webhookId}`, {
                method: 'DELETE'
            });
        } catch (error) {
            console.warn('Failed to delete webhook:', error);
        }
    }
    
    delay(ms) {
        return new Promise(resolve => setTimeout(resolve, ms));
    }
}

// Export
if (typeof window !== 'undefined') {
    window.WebhookSystem = WebhookSystem;
}

if (typeof module !== 'undefined' && module.exports) {
    module.exports = WebhookSystem;
}

