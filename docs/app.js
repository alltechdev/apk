// GitHub Configuration
const GITHUB_OWNER = 'alltechdev';
const GITHUB_REPO = 'apk';
const GITHUB_API = 'https://api.github.com';

// GitHub OAuth App - Users need to authenticate to create issues
// This enables a fully serverless architecture
const CLIENT_ID = 'Ov23liLn4gZ6mNuEYPON'; // Public OAuth App ID

// Check authentication on page load
let githubToken = localStorage.getItem('github_token');

// Handle OAuth callback
if (window.location.search.includes('code=')) {
    const urlParams = new URLSearchParams(window.location.search);
    const code = urlParams.get('code');

    // Show loading
    Swal.fire({
        icon: 'info',
        title: 'Completing login...',
        text: 'Please wait while we authenticate you with GitHub.',
        allowOutsideClick: false,
        didOpen: () => {
            Swal.showLoading();
        }
    });

    // Exchange code for token using GitHub's device flow
    // Since we can't have a backend, we'll use a public CORS proxy temporarily
    // Or better: Just have users create a personal access token
    window.history.replaceState({}, document.title, window.location.pathname);
}

// Utility functions
function showErrorModal(text) {
    Swal.fire({
        icon: 'error',
        title: 'Error',
        text,
    });
}

function extractDomain(url) {
    let domain = url.replace(/^https?:\/\//, '');
    domain = domain.split('/')[0];
    domain = domain.split(':')[0];
    return domain;
}

function generateBuildId() {
    return 'build-' + Date.now() + '-' + Math.random().toString(36).substr(2, 9);
}

// Check if user is authenticated
function isAuthenticated() {
    return !!githubToken;
}

// Prompt for GitHub token
async function promptForToken() {
    const { value: token } = await Swal.fire({
        title: 'GitHub Authentication Required',
        html: `
            <p>To build APKs, you need to authenticate with GitHub.</p>
            <p class="mt-3"><strong>Option 1: Create a Personal Access Token</strong></p>
            <ol class="text-start">
                <li>Go to <a href="https://github.com/settings/tokens/new?scopes=public_repo&description=APK%20Builder" target="_blank">GitHub Token Settings</a></li>
                <li>Click "Generate token" (only needs <code>public_repo</code> scope)</li>
                <li>Copy the token and paste it below</li>
            </ol>
            <p class="text-muted small mt-3">Your token is stored locally and never sent to any server except GitHub.</p>
        `,
        input: 'password',
        inputLabel: 'GitHub Personal Access Token',
        inputPlaceholder: 'ghp_xxxxxxxxxxxx',
        showCancelButton: true,
        confirmButtonText: 'Save Token',
        inputValidator: (value) => {
            if (!value) {
                return 'Please enter a token';
            }
            if (!value.startsWith('ghp_') && !value.startsWith('github_pat_')) {
                return 'Invalid token format';
            }
        }
    });

    if (token) {
        // Verify token works
        try {
            const response = await fetch(`${GITHUB_API}/user`, {
                headers: {
                    'Authorization': `token ${token}`,
                    'Accept': 'application/vnd.github.v3+json'
                }
            });

            if (!response.ok) {
                throw new Error('Invalid token');
            }

            const user = await response.json();

            // Save token
            localStorage.setItem('github_token', token);
            githubToken = token;

            Swal.fire({
                icon: 'success',
                title: 'Authenticated!',
                text: `Welcome, ${user.login}! You can now build APKs.`,
                timer: 2000,
                showConfirmButton: false
            });

            return true;
        } catch (error) {
            showErrorModal('Invalid token. Please try again.');
            return false;
        }
    }

    return false;
}

// Logout function
function logout() {
    localStorage.removeItem('github_token');
    githubToken = null;
    Swal.fire({
        icon: 'info',
        title: 'Logged Out',
        text: 'You have been logged out.',
        timer: 2000,
        showConfirmButton: false
    }).then(() => {
        location.reload();
    });
}

// Show auth status
async function updateAuthStatus() {
    const authStatus = document.getElementById('authStatus');
    if (!authStatus) return;

    if (isAuthenticated()) {
        try {
            const response = await fetch(`${GITHUB_API}/user`, {
                headers: {
                    'Authorization': `token ${githubToken}`,
                    'Accept': 'application/vnd.github.v3+json'
                }
            });

            if (response.ok) {
                const user = await response.json();
                authStatus.innerHTML = `
                    <div class="text-success">
                        <i class="fab fa-github"></i> Logged in as ${user.login}
                        <button class="btn btn-sm btn-link" onclick="logout()">Logout</button>
                    </div>
                `;
                return;
            }
        } catch (error) {
            // Token invalid, remove it
            localStorage.removeItem('github_token');
            githubToken = null;
        }
    }

    authStatus.innerHTML = `
        <div class="text-muted">
            <i class="fas fa-sign-in-alt"></i> Not authenticated
        </div>
    `;
}

// Form handling
$('input').on('focusout', function (e) {
    const input = $(this).val();
    if (input.length > 0) {
        $(this).addClass('active');
    } else {
        $(this).removeClass('active');
    }
});

$('#advancedOptions').on('click', function (e) {
    $('#advancedOptionsContainer').slideToggle();
    $('#advancedOptions i').toggleClass('fa-chevron-down fa-chevron-up');
});

$('#useHomePage').on('change', function (e) {
    if (this.checked) {
        $('#customStartupUrlContainer').slideUp();
    } else {
        $('#customStartupUrlContainer').slideDown();
    }
});

// Icon cropping
$('#icon').on('change', async function (e) {
    const file = this.files[0];
    if (file) {
        const reader = new FileReader();
        const { isConfirmed } = await Swal.fire({
            title: 'Select the desired area',
            html: '<div id="crop-select"></div>',
            didOpen: () => {
                $('#crop-select').CropSelectJs();
                $('#crop-select').CropSelectJs('setSelectionAspectRatio', 1);
                reader.onload = function (e) {
                    $('#crop-select').CropSelectJs('setImageSrc', e.target.result);
                };
                reader.readAsDataURL(new Blob([file]));
            },
            confirmButtonText: 'Confirm',
        });

        if (isConfirmed) {
            const data = $('#crop-select').CropSelectJs('getImageSrc');
            window.croppedIcon = data;
        } else {
            this.value = '';
            window.croppedIcon = null;
        }
    }
});

// Main form submission
$('#apkForm').on('submit', async (e) => {
    e.preventDefault();

    // Check authentication
    if (!isAuthenticated()) {
        const authenticated = await promptForToken();
        if (!authenticated) {
            return;
        }
    }

    const form = e.target;
    const url = form.url.value;
    const useHomePage = form.useHomePage.checked;
    const startUpUrl = useHomePage ? '' : form.startUpUrl.value;
    const additionalDomains = [
        form.additionalDomain1.value,
        form.additionalDomain2.value,
        form.additionalDomain3.value
    ].filter(d => d.trim() !== '');

    const blockMedia = form.forcePortrait.checked;
    const appName = form.name.value;
    const viewMode = form.viewMode.value;
    const adsBlocker = form.adsBlocker.checked;
    const noSslMode = form.noSslMode.checked;

    // Validation
    const DOMAIN_REGEX = /(?:[a-z0-9](?:[a-z0-9-]{0,61}[a-z0-9])?\.)+[a-z0-9][a-z0-9-]{0,61}[a-z0-9]/;
    if (!DOMAIN_REGEX.test(url)) {
        return showErrorModal('The domain is not valid');
    }

    if (!useHomePage && startUpUrl.trim() === '') {
        return showErrorModal('Please enter the startup page URL');
    }

    for (const domain of additionalDomains) {
        if (!DOMAIN_REGEX.test(domain)) {
            return showErrorModal(`The additional domain "${domain}" is not valid`);
        }
    }

    // Extract domain and generate build ID
    const domain = extractDomain(url);
    const sanitizedAppName = appName || domain.replace(/[^a-zA-Z0-9]/g, '');
    const buildId = generateBuildId();

    // Create build request
    await createBuildRequest({
        buildId,
        domain,
        url,
        additionalDomains,
        appName: sanitizedAppName,
        blockMedia,
        viewMode,
        startUpUrl: startUpUrl || `https://${domain}`,
        icon: window.croppedIcon || null,
        adsBlocker,
        noSslMode
    });
});

async function createBuildRequest(config) {
    try {
        Swal.fire({
            icon: 'info',
            title: 'Creating build request...',
            html: 'Please wait while we set up your build.',
            didOpen: () => {
                Swal.showLoading();
            },
            showConfirmButton: false,
            allowOutsideClick: false,
        });

        const issueBody = `## APK Build Request

**Build ID:** \`${config.buildId}\`
**Domain:** ${config.domain}
**App Name:** ${config.appName}

### Configuration
- **URL:** ${config.url}
- **Startup URL:** ${config.startUpUrl}
- **Additional Domains:** ${config.additionalDomains.join(', ') || 'None'}
- **Block Media:** ${config.blockMedia ? 'Yes' : 'No'}
- **Ad Blocker:** ${config.adsBlocker ? 'Yes' : 'No'}
- **Ignore SSL:** ${config.noSslMode ? 'Yes' : 'No'}
- **View Mode:** ${config.viewMode}
- **Has Custom Icon:** ${config.icon ? 'Yes' : 'No'}

### Build Data
\`\`\`json
${JSON.stringify(config, null, 2)}
\`\`\`

---
*This issue was automatically created by the APK Builder.*
`;

        const response = await fetch(`${GITHUB_API}/repos/${GITHUB_OWNER}/${GITHUB_REPO}/issues`, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'Accept': 'application/vnd.github.v3+json',
                'Authorization': `token ${githubToken}`
            },
            body: JSON.stringify({
                title: `APK Build: ${config.appName} [${config.buildId}]`,
                body: issueBody,
                labels: ['apk-build', 'automated']
            })
        });

        if (!response.ok) {
            const error = await response.json();
            throw new Error(error.message || 'Failed to create build request');
        }

        const issue = await response.json();
        console.log('Issue created:', issue);

        monitorBuildProgress(issue.number, config);

    } catch (error) {
        console.error('Build request error:', error);
        showErrorModal(error.message || 'Failed to create build request. Please try again.');
    }
}

async function monitorBuildProgress(issueNumber, config) {
    Swal.fire({
        icon: 'info',
        title: 'Building your APK...',
        html: `
            <div>The build process takes about 2-3 minutes.</div>
            <div class="mt-3"><b>Do not close this page</b></div>
            <div class="mt-2 text-muted small">
                <a href="https://github.com/${GITHUB_OWNER}/${GITHUB_REPO}/issues/${issueNumber}" target="_blank">
                    View Issue #${issueNumber}
                </a>
            </div>
        `,
        didOpen: () => {
            Swal.showLoading();
        },
        showConfirmButton: false,
        allowOutsideClick: false,
    });

    const maxAttempts = 60;
    let attempts = 0;

    const checkStatus = async () => {
        try {
            attempts++;

            const response = await fetch(
                `${GITHUB_API}/repos/${GITHUB_OWNER}/${GITHUB_REPO}/issues/${issueNumber}/comments`,
                {
                    headers: {
                        'Accept': 'application/vnd.github.v3+json',
                        'Authorization': `token ${githubToken}`
                    }
                }
            );

            if (!response.ok) {
                throw new Error('Failed to check build status');
            }

            const comments = await response.json();

            const completionComment = comments.find(c =>
                c.body.includes('✅ APK Build Complete') ||
                c.body.includes('Download APK')
            );

            const errorComment = comments.find(c =>
                c.body.includes('❌ Build Failed') ||
                c.body.includes('Build Error')
            );

            if (completionComment) {
                const urlMatch = completionComment.body.match(/https:\/\/github\.com\/[^\s)]+\.apk/);
                const downloadUrl = urlMatch ? urlMatch[0] : null;

                Swal.fire({
                    icon: 'success',
                    title: 'APK Built Successfully!',
                    html: `
                        <div class="mb-3">Your Android app is ready!</div>
                        <div><strong>App:</strong> ${config.appName}</div>
                        <div><strong>Domain:</strong> ${config.domain}</div>
                        ${downloadUrl ? `
                            <div class="mt-4">
                                <a href="${downloadUrl}" class="btn btn-primary" download>
                                    <i class="fas fa-download"></i> Download APK
                                </a>
                            </div>
                        ` : ''}
                        <div class="mt-3">
                            <a href="https://github.com/${GITHUB_OWNER}/${GITHUB_REPO}/issues/${issueNumber}" target="_blank">
                                View build details
                            </a>
                        </div>
                    `,
                    showConfirmButton: true,
                    confirmButtonText: 'Build Another',
                    showCloseButton: true,
                }).then((result) => {
                    if (result.isConfirmed) {
                        location.reload();
                    }
                });

            } else if (errorComment) {
                Swal.fire({
                    icon: 'error',
                    title: 'Build Failed',
                    html: `
                        <div>The APK build encountered an error.</div>
                        <div class="mt-3">
                            <a href="https://github.com/${GITHUB_OWNER}/${GITHUB_REPO}/issues/${issueNumber}" target="_blank">
                                View error details
                            </a>
                        </div>
                    `,
                    showConfirmButton: true,
                });

            } else if (attempts >= maxAttempts) {
                Swal.fire({
                    icon: 'warning',
                    title: 'Build Taking Longer Than Expected',
                    html: `
                        <div>The build is still in progress.</div>
                        <div class="mt-3">
                            <a href="https://github.com/${GITHUB_OWNER}/${GITHUB_REPO}/issues/${issueNumber}" target="_blank">
                                Monitor build progress
                            </a>
                        </div>
                    `,
                    showConfirmButton: true,
                });

            } else {
                setTimeout(checkStatus, 10000);
            }

        } catch (error) {
            console.error('Polling error:', error);
            Swal.fire({
                icon: 'error',
                title: 'Error Checking Status',
                html: `
                    <div>Could not check build status.</div>
                    <div class="mt-3">
                        <a href="https://github.com/${GITHUB_OWNER}/${GITHUB_REPO}/issues/${issueNumber}" target="_blank">
                            Check manually
                        </a>
                    </div>
                `,
                showConfirmButton: true,
            });
        }
    };

    setTimeout(checkStatus, 5000);
}

// Initialize on page load
$(document).ready(() => {
    updateAuthStatus();
});

// Expose logout function globally
window.logout = logout;
