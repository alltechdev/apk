package com.webview.myapplication;

import android.Manifest;
import android.annotation.SuppressLint;
import android.app.Activity;
import android.app.AlertDialog;
import android.app.DownloadManager;
import android.content.Context;
import android.content.pm.ActivityInfo;
import android.net.Uri;
import android.os.Build;
import android.os.Bundle;
import android.os.Environment;
import android.view.View;
import android.webkit.CookieManager;
import android.webkit.URLUtil;
import android.webkit.WebChromeClient;
import android.webkit.WebChromeClient.CustomViewCallback;
import android.webkit.WebSettings;
import android.webkit.WebView;
import android.webkit.WebViewClient;
import android.widget.FrameLayout;
import android.widget.ProgressBar;
import android.widget.Toast;
import android.content.pm.PackageManager;
import androidx.core.content.ContextCompat;

import androidx.annotation.RequiresApi;
import androidx.core.app.ActivityCompat;

import android.webkit.SslErrorHandler;
import android.net.http.SslError;
import android.webkit.WebResourceRequest;
import android.webkit.WebResourceResponse;

public class MainActivity extends Activity {
    private final int STORAGE_PERMISSION_CODE = 1;
    private Config config;
    private WebView mWebView;
    private View mCustomView;
    private CustomViewCallback mCustomViewCallback;
    private ProgressBar mProgressBar;

    private void requestStoragePermission() {
        if (ActivityCompat.shouldShowRequestPermissionRationale(this, Manifest.permission.READ_EXTERNAL_STORAGE)) {
            new AlertDialog.Builder(this)
                    .setTitle("Permission needed")
                    .setMessage("This permission is needed to download files")
                    .setPositiveButton("ok", (dialog, which) -> ActivityCompat.requestPermissions(MainActivity.this,
                            new String[]{Manifest.permission.READ_EXTERNAL_STORAGE}, STORAGE_PERMISSION_CODE))
                    .setNegativeButton("cancel", (dialog, which) -> dialog.dismiss())
                    .create().show();
        } else {
            ActivityCompat.requestPermissions(this,
                    new String[]{Manifest.permission.READ_EXTERNAL_STORAGE}, STORAGE_PERMISSION_CODE);
        }
    }

    @RequiresApi(api = Build.VERSION_CODES.Q)
    @Override
    @SuppressLint("SetJavaScriptEnabled")
    protected void onCreate(Bundle savedInstanceState) {
        if (ContextCompat.checkSelfPermission(this, Manifest.permission.READ_EXTERNAL_STORAGE) != PackageManager.PERMISSION_GRANTED) {
            requestStoragePermission();
        }
        super.onCreate(savedInstanceState);

        // Load configuration
        config = Config.load(this);
        if (config == null) {
            Toast.makeText(this, "Failed to load configuration", Toast.LENGTH_LONG).show();
            finish();
            return;
        }

        // Set orientation
        if (config.isForcePortrait()) {
            setRequestedOrientation(ActivityInfo.SCREEN_ORIENTATION_PORTRAIT);
        } else if (config.isForceLandscape()) {
            setRequestedOrientation(ActivityInfo.SCREEN_ORIENTATION_LANDSCAPE);
        }

        setContentView(R.layout.activity_main);
        mWebView = findViewById(R.id.activity_main_webview);
        mProgressBar = findViewById(R.id.progressBar);
        WebSettings webSettings = mWebView.getSettings();
        webSettings.setJavaScriptEnabled(true);

        // Apply media blocking
        if (config.isBlockMedia()) {
            // Block images
            webSettings.setBlockNetworkImage(true);
            webSettings.setLoadsImagesAutomatically(false);

            // Block videos and audio autoplay
            webSettings.setMediaPlaybackRequiresUserGesture(true);
        }

        mWebView.setWebChromeClient(new WebChromeClient() {
            @Override
            public void onShowCustomView(View view, CustomViewCallback callback) {
                if (mCustomView != null) {
                    callback.onCustomViewHidden();
                    return;
                }
                mCustomView = view;
                mWebView.setVisibility(View.GONE);
                mCustomViewCallback = callback;
                ((FrameLayout) getWindow().getDecorView()).addView(mCustomView);
                getWindow().getDecorView().setSystemUiVisibility(View.SYSTEM_UI_FLAG_FULLSCREEN);
                setRequestedOrientation(ActivityInfo.SCREEN_ORIENTATION_UNSPECIFIED);
            }

            @Override
            public void onHideCustomView() {
                ((FrameLayout) getWindow().getDecorView()).removeView(mCustomView);
                mCustomView = null;
                mWebView.setVisibility(View.VISIBLE);
                getWindow().getDecorView().setSystemUiVisibility(View.SYSTEM_UI_FLAG_VISIBLE);
                mCustomViewCallback.onCustomViewHidden();
                mCustomViewCallback = null;
                if (config.isForcePortrait()) {
                    setRequestedOrientation(ActivityInfo.SCREEN_ORIENTATION_PORTRAIT);
                } else if (config.isForceLandscape()) {
                    setRequestedOrientation(ActivityInfo.SCREEN_ORIENTATION_LANDSCAPE);
                }
            }
        });

        mWebView.setWebViewClient(new HelloWebViewClient());
        mWebView.setDownloadListener((url, userAgent, contentDisposition, mimeType, contentLength) -> {
            Uri source = Uri.parse(url);
            DownloadManager.Request request = new DownloadManager.Request(source);
            String cookies = CookieManager.getInstance().getCookie(url);
            request.addRequestHeader("cookie", cookies);
            request.addRequestHeader("User-Agent", userAgent);
            request.setDescription("Downloading File...");
            request.setTitle(URLUtil.guessFileName(url, contentDisposition, mimeType));
            request.allowScanningByMediaScanner();
            request.setNotificationVisibility(DownloadManager.Request.VISIBILITY_VISIBLE_NOTIFY_COMPLETED);
            request.setDestinationInExternalPublicDir(Environment.DIRECTORY_DOWNLOADS, URLUtil.guessFileName(url, contentDisposition, mimeType));
            DownloadManager dm = (DownloadManager) getSystemService(Context.DOWNLOAD_SERVICE);
            dm.enqueue(request);
            Toast.makeText(getApplicationContext(), "Downloading File", Toast.LENGTH_LONG).show();
        });
        mWebView.loadUrl(config.getStartUrl());
    }

    private class HelloWebViewClient extends WebViewClient {
        @Override
        public boolean shouldOverrideUrlLoading(final WebView view, final String url) {
            // Check if URL is allowed
            if (config.isUrlAllowed(url)) {
                mProgressBar.setVisibility(View.VISIBLE);

                // Ad blocking
                if (config.isAdBlocker() && isAdUrl(url)) {
                    return true; // Block the request
                }

                view.loadUrl(url);
                return true;
            } else {
                Toast.makeText(view.getContext(), "This URL is not allowed", Toast.LENGTH_SHORT).show();
                return true;
            }
        }

        @Override
        public WebResourceResponse shouldInterceptRequest(WebView view, WebResourceRequest request) {
            String url = request.getUrl().toString();

            // Block media resources if blockMedia is enabled
            // Only block if this is not a main frame request (not a page navigation)
            if (config.isBlockMedia() && !request.isForMainFrame() && isMediaUrl(url)) {
                // Return empty response to block the media
                return new WebResourceResponse("text/plain", "UTF-8", null);
            }

            // Block ads if adBlocker is enabled
            if (config.isAdBlocker() && isAdUrl(url)) {
                return new WebResourceResponse("text/plain", "UTF-8", null);
            }

            return super.shouldInterceptRequest(view, request);
        }

        @Override
        public void onPageFinished(WebView view, String url) {
            super.onPageFinished(view, url);
            mProgressBar.setVisibility(View.GONE);
        }

        @Override
        public void onReceivedSslError(WebView view, SslErrorHandler handler, SslError error) {
            if (config.isIgnoreSSLErrors()) {
                handler.proceed(); // Ignore SSL certificate errors
            } else {
                super.onReceivedSslError(view, handler, error);
            }
        }
    }

    private boolean isMediaUrl(String url) {
        // Check for common media file extensions and streaming domains
        String lowerUrl = url.toLowerCase();

        // Image formats
        String[] imageExtensions = {".jpg", ".jpeg", ".png", ".gif", ".bmp", ".webp", ".svg", ".ico"};
        for (String ext : imageExtensions) {
            if (lowerUrl.endsWith(ext) || lowerUrl.contains(ext + "?")) {
                return true;
            }
        }

        // Video formats
        String[] videoExtensions = {".mp4", ".webm", ".ogg", ".mov", ".avi", ".mkv", ".flv", ".m4v", ".3gp"};
        for (String ext : videoExtensions) {
            if (lowerUrl.endsWith(ext) || lowerUrl.contains(ext + "?")) {
                return true;
            }
        }

        // Audio formats
        String[] audioExtensions = {".mp3", ".wav", ".ogg", ".m4a", ".aac", ".flac", ".wma"};
        for (String ext : audioExtensions) {
            if (lowerUrl.endsWith(ext) || lowerUrl.contains(ext + "?")) {
                return true;
            }
        }

        // Embedded video player domains (specific domains only, not broad patterns)
        String[] mediaPatterns = {
            "youtube.com/embed",
            "youtube-nocookie.com/embed",
            "player.vimeo.com",
            "dailymotion.com/embed",
            "streamable.com/e/",
            "streamable.com/o/"
        };
        for (String pattern : mediaPatterns) {
            if (lowerUrl.contains(pattern)) {
                return true;
            }
        }

        return false;
    }

    private boolean isAdUrl(String url) {
        // Simple ad blocking based on common ad domains
        String[] adDomains = {
            "doubleclick.net", "googlesyndication.com", "googleadservices.com",
            "advertising.com", "adnxs.com", "quantserve.com", "scorecardresearch.com",
            "facebook.com/tr", "connect.facebook.net", "google-analytics.com",
            "googletagmanager.com", "advertising.amazon.com", "ads.yahoo.com"
        };

        String lowerUrl = url.toLowerCase();
        for (String adDomain : adDomains) {
            if (lowerUrl.contains(adDomain)) {
                return true;
            }
        }
        return false;
    }

    @Override
    public void onBackPressed() {
        if (mCustomView != null) {
            mWebView.getWebChromeClient().onHideCustomView();
        } else if (mWebView.canGoBack()) {
            mWebView.goBack();
        } else {
            super.onBackPressed();
        }
    }
}
