# Netlify Deployment Setup

## Environment Variables

In your Netlify dashboard, go to Site settings > Environment variables and add:

```
ZCASH_RPC_URL=https://zec.nownodes.io
ZCASH_RPC_USER=302b8045-dc7d-4e77-9ba8-b87b8fb4937b
```

**IMPORTANT:** Make sure to set these as environment variables in Netlify, not in the code. The function reads from `process.env`.

## Auto-Deployment

Netlify will automatically deploy when you push to GitHub.

## Function Deployment

The Zcash RPC proxy is deployed as a Netlify Function at `/api/zcash-rpc`.

The frontend automatically detects Netlify deployment and uses the function endpoint.

## Troubleshooting

If you see "Missing API_key" errors:
1. Go to Netlify Dashboard > Your Site > Site settings > Environment variables
2. Add `ZCASH_RPC_USER` with your Nownodes API key
3. Redeploy the site (or wait for auto-deploy)

