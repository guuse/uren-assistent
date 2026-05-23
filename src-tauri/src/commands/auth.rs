use base64::{engine::general_purpose::URL_SAFE_NO_PAD, Engine};
use rand::RngCore;
use sha2::{Digest, Sha256};
use std::net::TcpListener;
use tauri::{AppHandle, Manager};
use tauri_plugin_opener::OpenerExt;
use tokio::io::{AsyncBufReadExt, AsyncWriteExt, BufReader};
use tokio::net::TcpListener as AsyncTcpListener;

fn generate_code_verifier() -> String {
    let mut buf = [0u8; 32];
    rand::thread_rng().fill_bytes(&mut buf);
    URL_SAFE_NO_PAD.encode(buf)
}

fn generate_code_challenge(verifier: &str) -> String {
    let hash = Sha256::digest(verifier.as_bytes());
    URL_SAFE_NO_PAD.encode(hash)
}

fn find_free_port() -> u16 {
    TcpListener::bind("127.0.0.1:0")
        .unwrap()
        .local_addr()
        .unwrap()
        .port()
}

#[tauri::command]
pub async fn start_google_oauth(app: AppHandle, client_id: String) -> Result<String, String> {
    let port = find_free_port();
    let redirect_uri = format!("http://localhost:{}/callback", port);
    let verifier = generate_code_verifier();
    let challenge = generate_code_challenge(&verifier);

    let auth_url = format!(
        "https://accounts.google.com/o/oauth2/v2/auth\
         ?client_id={client_id}\
         &redirect_uri={redirect_uri}\
         &response_type=code\
         &scope=openid%20email%20profile%20https%3A%2F%2Fwww.googleapis.com%2Fauth%2Fcalendar.readonly\
         &code_challenge={challenge}\
         &code_challenge_method=S256",
    );

    // Open browser
    app.opener().open_url(&auth_url, None::<&str>).map_err(|e| e.to_string())?;

    // Wait for callback
    let listener = AsyncTcpListener::bind(format!("127.0.0.1:{}", port))
        .await
        .map_err(|e| e.to_string())?;

    let (stream, _) = listener.accept().await.map_err(|e| e.to_string())?;
    let (reader, mut writer) = tokio::io::split(stream);
    let mut reader = BufReader::new(reader);
    let mut request_line = String::new();
    reader.read_line(&mut request_line).await.map_err(|e| e.to_string())?;

    // Extract code from GET /callback?code=xxx
    let code = request_line
        .split_whitespace()
        .nth(1)
        .and_then(|path| {
            url::Url::parse(&format!("http://localhost{}", path)).ok()
        })
        .and_then(|url| {
            url.query_pairs()
                .find(|(k, _)| k == "code")
                .map(|(_, v)| v.into_owned())
        })
        .ok_or("No code in callback")?;

    let html = "<!DOCTYPE html><html><body><p>Je bent ingelogd. Dit venster sluit automatisch.</p><script>window.close()</script></body></html>";
    let response = format!(
        "HTTP/1.1 200 OK\r\nContent-Type: text/html\r\nContent-Length: {}\r\n\r\n{}",
        html.len(),
        html
    );
    writer.write_all(response.as_bytes()).await.map_err(|e| e.to_string())?;

    if let Some(window) = app.get_webview_window("main") {
        let _ = window.set_focus();
    }

    // Return code + verifier + redirect_uri for token exchange in JS
    Ok(serde_json::json!({ "code": code, "verifier": verifier, "redirect_uri": redirect_uri }).to_string())
}
