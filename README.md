# APK Builder - Website to Android App Converter

A full-stack web application that converts any website into a standalone Android APK file with custom branding and restricted browsing.

## Features

- **One-Click Conversion**: Convert any website to an Android app instantly
- **Custom Branding**: Upload custom app icons with built-in cropping tool
- **Domain Restriction**: Restrict app navigation to specific domains only
- **Media Blocking**: Optional blocking of images, videos, and embedded content
- **Ad Blocker**: Built-in advertisement blocking
- **SSL Handling**: Option to ignore SSL errors for development
- **Orientation Control**: Auto, landscape, or portrait mode
- **Additional Domains**: Whitelist additional domains for login systems, etc.
- **Real-time Progress**: Socket.IO for live build status updates

## Architecture

### Frontend
- HTML5 + JavaScript (ES6 Modules)
- Material Design Bootstrap (MDB)
- Socket.IO Client for real-time communication
- SweetAlert2 for modals
- CropSelectJS for image cropping

### Backend
- Node.js + Express
- Socket.IO Server
- Sharp for image processing
- Multer for file uploads
- Gradle for Android builds

### Android Template
Based on [AndroidRestrictedWebView](https://github.com/lo-mityaesh/AndroidRestrictedWebView) by @lo-mityaesh

## Prerequisites

### Required
- **Node.js** 16+ ([Download](https://nodejs.org/))
- **Java JDK** 11+ ([Download](https://adoptium.net/))
- **Android SDK** ([Download Android Studio](https://developer.android.com/studio))
- **Git**

### Optional
- **Docker** (for containerized deployment)

## Quick Start

### Option 1: Automated Setup (Linux/Mac)

```bash
# Clone the repository
git clone https://github.com/alltechdev/apk.git
cd apk

# Run setup script
chmod +x setup.sh
./setup.sh

# Start the server
npm start
```

### Option 2: Manual Setup

```bash
# Clone the repository
git clone https://github.com/alltechdev/apk.git
cd apk

# Install dependencies
npm install

# Clone Android template
git clone https://github.com/lo-mityaesh/AndroidRestrictedWebView.git

# Create directories
mkdir -p uploads output public

# Configure environment
cp .env.example .env

# Make gradlew executable
chmod +x AndroidRestrictedWebView/gradlew

# Start the server
npm start
```

### Option 3: Docker

```bash
# Clone the repository
git clone https://github.com/alltechdev/apk.git
cd apk

# Clone Android template first
git clone https://github.com/lo-mityaesh/AndroidRestrictedWebView.git

# Build and run with Docker Compose
docker-compose up -d
```

## Configuration

### Environment Variables

Create a `.env` file based on `.env.example`:

```env
# Server Configuration
PORT=3000

# Cleanup Configuration
CLEANUP_INTERVAL_HOURS=1
MAX_FILE_AGE_HOURS=24

# Security
MAX_FILE_SIZE_MB=5
```

### Android SDK Setup

1. Install Android Studio
2. Open SDK Manager (Tools → SDK Manager)
3. Install:
   - Android SDK Platform 33
   - Android SDK Build-Tools 33.0.0
   - Android SDK Platform-Tools

4. Set environment variables:

```bash
# Linux/Mac (~/.bashrc or ~/.zshrc)
export ANDROID_SDK_ROOT=$HOME/Android/Sdk
export PATH=$PATH:$ANDROID_SDK_ROOT/platform-tools

# Windows (System Environment Variables)
ANDROID_SDK_ROOT=C:\Users\YourName\AppData\Local\Android\Sdk
```

## Usage

1. **Start the server:**
   ```bash
   npm start
   ```

2. **Open your browser:**
   ```
   http://localhost:3000
   ```

3. **Fill in the form:**
   - Enter website URL (e.g., `example.com`)
   - Upload custom icon (optional)
   - Configure settings
   - Click "Generate App"

4. **Download APK:**
   - Wait ~2 minutes for build
   - Download generated APK file
   - Install on Android device

## API Documentation

### Socket.IO Events

#### Client → Server

**Event: `generate-apk`**

Payload:
```javascript
{
  url: string,                // Domain to convert
  additionalDomains: string[], // Additional allowed domains
  appName: string,            // App name (optional)
  blockMedia: boolean,        // Block images/videos
  viewMode: string,           // AUTO|LANDSCAPE|PORTRAIT
  startUpUrl: string,         // Custom startup URL
  icon: Buffer|string,        // App icon (base64 or buffer)
  adsBlocker: boolean,        // Enable ad blocker
  noSslMode: boolean          // Ignore SSL errors
}
```

#### Server → Client

**Event: `done`**

Payload:
```javascript
{
  domain: string,       // Domain name
  downloadUrl: string,  // APK download URL
  appName: string,      // App name
  viewMode: string,     // View mode used
  blockMedia: boolean   // Media blocking status
}
```

**Event: `error`**

Payload:
```javascript
{
  message: string  // Error description
}
```

### HTTP Endpoints

**GET `/health`**
- Health check endpoint
- Returns: `{ status: 'ok', message: 'APK Builder Server Running' }`

**GET `/download/:filename`**
- Download generated APK
- Requires valid filename
- Returns: APK file or 404 error

## Project Structure

```
apk-builder/
├── server.js                    # Main server file
├── package.json                 # Dependencies
├── .env.example                 # Environment template
├── .gitignore                   # Git ignore rules
├── setup.sh                     # Setup script
├── Dockerfile                   # Docker configuration
├── docker-compose.yml           # Docker Compose config
├── README.md                    # This file
├── public/                      # Frontend files
│   ├── index.html              # Main HTML
│   ├── index.js                # Frontend logic
│   ├── css.css                 # Custom styles
│   ├── crop-select-js.min.css  # Cropping styles
│   └── crop-select-js.min.js   # Cropping library
├── AndroidRestrictedWebView/    # Android template (cloned)
├── uploads/                     # Temporary build files
└── output/                      # Generated APK files
```

## Development

### Running in Development Mode

```bash
# Install nodemon
npm install -g nodemon

# Start with auto-reload
npm run dev
```

### Debugging

Enable debug logging:

```javascript
// In server.js, add at the top:
const DEBUG = true;
```

Check logs:
- Server logs: Console output
- Build logs: `uploads/<build-id>/build.log`

### Testing

Test the API with curl:

```bash
# Health check
curl http://localhost:3000/health

# Test Socket.IO connection
npm install -g wscat
wscat -c ws://localhost:3000/socket.io/?EIO=4&transport=websocket
```

## Deployment

### Production Deployment

1. **Set environment to production:**
   ```bash
   export NODE_ENV=production
   ```

2. **Use a process manager:**
   ```bash
   # Using PM2
   npm install -g pm2
   pm2 start server.js --name apk-builder
   pm2 save
   pm2 startup
   ```

3. **Set up reverse proxy (Nginx):**
   ```nginx
   server {
       listen 80;
       server_name yourdomain.com;

       location / {
           proxy_pass http://localhost:3000;
           proxy_http_version 1.1;
           proxy_set_header Upgrade $http_upgrade;
           proxy_set_header Connection 'upgrade';
           proxy_set_header Host $host;
           proxy_cache_bypass $http_upgrade;
       }
   }
   ```

4. **Enable HTTPS:**
   ```bash
   sudo certbot --nginx -d yourdomain.com
   ```

### Docker Deployment

```bash
# Build image
docker build -t apk-builder .

# Run container
docker run -d \
  -p 3000:3000 \
  -v $(pwd)/uploads:/app/uploads \
  -v $(pwd)/output:/app/output \
  --name apk-builder \
  apk-builder
```

## Troubleshooting

### Build Fails

**Problem:** Gradle build fails
**Solution:**
- Ensure Java 11+ is installed: `java -version`
- Check Android SDK: `echo $ANDROID_SDK_ROOT`
- Verify gradlew is executable: `chmod +x AndroidRestrictedWebView/gradlew`

### Socket.IO Connection Issues

**Problem:** Client can't connect
**Solution:**
- Check server is running: `curl http://localhost:3000/health`
- Verify port is not blocked
- Check browser console for errors

### APK Installation Fails

**Problem:** "App not installed" error
**Solution:**
- Enable "Install from unknown sources" on Android
- Check APK is not corrupted (re-download)
- Ensure Android version is compatible (Android 5.0+)

### Memory Issues

**Problem:** Server crashes during build
**Solution:**
- Increase Node.js memory: `NODE_OPTIONS=--max-old-space-size=4096 npm start`
- Reduce concurrent builds
- Clean old files regularly

## Security Considerations

- **File Upload Validation**: Only images allowed for icons
- **Directory Traversal**: Protected against path traversal attacks
- **File Size Limits**: Max 5MB for uploads
- **Automatic Cleanup**: Old files deleted after 24 hours
- **Domain Validation**: Regex validation for domain inputs
- **No Code Injection**: User inputs are escaped in XML

## Performance

- Average build time: 1-2 minutes
- Concurrent builds supported
- Auto cleanup of old files
- File size: Generated APKs ~2-5MB

## Credits

- **Original Website**: app-builder.madrichim.ovh (archived)
- **Android Template**: [AndroidRestrictedWebView](https://github.com/lo-mityaesh/AndroidRestrictedWebView) by @lo-mityaesh
- **Frontend Recreation**: Based on Wayback Machine archive

## License

MIT License - See LICENSE file for details

## Contributing

Contributions welcome! Please:
1. Fork the repository
2. Create a feature branch
3. Make your changes
4. Submit a pull request

## Support

- Issues: [GitHub Issues](https://github.com/alltechdev/apk/issues)
- Discussions: [GitHub Discussions](https://github.com/alltechdev/apk/discussions)

## Roadmap

- [ ] iOS app generation
- [ ] Custom splash screens
- [ ] App signing automation
- [ ] Play Store metadata generation
- [ ] Multi-language support
- [ ] Advanced WebView customization
- [ ] Analytics integration
- [ ] Push notification support

---

**Note**: This tool is for educational purposes. Ensure you have rights to convert websites into apps.
