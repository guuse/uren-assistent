mod commands;

use commands::keychain::{delete_secret, get_secret, set_secret};

#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
    tauri::Builder::default()
        .plugin(tauri_plugin_keyring::init())
        .invoke_handler(tauri::generate_handler![get_secret, set_secret, delete_secret])
        .run(tauri::generate_context!())
        .expect("error while running tauri application");
}
