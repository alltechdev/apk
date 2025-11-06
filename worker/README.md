# Cloudflare Worker - APK Builder Proxy

This serverless function acts as a proxy between the frontend and GitHub API, eliminating the need for users to authenticate.

## How It Works

1. User fills form on GitHub Pages
2. Frontend sends build request to Cloudflare Worker
3. Worker creates GitHub issue using server-side token
4. GitHub Actions builds APK automatically
5. User gets download link

## Deployment

### Prerequisites
- Cloudflare account (free tier works)
- GitHub Personal Access Token with `public_repo` scope

### Setup

1. **Install Wrangler CLI:**
   ```bash
   npm install -g wrangler
   ```

2. **Login to Cloudflare:**
   ```bash
   wrangler login
   ```

3. **Set GitHub token as secret:**
   ```bash
   cd worker
   wrangler secret put GITHUB_TOKEN
   # Paste your GitHub token when prompted
   ```

4. **Deploy:**
   ```bash
   wrangler deploy
   ```

5. **Get Worker URL:**
   ```
   https://apk-builder-worker.<your-subdomain>.workers.dev
   ```

6. **Update frontend:**
   Edit `docs/app.js` and set:
   ```javascript
   const WORKER_URL = 'https://apk-builder-worker.<your-subdomain>.workers.dev';
   ```

## Environment Variables

Set via Cloudflare dashboard or `wrangler secret`:

- `GITHUB_TOKEN` - Personal access token (secret)
- `GITHUB_OWNER` - Repository owner (default: alltechdev)
- `GITHUB_REPO` - Repository name (default: apk)

## Cost

**Free tier includes:**
- 100,000 requests/day
- 10ms CPU time per request
- More than enough for APK Builder!

## Security

- Token stored server-side (never exposed to users)
- CORS enabled only for your domain
- Rate limiting via Cloudflare
- No user data stored

## Alternative: Vercel Edge Function

Can also deploy as Vercel Edge Function:

```javascript
// api/build.js
export const config = { runtime: 'edge' };

export default async function handler(request) {
  // Same code as worker/index.js
}
```

Deploy: `vercel deploy`
