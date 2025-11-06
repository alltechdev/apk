// GitHub Configuration
const GITHUB_OWNER = 'alltechdev';
const GITHUB_REPO = 'apk';
const GITHUB_API = 'https://api.github.com';

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
            // Store base64 image for later use
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

    // Create build request as GitHub Issue
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
        // Show loading
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

        // Create issue body with configuration
        const issueBody = `
## APK Build Request

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
*This issue was automatically created by the APK Builder. A GitHub Action will process this request and build your APK.*
`;

        // Create issue via GitHub API
        const response = await fetch(`${GITHUB_API}/repos/${GITHUB_OWNER}/${GITHUB_REPO}/issues`, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'Accept': 'application/vnd.github.v3+json'
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

        // Start monitoring the issue for completion
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
            <div class="mt-2 text-muted small">Issue #${issueNumber}</div>
        `,
        didOpen: () => {
            Swal.showLoading();
        },
        showConfirmButton: false,
        allowOutsideClick: false,
    });

    // Poll the issue for completion
    const maxAttempts = 60; // 10 minutes
    let attempts = 0;

    const checkStatus = async () => {
        try {
            attempts++;

            // Get issue comments
            const response = await fetch(
                `${GITHUB_API}/repos/${GITHUB_OWNER}/${GITHUB_REPO}/issues/${issueNumber}/comments`,
                {
                    headers: {
                        'Accept': 'application/vnd.github.v3+json'
                    }
                }
            );

            if (!response.ok) {
                throw new Error('Failed to check build status');
            }

            const comments = await response.json();

            // Look for completion comment from bot
            const completionComment = comments.find(c =>
                c.body.includes('✅ APK Build Complete') ||
                c.body.includes('Download your APK')
            );

            const errorComment = comments.find(c =>
                c.body.includes('❌ Build Failed') ||
                c.body.includes('Build Error')
            );

            if (completionComment) {
                // Extract download URL from comment
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
                // Continue polling
                setTimeout(checkStatus, 10000); // Check every 10 seconds
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

    // Start checking after 5 seconds
    setTimeout(checkStatus, 5000);
}
