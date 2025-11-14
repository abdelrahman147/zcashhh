const https = require('https');
const fs = require('fs');

const NETLIFY_SITE_ID = process.env.NETLIFY_SITE_ID || '';
const NETLIFY_ACCESS_TOKEN = process.env.NETLIFY_ACCESS_TOKEN || '';

const envVars = {
    ZCASH_RPC_URL: 'https://zec.nownodes.io',
    ZCASH_RPC_USER: '302b8045-dc7d-4e77-9ba8-b87b8fb4937b'
};

if (!NETLIFY_SITE_ID || !NETLIFY_ACCESS_TOKEN) {
    console.log('NETLIFY_SITE_ID and NETLIFY_ACCESS_TOKEN environment variables are required.');
    console.log('Get them from: https://app.netlify.com/user/applications');
    console.log('\nTo set environment variables manually:');
    console.log('1. Go to https://app.netlify.com');
    console.log('2. Select your site');
    console.log('3. Go to Site settings > Environment variables');
    console.log('4. Add the following:');
    Object.entries(envVars).forEach(([key, value]) => {
        console.log(`   ${key} = ${value}`);
    });
    process.exit(1);
}

function setEnvVar(siteId, accessToken, key, value) {
    return new Promise((resolve, reject) => {
        const data = JSON.stringify({
            key: key,
            values: [{
                value: value,
                context: 'all',
                context_parameter: null
            }]
        });

        const options = {
            hostname: 'api.netlify.com',
            path: `/api/v1/sites/${siteId}/env`,
            method: 'POST',
            headers: {
                'Authorization': `Bearer ${accessToken}`,
                'Content-Type': 'application/json',
                'Content-Length': data.length
            }
        };

        const req = https.request(options, (res) => {
            let body = '';
            res.on('data', (chunk) => {
                body += chunk;
            });
            res.on('end', () => {
                if (res.statusCode >= 200 && res.statusCode < 300) {
                    resolve(JSON.parse(body));
                } else {
                    reject(new Error(`HTTP ${res.statusCode}: ${body}`));
                }
            });
        });

        req.on('error', reject);
        req.write(data);
        req.end();
    });
}

async function main() {
    console.log('Setting Netlify environment variables...');
    
    for (const [key, value] of Object.entries(envVars)) {
        try {
            console.log(`Setting ${key}...`);
            await setEnvVar(NETLIFY_SITE_ID, NETLIFY_ACCESS_TOKEN, key, value);
            console.log(`✓ ${key} set successfully`);
        } catch (error) {
            console.error(`✗ Failed to set ${key}:`, error.message);
        }
    }
    
    console.log('\nDone! Redeploy your site for changes to take effect.');
}

main().catch(console.error);


