//! Tauri/OS glue layer — excluded from the coverage target.
//!
//! Everything here is a thin shim that either (a) is a `#[tauri::command]`
//! entry point whose only job is to wire an `AppHandle`/concrete transport
//! into the tested orchestration functions, or (b) performs an OS/network
//! side effect that can only run against the real system (the macOS `security`
//! CLI, a live browser-driven OAuth callback, Tauri's path resolver).
//!
//! The behavior lives in `super::auth`, `super::simplicate`, `super::keychain`
//! and `super::storage`, where it is unit-tested with fakes. This file is
//! ignored via `--ignore-filename-regex` when measuring coverage.

use std::process::Command;
use tauri::{AppHandle, Manager};
use tokio::net::TcpListener;
use tokio::time::Duration;

use super::auth;
use super::keychain::{CmdOutput, CommandRunner};
use super::simplicate::{run_request, ReqwestSender, SimplicateRequestArgs};
use super::storage;

// ---------------------------------------------------------------------------
// Real process runner backing the keychain commands.
// ---------------------------------------------------------------------------

/// Real runner that shells out to the macOS `security` CLI.
pub struct SecurityRunner;

impl CommandRunner for SecurityRunner {
    fn run(&self, args: &[&str]) -> std::io::Result<CmdOutput> {
        let output = Command::new("security").args(args).output()?;
        Ok(CmdOutput {
            success: output.status.success(),
            code: output.status.code(),
            stdout: output.stdout,
            stderr: output.stderr,
        })
    }
}

// ---------------------------------------------------------------------------
// Command entry points.
// ---------------------------------------------------------------------------

#[tauri::command]
pub fn get_secret(key: String) -> Result<Option<String>, String> {
    super::keychain::get_secret_with(&SecurityRunner, &key)
}

#[tauri::command]
pub fn set_secret(key: String, value: String) -> Result<(), String> {
    super::keychain::set_secret_with(&SecurityRunner, &key, &value)
}

#[tauri::command]
pub fn delete_secret(key: String) -> Result<(), String> {
    super::keychain::delete_secret_with(&SecurityRunner, &key)
}

#[tauri::command]
pub async fn simplicate_request(args: SimplicateRequestArgs) -> Result<String, String> {
    run_request(&ReqwestSender::new(), &args).await
}

#[tauri::command]
pub fn ensure_app_data_dir(app: AppHandle) -> Result<(), String> {
    let resolved = app.path().app_data_dir().map_err(|e| e.to_string());
    storage::ensure_app_data_dir_from(resolved)
}

#[tauri::command]
pub async fn start_google_oauth(app: AppHandle, client_id: String) -> Result<String, String> {
    let verifier = auth::generate_code_verifier();
    let challenge = auth::generate_code_challenge(&verifier);

    // Bind to a random ephemeral port on loopback.
    let listener = TcpListener::bind("127.0.0.1:0")
        .await
        .map_err(|e| format!("Failed to bind TCP listener: {e}"))?;
    let port = listener
        .local_addr()
        .map_err(|e| format!("Failed to get local port: {e}"))?
        .port();

    let redirect_uri = format!("http://127.0.0.1:{port}/callback");
    let auth_url = auth::build_auth_url(&client_id, &redirect_uri, &challenge);

    // Open browser to Google login.
    use tauri_plugin_opener::OpenerExt;
    app.opener()
        .open_url(&auth_url, None::<&str>)
        .map_err(|e| e.to_string())?;

    // Wait for the browser to hit our loopback server (max OAUTH_TIMEOUT_SECS).
    let code = auth::handle_callback(listener).await?;

    // Give the user 3 seconds to see the success page before the app takes focus.
    tokio::time::sleep(Duration::from_secs(3)).await;

    // Focus the app window.
    if let Some(window) = app.get_webview_window("main") {
        let _ = window.set_focus();
    }

    Ok(auth::build_result_json(&code, &verifier, &redirect_uri))
}
