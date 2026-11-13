package __PACKAGE_NAME__;

import android.app.Activity;
import android.content.ClipData;
import android.content.Context;
import android.content.Intent;
import android.content.res.Configuration;
import android.graphics.Color;
import android.graphics.Insets;
import android.graphics.Rect;
import android.net.Uri;
import android.os.Build;
import android.os.Bundle;
import android.util.DisplayMetrics;
import android.view.Display;
import android.view.DisplayCutout;
import android.view.View;
import android.view.Window;
import android.view.WindowInsets;
import android.view.WindowManager;
import android.webkit.JavascriptInterface;
import android.webkit.ValueCallback;
import android.webkit.WebChromeClient;
import android.webkit.WebResourceRequest;
import android.webkit.WebResourceResponse;
import android.webkit.WebSettings;
import android.webkit.WebView;
import android.webkit.WebViewClient;

import java.io.IOException;
import java.io.InputStream;
import java.net.URLConnection;
import java.util.List;
import java.util.Locale;

public class MainActivity extends Activity {
    private static final String HOST = "appassets.androidplatform.net";
    private static final String INDEX_URL = "https://" + HOST + "/www/__ENTRY_HTML__";

    private static final int FILE_CHOOSER_REQUEST_CODE = 4096;

    private WebView webView;
    private volatile String cachedDisplayMetricsJson = "{}";
    private ValueCallback<Uri[]> filePathCallback;

    private final class NativeBridge {
        @JavascriptInterface
        public String getDisplayMetricsJson() {
            refreshDisplayMetrics(webView != null ? webView.getRootWindowInsets() : null);
            return cachedDisplayMetricsJson;
        }

        @JavascriptInterface
        public void exitApp() {
            runOnUiThread(new Runnable() {
                @Override
                public void run() {
                    finish();
                }
            });
        }
    }

    @Override
    protected void onCreate(Bundle savedInstanceState) {
        super.onCreate(savedInstanceState);
        setupStatusBar();

        webView = new WebView(this);
        configureWebView(webView);
        setContentView(webView);

        attachInsetsObserver();
        refreshDisplayMetrics(null);

        webView.setWebViewClient(new WebViewClient() {
            @Override
            public WebResourceResponse shouldInterceptRequest(WebView view, WebResourceRequest request) {
                String scheme = request.getUrl().getScheme();
                String host = request.getUrl().getHost();
                String path = request.getUrl().getPath();
                if (!"https".equalsIgnoreCase(scheme) || !HOST.equalsIgnoreCase(host) || path == null) {
                    return null;
                }
                String cleanPath = path.startsWith("/") ? path.substring(1) : path;
                if (cleanPath.isEmpty() || cleanPath.endsWith("/")) {
                    cleanPath += "__ENTRY_HTML__";
                }
                if (cleanPath.contains("..")) {
                    return null;
                }
                try {
                    InputStream is = getAssets().open(cleanPath);
                    return new WebResourceResponse(guessMimeType(cleanPath), "UTF-8", is);
                } catch (IOException e) {
                    return null;
                }
            }

            @Override
            public boolean shouldOverrideUrlLoading(WebView view, WebResourceRequest request) {
                String host = request.getUrl().getHost();
                if (HOST.equalsIgnoreCase(host)) {
                    return false;
                }
                return super.shouldOverrideUrlLoading(view, request);
            }

            @Override
            public void onPageFinished(WebView view, String url) {
                super.onPageFinished(view, url);
                pushDisplayMetricsToWebView();
            }
        });

        webView.setWebChromeClient(new WebChromeClient() {
            @Override
            public boolean onShowFileChooser(WebView view, ValueCallback<Uri[]> callback, FileChooserParams params) {
                if (filePathCallback != null) {
                    filePathCallback.onReceiveValue(null);
                    filePathCallback = null;
                }
                filePathCallback = callback;
                try {
                    Intent intent = (params != null) ? params.createIntent() : new Intent(Intent.ACTION_GET_CONTENT);
                    if (params == null) {
                        intent.addCategory(Intent.CATEGORY_OPENABLE);
                        intent.setType("*/*");
                    }
                    startActivityForResult(intent, FILE_CHOOSER_REQUEST_CODE);
                    return true;
                } catch (Throwable e) {
                    if (filePathCallback != null) {
                        filePathCallback.onReceiveValue(null);
                        filePathCallback = null;
                    }
                    return false;
                }
            }
        });

        webView.loadUrl(INDEX_URL);
    }

    private void attachInsetsObserver() {
        final View decor = getWindow().getDecorView();
        decor.setOnApplyWindowInsetsListener(new View.OnApplyWindowInsetsListener() {
            @Override
            public WindowInsets onApplyWindowInsets(View v, WindowInsets insets) {
                refreshDisplayMetrics(insets);
                pushDisplayMetricsToWebView();
                return v.onApplyWindowInsets(insets);
            }
        });
        decor.post(new Runnable() {
            @Override
            public void run() {
                decor.requestApplyInsets();
                refreshDisplayMetrics(decor.getRootWindowInsets());
                pushDisplayMetricsToWebView();
            }
        });
    }

    private synchronized void refreshDisplayMetrics(WindowInsets insets) {
        DisplayMetrics dm = getResources().getDisplayMetrics();
        DisplayMetrics realDm = new DisplayMetrics();
        realDm.setTo(dm);
        try {
            WindowManager wm = (WindowManager) getSystemService(Context.WINDOW_SERVICE);
            if (wm != null && wm.getDefaultDisplay() != null) {
                wm.getDefaultDisplay().getRealMetrics(realDm);
            }
        } catch (Throwable ignored) {}

        float density = dm.density > 0f ? dm.density : 1f;
        float scaledDensity = dm.scaledDensity > 0f ? dm.scaledDensity : density;
        float fontScale = scaledDensity / density;

        int wPx = realDm.widthPixels > 0 ? realDm.widthPixels : dm.widthPixels;
        int hPx = realDm.heightPixels > 0 ? realDm.heightPixels : dm.heightPixels;
        float widthDp = wPx / density;
        float heightDp = hPx / density;

        float statusBarResDp = 0f;
        try {
            int resId = getResources().getIdentifier("status_bar_height", "dimen", "android");
            if (resId > 0) {
                statusBarResDp = getResources().getDimensionPixelSize(resId) / density;
            }
        } catch (Throwable ignored) {}

        float navBarResDp = 0f;
        try {
            int navId = getResources().getIdentifier("navigation_bar_height", "dimen", "android");
            if (navId > 0) {
                navBarResDp = getResources().getDimensionPixelSize(navId) / density;
            }
        } catch (Throwable ignored) {}

        float safeTopDp = 0f;
        float safeBottomDp = 0f;
        float safeLeftDp = 0f;
        float safeRightDp = 0f;
        float statusBarTopDp = statusBarResDp;
        float navBottomDp = 0f;

        boolean hasCutout = false;
        float uLeft = Float.MAX_VALUE;
        float uTop = Float.MAX_VALUE;
        float uRight = 0f;
        float uBottom = 0f;
        int topRectCount = 0;

        if (insets != null) {
            if (Build.VERSION.SDK_INT >= 30) {
                try {
                    Insets sb = insets.getInsetsIgnoringVisibility(WindowInsets.Type.statusBars());
                    Insets nb = insets.getInsetsIgnoringVisibility(WindowInsets.Type.navigationBars());
                    Insets dc = insets.getInsetsIgnoringVisibility(WindowInsets.Type.displayCutout());
                    statusBarTopDp = Math.max(statusBarTopDp, sb.top / density);
                    navBottomDp = nb.bottom / density;
                    safeTopDp = Math.max(dc.top / density, statusBarTopDp);
                    safeBottomDp = Math.max(dc.bottom / density, navBottomDp);
                    safeLeftDp = Math.max(dc.left, sb.left) / density;
                    safeRightDp = Math.max(dc.right, sb.right) / density;
                } catch (Throwable ignored) {}
            } else {
                safeTopDp = Math.max(insets.getSystemWindowInsetTop() / density, statusBarResDp);
                safeBottomDp = insets.getSystemWindowInsetBottom() / density;
                safeLeftDp = insets.getSystemWindowInsetLeft() / density;
                safeRightDp = insets.getSystemWindowInsetRight() / density;
            }

            if (Build.VERSION.SDK_INT >= 28) {
                try {
                    DisplayCutout cutout = insets.getDisplayCutout();
                    if (cutout != null) {
                        safeTopDp = Math.max(safeTopDp, cutout.getSafeInsetTop() / density);
                        safeBottomDp = Math.max(safeBottomDp, cutout.getSafeInsetBottom() / density);
                        safeLeftDp = Math.max(safeLeftDp, cutout.getSafeInsetLeft() / density);
                        safeRightDp = Math.max(safeRightDp, cutout.getSafeInsetRight() / density);
                        List<Rect> rects = cutout.getBoundingRects();
                        if (rects != null) {
                            for (Rect r : rects) {
                                if (r == null || r.isEmpty()) continue;
                                // Only consider top-edge cutouts for status-bar capsule alignment
                                if (r.top < hPx * 0.25f) {
                                    hasCutout = true;
                                    topRectCount++;
                                    uLeft = Math.min(uLeft, r.left / density);
                                    uTop = Math.min(uTop, r.top / density);
                                    uRight = Math.max(uRight, r.right / density);
                                    uBottom = Math.max(uBottom, r.bottom / density);
                                }
                            }
                        }
                    }
                } catch (Throwable ignored) {}
            }
        } else {
            safeTopDp = statusBarResDp;
        }

        if (safeBottomDp == 0f && navBarResDp > 0f && Build.VERSION.SDK_INT < 30) {
            navBottomDp = navBarResDp;
        }

        float cutoutLeftDp = hasCutout ? uLeft : 0f;
        float cutoutTopDp = hasCutout ? uTop : 0f;
        float cutoutRightDp = hasCutout ? uRight : 0f;
        float cutoutBottomDp = hasCutout ? uBottom : 0f;
        float cutoutWidthDp = hasCutout ? Math.max(0f, uRight - uLeft) : 0f;
        float cutoutHeightDp = hasCutout ? Math.max(0f, uBottom - uTop) : 0f;
        float cutoutCenterXDp = hasCutout ? (uLeft + uRight) * 0.5f : (widthDp * 0.5f);
        float cutoutCenterYDp = hasCutout ? (uTop + uBottom) * 0.5f : 0f;
        float cutoutRelCenterX = (hasCutout && widthDp > 0f) ? (cutoutCenterXDp / widthDp) : 0.5f;

        cachedDisplayMetricsJson = String.format(
            Locale.US,
            "{\"density\":%.4f,\"fontScale\":%.4f,\"widthPx\":%d,\"heightPx\":%d,\"widthDp\":%.2f,\"heightDp\":%.2f," +
            "\"statusBarResDp\":%.2f,\"statusBarTopDp\":%.2f,\"navBottomDp\":%.2f," +
            "\"safeTopDp\":%.2f,\"safeBottomDp\":%.2f,\"safeLeftDp\":%.2f,\"safeRightDp\":%.2f," +
            "\"hasCutout\":%s,\"topRectCount\":%d,\"cutoutLeftDp\":%.2f,\"cutoutTopDp\":%.2f," +
            "\"cutoutRightDp\":%.2f,\"cutoutBottomDp\":%.2f,\"cutoutWidthDp\":%.2f,\"cutoutHeightDp\":%.2f," +
            "\"cutoutCenterXDp\":%.2f,\"cutoutCenterYDp\":%.2f,\"cutoutRelCenterX\":%.4f," +
            "\"manufacturer\":%s,\"brand\":%s,\"model\":%s,\"sdkInt\":%d}",
            density, fontScale, wPx, hPx, widthDp, heightDp,
            statusBarResDp, statusBarTopDp, navBottomDp,
            safeTopDp, safeBottomDp, safeLeftDp, safeRightDp,
            hasCutout ? "true" : "false", topRectCount, cutoutLeftDp, cutoutTopDp,
            cutoutRightDp, cutoutBottomDp, cutoutWidthDp, cutoutHeightDp,
            cutoutCenterXDp, cutoutCenterYDp, cutoutRelCenterX,
            jsonQuote(Build.MANUFACTURER), jsonQuote(Build.BRAND), jsonQuote(Build.MODEL), Build.VERSION.SDK_INT
        );
    }

    private static String jsonQuote(String s) {
        if (s == null) return "\"\"";
        StringBuilder sb = new StringBuilder("\"");
        for (int i = 0; i < s.length(); i++) {
            char c = s.charAt(i);
            if (c == '"' || c == '\\') sb.append('\\').append(c);
            else if (c == '\n') sb.append("\\n");
            else if (c == '\r') sb.append("\\r");
            else if (c >= 32) sb.append(c);
        }
        return sb.append('"').toString();
    }

    private void pushDisplayMetricsToWebView() {
        if (webView == null) return;
        final String payload = cachedDisplayMetricsJson;
        final String js = "try{window.__ANDROID_DISPLAY_METRICS__=" + payload +
            ";window.__applyAndroidDisplayMetrics&&window.__applyAndroidDisplayMetrics(window.__ANDROID_DISPLAY_METRICS__);}catch(e){}";
        webView.post(new Runnable() {
            @Override
            public void run() {
                if (webView != null) {
                    webView.evaluateJavascript(js, null);
                }
            }
        });
    }

    @Override
    protected void onResume() {
        super.onResume();
        setupStatusBar();
        if (webView != null) {
            webView.onResume();
            View decor = getWindow().getDecorView();
            refreshDisplayMetrics(decor.getRootWindowInsets());
            pushDisplayMetricsToWebView();
        }
    }

    @Override
    protected void onPause() {
        if (webView != null) {
            webView.onPause();
        }
        super.onPause();
    }

    @Override
    public void onWindowFocusChanged(boolean hasFocus) {
        super.onWindowFocusChanged(hasFocus);
        if (hasFocus) {
            setupStatusBar();
            View decor = getWindow().getDecorView();
            refreshDisplayMetrics(decor.getRootWindowInsets());
            pushDisplayMetricsToWebView();
        }
    }

    @Override
    protected void onActivityResult(int requestCode, int resultCode, Intent data) {
        if (requestCode == FILE_CHOOSER_REQUEST_CODE && filePathCallback != null) {
            Uri[] results = null;
            if (resultCode == Activity.RESULT_OK && data != null) {
                String dataStr = data.getDataString();
                ClipData clipData = data.getClipData();
                if (clipData != null && clipData.getItemCount() > 0) {
                    results = new Uri[clipData.getItemCount()];
                    for (int i = 0; i < clipData.getItemCount(); i++) {
                        results[i] = clipData.getItemAt(i).getUri();
                    }
                } else if (dataStr != null) {
                    results = new Uri[]{ Uri.parse(dataStr) };
                } else if (data.getData() != null) {
                    results = new Uri[]{ data.getData() };
                }
            }
            filePathCallback.onReceiveValue(results);
            filePathCallback = null;
            return;
        }
        super.onActivityResult(requestCode, resultCode, data);
    }

    @Override
    public void onConfigurationChanged(Configuration newConfig) {
        super.onConfigurationChanged(newConfig);
        setupStatusBar();
        if (webView != null) {
            final View decor = getWindow().getDecorView();
            decor.post(new Runnable() {
                @Override
                public void run() {
                    decor.requestApplyInsets();
                    refreshDisplayMetrics(decor.getRootWindowInsets());
                    pushDisplayMetricsToWebView();
                }
            });
        }
    }

    @Override
    protected void onDestroy() {
        if (webView != null) {
            webView.destroy();
            webView = null;
        }
        super.onDestroy();
    }

    private void setupStatusBar() {
        try {
            Window window = getWindow();
            window.clearFlags(0x04000c00);
            window.addFlags(WindowManager.LayoutParams.FLAG_DRAWS_SYSTEM_BAR_BACKGROUNDS);
            window.setStatusBarColor(Color.TRANSPARENT);
            window.setNavigationBarColor(Color.TRANSPARENT);

            if (Build.VERSION.SDK_INT >= 28) {
                WindowManager.LayoutParams lp = window.getAttributes();
                lp.layoutInDisplayCutoutMode = (Build.VERSION.SDK_INT >= 30)
                    ? WindowManager.LayoutParams.LAYOUT_IN_DISPLAY_CUTOUT_MODE_ALWAYS
                    : WindowManager.LayoutParams.LAYOUT_IN_DISPLAY_CUTOUT_MODE_SHORT_EDGES;
                window.setAttributes(lp);
            }

            View decor = window.getDecorView();
            decor.setSystemUiVisibility(0x1504);

            if (Build.VERSION.SDK_INT >= 23) {
                Display display = window.getWindowManager().getDefaultDisplay();
                if (display != null) {
                    Display.Mode cur = display.getMode();
                    Display.Mode[] modes = display.getSupportedModes();
                    if (cur != null && modes != null) {
                        int w = cur.getPhysicalWidth();
                        int h = cur.getPhysicalHeight();
                        Display.Mode best = cur;
                        for (Display.Mode m : modes) {
                            if (m.getPhysicalWidth() == w && m.getPhysicalHeight() == h) {
                                float rr = m.getRefreshRate();
                                if (rr <= 122.0f && rr > best.getRefreshRate()) {
                                    best = m;
                                }
                            }
                        }
                        if (best != cur) {
                            WindowManager.LayoutParams lp = window.getAttributes();
                            lp.preferredDisplayModeId = best.getModeId();
                            lp.preferredRefreshRate = best.getRefreshRate();
                            window.setAttributes(lp);
                        }
                    }
                }
            }
        } catch (Throwable ignored) {}
    }

    @Override
    public void onBackPressed() {
        if (webView != null) {
            webView.evaluateJavascript(
                "(function(){try{return !!(window.handleAndroidHardwareBack&&window.handleAndroidHardwareBack());}catch(e){return false;}})();",
                new ValueCallback<String>() {
                    @Override
                    public void onReceiveValue(String value) {
                        if ("true".equals(value)) {
                            return;
                        }
                        if (webView != null && webView.canGoBack()) {
                            webView.goBack();
                        } else if (!isFinishing()) {
                            finish();
                        }
                    }
                }
            );
            return;
        }
        super.onBackPressed();
    }

    private void configureWebView(WebView view) {
        WebSettings s = view.getSettings();
        s.setJavaScriptEnabled(true);
        s.setDomStorageEnabled(true);
        s.setDatabaseEnabled(true);
        s.setAllowFileAccess(true);
        s.setCacheMode(WebSettings.LOAD_NO_CACHE);
        s.setUseWideViewPort(true);
        s.setLoadWithOverviewMode(true);
        s.setTextZoom(100);
        if (Build.VERSION.SDK_INT >= 21) {
            s.setMixedContentMode(WebSettings.MIXED_CONTENT_ALWAYS_ALLOW);
        }
        view.setOverScrollMode(View.OVER_SCROLL_NEVER);
        view.setHorizontalScrollBarEnabled(false);
        view.addJavascriptInterface(new NativeBridge(), "AndroidNativeBridge");
    }

    private String guessMimeType(String path) {
        String lower = path.toLowerCase(Locale.US);
        if (lower.endsWith(".html") || lower.endsWith(".htm")) return "text/html";
        if (lower.endsWith(".js") || lower.endsWith(".mjs")) return "application/javascript";
        if (lower.endsWith(".css")) return "text/css";
        if (lower.endsWith(".json")) return "application/json";
        if (lower.endsWith(".woff2")) return "font/woff2";
        if (lower.endsWith(".woff")) return "font/woff";
        if (lower.endsWith(".ttf")) return "font/ttf";
        if (lower.endsWith(".svg")) return "image/svg+xml";
        if (lower.endsWith(".png")) return "image/png";
        if (lower.endsWith(".jpg") || lower.endsWith(".jpeg")) return "image/jpeg";
        if (lower.endsWith(".webp")) return "image/webp";
        if (lower.endsWith(".wav")) return "audio/wav";
        if (lower.endsWith(".mp3")) return "audio/mpeg";
        String guess = URLConnection.guessContentTypeFromName(path);
        return guess != null ? guess : "application/octet-stream";
    }
}
