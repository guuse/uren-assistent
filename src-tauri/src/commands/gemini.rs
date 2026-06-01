//! Gemini HTTP transport — runs the Generative Language API call from Rust
//! instead of the WebKit webview's `fetch`. The webview drops large/slow
//! requests with a generic "Load failed" error; `reqwest` does not. Retries
//! transient failures (network errors, HTTP 429, 5xx) with backoff.
//!
//! Reuses the shared request primitives from [`super::simplicate`]
//! (`PreparedRequest`, `HttpSender`, `HttpResponse`, `ReqwestSender`).

use serde::Deserialize;

use super::simplicate::{HttpSender, PreparedRequest};

/// Arguments for a Gemini `generateContent` call. The URL already carries the
/// API key as a query parameter (built on the frontend from the bundled env),
/// so no auth headers are needed.
#[derive(Deserialize)]
pub struct GeminiRequestArgs {
    pub url: String,
    pub body: String,
}

/// Maximum number of retries *after* the initial attempt.
const MAX_RETRIES: u32 = 3;

/// Build the outgoing Gemini request: always a JSON POST, no auth headers.
pub fn build_gemini_request(args: &GeminiRequestArgs) -> PreparedRequest {
    PreparedRequest {
        method: "POST".to_string(),
        url: args.url.clone(),
        headers: vec![("Content-Type".to_string(), "application/json".to_string())],
        body: Some(args.body.clone()),
    }
}

/// Injectable delay so the retry/backoff loop is unit-testable without waiting.
#[allow(async_fn_in_trait)]
pub trait Sleeper {
    async fn sleep(&self, secs: u64);
}

/// Real sleeper backed by tokio.
pub struct TokioSleeper;

impl Sleeper for TokioSleeper {
    async fn sleep(&self, secs: u64) {
        tokio::time::sleep(std::time::Duration::from_secs(secs)).await;
    }
}

/// Exponential backoff: 2s, 4s, 8s for attempts 0, 1, 2.
fn backoff_secs(attempt: u32) -> u64 {
    2u64.saturating_mul(2u64.saturating_pow(attempt))
}

/// Extract the integer seconds from a Gemini 429 body's
/// `"retryDelay":"<n>s"` field, if present.
fn parse_retry_delay(body: &str) -> Option<u64> {
    let key = "\"retryDelay\":\"";
    let start = body.find(key)? + key.len();
    let rest = &body[start..];
    let end = rest.find('s')?;
    rest[..end].parse::<u64>().ok()
}

/// Transient statuses worth retrying.
fn is_retryable_status(status: u16) -> bool {
    status == 429 || (500..600).contains(&status)
}

/// Orchestrate a Gemini request, retrying transient failures (network errors,
/// 429, 5xx) with backoff. Pure of any concrete transport/clock so it can be
/// driven by fakes in tests.
pub async fn run_gemini_request<S: HttpSender, T: Sleeper>(
    sender: &S,
    sleeper: &T,
    args: &GeminiRequestArgs,
) -> Result<String, String> {
    let req = build_gemini_request(args);
    let mut attempt: u32 = 0;

    loop {
        match sender.send(&req).await {
            Ok(resp) if (200..300).contains(&resp.status) => return Ok(resp.body),
            Ok(resp) => {
                if is_retryable_status(resp.status) && attempt < MAX_RETRIES {
                    let delay = if resp.status == 429 {
                        parse_retry_delay(&resp.body).unwrap_or_else(|| backoff_secs(attempt))
                    } else {
                        backoff_secs(attempt)
                    };
                    sleeper.sleep(delay).await;
                    attempt += 1;
                    continue;
                }
                return Err(format!("Gemini API error: {} — {}", resp.status, resp.body));
            }
            Err(e) => {
                if attempt < MAX_RETRIES {
                    sleeper.sleep(backoff_secs(attempt)).await;
                    attempt += 1;
                    continue;
                }
                return Err(format!("Request failed: {}", e));
            }
        }
    }
}

#[cfg(test)]
mod tests {
    use super::*;
    use crate::commands::simplicate::HttpResponse;
    use std::cell::RefCell;

    fn args() -> GeminiRequestArgs {
        GeminiRequestArgs {
            url: "https://gemini.test/v1/models/x:generateContent?key=K".to_string(),
            body: "{\"contents\":[]}".to_string(),
        }
    }

    #[test]
    fn build_request_is_json_post_without_auth() {
        let req = build_gemini_request(&args());
        assert_eq!(req.method, "POST");
        assert_eq!(
            req.url,
            "https://gemini.test/v1/models/x:generateContent?key=K"
        );
        assert_eq!(req.body.as_deref(), Some("{\"contents\":[]}"));
        assert_eq!(
            req.headers,
            vec![("Content-Type".to_string(), "application/json".to_string())]
        );
    }

    #[test]
    fn parse_retry_delay_reads_seconds() {
        assert_eq!(parse_retry_delay("{\"retryDelay\":\"7s\"}"), Some(7));
        assert_eq!(parse_retry_delay("no delay here"), None);
        assert_eq!(parse_retry_delay("{\"retryDelay\":\"xs\"}"), None);
    }

    #[test]
    fn backoff_grows_exponentially() {
        assert_eq!(backoff_secs(0), 2);
        assert_eq!(backoff_secs(1), 4);
        assert_eq!(backoff_secs(2), 8);
    }

    /// Sender that yields queued outcomes in order and counts its calls.
    struct QueueSender {
        outcomes: RefCell<Vec<Result<HttpResponse, String>>>,
        calls: RefCell<u32>,
    }
    impl QueueSender {
        fn new(outcomes: Vec<Result<HttpResponse, String>>) -> Self {
            Self {
                outcomes: RefCell::new(outcomes),
                calls: RefCell::new(0),
            }
        }
    }
    impl HttpSender for QueueSender {
        async fn send(&self, _req: &PreparedRequest) -> Result<HttpResponse, String> {
            *self.calls.borrow_mut() += 1;
            self.outcomes.borrow_mut().remove(0)
        }
    }

    /// Sleeper that records requested delays without actually waiting.
    struct RecordingSleeper {
        delays: RefCell<Vec<u64>>,
    }
    impl RecordingSleeper {
        fn new() -> Self {
            Self {
                delays: RefCell::new(vec![]),
            }
        }
    }
    impl Sleeper for RecordingSleeper {
        async fn sleep(&self, secs: u64) {
            self.delays.borrow_mut().push(secs);
        }
    }

    fn ok(body: &str) -> Result<HttpResponse, String> {
        Ok(HttpResponse {
            status: 200,
            body: body.to_string(),
        })
    }
    fn status(code: u16, body: &str) -> Result<HttpResponse, String> {
        Ok(HttpResponse {
            status: code,
            body: body.to_string(),
        })
    }

    #[tokio::test]
    async fn returns_body_on_first_success() {
        let sender = QueueSender::new(vec![ok("{\"candidates\":[]}")]);
        let sleeper = RecordingSleeper::new();
        let out = run_gemini_request(&sender, &sleeper, &args()).await.unwrap();
        assert_eq!(out, "{\"candidates\":[]}");
        assert_eq!(*sender.calls.borrow(), 1);
        assert!(sleeper.delays.borrow().is_empty());
    }

    #[tokio::test]
    async fn retries_on_429_then_succeeds_honoring_retry_delay() {
        let sender = QueueSender::new(vec![status(429, "{\"retryDelay\":\"3s\"}"), ok("[]")]);
        let sleeper = RecordingSleeper::new();
        let out = run_gemini_request(&sender, &sleeper, &args()).await.unwrap();
        assert_eq!(out, "[]");
        assert_eq!(*sender.calls.borrow(), 2);
        assert_eq!(*sleeper.delays.borrow(), vec![3]);
    }

    #[tokio::test]
    async fn retries_on_5xx_with_exponential_backoff_then_succeeds() {
        let sender = QueueSender::new(vec![status(500, "boom"), status(503, "again"), ok("[]")]);
        let sleeper = RecordingSleeper::new();
        let out = run_gemini_request(&sender, &sleeper, &args()).await.unwrap();
        assert_eq!(out, "[]");
        assert_eq!(*sleeper.delays.borrow(), vec![2, 4]);
    }

    #[tokio::test]
    async fn exhausts_retries_on_persistent_429() {
        let sender = QueueSender::new(vec![
            status(429, "x"),
            status(429, "x"),
            status(429, "x"),
            status(429, "x"),
        ]);
        let sleeper = RecordingSleeper::new();
        let err = run_gemini_request(&sender, &sleeper, &args())
            .await
            .unwrap_err();
        assert_eq!(err, "Gemini API error: 429 — x");
        assert_eq!(*sender.calls.borrow(), 4); // initial + 3 retries
        assert_eq!(sleeper.delays.borrow().len(), 3);
    }

    #[tokio::test]
    async fn does_not_retry_client_errors() {
        let sender = QueueSender::new(vec![status(400, "bad request")]);
        let sleeper = RecordingSleeper::new();
        let err = run_gemini_request(&sender, &sleeper, &args())
            .await
            .unwrap_err();
        assert_eq!(err, "Gemini API error: 400 — bad request");
        assert_eq!(*sender.calls.borrow(), 1);
        assert!(sleeper.delays.borrow().is_empty());
    }

    #[tokio::test]
    async fn retries_network_errors_then_gives_up() {
        let sender = QueueSender::new(vec![
            Err("connection reset".to_string()),
            Err("connection reset".to_string()),
            Err("connection reset".to_string()),
            Err("connection reset".to_string()),
        ]);
        let sleeper = RecordingSleeper::new();
        let err = run_gemini_request(&sender, &sleeper, &args())
            .await
            .unwrap_err();
        assert_eq!(err, "Request failed: connection reset");
        assert_eq!(*sender.calls.borrow(), 4);
        assert_eq!(*sleeper.delays.borrow(), vec![2, 4, 8]);
    }

    #[tokio::test]
    async fn recovers_after_transient_network_error() {
        let sender = QueueSender::new(vec![Err("reset".to_string()), ok("[]")]);
        let sleeper = RecordingSleeper::new();
        let out = run_gemini_request(&sender, &sleeper, &args()).await.unwrap();
        assert_eq!(out, "[]");
        assert_eq!(*sleeper.delays.borrow(), vec![2]);
    }
}
