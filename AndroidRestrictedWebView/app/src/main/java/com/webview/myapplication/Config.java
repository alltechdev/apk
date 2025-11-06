package com.webview.myapplication;

import android.content.Context;
import org.json.JSONArray;
import org.json.JSONObject;
import java.io.InputStream;
import java.nio.charset.StandardCharsets;
import java.util.ArrayList;
import java.util.List;

public class Config {
    private String domain;
    private String startUrl;
    private List<String> allowedDomains;
    private boolean blockMedia;
    private boolean adBlocker;
    private boolean ignoreSSLErrors;
    private String orientation;

    public static Config load(Context context) {
        try {
            InputStream is = context.getAssets().open("config.json");
            int size = is.available();
            byte[] buffer = new byte[size];
            is.read(buffer);
            is.close();

            String json = new String(buffer, StandardCharsets.UTF_8);
            JSONObject obj = new JSONObject(json);

            Config config = new Config();
            config.domain = obj.getString("domain");
            config.startUrl = obj.getString("startUrl");
            config.blockMedia = obj.getBoolean("blockMedia");
            config.adBlocker = obj.getBoolean("adBlocker");
            config.ignoreSSLErrors = obj.getBoolean("ignoreSSLErrors");
            config.orientation = obj.getString("orientation");

            config.allowedDomains = new ArrayList<>();
            JSONArray domainsArray = obj.getJSONArray("allowedDomains");
            for (int i = 0; i < domainsArray.length(); i++) {
                config.allowedDomains.add(domainsArray.getString(i));
            }

            return config;
        } catch (Exception e) {
            e.printStackTrace();
            return null;
        }
    }

    public String getDomain() {
        return domain;
    }

    public String getStartUrl() {
        return startUrl;
    }

    public List<String> getAllowedDomains() {
        return allowedDomains;
    }

    public boolean isBlockMedia() {
        return blockMedia;
    }

    public boolean isAdBlocker() {
        return adBlocker;
    }

    public boolean isIgnoreSSLErrors() {
        return ignoreSSLErrors;
    }

    public String getOrientation() {
        return orientation;
    }

    public boolean isForcePortrait() {
        return "PORTRAIT".equals(orientation);
    }

    public boolean isForceLandscape() {
        return "LANDSCAPE".equals(orientation);
    }

    public boolean isUrlAllowed(String url) {
        if (url == null) return false;

        for (String domain : allowedDomains) {
            if (url.contains(domain)) {
                return true;
            }
        }
        return false;
    }
}
