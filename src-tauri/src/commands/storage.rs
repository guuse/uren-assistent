use std::path::{Path, PathBuf};

/// Create the application data directory (and any missing parents).
/// Split out from the Tauri command so it can be tested against a real
/// temp path without an `AppHandle`.
pub fn create_app_data_dir(path: &Path) -> Result<(), String> {
    std::fs::create_dir_all(path)
        .map_err(|e| format!("Could not create app data dir {:?}: {}", path, e))
}

/// Map the resolver's outcome into the final command result. Keeps the
/// error-wrapping logic testable independent of Tauri's path API.
pub fn ensure_app_data_dir_from(
    resolved: Result<PathBuf, String>,
) -> Result<(), String> {
    let path = resolved.map_err(|e| format!("Could not resolve app data dir: {}", e))?;
    create_app_data_dir(&path)
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn create_app_data_dir_creates_nested_dirs() {
        let base = std::env::temp_dir().join(format!("uren-test-{}", std::process::id()));
        let nested = base.join("a").join("b");
        let _ = std::fs::remove_dir_all(&base);

        assert!(create_app_data_dir(&nested).is_ok());
        assert!(nested.is_dir());

        // Idempotent: creating again succeeds.
        assert!(create_app_data_dir(&nested).is_ok());

        let _ = std::fs::remove_dir_all(&base);
    }

    #[test]
    fn create_app_data_dir_errors_when_path_is_a_file() {
        let base = std::env::temp_dir().join(format!("uren-test-file-{}", std::process::id()));
        let _ = std::fs::remove_dir_all(&base);
        std::fs::create_dir_all(&base).unwrap();
        let file = base.join("afile");
        std::fs::write(&file, b"x").unwrap();

        // create_dir_all on an existing file (used as a dir) fails.
        let err = create_app_data_dir(&file.join("child")).unwrap_err();
        assert!(err.contains("Could not create app data dir"));

        let _ = std::fs::remove_dir_all(&base);
    }

    #[test]
    fn ensure_from_propagates_resolver_error() {
        let err = ensure_app_data_dir_from(Err("no dir".to_string())).unwrap_err();
        assert_eq!(err, "Could not resolve app data dir: no dir");
    }

    #[test]
    fn ensure_from_creates_when_resolved_ok() {
        let base = std::env::temp_dir().join(format!("uren-test-ok-{}", std::process::id()));
        let _ = std::fs::remove_dir_all(&base);
        assert!(ensure_app_data_dir_from(Ok(base.clone())).is_ok());
        assert!(base.is_dir());
        let _ = std::fs::remove_dir_all(&base);
    }
}
