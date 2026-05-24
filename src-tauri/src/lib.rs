mod commands;

use commands::auth::start_google_oauth;
use commands::copilot::copilot_request;
use commands::keychain::{delete_secret, get_secret, set_secret};
use commands::simplicate::simplicate_request;
use commands::storage::ensure_app_data_dir;

use std::sync::{Arc, Mutex};
use tauri::{Listener, Manager};
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
                };
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
