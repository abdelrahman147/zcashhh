# Netlify Deployment Setup

## Environment Variables

In your Netlify dashboard, go to Site settings > Environment variables and add:

```
ZCASH_RPC_URL=https://zec.nownodes.io
ZCASH_RPC_USER=302b8045-dc7d-4e77-9ba8-b87b8fb4937b
```

## Auto-Deployment

Netlify will automatically deploy when you push to GitHub.

## Function Deployment

The Zcash RPC proxy is deployed as a Netlify Function at `/api/zcash-rpc`.

The frontend automatically detects Netlify deployment and uses the function endpoint.

