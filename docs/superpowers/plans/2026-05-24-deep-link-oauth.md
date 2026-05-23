# Deep Link OAuth + Success Card Fallback Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Vervang de lokale TCP-server OAuth callback door een custom URL scheme (`uren-schrijven://oauth/callback`) zodat de browser-tab automatisch sluit en de app focus krijgt via het OS.

**Architecture:** `tauri-plugin-deep-link` registreert `uren-schrijven://` als macOS URL scheme. In `lib.rs` wordt een `Arc<Mutex<Option<oneshot::Sender<String>>>>` als managed state bijgehouden. De deep link event handler stuurt de ontvangen URL door via die sender. `auth.rs` maakt een oneshot channel, zet de sender in de managed state, opent de browser, en wacht op de receiver. De lokale TCP-server verdwijnt volledig.

**Tech Stack:** Rust, Tauri v2, `tauri-plugin-deep-link`, `tokio::sync::oneshot`

---

## File Map

| Actie | Bestand | Verantwoordelijkheid |
|---|---|---|
| Modify | `src-tauri/Cargo.toml` | Deep link plugin dependency toevoegen |
| Modify | `src-tauri/tauri.conf.json` | URL scheme registreren |
| Modify | `src-tauri/src/lib.rs` | Plugin init + deep link event handler + managed state |
| Modify | `src-tauri/src/commands/auth.rs` | TCP-server vervangen door deep link wachten + fallback HTML |

---

### Task 1: Voeg `tauri-plugin-deep-link` toe aan Cargo.toml

**Files:**
- Modify: `src-tauri/Cargo.toml`

- [ ] **Step 1: Voeg de plugin toe aan `[dependencies]`**

Voeg toe na de regel `tauri-plugin-fs = "2"`:

```toml
tauri-plugin-deep-link = "2"
```

Het `[dependencies]` blok ziet er dan zo uit:

```toml
[dependencies]
tauri = { version = "2", features = [] }
tauri-plugin-opener = "2"
tauri-plugin-fs = "2"
tauri-plugin-deep-link = "2"
serde = { version = "1", features = ["derive"] }
serde_json = "1"
tokio = { version = "1", features = ["full"] }
reqwest = { version = "0.12", features = ["json"] }
rand = "0.8"
sha2 = "0.10"
base64 = "0.22"
url = "2"
```

- [ ] **Step 2: Verifieer dat het compileert**

```bash
cd src-tauri && cargo fetch
```

Verwacht: geen errors. De plugin wordt gedownload.

- [ ] **Step 3: Commit**

```bash
git add src-tauri/Cargo.toml src-tauri/Cargo.lock
git commit -m "chore: add tauri-plugin-deep-link dependency"
```

---

### Task 2: Registreer het URL scheme in `tauri.conf.json`

**Files:**
- Modify: `src-tauri/tauri.conf.json`

- [ ] **Step 1: Voeg `macOS.urls` toe aan het `bundle` object**

Vervang het huidige `bundle` object:

```json
"bundle": {
  "active": true,
  "targets": "all",
  "icon": [
    "icons/32x32.png",
    "icons/128x128.png",
    "icons/128x128@2x.png",
    "icons/icon.icns",
    "icons/icon.ico"
  ]
}
```

Door:

```json
"bundle": {
  "active": true,
  "targets": "all",
  "icon": [
    "icons/32x32.png",
    "icons/128x128.png",
    "icons/128x128@2x.png",
    "icons/icon.icns",
    "icons/icon.ico"
  ],
  "macOS": {
    "urls": ["uren-schrijven://"]
  }
}
```

- [ ] **Step 2: Commit**

```bash
git add src-tauri/tauri.conf.json
git commit -m "chore: register uren-schrijven:// url scheme for deep links"
```

---

### Task 3: Deep link state en event handler in `lib.rs`

**Files:**
- Modify: `src-tauri/src/lib.rs`

- [ ] **Step 1: Vervang de volledige inhoud van `lib.rs`**

```rust
mod commands;

use commands::auth::start_google_oauth;
use commands::copilot::copilot_request;
use commands::keychain::{delete_secret, get_secret, set_secret};
use commands::simplicate::simplicate_request;
use commands::storage::ensure_app_data_dir;

use std::sync::{Arc, Mutex};
use tauri::Manager;
use tokio::sync::oneshot;

pub type OAuthSender = Arc<Mutex<Option<oneshot::Sender<String>>>>;

#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
    let oauth_tx: OAuthSender = Arc::new(Mutex::new(None));

    tauri::Builder::default()
        .plugin(tauri_plugin_opener::init())
        .plugin(tauri_plugin_fs::init())
        .plugin(tauri_plugin_deep_link::init())
        .manage(oauth_tx)
        .setup(|app| {
            let app_handle = app.handle().clone();
            app.listen("deep-link://new-url", move |event| {
                let payload = event.payload().to_string();
                // payload is a JSON array of URLs: ["uren-schrijven://oauth/callback?code=xxx"]
                // Extract the first URL string
                let url = serde_json::from_str::<Vec<String>>(&payload)
                    .ok()
                    .and_then(|v| v.into_iter().next())
                    .unwrap_or(payload);

                let sender = app_handle.state::<OAuthSender>();
                if let Ok(mut guard) = sender.lock() {
                    if let Some(tx) = guard.take() {
                        let _ = tx.send(url);
                    }
                }
            });
            Ok(())
        })
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

- [ ] **Step 2: Verifieer dat het compileert**

```bash
cd src-tauri && cargo check
```

Verwacht: geen errors.

- [ ] **Step 3: Commit**

```bash
git add src-tauri/src/lib.rs
git commit -m "feat: register deep link plugin and oauth url handler"
```

---

### Task 4: Vervang TCP-server door deep link wachten in `auth.rs`

**Files:**
- Modify: `src-tauri/src/commands/auth.rs`

- [ ] **Step 1: Vervang de volledige inhoud van `auth.rs`**

```rust
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

    let auth_url = format!(
        "https://accounts.google.com/o/oauth2/v2/auth\
         ?client_id={client_id}\
         &redirect_uri={REDIRECT_URI}\
         &response_type=code\
         &scope=openid%20email%20profile%20https%3A%2F%2Fwww.googleapis.com%2Fauth%2Fcalendar.readonly\
         &code_challenge={challenge}\
         &code_challenge_method=S256",
    );

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
        .map_err(|_| "OAuth timeout: no callback received within 120 seconds")?
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
```

- [ ] **Step 2: Verifieer dat het compileert**

```bash
cd src-tauri && cargo check
```

Verwacht: geen errors of warnings over ongebruikte imports.

- [ ] **Step 3: Commit**

```bash
git add src-tauri/src/commands/auth.rs
git commit -m "feat: replace tcp callback server with deep link oauth flow"
```

---

### Task 5: Handmatige verificatie en Google Cloud Console

Dit is een handmatige stap — niet geautomatiseerd.

- [ ] **Step 1: Voeg de redirect URI toe in Google Cloud Console**

Ga naar [Google Cloud Console](https://console.cloud.google.com/) → APIs & Services → Credentials → jouw OAuth 2.0 Client → Authorised redirect URIs.

Voeg toe: `uren-schrijven://oauth/callback`

Sla op.

- [ ] **Step 2: Test de volledige flow**

Start de app met `make run`. Klik op "Login met Google".

Verwacht:
1. Browser opent Google login pagina
2. Na inloggen: browser redirect naar `uren-schrijven://oauth/callback?code=...`
3. macOS activeert de Tauri-app automatisch
4. App logt in en toont de hoofdpagina
5. Browser-tab sluit zichzelf (of toont een lege pagina — afhankelijk van browser)

- [ ] **Step 3: Commit fallback notitie indien nodig**

Als de browser-tab niet sluit na de deep link redirect: dit is browser-afhankelijk gedrag. De app werkt correct — de tab kan handmatig gesloten worden. Geen code actie nodig.
