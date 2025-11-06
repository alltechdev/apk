# Deployment Guide

This guide explains the two deployment methods for the APK Builder server.

## Build Methods

### Method 1: Local Server Builds (Default)

APKs are built directly on your server using Gradle.

**Pros:**
- Faster builds (no queueing)
- Full control over build environment
- No GitHub API limits

**Cons:**
- Requires Android SDK on server
- Higher server resource usage
- Doesn't scale well with many concurrent users

**Setup:**
```bash
# Use default server
npm start

# Or explicitly
node server.js
```

**Requirements:**
- Node.js 16+
- Java JDK 11+
- Android SDK
- 2GB+ RAM recommended

---

### Method 2: GitHub Actions Builds (Recommended for Production)

APKs are built using GitHub Actions runners, server only orchestrates.

**Pros:**
- Scales automatically
- No Android SDK needed on server
- Lower server resource usage
- Build logs in GitHub
- Better for multiple concurrent users

**Cons:**
- Slightly slower (workflow queue time)
- Requires GitHub token
- Subject to GitHub Actions limits

**Setup:**

1. **Create GitHub Personal Access Token:**
   - Go to https://github.com/settings/tokens
   - Click "Generate new token (classic)"
   - Select scopes:
     - `repo` (full control)
     - `workflow` (update workflows)
   - Copy the token

2. **Configure environment:**
   ```bash
   # Create .env file
   cat > .env << EOF
   PORT=3000
   GITHUB_TOKEN=your_github_token_here
   GITHUB_OWNER=alltechdev
   GITHUB_REPO=apk
   EOF
   ```

3. **Start server:**
   ```bash
   npm run start:actions
   ```

4. **Verify workflow file is committed:**
   ```bash
   git add .github/workflows/build-apk.yml
   git commit -m "Add GitHub Actions workflow"
   git push
   ```

---

## Choosing the Right Method

| Scenario | Recommended Method |
|----------|-------------------|
| Development/Testing | Local builds |
| Low traffic (<10 builds/day) | Local builds |
| Medium traffic (10-100 builds/day) | GitHub Actions |
| High traffic (100+ builds/day) | GitHub Actions + Queue |
| Limited server resources | GitHub Actions |
| Maximum speed | Local builds |
| Need build logs | GitHub Actions |

---

## Deployment Strategies

### Single Server

For small to medium deployments:

```bash
# Clone and setup
git clone https://github.com/alltechdev/apk.git
cd apk
./setup.sh

# Choose your method
npm start              # Local builds
# OR
npm run start:actions  # GitHub Actions builds
```

### Docker Deployment

For containerized environments:

```bash
# Clone repository
git clone https://github.com/alltechdev/apk.git
cd apk

# For local builds
docker-compose up -d

# For GitHub Actions builds
docker run -d \
  -p 3000:3000 \
  -e GITHUB_TOKEN=your_token \
  -e GITHUB_OWNER=alltechdev \
  -e GITHUB_REPO=apk \
  --name apk-builder \
  node:18 \
  sh -c "cd /app && npm run start:actions"
```

### Production with PM2

For production environments:

```bash
# Install PM2
npm install -g pm2

# For local builds
pm2 start server.js --name apk-builder

# For GitHub Actions builds
pm2 start server-github-actions.js --name apk-builder

# Save configuration
pm2 save
pm2 startup
```

### Load Balanced Setup

For high-traffic deployments:

1. **Frontend Load Balancer** (Nginx/HAProxy)
2. **Multiple Server Instances** (PM2 cluster mode or separate servers)
3. **Shared Storage** (NFS/S3 for uploads/output)
4. **Redis** (for session management)

```bash
# PM2 cluster mode
pm2 start server-github-actions.js -i max --name apk-builder
```

---

## Monitoring

### Health Checks

```bash
# Check server status
curl http://localhost:3000/health

# Expected response:
{
  "status": "ok",
  "message": "APK Builder Server Running",
  "buildMethod": "GitHub Actions"  # or "Local"
}
```

### GitHub Actions Monitoring

View workflow runs:
```bash
gh run list --workflow=build-apk.yml
```

View specific run:
```bash
gh run view <run-id> --log
```

### Logs

```bash
# PM2 logs
pm2 logs apk-builder

# Docker logs
docker logs apk-builder-server

# Direct logs
tail -f logs/server.log
```

---

## Scaling Considerations

### GitHub Actions Limits

- Free: 2,000 minutes/month (public repos)
- Pro: 3,000 minutes/month
- Build time: ~2 minutes per APK
- Max: ~1,000 builds/month (free tier)

### Local Build Limits

- CPU: 1 build uses ~1 core for 2 minutes
- RAM: ~1GB per build
- Disk: ~500MB per build (temporary)
- Concurrent: Limited by server resources

### Recommendations

| Monthly Builds | Method | Server Specs |
|----------------|--------|--------------|
| <100 | Local | 2 CPU, 4GB RAM |
| 100-1,000 | GitHub Actions | 1 CPU, 2GB RAM |
| 1,000-10,000 | GitHub Actions + Queue | 2 CPU, 4GB RAM |
| 10,000+ | Hybrid + CDN | 4+ CPU, 8GB+ RAM |

---

## Troubleshooting

### GitHub Actions Issues

**Problem:** Workflow not triggering
```bash
# Check token permissions
gh auth status

# Verify workflow file
cat .github/workflows/build-apk.yml

# Manually trigger
gh workflow run build-apk.yml
```

**Problem:** Build failing
```bash
# View logs
gh run list --workflow=build-apk.yml
gh run view <run-id> --log
```

### Local Build Issues

**Problem:** Android SDK not found
```bash
# Set ANDROID_SDK_ROOT
export ANDROID_SDK_ROOT=$HOME/Android/Sdk
export PATH=$PATH:$ANDROID_SDK_ROOT/platform-tools
```

**Problem:** Out of memory
```bash
# Increase Node.js memory
NODE_OPTIONS=--max-old-space-size=4096 npm start
```

---

## Security

### GitHub Token Security

- **Never commit** tokens to repository
- Use environment variables
- Rotate tokens regularly
- Use minimal required scopes
- Consider GitHub Apps for production

### Server Security

- Enable HTTPS (use Let's Encrypt)
- Rate limit API endpoints
- Validate all inputs
- Sandbox build processes
- Regular security updates

---

## Cost Analysis

### Local Builds

**Server Costs:**
- Small server: $5-10/month (DigitalOcean, Linode)
- Medium server: $20-40/month
- Large server: $80+/month

**Pros:** Predictable costs

### GitHub Actions

**Action Costs:**
- Free tier: $0 (2,000 minutes)
- Pro: $0.008/minute after free tier
- ~$0.016 per APK (2 minutes)

**Server Costs:**
- Minimal: $5/month (1GB RAM sufficient)

**Example:**
- 500 builds/month
- GitHub: $8 (actions) + $5 (server) = $13/month
- Local: $20/month (medium server)

---

## Migration

### Switching from Local to GitHub Actions

```bash
# Install dependencies
npm install

# Configure environment
export GITHUB_TOKEN=your_token

# Test
npm run start:actions

# Update PM2
pm2 delete apk-builder
pm2 start server-github-actions.js --name apk-builder
pm2 save
```

### Switching from GitHub Actions to Local

```bash
# Install Android SDK
# (See README for instructions)

# Test
npm start

# Update PM2
pm2 delete apk-builder
pm2 start server.js --name apk-builder
pm2 save
```

---

## Support

For deployment help:
- [GitHub Issues](https://github.com/alltechdev/apk/issues)
- [GitHub Discussions](https://github.com/alltechdev/apk/discussions)
