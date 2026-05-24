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
    .countdown {
      font-size: 13px;
      color: #bbb;
      margin-top: 8px;
    }
  </style>
</head>
<body>
  <div class="card">
    <div class="icon">
      <svg viewBox="0 0 24 24"><polyline points="20 6 9 17 4 12"/></svg>
    </div>
    <h1>Inloggen geslaagd</h1>
    <p>Je bent ingelogd en wordt teruggestuurd naar de app.</p>
    <a href="javascript:window.close()">Sluit dit tabblad</a>
    <div class="countdown" id="cd">Dit venster sluit over 3 seconden…</div>
  </div>
  <script>
    var n = 3;
    var el = document.getElementById('cd');
    var iv = setInterval(function() {
      n--;
      if (n <= 0) {
        clearInterval(iv);
        el.textContent = '';
        window.close();
      } else {
        el.textContent = 'Dit venster sluit over ' + n + (n === 1 ? ' seconde…' : ' seconden…');
      }
    }, 1000);
  </script>
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

    // Give the user 3 seconds to see the success page before the app takes focus
    tokio::time::sleep(Duration::from_secs(3)).await;

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
