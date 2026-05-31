const SERVICE: &str = "uren-assistent";

/// The outcome of running an external command: exit code plus captured output.
/// `code` is `None` when the process was terminated by a signal.
pub struct CmdOutput {
    pub success: bool,
    pub code: Option<i32>,
    pub stdout: Vec<u8>,
    pub stderr: Vec<u8>,
}

/// Side-effecting process runner, behind a trait so the keychain orchestration
/// can be driven by a fake in tests instead of the real `security` binary.
/// The real implementation (`SecurityRunner`) lives in the glue layer.
pub trait CommandRunner {
    fn run(&self, args: &[&str]) -> std::io::Result<CmdOutput>;
}

fn validate_key(key: &str) -> Result<(), String> {
    if key.is_empty() {
        return Err("key must not be empty".to_string());
    }
    Ok(())
}

/// Read a secret. Returns `Ok(None)` when the item does not exist.
pub fn get_secret_with<R: CommandRunner>(runner: &R, key: &str) -> Result<Option<String>, String> {
    validate_key(key)?;
    let output = runner
        .run(&["find-generic-password", "-s", SERVICE, "-a", key, "-w"])
        .map_err(|e| format!("Failed to run security: {}", e))?;

    if output.success {
        let password = String::from_utf8_lossy(&output.stdout).trim().to_string();
        Ok(Some(password))
    } else {
        Ok(None)
    }
}

/// Write (or overwrite) a secret. The update is delete-then-add.
pub fn set_secret_with<R: CommandRunner>(runner: &R, key: &str, value: &str) -> Result<(), String> {
    validate_key(key)?;

    // Delete existing entry first (update = delete + add)
    let _ = runner.run(&["delete-generic-password", "-s", SERVICE, "-a", key]);

    // Add new entry; -T /usr/bin/security = only security CLI can read without ACL prompt.
    // Using the stable system binary avoids the per-rebuild binary-hash ACL issue.
    let output = runner
        .run(&[
            "add-generic-password",
            "-s",
            SERVICE,
            "-a",
            key,
            "-w",
            value,
            "-T",
            "/usr/bin/security",
        ])
        .map_err(|e| format!("Failed to run security: {}", e))?;

    if output.success {
        Ok(())
    } else {
        let stderr = String::from_utf8_lossy(&output.stderr);
        Err(format!("Keychain write failed: {}", stderr.trim()))
    }
}

/// Delete a secret. Idempotent: a "not found" (exit 44) is treated as success.
pub fn delete_secret_with<R: CommandRunner>(runner: &R, key: &str) -> Result<(), String> {
    validate_key(key)?;
    let output = runner
        .run(&["delete-generic-password", "-s", SERVICE, "-a", key])
        .map_err(|e| format!("Failed to run security: {}", e))?;

    // Exit code 44 = item not found — treat as success (idempotent)
    if output.success || output.code == Some(44) {
        Ok(())
    } else {
        let stderr = String::from_utf8_lossy(&output.stderr);
        Err(format!("Keychain delete failed: {}", stderr.trim()))
    }
}

#[cfg(test)]
mod tests {
    use super::*;
    use std::cell::RefCell;

    /// Scripts a sequence of responses and records the argument lists it saw.
    struct FakeRunner {
        responses: RefCell<Vec<std::io::Result<CmdOutput>>>,
        calls: RefCell<Vec<Vec<String>>>,
    }

    impl FakeRunner {
        fn new(responses: Vec<std::io::Result<CmdOutput>>) -> Self {
            Self {
                responses: RefCell::new(responses),
                calls: RefCell::new(Vec::new()),
            }
        }

        fn ok(stdout: &str) -> std::io::Result<CmdOutput> {
            Ok(CmdOutput {
                success: true,
                code: Some(0),
                stdout: stdout.as_bytes().to_vec(),
                stderr: Vec::new(),
            })
        }

        fn fail(code: Option<i32>, stderr: &str) -> std::io::Result<CmdOutput> {
            Ok(CmdOutput {
                success: false,
                code,
                stdout: Vec::new(),
                stderr: stderr.as_bytes().to_vec(),
            })
        }

        fn io_err() -> std::io::Result<CmdOutput> {
            Err(std::io::Error::new(std::io::ErrorKind::NotFound, "missing"))
        }
    }

    impl CommandRunner for FakeRunner {
        fn run(&self, args: &[&str]) -> std::io::Result<CmdOutput> {
            self.calls
                .borrow_mut()
                .push(args.iter().map(|s| s.to_string()).collect());
            self.responses
                .borrow_mut()
                .remove(0)
        }
    }

    #[test]
    fn get_secret_empty_key_errors() {
        let runner = FakeRunner::new(vec![]);
        assert_eq!(
            get_secret_with(&runner, "").unwrap_err(),
            "key must not be empty"
        );
    }

    #[test]
    fn get_secret_found_trims_output() {
        let runner = FakeRunner::new(vec![FakeRunner::ok("hunter2\n")]);
        assert_eq!(
            get_secret_with(&runner, "k").unwrap(),
            Some("hunter2".to_string())
        );
        assert_eq!(runner.calls.borrow()[0][0], "find-generic-password");
    }

    #[test]
    fn get_secret_not_found_is_none() {
        let runner = FakeRunner::new(vec![FakeRunner::fail(Some(44), "not found")]);
        assert_eq!(get_secret_with(&runner, "k").unwrap(), None);
    }

    #[test]
    fn get_secret_io_error_is_reported() {
        let runner = FakeRunner::new(vec![FakeRunner::io_err()]);
        let err = get_secret_with(&runner, "k").unwrap_err();
        assert!(err.starts_with("Failed to run security:"));
    }

    #[test]
    fn set_secret_empty_key_errors() {
        let runner = FakeRunner::new(vec![]);
        assert_eq!(
            set_secret_with(&runner, "", "v").unwrap_err(),
            "key must not be empty"
        );
    }

    #[test]
    fn set_secret_deletes_then_adds() {
        // first call = delete (ignored), second = add (success)
        let runner = FakeRunner::new(vec![FakeRunner::ok(""), FakeRunner::ok("")]);
        assert!(set_secret_with(&runner, "k", "v").is_ok());
        let calls = runner.calls.borrow();
        assert_eq!(calls[0][0], "delete-generic-password");
        assert_eq!(calls[1][0], "add-generic-password");
        assert!(calls[1].contains(&"v".to_string()));
    }

    #[test]
    fn set_secret_add_failure_is_reported() {
        let runner = FakeRunner::new(vec![FakeRunner::ok(""), FakeRunner::fail(Some(1), "denied")]);
        let err = set_secret_with(&runner, "k", "v").unwrap_err();
        assert_eq!(err, "Keychain write failed: denied");
    }

    #[test]
    fn set_secret_add_io_error_is_reported() {
        let runner = FakeRunner::new(vec![FakeRunner::ok(""), FakeRunner::io_err()]);
        let err = set_secret_with(&runner, "k", "v").unwrap_err();
        assert!(err.starts_with("Failed to run security:"));
    }

    #[test]
    fn delete_secret_empty_key_errors() {
        let runner = FakeRunner::new(vec![]);
        assert_eq!(
            delete_secret_with(&runner, "").unwrap_err(),
            "key must not be empty"
        );
    }

    #[test]
    fn delete_secret_success() {
        let runner = FakeRunner::new(vec![FakeRunner::ok("")]);
        assert!(delete_secret_with(&runner, "k").is_ok());
    }

    #[test]
    fn delete_secret_not_found_is_idempotent_success() {
        let runner = FakeRunner::new(vec![FakeRunner::fail(Some(44), "not found")]);
        assert!(delete_secret_with(&runner, "k").is_ok());
    }

    #[test]
    fn delete_secret_other_failure_is_reported() {
        let runner = FakeRunner::new(vec![FakeRunner::fail(Some(1), "boom")]);
        let err = delete_secret_with(&runner, "k").unwrap_err();
        assert_eq!(err, "Keychain delete failed: boom");
    }

    #[test]
    fn delete_secret_io_error_is_reported() {
        let runner = FakeRunner::new(vec![FakeRunner::io_err()]);
        let err = delete_secret_with(&runner, "k").unwrap_err();
        assert!(err.starts_with("Failed to run security:"));
    }
}
