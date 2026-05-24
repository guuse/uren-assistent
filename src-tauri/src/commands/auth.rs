use base64::{engine::general_purpose::URL_SAFE_NO_PAD, Engine};
use rand::RngCore;
use sha2::{Digest, Sha256};
use tauri::{AppHandle, Manager};
use tokio::sync::oneshot;
use tokio::time::{timeout, Duration};

use crate::OAuthSender;

const REDIRECT_URI: &str = "uren-schrijven://oauth/callback";
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

#[tauri::command]
pub async fn start_google_oauth(app: AppHandle, client_id: String) -> Result<String, String> {
    let verifier = generate_code_verifier();
    let challenge = generate_code_challenge(&verifier);

    let mut auth_url = url::Url::parse("https://accounts.google.com/o/oauth2/v2/auth")
        .expect("static URL is valid");
    auth_url.query_pairs_mut()
        .append_pair("client_id", &client_id)
        .append_pair("redirect_uri", REDIRECT_URI)
        .append_pair("response_type", "code")
        .append_pair("scope", "openid email profile https://www.googleapis.com/auth/calendar.readonly")
        .append_pair("code_challenge", &challenge)
        .append_pair("code_challenge_method", "S256");
    let auth_url = auth_url.to_string();

    // Register one-shot sender before opening the browser
    let (tx, rx) = oneshot::channel::<String>();
    {
        let sender = app.state::<OAuthSender>();
        let mut guard = sender.lock().map_err(|e| e.to_string())?;
        *guard = Some(tx);
    }

    // Open browser to Google login
    use tauri_plugin_opener::OpenerExt;
    app.opener().open_url(&auth_url, None::<&str>).map_err(|e| e.to_string())?;

    // Wait for deep link callback (max 120 seconds)
    let callback_url = timeout(Duration::from_secs(OAUTH_TIMEOUT_SECS), rx)
        .await
        .map_err(|_| format!("OAuth timeout: no callback received within {OAUTH_TIMEOUT_SECS} seconds"))?
        .map_err(|_| "OAuth channel closed before callback")?;

    // Extract code from uren-schrijven://oauth/callback?code=xxx
    let code = url::Url::parse(&callback_url)
        .map_err(|e| format!("Invalid callback URL: {e}"))?
        .query_pairs()
        .find(|(k, _)| k == "code")
        .map(|(_, v)| v.into_owned())
        .ok_or("No code in deep link callback")?;

    // Focus the app window
    if let Some(window) = app.get_webview_window("main") {
        let _ = window.set_focus();
    }

    Ok(serde_json::json!({
        "code": code,
        "verifier": verifier,
        "redirect_uri": REDIRECT_URI
    })
    .to_string())
}
