package com.liumx.deepseekchat;

import android.content.res.AssetManager;

import java.io.ByteArrayOutputStream;
import java.io.IOException;
import java.io.InputStream;
import java.io.OutputStream;
import java.net.InetAddress;
import java.net.ServerSocket;
import java.net.Socket;
import java.nio.charset.StandardCharsets;

/**
 * 极简静态服务：把 assets/web 通过 http://127.0.0.1:<port> 暴露给 WebView。
 *
 * 为什么不用 loadUrl("file:///android_asset/index.html")：file:// 在 Chromium 里是
 * 不透明源，localStorage / IndexedDB 都不可用，聊天记录和 API Key 就存不下来。
 * 用固定的 http 源可以保证存储稳定，和桌面版保持同一套思路。
 */
public class LocalServer implements Runnable {

    private static final int[] PORTS = {17890, 17891, 17892, 17893};
    private static final String PREFIX = "web";

    private final AssetManager assets;
    private ServerSocket serverSocket;
    private Thread acceptThread;
    private int port = 0;
    private volatile boolean running = false;

    public LocalServer(AssetManager assets) {
        this.assets = assets;
    }

    public int start() throws IOException {
        IOException last = null;
        for (int candidate : PORTS) {
            try {
                ServerSocket ss = new ServerSocket(candidate, 64, InetAddress.getByName("127.0.0.1"));
                serverSocket = ss;
                port = candidate;
                running = true;
                acceptThread = new Thread(this, "deepseek-assets");
                acceptThread.setDaemon(true);
                acceptThread.start();
                return port;
            } catch (IOException e) {
                last = e;
            }
        }
        throw last == null ? new IOException("no port available") : last;
    }

    public int getPort() {
        return port;
    }

    public void stop() {
        running = false;
        try {
            if (serverSocket != null) serverSocket.close();
        } catch (IOException ignored) {
        }
    }

    @Override
    public void run() {
        while (running) {
            try {
                final Socket client = serverSocket.accept();
                Thread t = new Thread(() -> handle(client), "deepseek-assets-worker");
                t.setDaemon(true);
                t.start();
            } catch (IOException e) {
                if (!running) break;
            }
        }
    }

    private void handle(Socket client) {
        try (Socket socket = client) {
            socket.setSoTimeout(20000);
            InputStream in = socket.getInputStream();
            String requestLine = readLine(in);
            if (requestLine == null) return;
            // 吃掉请求头
            String header;
            do {
                header = readLine(in);
            } while (header != null && !header.isEmpty());

            String[] parts = requestLine.split(" ");
            String requestPath = parts.length > 1 ? parts[1] : "/";
            int q = requestPath.indexOf('?');
            if (q >= 0) requestPath = requestPath.substring(0, q);
            int hash = requestPath.indexOf('#');
            if (hash >= 0) requestPath = requestPath.substring(0, hash);
            if (requestPath.isEmpty() || "/".equals(requestPath)) requestPath = "/index.html";

            byte[] body;
            String contentType;
            try {
                body = readAsset(PREFIX + requestPath);
                contentType = mimeOf(requestPath);
            } catch (IOException notFound) {
                // SPA：找不到的路径一律回落 index.html
                body = readAsset(PREFIX + "/index.html");
                contentType = "text/html; charset=utf-8";
            }

            StringBuilder head = new StringBuilder();
            head.append("HTTP/1.1 200 OK\r\n");
            head.append("Content-Type: ").append(contentType).append("\r\n");
            head.append("Content-Length: ").append(body.length).append("\r\n");
            head.append("Cache-Control: no-store\r\n");
            head.append("Connection: close\r\n\r\n");
            OutputStream out = socket.getOutputStream();
            out.write(head.toString().getBytes(StandardCharsets.UTF_8));
            out.write(body);
            out.flush();
        } catch (Exception ignored) {
        }
    }

    private byte[] readAsset(String path) throws IOException {
        InputStream is = assets.open(path);
        try {
            ByteArrayOutputStream bos = new ByteArrayOutputStream();
            byte[] buf = new byte[16384];
            int n;
            while ((n = is.read(buf)) > 0) bos.write(buf, 0, n);
            return bos.toByteArray();
        } finally {
            try {
                is.close();
            } catch (IOException ignored) {
            }
        }
    }

    private static String readLine(InputStream in) throws IOException {
        ByteArrayOutputStream bos = new ByteArrayOutputStream();
        int c;
        while ((c = in.read()) != -1) {
            if (c == '\n') break;
            if (c != '\r') bos.write(c);
        }
        if (c == -1 && bos.size() == 0) return null;
        return new String(bos.toByteArray(), StandardCharsets.UTF_8);
    }

    private static String mimeOf(String path) {
        String p = path.toLowerCase();
        if (p.endsWith(".html") || p.endsWith(".htm")) return "text/html; charset=utf-8";
        if (p.endsWith(".js") || p.endsWith(".mjs")) return "text/javascript; charset=utf-8";
        if (p.endsWith(".css")) return "text/css; charset=utf-8";
        if (p.endsWith(".json")) return "application/json; charset=utf-8";
        if (p.endsWith(".svg")) return "image/svg+xml";
        if (p.endsWith(".png")) return "image/png";
        if (p.endsWith(".jpg") || p.endsWith(".jpeg")) return "image/jpeg";
        if (p.endsWith(".webp")) return "image/webp";
        if (p.endsWith(".gif")) return "image/gif";
        if (p.endsWith(".woff2")) return "font/woff2";
        if (p.endsWith(".woff")) return "font/woff";
        if (p.endsWith(".ttf")) return "font/ttf";
        if (p.endsWith(".wasm")) return "application/wasm";
        return "application/octet-stream";
    }
}
