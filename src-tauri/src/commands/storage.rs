use tauri::Manager;

#[tauri::command]
pub fn ensure_app_data_dir(app: tauri::AppHandle) -> Result<(), String> {
    let path = app
        .path()
        .app_data_dir()
        .map_err(|e| format!("Could not resolve app data dir: {}", e))?;
    std::fs::create_dir_all(&path)
        .map_err(|e| format!("Could not create app data dir {:?}: {}", path, e))
}
