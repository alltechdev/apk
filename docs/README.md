# APK Builder - GitHub Pages Frontend

This is the serverless frontend for the APK Builder, hosted entirely on GitHub!

## How It Works

1. **User fills out the form** on the GitHub Pages site
2. **JavaScript creates a GitHub Issue** with the build configuration
3. **GitHub Actions automatically detects** the issue with the `apk-build` label
4. **Workflow builds the APK** using the Android template
5. **APK is uploaded to GitHub Releases**
6. **Bot comments on the issue** with the download link
7. **User downloads the APK** from GitHub Releases

## Features

- 🚀 **100% Serverless** - No backend server needed!
- 🆓 **Completely Free** - Uses GitHub's free tier
- ⚡ **Fast** - GitHub Actions build APKs in 2-3 minutes
- 🔒 **Secure** - All builds tracked via GitHub Issues
- 📦 **Scalable** - Handles multiple concurrent builds
- 🌐 **Global CDN** - GitHub Pages and Releases are CDN-backed

## Live Demo

Visit the live site: `https://alltechdev.github.io/apk/`

## Architecture

```
┌─────────────┐
│   Browser   │
│  (User UI)  │
└──────┬──────┘
       │
       │ 1. Create Issue via API
       ▼
┌─────────────────┐
│  GitHub Issues  │
│  (Build Queue)  │
└────────┬────────┘
         │
         │ 2. Trigger on new issue
         ▼
┌──────────────────┐
│ GitHub Actions   │
│  (Build APK)     │
└────────┬─────────┘
         │
         │ 3. Upload APK
         ▼
┌──────────────────┐
│ GitHub Releases  │
│  (APK Storage)   │
└────────┬─────────┘
         │
         │ 4. Comment download link
         ▼
┌──────────────────┐
│  GitHub Issues   │
│  (Notification)  │
└────────┬─────────┘
         │
         │ 5. Poll for completion
         ▼
┌─────────────┐
│   Browser   │
│  (Download) │
└─────────────┘
```

## Cost

**Completely FREE!**

- GitHub Pages: Free hosting
- GitHub Actions: 2,000 minutes/month (free tier)
- GitHub Releases: Unlimited storage for releases
- Average build: ~2 minutes
- **You can build ~1,000 APKs per month for free!**

## Files

- `index.html` - Main UI
- `app.js` - Frontend logic
- `css.css` - Custom styles
- `crop-select-js.min.*` - Image cropping library

## Customization

To use this for your own repository:

1. Fork the repository
2. Edit `app.js` and update:
   ```javascript
   const GITHUB_OWNER = 'your-username';
   const GITHUB_REPO = 'apk';
   ```
3. Enable GitHub Pages in repository settings
4. Set source to `docs/` folder
5. Done! Your site is live at `https://your-username.github.io/apk/`

## Security

- No authentication required
- All builds are public (issues and releases)
- Rate limited by GitHub API (5,000 requests/hour)
- No sensitive data is stored
- Icon images are processed server-side only

## Limitations

- GitHub Actions free tier: 2,000 minutes/month
- Maximum build time: 15 minutes per APK
- Build queue: Handled by GitHub Actions queue
- File size: APKs typically 2-5 MB

## Support

- [Report Issues](https://github.com/alltechdev/apk/issues)
- [View Builds](https://github.com/alltechdev/apk/issues?q=label%3Aapk-build)
- [Download APKs](https://github.com/alltechdev/apk/releases)
