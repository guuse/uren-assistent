use std::process::Command;

const SERVICE: &str = "uren-schrijven";

#[tauri::command]
pub fn get_secret(key: String) -> Result<Option<String>, String> {
    if key.is_empty() {
        return Err("key must not be empty".to_string());
    }
    let output = Command::new("security")
        .args([
            "find-generic-password",
            "-s", SERVICE,
            "-a", &key,
            "-w",
        ])
        .output()
        .map_err(|e| format!("Failed to run security: {}", e))?;

    if output.status.success() {
        let password = String::from_utf8_lossy(&output.stdout).trim().to_string();
        Ok(Some(password))
    } else {
        Ok(None)
    }
}

#[tauri::command]
pub fn set_secret(key: String, value: String) -> Result<(), String> {
    if key.is_empty() {
        return Err("key must not be empty".to_string());
    }

    // Delete existing entry first (update = delete + add)
    let _ = Command::new("security")
        .args(["delete-generic-password", "-s", SERVICE, "-a", &key])
        .output();

    // Add new entry; -T /usr/bin/security = only security CLI can read without ACL prompt.
    // Using the stable system binary avoids the per-rebuild binary-hash ACL issue.
    let output = Command::new("security")
        .args([
            "add-generic-password",
            "-s", SERVICE,
            "-a", &key,
            "-w", &value,
            "-T", "/usr/bin/security",
        ])
        .output()
        .map_err(|e| format!("Failed to run security: {}", e))?;

    if output.status.success() {
        Ok(())
    } else {
        let stderr = String::from_utf8_lossy(&output.stderr);
        Err(format!("Keychain write failed: {}", stderr.trim()))
    }
}

#[tauri::command]
pub fn delete_secret(key: String) -> Result<(), String> {
    if key.is_empty() {
        return Err("key must not be empty".to_string());
    }
    let output = Command::new("security")
        .args(["delete-generic-password", "-s", SERVICE, "-a", &key])
        .output()
        .map_err(|e| format!("Failed to run security: {}", e))?;

    // Exit code 44 = item not found — treat as success (idempotent)
    if output.status.success() || output.status.code() == Some(44) {
        Ok(())
    } else {
        let stderr = String::from_utf8_lossy(&output.stderr);
        Err(format!("Keychain delete failed: {}", stderr.trim()))
    }
}
