import express from 'express';
import { createServer } from 'http';
import { Server } from 'socket.io';
import multer from 'multer';
import sharp from 'sharp';
import { v4 as uuidv4 } from 'uuid';
import { promises as fs } from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import { exec } from 'child_process';
import { promisify } from 'util';

const execAsync = promisify(exec);

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const app = express();
const httpServer = createServer(app);
const io = new Server(httpServer, {
  cors: {
    origin: "*",
    methods: ["GET", "POST"]
  },
  maxHttpBufferSize: 10e6 // 10MB for file uploads
});

// Configuration
const PORT = process.env.PORT || 3000;
const UPLOAD_DIR = path.join(__dirname, 'uploads');
const OUTPUT_DIR = path.join(__dirname, 'output');
const TEMPLATE_DIR = path.join(__dirname, 'AndroidRestrictedWebView');

// Ensure directories exist
await fs.mkdir(UPLOAD_DIR, { recursive: true });
await fs.mkdir(OUTPUT_DIR, { recursive: true });

// Serve static files (frontend)
app.use(express.static(path.join(__dirname, 'public')));

// Configure multer for file uploads
const storage = multer.memoryStorage();
const upload = multer({
  storage,
  limits: { fileSize: 5 * 1024 * 1024 } // 5MB limit
});

// Health check endpoint
app.get('/health', (req, res) => {
  res.json({ status: 'ok', message: 'APK Builder Server Running' });
});

// Download endpoint for generated APKs
app.get('/download/:filename', async (req, res) => {
  try {
    const filename = req.params.filename;
    const filepath = path.join(OUTPUT_DIR, filename);

    // Security check: prevent directory traversal
    if (!filepath.startsWith(OUTPUT_DIR)) {
      return res.status(403).json({ error: 'Access denied' });
    }

    // Check if file exists
    await fs.access(filepath);

    res.download(filepath, filename, (err) => {
      if (err) {
        console.error('Download error:', err);
      }
    });
  } catch (error) {
    res.status(404).json({ error: 'File not found' });
  }
});

// Socket.IO connection handling
io.on('connection', (socket) => {
  console.log('Client connected:', socket.id);

  socket.on('generate-apk', async (data) => {
    console.log('APK generation request:', data);

    try {
      // Validate input
      if (!data.url) {
        throw new Error('URL is required');
      }

      const {
        url,
        additionalDomains = [],
        appName,
        blockMedia = false,
        viewMode = 'AUTO',
        startUpUrl = '',
        icon,
        adsBlocker = false,
        noSslMode = false
      } = data;

      // Extract domain from URL
      const domain = extractDomain(url);
      const sanitizedAppName = appName || domain.replace(/[^a-zA-Z0-9]/g, '');
      const buildId = uuidv4();

      // Create build directory
      const buildDir = path.join(UPLOAD_DIR, buildId);
      await fs.mkdir(buildDir, { recursive: true });

      // Process icon if provided
      let iconPath = null;
      if (icon) {
        iconPath = await processIcon(icon, buildDir);
      }

      // Generate APK
      const apkFilename = await generateAPK({
        buildId,
        buildDir,
        domain,
        url,
        additionalDomains,
        appName: sanitizedAppName,
        blockMedia,
        viewMode,
        startUpUrl: startUpUrl || `https://${domain}`,
        iconPath,
        adsBlocker,
        noSslMode
      });

      // Send success response
      socket.emit('done', {
        domain,
        downloadUrl: `/download/${apkFilename}`,
        appName: sanitizedAppName,
        viewMode,
        blockMedia
      });

      // Clean up build directory after 5 minutes
      setTimeout(async () => {
        try {
          await fs.rm(buildDir, { recursive: true, force: true });
        } catch (err) {
          console.error('Cleanup error:', err);
        }
      }, 5 * 60 * 1000);

    } catch (error) {
      console.error('APK generation error:', error);
      socket.emit('error', {
        message: error.message || 'Failed to generate APK'
      });
    }
  });

  socket.on('disconnect', () => {
    console.log('Client disconnected:', socket.id);
  });
});

// Helper function to extract domain from URL
function extractDomain(url) {
  // Remove protocol if present
  let domain = url.replace(/^https?:\/\//, '');
  // Remove path if present
  domain = domain.split('/')[0];
  // Remove port if present
  domain = domain.split(':')[0];
  return domain;
}

// Process and resize icon
async function processIcon(iconData, buildDir) {
  try {
    const iconPath = path.join(buildDir, 'icon.png');

    // If iconData is base64
    if (typeof iconData === 'string' && iconData.startsWith('data:')) {
      const base64Data = iconData.replace(/^data:image\/\w+;base64,/, '');
      const buffer = Buffer.from(base64Data, 'base64');

      await sharp(buffer)
        .resize(512, 512, { fit: 'cover' })
        .png()
        .toFile(iconPath);
    } else if (Buffer.isBuffer(iconData)) {
      await sharp(iconData)
        .resize(512, 512, { fit: 'cover' })
        .png()
        .toFile(iconPath);
    }

    return iconPath;
  } catch (error) {
    console.error('Icon processing error:', error);
    return null;
  }
}

// Generate APK using AndroidRestrictedWebView template
async function generateAPK(config) {
  const {
    buildId,
    buildDir,
    domain,
    url,
    additionalDomains,
    appName,
    blockMedia,
    viewMode,
    startUpUrl,
    iconPath,
    adsBlocker,
    noSslMode
  } = config;

  // Check if Android template exists
  try {
    await fs.access(TEMPLATE_DIR);
  } catch (error) {
    throw new Error('Android project template not found. Please clone AndroidRestrictedWebView first.');
  }

  // Copy template to build directory
  const projectDir = path.join(buildDir, 'project');
  await copyDir(TEMPLATE_DIR, projectDir);

  // Update configuration files
  await updateAppConfig(projectDir, {
    domain,
    url,
    additionalDomains,
    appName,
    blockMedia,
    viewMode,
    startUpUrl,
    adsBlocker,
    noSslMode
  });

  // Copy icon if provided
  if (iconPath) {
    await copyIcon(iconPath, projectDir);
  }

  // Build APK
  const apkPath = await buildAPK(projectDir, buildId);

  // Move APK to output directory
  const apkFilename = `${appName}-${buildId}.apk`;
  const outputPath = path.join(OUTPUT_DIR, apkFilename);
  await fs.copyFile(apkPath, outputPath);

  return apkFilename;
}

// Copy directory recursively
async function copyDir(src, dest) {
  await fs.mkdir(dest, { recursive: true });
  const entries = await fs.readdir(src, { withFileTypes: true });

  for (const entry of entries) {
    const srcPath = path.join(src, entry.name);
    const destPath = path.join(dest, entry.name);

    if (entry.isDirectory()) {
      await copyDir(srcPath, destPath);
    } else {
      await fs.copyFile(srcPath, destPath);
    }
  }
}

// Update app configuration
async function updateAppConfig(projectDir, config) {
  // Update strings.xml
  const stringsPath = path.join(projectDir, 'app/src/main/res/values/strings.xml');
  let stringsXml = await fs.readFile(stringsPath, 'utf-8');
  stringsXml = stringsXml.replace(
    /<string name="app_name">.*?<\/string>/,
    `<string name="app_name">${escapeXml(config.appName)}</string>`
  );
  await fs.writeFile(stringsPath, stringsXml);

  // Update config.json
  const configPath = path.join(projectDir, 'app/src/main/assets/config.json');
  const configJson = {
    domain: config.domain,
    startUrl: config.startUpUrl,
    allowedDomains: [config.domain, ...config.additionalDomains],
    blockMedia: config.blockMedia,
    adBlocker: config.adsBlocker,
    ignoreSSLErrors: config.noSslMode,
    orientation: config.viewMode
  };
  await fs.writeFile(configPath, JSON.stringify(configJson, null, 2));
}

// Copy icon to project resources
async function copyIcon(iconPath, projectDir) {
  const resDir = path.join(projectDir, 'app/src/main/res');
  const sizes = [
    { folder: 'mipmap-mdpi', size: 48 },
    { folder: 'mipmap-hdpi', size: 72 },
    { folder: 'mipmap-xhdpi', size: 96 },
    { folder: 'mipmap-xxhdpi', size: 144 },
    { folder: 'mipmap-xxxhdpi', size: 192 }
  ];

  for (const { folder, size } of sizes) {
    const targetDir = path.join(resDir, folder);
    await fs.mkdir(targetDir, { recursive: true });
    const targetPath = path.join(targetDir, 'ic_launcher.png');

    await sharp(iconPath)
      .resize(size, size, { fit: 'cover' })
      .png()
      .toFile(targetPath);
  }
}

// Build APK using Gradle
async function buildAPK(projectDir, buildId) {
  try {
    // Run Gradle build
    const { stdout, stderr } = await execAsync(
      './gradlew assembleRelease',
      {
        cwd: projectDir,
        maxBuffer: 10 * 1024 * 1024 // 10MB buffer
      }
    );

    console.log('Build output:', stdout);
    if (stderr) console.error('Build stderr:', stderr);

    // Find generated APK
    const apkPath = path.join(projectDir, 'app/build/outputs/apk/release/app-release.apk');

    // Check if APK exists
    await fs.access(apkPath);

    return apkPath;
  } catch (error) {
    console.error('Build error:', error);
    throw new Error(`Failed to build APK: ${error.message}`);
  }
}

// Escape XML special characters
function escapeXml(str) {
  return str
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&apos;');
}

// Cleanup old files periodically (every hour)
setInterval(async () => {
  try {
    const now = Date.now();
    const maxAge = 60 * 60 * 1000; // 1 hour

    // Clean output directory
    const outputFiles = await fs.readdir(OUTPUT_DIR);
    for (const file of outputFiles) {
      const filepath = path.join(OUTPUT_DIR, file);
      const stats = await fs.stat(filepath);
      if (now - stats.mtimeMs > maxAge) {
        await fs.unlink(filepath);
        console.log('Cleaned up old file:', file);
      }
    }

    // Clean uploads directory
    const uploadDirs = await fs.readdir(UPLOAD_DIR);
    for (const dir of uploadDirs) {
      const dirpath = path.join(UPLOAD_DIR, dir);
      const stats = await fs.stat(dirpath);
      if (stats.isDirectory() && now - stats.mtimeMs > maxAge) {
        await fs.rm(dirpath, { recursive: true, force: true });
        console.log('Cleaned up old build:', dir);
      }
    }
  } catch (error) {
    console.error('Cleanup error:', error);
  }
}, 60 * 60 * 1000);

// Start server
httpServer.listen(PORT, () => {
  console.log(`🚀 APK Builder Server running on port ${PORT}`);
  console.log(`📁 Template directory: ${TEMPLATE_DIR}`);
  console.log(`💾 Upload directory: ${UPLOAD_DIR}`);
  console.log(`📦 Output directory: ${OUTPUT_DIR}`);
});
