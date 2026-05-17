use tauri_plugin_keyring::KeyringExt;

#[tauri::command]
pub async fn get_secret(app: tauri::AppHandle, key: String) -> Result<Option<String>, String> {
    let keyring = app.keyring();
    match keyring.get_password("uren-schrijven", &key) {
        Ok(password) => Ok(Some(password)),
        Err(keyring::Error::NoEntry) => Ok(None),
        Err(e) => Err(e.to_string()),
    }
}

#[tauri::command]
pub async fn set_secret(app: tauri::AppHandle, key: String, value: String) -> Result<(), String> {
    let keyring = app.keyring();
    keyring
        .set_password("uren-schrijven", &key, &value)
        .map_err(|e| e.to_string())
}

#[tauri::command]
pub async fn delete_secret(app: tauri::AppHandle, key: String) -> Result<(), String> {
    let keyring = app.keyring();
    match keyring.delete_password("uren-schrijven", &key) {
        Ok(()) => Ok(()),
        Err(keyring::Error::NoEntry) => Ok(()),
        Err(e) => Err(e.to_string()),
    }
}
