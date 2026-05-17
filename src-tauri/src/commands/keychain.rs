use tauri_plugin_keyring::KeyringExt;

const SERVICE: &str = "uren-schrijven";

#[tauri::command]
pub fn get_secret(app: tauri::AppHandle, key: String) -> Result<Option<String>, String> {
    if key.is_empty() {
        return Err("key must not be empty".to_string());
    }
    let keyring = app.keyring();
    match keyring.get_password(SERVICE, &key) {
        Ok(password) => Ok(Some(password)),
        Err(keyring::Error::NoEntry) => Ok(None),
        Err(e) => {
            eprintln!("[keychain] get_secret error for key '{}': {}", key, e);
            Err("Keychain operation failed".to_string())
        }
    }
}

#[tauri::command]
pub fn set_secret(app: tauri::AppHandle, key: String, value: String) -> Result<(), String> {
    if key.is_empty() {
        return Err("key must not be empty".to_string());
    }
    let keyring = app.keyring();
    keyring.set_password(SERVICE, &key, &value).map_err(|e| {
        eprintln!("[keychain] set_secret error for key '{}': {}", key, e);
        "Keychain operation failed".to_string()
    })
}

#[tauri::command]
pub fn delete_secret(app: tauri::AppHandle, key: String) -> Result<(), String> {
    if key.is_empty() {
        return Err("key must not be empty".to_string());
    }
    let keyring = app.keyring();
    match keyring.delete_password(SERVICE, &key) {
        Ok(()) => Ok(()),
        Err(keyring::Error::NoEntry) => Ok(()), // idempotent: deleting a non-existent key is not an error
        Err(e) => {
            eprintln!("[keychain] delete_secret error for key '{}': {}", key, e);
            Err("Keychain operation failed".to_string())
        }
    }
}
