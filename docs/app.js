// GitHub Configuration
const GITHUB_OWNER = 'alltechdev';
const GITHUB_REPO = 'apk';
const GITHUB_API = 'https://api.github.com';

// Cloudflare Worker endpoint - No authentication required!
const WORKER_URL = 'https://apk-builder-worker.abesternheim.workers.dev';

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

    const blockMedia = form.blockMedia.checked;
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

        let issueNumber, issueUrl;

        if (WORKER_URL) {
            // Use Cloudflare Worker (no authentication needed)
            const response = await fetch(WORKER_URL, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                },
                body: JSON.stringify(config)
            });

            if (!response.ok) {
                const error = await response.json();
                throw new Error(error.error || 'Failed to create build request');
            }

            const result = await response.json();
            issueNumber = result.issueNumber;
            issueUrl = result.issueUrl;

        } else {
            // Fallback: Create issue directly via GitHub API
            // This requires the user to be logged into GitHub and have repo access
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

            // Try creating without authentication (will show GitHub's login if needed)
            const form = document.createElement('form');
            form.method = 'POST';
            form.action = `https://github.com/${GITHUB_OWNER}/${GITHUB_REPO}/issues/new`;
            form.target = '_blank';

            const titleInput = document.createElement('input');
            titleInput.type = 'hidden';
            titleInput.name = 'title';
            titleInput.value = `APK Build: ${config.appName} [${config.buildId}]`;
            form.appendChild(titleInput);

            const bodyInput = document.createElement('input');
            bodyInput.type = 'hidden';
            bodyInput.name = 'body';
            bodyInput.value = issueBody;
            form.appendChild(bodyInput);

            const labelsInput = document.createElement('input');
            labelsInput.type = 'hidden';
            labelsInput.name = 'labels';
            labelsInput.value = 'apk-build,automated';
            form.appendChild(labelsInput);

            document.body.appendChild(form);
            form.submit();
            document.body.removeChild(form);

            Swal.fire({
                icon: 'info',
                title: 'Complete on GitHub',
                html: `
                    <div>A new tab has opened with a pre-filled issue.</div>
                    <div class="mt-3"><b>Click "Submit new issue" on GitHub</b></div>
                    <div class="mt-3 text-muted">The APK will be built automatically after you submit the issue.</div>
                `,
                showConfirmButton: true,
                confirmButtonText: 'OK'
            });

            return;
        }

        // Monitor build if we have issue number
        if (issueNumber) {
            monitorBuildProgress(issueNumber, config);
        }

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
                        'Accept': 'application/vnd.github.v3+json'
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

// ============================================
// APK Build History Management
// ============================================

let allReleases = [];
let currentPage = 1;
const ITEMS_PER_PAGE = 4;

// Parse release body to extract configuration
function parseReleaseConfig(body) {
    const config = {
        appName: '',
        domain: '',
        buildId: '',
        blockMedia: false,
        adBlocker: false,
        viewMode: 'AUTO',
        noSslMode: false,
        additionalDomains: []
    };

    // Extract app name
    const appNameMatch = body.match(/\*\*App Name:\*\*\s*(.+)/);
    if (appNameMatch) config.appName = appNameMatch[1].trim();

    // Extract domain
    const domainMatch = body.match(/\*\*Domain:\*\*\s*(.+)/);
    if (domainMatch) config.domain = domainMatch[1].trim();

    // Extract build ID
    const buildIdMatch = body.match(/\*\*Build ID:\*\*\s*(.+)/);
    if (buildIdMatch) config.buildId = buildIdMatch[1].trim();

    // Extract block media
    if (body.includes('Block Media: true')) config.blockMedia = true;

    // Extract ad blocker
    if (body.includes('Ad Blocker: true')) config.adBlocker = true;

    // Extract view mode
    const viewModeMatch = body.match(/View Mode:\s*(\w+)/);
    if (viewModeMatch) config.viewMode = viewModeMatch[1].trim();

    // Extract SSL mode
    if (body.includes('Ignore SSL: true')) config.noSslMode = true;

    return config;
}

// Fetch all releases from GitHub
async function fetchReleases() {
    try {
        const response = await fetch(
            `${GITHUB_API}/repos/${GITHUB_OWNER}/${GITHUB_REPO}/releases?per_page=100`,
            {
                headers: {
                    'Accept': 'application/vnd.github.v3+json'
                }
            }
        );

        if (!response.ok) {
            throw new Error('Failed to fetch releases');
        }

        const releases = await response.json();
        return releases.filter(release =>
            release.assets.length > 0 &&
            release.assets[0].name.endsWith('.apk')
        );
    } catch (error) {
        console.error('Error fetching releases:', error);
        return [];
    }
}

// Create a card for a single build
function createBuildCard(release) {
    const config = parseReleaseConfig(release.body);
    const apkAsset = release.assets.find(asset => asset.name.endsWith('.apk'));
    const downloadUrl = apkAsset ? apkAsset.browser_download_url : '#';
    const createdDate = new Date(release.created_at).toLocaleDateString();

    return `
        <div class="col-md-6">
            <div class="card h-100 shadow-sm">
                <div class="card-body">
                    <div class="d-flex justify-content-between align-items-start mb-2">
                        <h5 class="card-title mb-0">
                            <i class="fas fa-mobile-alt text-primary me-2"></i>${config.appName}
                        </h5>
                        <span class="badge bg-success rounded-pill">APK</span>
                    </div>

                    <p class="card-text text-muted small mb-3">
                        <i class="fas fa-globe me-1"></i>${config.domain}
                    </p>

                    <div class="mb-3">
                        <h6 class="small fw-bold text-muted mb-2">Configuration:</h6>
                        <div class="d-flex flex-wrap gap-1">
                            ${config.blockMedia ? '<span class="badge bg-info">Block Media</span>' : ''}
                            ${config.adBlocker ? '<span class="badge bg-info">Ad Blocker</span>' : ''}
                            ${config.noSslMode ? '<span class="badge bg-warning text-dark">Ignore SSL</span>' : ''}
                            <span class="badge bg-secondary">${config.viewMode}</span>
                        </div>
                    </div>

                    <div class="d-flex justify-content-between align-items-center">
                        <small class="text-muted">
                            <i class="far fa-calendar me-1"></i>${createdDate}
                        </small>
                        <a href="${downloadUrl}" class="btn btn-sm btn-primary" download>
                            <i class="fas fa-download me-1"></i>Download
                        </a>
                    </div>
                </div>
            </div>
        </div>
    `;
}

// Render current page of builds
function renderBuildHistory() {
    const startIdx = (currentPage - 1) * ITEMS_PER_PAGE;
    const endIdx = startIdx + ITEMS_PER_PAGE;
    const pageReleases = allReleases.slice(startIdx, endIdx);

    const buildHistoryList = $('#buildHistoryList');
    buildHistoryList.empty();

    if (pageReleases.length === 0) {
        $('#buildHistoryContent').hide();
        $('#noBuildHistory').show();
        return;
    }

    pageReleases.forEach(release => {
        buildHistoryList.append(createBuildCard(release));
    });

    // Update pagination
    const totalPages = Math.ceil(allReleases.length / ITEMS_PER_PAGE);
    $('#pageInfo').text(`Page ${currentPage} of ${totalPages}`);
    $('#prevPageBtn').prop('disabled', currentPage === 1);
    $('#nextPageBtn').prop('disabled', currentPage >= totalPages);

    $('#buildHistoryContent').show();
    $('#noBuildHistory').hide();
}

// Load and display build history
async function loadBuildHistory() {
    $('#buildHistoryLoading').show();
    $('#buildHistoryContent').hide();

    allReleases = await fetchReleases();

    $('#buildHistoryLoading').hide();

    if (allReleases.length === 0) {
        $('#noBuildHistory').show();
    } else {
        renderBuildHistory();
    }
}

// Pagination handlers
$('#prevPageBtn').on('click', function() {
    if (currentPage > 1) {
        currentPage--;
        renderBuildHistory();
        // Scroll to history section
        $('html, body').animate({
            scrollTop: $('#buildHistorySection').offset().top - 20
        }, 500);
    }
});

$('#nextPageBtn').on('click', function() {
    const totalPages = Math.ceil(allReleases.length / ITEMS_PER_PAGE);
    if (currentPage < totalPages) {
        currentPage++;
        renderBuildHistory();
        // Scroll to history section
        $('html, body').animate({
            scrollTop: $('#buildHistorySection').offset().top - 20
        }, 500);
    }
});

// Load build history when page loads
$(document).ready(function() {
    loadBuildHistory();
});
