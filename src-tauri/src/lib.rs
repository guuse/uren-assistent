mod commands;

use commands::glue::{
    delete_secret, ensure_app_data_dir, get_secret, set_secret, simplicate_request,
    start_google_oauth,
};

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
            ensure_app_data_dir,
        ])
        .run(tauri::generate_context!())
        .expect("error while running tauri application")
}
