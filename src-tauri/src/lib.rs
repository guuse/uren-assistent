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
