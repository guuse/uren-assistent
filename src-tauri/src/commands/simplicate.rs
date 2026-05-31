use reqwest::Client;
use serde::Deserialize;

#[derive(Deserialize)]
pub struct SimplicateRequestArgs {
    pub method: String,
    pub url: String,
    pub api_key: String,
    pub api_secret: String,
    pub body: Option<String>,
}

/// A fully-specified HTTP request, derived purely from the command arguments.
/// Pulling this out of the command lets us unit-test the method/header/body
/// assembly without performing any network I/O.
#[derive(Debug, PartialEq, Eq, Clone)]
pub struct PreparedRequest {
    pub method: String,
    pub url: String,
    pub headers: Vec<(String, String)>,
    pub body: Option<String>,
}

/// Build the outgoing HTTP request from the command arguments.
///
/// Returns an `Err` with a human-readable message for unsupported methods.
/// All header assembly and body handling lives here so it can be verified
/// without a live `reqwest::Client`.
pub fn build_request(args: &SimplicateRequestArgs) -> Result<PreparedRequest, String> {
    let method = args.method.to_uppercase();

    let body = match method.as_str() {
        "GET" => None,
        "POST" | "PUT" | "DELETE" => args.body.clone(),
        other => return Err(format!("Unsupported method: {}", other)),
    };

    let headers = vec![
        ("Content-Type".to_string(), "application/json".to_string()),
        ("Authentication-Key".to_string(), args.api_key.clone()),
        ("Authentication-Secret".to_string(), args.api_secret.clone()),
    ];

    Ok(PreparedRequest {
        method,
        url: args.url.clone(),
        headers,
        body,
    })
}

/// The outcome of an HTTP call: the status code plus the response text.
pub struct HttpResponse {
    pub status: u16,
    pub body: String,
}

/// Side-effecting HTTP transport, behind a trait so the orchestration can be
/// driven by a fake in tests.
#[allow(async_fn_in_trait)]
pub trait HttpSender {
    async fn send(&self, req: &PreparedRequest) -> Result<HttpResponse, String>;
}

/// Real transport backed by `reqwest`.
pub struct ReqwestSender {
    client: Client,
}

impl ReqwestSender {
    pub fn new() -> Self {
        Self {
            client: Client::new(),
        }
    }
}

impl Default for ReqwestSender {
    fn default() -> Self {
        Self::new()
    }
}

impl HttpSender for ReqwestSender {
    async fn send(&self, req: &PreparedRequest) -> Result<HttpResponse, String> {
        // `build_request` has already validated the method, so only the four
        // supported verbs can reach here.
        let mut builder = match req.method.as_str() {
            "GET" => self.client.get(&req.url),
            "POST" => self.client.post(&req.url),
            "PUT" => self.client.put(&req.url),
            "DELETE" => self.client.delete(&req.url),
            other => unreachable!("unsupported method reached transport: {other}"),
        };

        for (name, value) in &req.headers {
            builder = builder.header(name, value);
        }
        if let Some(body) = &req.body {
            builder = builder.body(body.clone());
        }

        let response = builder
            .send()
            .await
            .map_err(|e| format!("Request failed: {}", e))?;

        let status = response.status().as_u16();
        let body = response
            .text()
            .await
            .map_err(|e| format!("Failed to read response: {}", e))?;

        Ok(HttpResponse { status, body })
    }
}

/// Orchestrates the request: builds it, sends it via the supplied transport,
/// and maps non-2xx responses to an error. Pure of any concrete transport so
/// it can be exercised with a fake `HttpSender`.
pub async fn run_request<S: HttpSender>(
    sender: &S,
    args: &SimplicateRequestArgs,
) -> Result<String, String> {
    let req = build_request(args)?;
    let resp = sender.send(&req).await?;

    if !(200..300).contains(&resp.status) {
        return Err(format!(
            "Simplicate API error: {} — {}",
            resp.status, resp.body
        ));
    }

    Ok(resp.body)
}

#[cfg(test)]
mod tests {
    use super::*;
    use std::cell::RefCell;

    fn args(method: &str, body: Option<&str>) -> SimplicateRequestArgs {
        SimplicateRequestArgs {
            method: method.to_string(),
            url: "https://api.simplicate.test/path".to_string(),
            api_key: "KEY".to_string(),
            api_secret: "SECRET".to_string(),
            body: body.map(|b| b.to_string()),
        }
    }

    #[test]
    fn build_request_get_drops_body_and_sets_auth_headers() {
        let req = build_request(&args("get", Some("ignored"))).unwrap();
        assert_eq!(req.method, "GET");
        assert_eq!(req.url, "https://api.simplicate.test/path");
        assert_eq!(req.body, None);
        assert!(req
            .headers
            .contains(&("Content-Type".to_string(), "application/json".to_string())));
        assert!(req
            .headers
            .contains(&("Authentication-Key".to_string(), "KEY".to_string())));
        assert!(req
            .headers
            .contains(&("Authentication-Secret".to_string(), "SECRET".to_string())));
    }

    #[test]
    fn build_request_post_keeps_body() {
        let req = build_request(&args("POST", Some("{\"a\":1}"))).unwrap();
        assert_eq!(req.method, "POST");
        assert_eq!(req.body.as_deref(), Some("{\"a\":1}"));
    }

    #[test]
    fn build_request_put_keeps_body() {
        let req = build_request(&args("put", Some("payload"))).unwrap();
        assert_eq!(req.method, "PUT");
        assert_eq!(req.body.as_deref(), Some("payload"));
    }

    #[test]
    fn build_request_delete_with_and_without_body() {
        let with = build_request(&args("DELETE", Some("b"))).unwrap();
        assert_eq!(with.method, "DELETE");
        assert_eq!(with.body.as_deref(), Some("b"));

        let without = build_request(&args("delete", None)).unwrap();
        assert_eq!(without.body, None);
    }

    #[test]
    fn build_request_rejects_unsupported_method() {
        let err = build_request(&args("PATCH", None)).unwrap_err();
        assert_eq!(err, "Unsupported method: PATCH");
    }

    /// Records the request it was handed and returns a canned response.
    struct FakeSender {
        response: HttpResponse,
        seen: RefCell<Option<PreparedRequest>>,
    }

    impl FakeSender {
        fn new(status: u16, body: &str) -> Self {
            Self {
                response: HttpResponse {
                    status,
                    body: body.to_string(),
                },
                seen: RefCell::new(None),
            }
        }
    }

    impl HttpSender for FakeSender {
        async fn send(&self, req: &PreparedRequest) -> Result<HttpResponse, String> {
            *self.seen.borrow_mut() = Some(req.clone());
            Ok(HttpResponse {
                status: self.response.status,
                body: self.response.body.clone(),
            })
        }
    }

    struct ErrorSender;
    impl HttpSender for ErrorSender {
        async fn send(&self, _req: &PreparedRequest) -> Result<HttpResponse, String> {
            Err("Request failed: boom".to_string())
        }
    }

    #[tokio::test]
    async fn run_request_returns_body_on_success() {
        let sender = FakeSender::new(200, "{\"ok\":true}");
        let out = run_request(&sender, &args("GET", None)).await.unwrap();
        assert_eq!(out, "{\"ok\":true}");
        let seen = sender.seen.borrow();
        assert_eq!(seen.as_ref().unwrap().method, "GET");
    }

    #[tokio::test]
    async fn run_request_accepts_204() {
        let sender = FakeSender::new(204, "");
        let out = run_request(&sender, &args("PUT", Some("x"))).await.unwrap();
        assert_eq!(out, "");
    }

    #[tokio::test]
    async fn run_request_maps_non_2xx_to_error() {
        let sender = FakeSender::new(403, "forbidden");
        let err = run_request(&sender, &args("GET", None)).await.unwrap_err();
        assert_eq!(err, "Simplicate API error: 403 — forbidden");
    }

    #[tokio::test]
    async fn run_request_propagates_build_error() {
        let sender = FakeSender::new(200, "");
        let err = run_request(&sender, &args("PATCH", None)).await.unwrap_err();
        assert_eq!(err, "Unsupported method: PATCH");
    }

    #[tokio::test]
    async fn run_request_propagates_transport_error() {
        let err = run_request(&ErrorSender, &args("GET", None)).await.unwrap_err();
        assert_eq!(err, "Request failed: boom");
    }

    // --- Real ReqwestSender exercised against a local mock HTTP server ---

    fn live_args(method: &str, url: &str, body: Option<&str>) -> SimplicateRequestArgs {
        SimplicateRequestArgs {
            method: method.to_string(),
            url: url.to_string(),
            api_key: "KEY".to_string(),
            api_secret: "SECRET".to_string(),
            body: body.map(|b| b.to_string()),
        }
    }

    #[tokio::test]
    async fn reqwest_sender_get_sends_auth_headers() {
        let server = httpmock::MockServer::start_async().await;
        let mock = server
            .mock_async(|when, then| {
                when.method(httpmock::Method::GET)
                    .path("/data")
                    .header("Authentication-Key", "KEY")
                    .header("Authentication-Secret", "SECRET");
                then.status(200).body("{\"ok\":1}");
            })
            .await;

        let url = format!("{}/data", server.base_url());
        let out = run_request(&ReqwestSender::new(), &live_args("GET", &url, None))
            .await
            .unwrap();
        assert_eq!(out, "{\"ok\":1}");
        mock.assert_async().await;
    }

    #[tokio::test]
    async fn reqwest_sender_post_sends_body() {
        let server = httpmock::MockServer::start_async().await;
        let mock = server
            .mock_async(|when, then| {
                when.method(httpmock::Method::POST)
                    .path("/create")
                    .body("{\"x\":1}");
                then.status(201).body("created");
            })
            .await;

        let url = format!("{}/create", server.base_url());
        let out = run_request(
            &ReqwestSender::default(),
            &live_args("POST", &url, Some("{\"x\":1}")),
        )
        .await
        .unwrap();
        assert_eq!(out, "created");
        mock.assert_async().await;
    }

    #[tokio::test]
    async fn reqwest_sender_put_and_delete() {
        let server = httpmock::MockServer::start_async().await;
        let put = server
            .mock_async(|when, then| {
                when.method(httpmock::Method::PUT).path("/u");
                then.status(204);
            })
            .await;
        let del = server
            .mock_async(|when, then| {
                when.method(httpmock::Method::DELETE).path("/d");
                then.status(200).body("gone");
            })
            .await;

        let put_url = format!("{}/u", server.base_url());
        let out = run_request(&ReqwestSender::new(), &live_args("PUT", &put_url, Some("p")))
            .await
            .unwrap();
        assert_eq!(out, "");
        put.assert_async().await;

        let del_url = format!("{}/d", server.base_url());
        let out = run_request(&ReqwestSender::new(), &live_args("DELETE", &del_url, None))
            .await
            .unwrap();
        assert_eq!(out, "gone");
        del.assert_async().await;
    }

    #[tokio::test]
    async fn reqwest_sender_maps_error_status() {
        let server = httpmock::MockServer::start_async().await;
        server
            .mock_async(|when, then| {
                when.method(httpmock::Method::GET).path("/bad");
                then.status(500).body("oops");
            })
            .await;

        let url = format!("{}/bad", server.base_url());
        let err = run_request(&ReqwestSender::new(), &live_args("GET", &url, None))
            .await
            .unwrap_err();
        assert_eq!(err, "Simplicate API error: 500 — oops");
    }

    #[tokio::test]
    async fn reqwest_sender_connection_failure_is_reported() {
        // Nothing is listening on this port -> reqwest send() fails.
        let err = run_request(
            &ReqwestSender::new(),
            &live_args("GET", "http://127.0.0.1:1/nope", None),
        )
        .await
        .unwrap_err();
        assert!(err.starts_with("Request failed:"), "got: {err}");
    }
}
