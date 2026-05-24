# Loopback OAuth (TCP Server) Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Revert OAuth callback from custom URI scheme (`uren-schrijven://`) to `http://127.0.0.1:{port}/callback` via a Tokio TCP listener, because Google blocks custom URI schemes for desktop OAuth clients.

**Architecture:** `auth.rs` binds a random ephemeral port, constructs the auth URL with the loopback redirect URI, opens the browser, accepts exactly one TCP connection, parses the `code` query param from the raw HTTP request line, serves the success card HTML response, then focuses the app window. The `OAuthSender` managed state and deep link event handler in `lib.rs` are removed (no longer needed). The deep link plugin remains registered for potential future use.

**Tech Stack:** Rust, Tauri v2, `tokio::net::TcpListener`, `tokio::io::AsyncReadExt / AsyncWriteExt`

---

## File Map

| Actie | Bestand | Verantwoordelijkheid |
|---|---|---|
| Modify | `src-tauri/src/commands/auth.rs` | TCP loopback server + success card HTML |
| Modify | `src-tauri/src/lib.rs` | Remove OAuthSender state + deep link event handler |

---

### Task 1: Rewrite `auth.rs` — loopback TCP server

**Files:**
- Modify: `src-tauri/src/commands/auth.rs`

- [ ] **Step 1: Replace the full contents of `auth.rs`**

```rust
use base64::{engine::general_purpose::URL_SAFE_NO_PAD, Engine};
use rand::RngCore;
use sha2::{Digest, Sha256};
use tauri::{AppHandle, Manager};
use tokio::io::{AsyncReadExt, AsyncWriteExt};
use tokio::net::TcpListener;
use tokio::time::{timeout, Duration};

const OAUTH_TIMEOUT_SECS: u64 = 120;

fn generate_code_verifier() -> String {
    let mut buf = [0u8; 32];
    rand::thread_rng().fill_bytes(&mut buf);
    URL_SAFE_NO_PAD.encode(buf)
}

fn generate_code_challenge(verifier: &str) -> String {
    let hash = Sha256::digest(verifier.as_bytes());
    URL_SAFE_NO_PAD.encode(hash)
}

fn success_html() -> String {
    r#"<!DOCTYPE html>
<html lang="nl">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>Inloggen geslaagd</title>
  <style>
    * { box-sizing: border-box; margin: 0; padding: 0; }
    body {
      font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif;
      background: #f5f5f5;
      display: flex;
      align-items: center;
      justify-content: center;
      min-height: 100vh;
    }
    .card {
      background: white;
      border-radius: 16px;
      padding: 48px 40px;
      text-align: center;
      box-shadow: 0 4px 24px rgba(0,0,0,0.08);
      max-width: 380px;
      width: 100%;
    }
    .icon {
      width: 64px;
      height: 64px;
      background: #22c55e;
      border-radius: 50%;
      display: flex;
      align-items: center;
      justify-content: center;
      margin: 0 auto 24px;
    }
    .icon svg {
      width: 32px;
      height: 32px;
      stroke: white;
      stroke-width: 3;
      fill: none;
    }
    h1 {
      font-size: 22px;
      font-weight: 700;
      color: #111;
      margin-bottom: 8px;
    }
    p {
      font-size: 15px;
      color: #666;
      margin-bottom: 24px;
      line-height: 1.5;
    }
    a {
      font-size: 13px;
      color: #999;
      text-decoration: none;
    }
    a:hover { text-decoration: underline; }
  </style>
</head>
<body>
  <div class="card">
    <div class="icon">
      <svg viewBox="0 0 24 24"><polyline points="20 6 9 17 4 12"/></svg>
    </div>
    <h1>Inloggen geslaagd</h1>
    <p>Je bent ingelogd. Je kunt dit tabblad sluiten en terugkeren naar de app.</p>
    <a href="javascript:window.close()">Sluit dit tabblad</a>
  </div>
</body>
</html>"#.to_string()
}

#[tauri::command]
pub async fn start_google_oauth(app: AppHandle, client_id: String) -> Result<String, String> {
    let verifier = generate_code_verifier();
    let challenge = generate_code_challenge(&verifier);

    // Bind to a random ephemeral port on loopback
    let listener = TcpListener::bind("127.0.0.1:0")
        .await
        .map_err(|e| format!("Failed to bind TCP listener: {e}"))?;
    let port = listener.local_addr()
        .map_err(|e| format!("Failed to get local port: {e}"))?
        .port();

    let redirect_uri = format!("http://127.0.0.1:{port}/callback");

    let mut auth_url = url::Url::parse("https://accounts.google.com/o/oauth2/v2/auth")
        .expect("static URL is valid");
    auth_url.query_pairs_mut()
        .append_pair("client_id", &client_id)
        .append_pair("redirect_uri", &redirect_uri)
        .append_pair("response_type", "code")
        .append_pair("scope", "openid email profile https://www.googleapis.com/auth/calendar.readonly")
        .append_pair("code_challenge", &challenge)
        .append_pair("code_challenge_method", "S256");
    let auth_url = auth_url.to_string();

    // Open browser to Google login
    use tauri_plugin_opener::OpenerExt;
    app.opener().open_url(&auth_url, None::<&str>).map_err(|e| e.to_string())?;

    // Wait for the browser to hit our loopback server (max 120 seconds)
    let (mut stream, _) = timeout(
        Duration::from_secs(OAUTH_TIMEOUT_SECS),
        listener.accept(),
    )
    .await
    .map_err(|_| format!("OAuth timeout: no callback received within {OAUTH_TIMEOUT_SECS} seconds"))?
    .map_err(|e| format!("TCP accept error: {e}"))?;

    // Read the HTTP request
    let mut buf = vec![0u8; 4096];
    let n = stream.read(&mut buf).await.map_err(|e| format!("TCP read error: {e}"))?;
    let request = String::from_utf8_lossy(&buf[..n]);

    // Extract the code from the request line: "GET /callback?code=xxx HTTP/1.1"
    let code = request
        .lines()
        .next()
        .and_then(|line| line.split_whitespace().nth(1)) // the path+query
        .and_then(|path| {
            url::Url::parse(&format!("http://localhost{path}")).ok()
        })
        .and_then(|u| {
            u.query_pairs()
                .find(|(k, _)| k == "code")
                .map(|(_, v)| v.into_owned())
        })
        .ok_or("No code found in OAuth callback")?;

    // Serve the success card HTML
    let html = success_html();
    let response = format!(
        "HTTP/1.1 200 OK\r\nContent-Type: text/html; charset=utf-8\r\nContent-Length: {}\r\nConnection: close\r\n\r\n{}",
        html.len(),
        html
    );
    let _ = stream.write_all(response.as_bytes()).await;
    drop(stream);

    // Focus the app window
    if let Some(window) = app.get_webview_window("main") {
        let _ = window.set_focus();
    }

    Ok(serde_json::json!({
        "code": code,
        "verifier": verifier,
        "redirect_uri": redirect_uri
    })
    .to_string())
}
```

- [ ] **Step 2: Verify it compiles**

```bash
cd src-tauri && cargo check 2>&1
```

Expected: no errors. Warnings about unused imports are fine as long as there are no errors.

- [ ] **Step 3: Commit**

```bash
git add src-tauri/src/commands/auth.rs
git commit -m "feat: replace deep link oauth with loopback tcp server"
```

---

### Task 2: Clean up `lib.rs` — remove OAuthSender and deep link handler

**Files:**
- Modify: `src-tauri/src/lib.rs`

- [ ] **Step 1: Replace the full contents of `lib.rs`**

```rust
mod commands;

use commands::auth::start_google_oauth;
use commands::copilot::copilot_request;
use commands::keychain::{delete_secret, get_secret, set_secret};
use commands::simplicate::simplicate_request;
use commands::storage::ensure_app_data_dir;

#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
    tauri::Builder::default()
        .plugin(tauri_plugin_opener::init())
        .plugin(tauri_plugin_fs::init())
        .plugin(tauri_plugin_deep_link::init())
        .invoke_handler(tauri::generate_handler![
            get_secret,
            set_secret,
            delete_secret,
            start_google_oauth,
            simplicate_request,
            copilot_request,
            ensure_app_data_dir,
        ])
        .run(tauri::generate_context!())
        .expect("error while running tauri application")
}
```

Note: `tauri_plugin_deep_link::init()` is kept so the registered URL scheme in `tauri.conf.json` stays active (macOS registers the scheme at app install time via the bundle config). The `OAuthSender` type, managed state, and event handler are removed.

- [ ] **Step 2: Verify it compiles**

```bash
cd src-tauri && cargo check 2>&1
```

Expected: no errors.

- [ ] **Step 3: Commit**

```bash
git add src-tauri/src/lib.rs
git commit -m "chore: remove OAuthSender state and deep link handler"
```

---

### Task 3: Update Google Cloud Console redirect URI

This is a manual step — not automated.

- [ ] **Step 1: Update redirect URI in Google Cloud Console**

Go to [Google Cloud Console](https://console.cloud.google.com/) → APIs & Services → Credentials → your OAuth 2.0 Client (Desktop app type).

Under **Authorised redirect URIs**, the loopback redirect does NOT need to be explicitly listed for Desktop app clients — Google automatically allows `http://127.0.0.1` with any port for OAuth clients of type "Desktop app". Verify your client is type "Desktop app" (not "Web application"). If it is "Web application", you must change it to "Desktop app" or add `http://127.0.0.1` as an allowed redirect URI.

Remove `uren-schrijven://oauth/callback` if you added it.

- [ ] **Step 2: Test the full flow**

Start the app with `make run`. Click "Login met Google".

Expected:
1. Browser opens Google login page
2. After login: browser redirects to `http://127.0.0.1:{port}/callback?code=...`
3. Browser shows the success card (white card, green checkmark, "Inloggen geslaagd")
4. App gets focus
5. App logs in and shows the main page

---

### Task 4: Verify no regressions

- [ ] **Step 1: Run typecheck and lint**

```bash
npm run typecheck 2>&1
npm run lint 2>&1
```

Expected: no errors.

- [ ] **Step 2: Run unit tests**

```bash
npm run test 2>&1
```

Expected: all pass.
