import express from 'express';
import { createServer } from 'http';
import { Server } from 'socket.io';
import sharp from 'sharp';
import { v4 as uuidv4 } from 'uuid';
import { promises as fs } from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import { Octokit } from '@octokit/rest';

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
const GITHUB_TOKEN = process.env.GITHUB_TOKEN;
const GITHUB_OWNER = process.env.GITHUB_OWNER || 'alltechdev';
const GITHUB_REPO = process.env.GITHUB_REPO || 'apk';
const UPLOAD_DIR = path.join(__dirname, 'uploads');

// Initialize Octokit
const octokit = new Octokit({
  auth: GITHUB_TOKEN
});

// Ensure directories exist
await fs.mkdir(UPLOAD_DIR, { recursive: true });

// Serve static files (frontend)
app.use(express.static(path.join(__dirname, 'public')));

// Health check endpoint
app.get('/health', (req, res) => {
  res.json({
    status: 'ok',
    message: 'APK Builder Server Running',
    buildMethod: 'GitHub Actions'
  });
});

// Proxy downloads from GitHub releases
app.get('/download/:filename', async (req, res) => {
  try {
    const filename = req.params.filename;
    const buildId = filename.split('-').pop().replace('.apk', '');

    // Redirect to GitHub release download
    const downloadUrl = `https://github.com/${GITHUB_OWNER}/${GITHUB_REPO}/releases/download/${buildId}/${filename}`;

    res.redirect(downloadUrl);
  } catch (error) {
    res.status(404).json({ error: 'File not found' });
  }
});

// Track build status
const buildStatus = new Map();

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

      if (!GITHUB_TOKEN) {
        throw new Error('GitHub token not configured. Set GITHUB_TOKEN environment variable.');
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

      // Process icon if provided (upload to GitHub or encode as URL)
      let iconUrl = null;
      if (icon) {
        iconUrl = await uploadIcon(icon, buildId);
      }

      // Trigger GitHub Actions workflow
      console.log('Triggering GitHub Actions workflow...');

      const workflowResponse = await octokit.actions.createWorkflowDispatch({
        owner: GITHUB_OWNER,
        repo: GITHUB_REPO,
        workflow_id: 'build-apk.yml',
        ref: 'main',
        inputs: {
          domain,
          url,
          appName: sanitizedAppName,
          blockMedia: String(blockMedia),
          viewMode,
          startUpUrl: startUpUrl || `https://${domain}`,
          adsBlocker: String(adsBlocker),
          noSslMode: String(noSslMode),
          additionalDomains: additionalDomains.join(','),
          buildId
        }
      });

      console.log('Workflow triggered:', workflowResponse.status);

      // Store build status
      buildStatus.set(buildId, {
        status: 'building',
        domain,
        appName: sanitizedAppName,
        socketId: socket.id
      });

      // Poll for workflow completion
      pollWorkflowStatus(buildId, domain, sanitizedAppName, viewMode, blockMedia, socket);

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
  let domain = url.replace(/^https?:\/\//, '');
  domain = domain.split('/')[0];
  domain = domain.split(':')[0];
  return domain;
}

// Upload icon to GitHub or encode as data URL
async function uploadIcon(iconData, buildId) {
  try {
    const iconPath = path.join(UPLOAD_DIR, `${buildId}-icon.png`);

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

    // TODO: Upload to GitHub or CDN and return URL
    // For now, return local path
    return iconPath;
  } catch (error) {
    console.error('Icon processing error:', error);
    return null;
  }
}

// Poll GitHub Actions workflow status
async function pollWorkflowStatus(buildId, domain, appName, viewMode, blockMedia, socket) {
  const maxAttempts = 60; // 10 minutes (10 second intervals)
  let attempts = 0;

  const poll = async () => {
    try {
      attempts++;

      // Get recent workflow runs
      const runs = await octokit.actions.listWorkflowRuns({
        owner: GITHUB_OWNER,
        repo: GITHUB_REPO,
        workflow_id: 'build-apk.yml',
        per_page: 10
      });

      // Find our workflow run by checking inputs
      // Note: GitHub API doesn't directly expose inputs, so we check recent runs
      const recentRun = runs.data.workflow_runs[0];

      if (!recentRun) {
        throw new Error('Workflow run not found');
      }

      console.log(`Build ${buildId}: Status = ${recentRun.status}, Conclusion = ${recentRun.conclusion}`);

      if (recentRun.status === 'completed') {
        if (recentRun.conclusion === 'success') {
          // Build successful
          const apkFilename = `${appName}-${buildId}.apk`;
          const downloadUrl = `/download/${apkFilename}`;

          socket.emit('done', {
            domain,
            downloadUrl,
            appName,
            viewMode,
            blockMedia
          });

          buildStatus.delete(buildId);
        } else {
          // Build failed
          socket.emit('error', {
            message: 'APK build failed. Check GitHub Actions logs for details.'
          });
          buildStatus.delete(buildId);
        }
      } else if (attempts >= maxAttempts) {
        // Timeout
        socket.emit('error', {
          message: 'Build timeout. The process is taking longer than expected.'
        });
        buildStatus.delete(buildId);
      } else {
        // Still building, poll again
        setTimeout(poll, 10000); // Poll every 10 seconds
      }
    } catch (error) {
      console.error('Polling error:', error);
      socket.emit('error', {
        message: 'Failed to check build status: ' + error.message
      });
      buildStatus.delete(buildId);
    }
  };

  // Start polling after 5 seconds (give workflow time to start)
  setTimeout(poll, 5000);
}

// Start server
httpServer.listen(PORT, () => {
  console.log(`🚀 APK Builder Server running on port ${PORT}`);
  console.log(`🔧 Build method: GitHub Actions`);
  console.log(`📦 Repository: ${GITHUB_OWNER}/${GITHUB_REPO}`);
  console.log(`🔑 GitHub token: ${GITHUB_TOKEN ? 'Configured' : 'NOT CONFIGURED'}`);
});
