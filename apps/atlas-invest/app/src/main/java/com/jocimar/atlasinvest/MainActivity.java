package com.jocimar.atlasinvest;

import android.app.Activity;
import android.os.Bundle;
import android.content.Intent;
import android.net.Uri;
import android.webkit.*;
import android.view.View;
import org.json.JSONObject;
import java.net.URL;
import javax.net.ssl.HttpsURLConnection;
import java.io.*;
import java.nio.charset.StandardCharsets;
import java.util.concurrent.*;

/** Local, trusted UI only. Native bridge cannot access accounts or submit orders. */
public final class MainActivity extends Activity {
    private static final String ORIGIN = "appassets.androidplatform.net";
    private WebView web;
    private String pendingCsv;
    private final ExecutorService pool = new ThreadPoolExecutor(2, 3, 30, TimeUnit.SECONDS,
        new ArrayBlockingQueue<>(24), new ThreadPoolExecutor.AbortPolicy());

    @Override public void onCreate(Bundle saved) {
        super.onCreate(saved);
        web = new WebView(this);
        web.setBackgroundColor(0xff0b1320);
        setContentView(web);
        web.setOnApplyWindowInsetsListener((v, insets) -> {
            v.setPadding(insets.getSystemWindowInsetLeft(), insets.getSystemWindowInsetTop(),
                insets.getSystemWindowInsetRight(), insets.getSystemWindowInsetBottom());
            return insets.consumeSystemWindowInsets();
        });
        web.requestApplyInsets();
        WebSettings s = web.getSettings();
        s.setJavaScriptEnabled(true);
        s.setDomStorageEnabled(true);
        s.setAllowFileAccess(false);
        s.setAllowContentAccess(false);
        s.setMixedContentMode(WebSettings.MIXED_CONTENT_NEVER_ALLOW);
        s.setSupportMultipleWindows(false);
        s.setSafeBrowsingEnabled(true);
        if (BuildConfig.DEBUG) WebView.setWebContentsDebuggingEnabled(true);
        web.addJavascriptInterface(new MarketBridge(), "AtlasNative");
        web.setWebViewClient(new WebViewClient() {
            @Override public boolean shouldOverrideUrlLoading(WebView v, WebResourceRequest r) {
                Uri u = r.getUrl();
                if ("https".equals(u.getScheme()) && ORIGIN.equals(u.getHost())) return false;
                if (r.isForMainFrame() && "https".equals(u.getScheme())) {
                    try { startActivity(new Intent(Intent.ACTION_VIEW, u)); }
                    catch (Exception ignored) { }
                }
                return true;
            }
            @Override public WebResourceResponse shouldInterceptRequest(WebView v, WebResourceRequest r) {
                Uri u = r.getUrl();
                if (!"https".equals(u.getScheme()) || !ORIGIN.equals(u.getHost())) return null;
                String p = u.getPath();
                if (p == null || p.contains("..") || p.contains("\\")) return empty();
                if ("/".equals(p)) p = "/index.html";
                String mime = p.endsWith(".html") ? "text/html" : p.endsWith(".css") ? "text/css" :
                    (p.endsWith(".mjs") || p.endsWith(".js")) ? "text/javascript" :
                    p.endsWith(".svg") ? "image/svg+xml" : "application/json";
                try { return new WebResourceResponse(mime, "UTF-8", getAssets().open("web" + p)); }
                catch (IOException e) { return empty(); }
            }
        });
        web.loadUrl("https://" + ORIGIN + "/index.html");
    }
    private WebResourceResponse empty() {
        return new WebResourceResponse("text/plain", "UTF-8", 404, "Not found",
            java.util.Collections.emptyMap(), new ByteArrayInputStream(new byte[0]));
    }
    private void reply(String id, JSONObject result) {
        runOnUiThread(() -> { if (web != null) web.evaluateJavascript(
            "window.__atlasReply(" + JSONObject.quote(id) + "," + result + ")", null); });
    }
    private JSONObject error(String message) {
        JSONObject o = new JSONObject();
        try { o.put("error", message); } catch (Exception ignored) { }
        return o;
    }
    private static boolean allowed(URL u) {
        if (!"https".equals(u.getProtocol()) || u.getUserInfo() != null ||
            (u.getPort() != -1 && u.getPort() != 443)) return false;
        String p = u.getPath();
        return (u.getHost().equals("brapi.dev") && (
            p.matches("/api/quote/[A-Z0-9,]{1,80}") ||
            p.equals("/api/v2/stocks/quote") || p.equals("/api/v2/stocks/historical") ||
            p.equals("/api/v2/fii/indicators"))) ||
            (u.getHost().equals("api.binance.com") && (
                p.equals("/api/v3/klines") || p.equals("/api/v3/ticker/24hr") ||
                p.equals("/api/v3/ticker/bookTicker"))) ||
            (u.getHost().equals("api.bcb.gov.br") &&
                p.matches("/dados/serie/bcdata\\.sgs\\.(1|432|433)/dados/ultimos/(1|13|260)")) ||
            (u.getHost().equals("api.gdeltproject.org") && p.equals("/api/v2/doc/doc"));
    }
    public final class MarketBridge {
        @JavascriptInterface public void saveCsv(String content) {
            if (content == null || content.length() > 1000000) return;
            runOnUiThread(() -> {
                if (pendingCsv != null) return;
                pendingCsv = content;
                Intent intent = new Intent(Intent.ACTION_CREATE_DOCUMENT);
                intent.addCategory(Intent.CATEGORY_OPENABLE);
                intent.setType("text/csv");
                intent.putExtra(Intent.EXTRA_TITLE, "atlas-diario.csv");
                try { startActivityForResult(intent, 101); }
                catch (Exception e) { pendingCsv = null; }
            });
        }
        @JavascriptInterface public void request(String id, String address, String token) {
            if (id == null || !id.matches("r[0-9]{1,12}") || address == null || address.length() > 1400) return;
            try { pool.execute(() -> {
                HttpsURLConnection c = null;
                try {
                    URL u = new URL(address);
                    if (!allowed(u)) { reply(id, error("Fonte não permitida.")); return; }
                    c = (HttpsURLConnection) u.openConnection();
                    c.setInstanceFollowRedirects(false);
                    c.setConnectTimeout(10000); c.setReadTimeout(12000);
                    c.setRequestProperty("Accept", "application/json");
                    c.setRequestProperty("User-Agent", "AtlasInvest/0.1");
                    if (u.getHost().equals("brapi.dev") && token != null && !token.trim().isEmpty()) {
                        if (!token.matches("[A-Za-z0-9_.-]{5,500}")) throw new IOException("Token inválido");
                        c.setRequestProperty("Authorization", "Bearer " + token);
                    }
                    int status = c.getResponseCode();
                    if (status != 200) { reply(id, error("HTTP " + status +
                        (status == 429 ? ": limite da fonte; tente mais tarde." : ": fonte indisponível ou plano insuficiente."))); return; }
                    ByteArrayOutputStream out = new ByteArrayOutputStream();
                    try (InputStream in = c.getInputStream()) {
                        byte[] buf = new byte[8192]; int n;
                        while ((n = in.read(buf)) != -1) {
                            if (out.size() + n > 3_000_000) throw new IOException("Resposta muito grande");
                            out.write(buf, 0, n);
                        }
                    }
                    JSONObject o = new JSONObject();
                    o.put("body", out.toString(StandardCharsets.UTF_8.name()));
                    reply(id, o);
                } catch (Exception e) { reply(id, error("Não foi possível consultar a fonte. Verifique sua conexão.")); }
                finally { if (c != null) c.disconnect(); }
            }); } catch (RejectedExecutionException e) { reply(id, error("Aguarde as consultas em andamento.")); }
        }
    }
    @Override protected void onActivityResult(int requestCode, int resultCode, Intent data) {
        super.onActivityResult(requestCode, resultCode, data);
        if (requestCode == 101) {
            if (resultCode == RESULT_OK && data != null && data.getData() != null && pendingCsv != null) {
                try (OutputStream out = getContentResolver().openOutputStream(data.getData())) {
                    if (out != null) out.write(pendingCsv.getBytes(StandardCharsets.UTF_8));
                    android.widget.Toast.makeText(this, "Diário salvo.", android.widget.Toast.LENGTH_SHORT).show();
                } catch (IOException e) {
                    android.widget.Toast.makeText(this, "Não foi possível salvar o diário.", android.widget.Toast.LENGTH_LONG).show();
                }
            }
            pendingCsv = null;
        }
    }
    @Override public void onBackPressed() {
        web.evaluateJavascript("window.atlasBack ? window.atlasBack() : false", value -> {
            if (!"true".equals(value)) super.onBackPressed();
        });
    }
    @Override protected void onDestroy() {
        pool.shutdownNow();
        if (web != null) { web.removeJavascriptInterface("AtlasNative"); web.destroy(); web = null; }
        super.onDestroy();
    }
}
