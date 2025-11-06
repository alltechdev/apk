// Cloudflare Worker - Serverless proxy for GitHub API
// Allows users to create APK build requests without authentication

export default {
  async fetch(request, env) {
    // Enable CORS
    const corsHeaders = {
      'Access-Control-Allow-Origin': '*',
      'Access-Control-Allow-Methods': 'POST, OPTIONS',
      'Access-Control-Allow-Headers': 'Content-Type',
    };

    // Handle CORS preflight
    if (request.method === 'OPTIONS') {
      return new Response(null, { headers: corsHeaders });
    }

    // Only accept POST requests
    if (request.method !== 'POST') {
      return new Response('Method not allowed', {
        status: 405,
        headers: corsHeaders
      });
    }

    try {
      // Parse request body
      const data = await request.json();

      // Validate required fields
      if (!data.domain || !data.appName || !data.buildId) {
        return new Response(JSON.stringify({
          error: 'Missing required fields'
        }), {
          status: 400,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' }
        });
      }

      // Create issue body
      const issueBody = `## APK Build Request

**Build ID:** \`${data.buildId}\`
**Domain:** ${data.domain}
**App Name:** ${data.appName}

### Configuration
- **URL:** ${data.url}
- **Startup URL:** ${data.startUpUrl}
- **Additional Domains:** ${data.additionalDomains?.join(', ') || 'None'}
- **Block Media:** ${data.blockMedia ? 'Yes' : 'No'}
- **Ad Blocker:** ${data.adsBlocker ? 'Yes' : 'No'}
- **Ignore SSL:** ${data.noSslMode ? 'Yes' : 'No'}
- **View Mode:** ${data.viewMode}
- **Has Custom Icon:** ${data.icon ? 'Yes' : 'No'}

### Build Data
\`\`\`json
${JSON.stringify(data, null, 2)}
\`\`\`

---
*This issue was automatically created by the APK Builder.*
`;

      // Create GitHub issue using server-side token
      const githubResponse = await fetch(
        `https://api.github.com/repos/${env.GITHUB_OWNER}/${env.GITHUB_REPO}/issues`,
        {
          method: 'POST',
          headers: {
            'Authorization': `token ${env.GITHUB_TOKEN}`,
            'Content-Type': 'application/json',
            'Accept': 'application/vnd.github.v3+json',
            'User-Agent': 'APK-Builder-Worker'
          },
          body: JSON.stringify({
            title: `APK Build: ${data.appName} [${data.buildId}]`,
            body: issueBody,
            labels: ['apk-build', 'automated']
          })
        }
      );

      if (!githubResponse.ok) {
        const error = await githubResponse.json();
        throw new Error(error.message || 'Failed to create issue');
      }

      const issue = await githubResponse.json();

      // Return success response
      return new Response(JSON.stringify({
        success: true,
        issueNumber: issue.number,
        issueUrl: issue.html_url
      }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      });

    } catch (error) {
      console.error('Worker error:', error);
      return new Response(JSON.stringify({
        error: error.message || 'Internal server error'
      }), {
        status: 500,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      });
    }
  }
};
