# Setting Netlify Environment Variables

## Method 1: Netlify Dashboard (Recommended)

1. Go to https://app.netlify.com
2. Select your site (zoracle)
3. Go to **Site settings** > **Environment variables**
4. Click **Add a variable**
5. Add these variables:

```
ZCASH_RPC_URL = https://zec.nownodes.io
ZCASH_RPC_USER = 302b8045-dc7d-4e77-9ba8-b87b8fb4937b
```

6. Click **Save**
7. Go to **Deploys** tab and click **Trigger deploy** > **Deploy site**

## Method 2: Netlify CLI

If you have Netlify CLI installed:

```bash
netlify env:set ZCASH_RPC_URL "https://zec.nownodes.io"
netlify env:set ZCASH_RPC_USER "302b8045-dc7d-4e77-9ba8-b87b8fb4937b"
```

## Method 3: Using the Script

1. Get your Netlify Access Token from https://app.netlify.com/user/applications
2. Get your Site ID from Site settings > General > Site details
3. Run:

```bash
export NETLIFY_SITE_ID="your-site-id"
export NETLIFY_ACCESS_TOKEN="your-access-token"
npm run set-netlify-env
```

## Verify

After setting the variables, check the function logs in Netlify to ensure the API key is being read correctly.

