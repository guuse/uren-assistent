use base64::{engine::general_purpose::URL_SAFE_NO_PAD, Engine};
use rand::RngCore;
use sha2::{Digest, Sha256};
use tokio::io::{AsyncReadExt, AsyncWriteExt};
use tokio::net::TcpListener;
use tokio::time::{timeout, Duration};

pub(crate) const OAUTH_TIMEOUT_SECS: u64 = 120;

/// Encode 32 random bytes as a URL-safe (no padding) PKCE `code_verifier`.
/// The randomness is injected so the encoding can be tested deterministically.
fn encode_verifier(bytes: &[u8]) -> String {
    URL_SAFE_NO_PAD.encode(bytes)
}

pub(crate) fn generate_code_verifier() -> String {
    let mut buf = [0u8; 32];
    rand::thread_rng().fill_bytes(&mut buf);
    encode_verifier(&buf)
}

/// Derive the PKCE `code_challenge` (S256) from a verifier. Pure.
pub(crate) fn generate_code_challenge(verifier: &str) -> String {
    let hash = Sha256::digest(verifier.as_bytes());
    URL_SAFE_NO_PAD.encode(hash)
}

/// Build the Google OAuth authorization URL. Pure: given the inputs it always
/// produces the same URL, so the query-pair assembly can be asserted directly.
pub(crate) fn build_auth_url(client_id: &str, redirect_uri: &str, challenge: &str) -> String {
    let mut auth_url = url::Url::parse("https://accounts.google.com/o/oauth2/v2/auth")
        .expect("static URL is valid");
    auth_url
        .query_pairs_mut()
        .append_pair("client_id", client_id)
        .append_pair("redirect_uri", redirect_uri)
        .append_pair("response_type", "code")
        .append_pair(
            "scope",
            "openid email profile https://www.googleapis.com/auth/calendar.readonly",
        )
        .append_pair("code_challenge", challenge)
        .append_pair("code_challenge_method", "S256");
    auth_url.to_string()
}

/// Extract the `code` query parameter from a raw HTTP request, whose first
/// line looks like `GET /callback?code=xxx HTTP/1.1`. Pure parser.
fn extract_code(request: &str) -> Option<String> {
    request
        .lines()
        .next()
        .and_then(|line| line.split_whitespace().nth(1)) // the path+query
        .and_then(|path| url::Url::parse(&format!("http://localhost{path}")).ok())
        .and_then(|u| {
            u.query_pairs()
                .find(|(k, _)| k == "code")
                .map(|(_, v)| v.into_owned())
        })
}

/// Build the raw HTTP response that serves the success page.
fn build_http_response(html: &str) -> String {
    format!(
        "HTTP/1.1 200 OK\r\nContent-Type: text/html; charset=utf-8\r\nContent-Length: {}\r\nConnection: close\r\n\r\n{}",
        html.len(),
        html
    )
}

/// Assemble the JSON payload returned to the frontend on success.
pub(crate) fn build_result_json(code: &str, verifier: &str, redirect_uri: &str) -> String {
    serde_json::json!({
        "code": code,
        "verifier": verifier,
        "redirect_uri": redirect_uri
    })
    .to_string()
}

fn success_html() -> String {
    r#"<!DOCTYPE html>
<html lang="nl">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>Inloggen geslaagd</title>
  <style>
    * { box-sizing: border-box; margin: 0; padding: 0; }
    body {
      font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif;
      background: #f5f5f5;
      display: flex;
      align-items: center;
      justify-content: center;
      min-height: 100vh;
    }
    .card {
      background: white;
      border-radius: 16px;
      padding: 48px 40px;
      text-align: center;
      box-shadow: 0 4px 24px rgba(0,0,0,0.08);
      max-width: 380px;
      width: 100%;
    }
    .icon {
      width: 64px;
      height: 64px;
      background: #22c55e;
      border-radius: 50%;
      display: flex;
      align-items: center;
      justify-content: center;
      margin: 0 auto 24px;
    }
    .icon svg {
      width: 32px;
      height: 32px;
      stroke: white;
      stroke-width: 3;
      fill: none;
    }
    h1 {
      font-size: 22px;
      font-weight: 700;
      color: #111;
      margin-bottom: 8px;
    }
    p {
      font-size: 15px;
      color: #666;
      margin-bottom: 24px;
      line-height: 1.5;
    }
    a {
      font-size: 13px;
      color: #999;
      text-decoration: none;
    }
    a:hover { text-decoration: underline; }
    .countdown {
      font-size: 13px;
      color: #bbb;
      margin-top: 8px;
    }
  </style>
</head>
<body>
  <div class="card">
    <div class="icon">
      <svg viewBox="0 0 24 24"><polyline points="20 6 9 17 4 12"/></svg>
    </div>
    <h1>Inloggen geslaagd</h1>
    <p>Je bent ingelogd en wordt teruggestuurd naar de app.</p>
    <a href="javascript:window.close()">Sluit dit tabblad</a>
    <div class="countdown" id="cd">Dit venster sluit over 3 seconden…</div>
  </div>
  <script>
    var n = 3;
    var el = document.getElementById('cd');
    var iv = setInterval(function() {
      n--;
      if (n <= 0) {
        clearInterval(iv);
        el.textContent = '';
        window.close();
      } else {
        el.textContent = 'Dit venster sluit over ' + n + (n === 1 ? ' seconde…' : ' seconden…');
      }
    }, 1000);
  </script>
</body>
</html>"#
        .to_string()
}

/// Accept a single connection on the loopback listener, read the HTTP request,
/// pull out the OAuth `code`, and serve the success page. This is the I/O core
/// of the callback handling, isolated so it can be driven by a real client in
/// a `127.0.0.1:0` test.
pub(crate) async fn handle_callback(listener: TcpListener) -> Result<String, String> {
    handle_callback_with_timeout(listener, Duration::from_secs(OAUTH_TIMEOUT_SECS)).await
}

/// Like [`handle_callback`] but with an injectable accept timeout, so the
/// timeout branch can be exercised with a sub-second deadline in tests.
pub(crate) async fn handle_callback_with_timeout(
    listener: TcpListener,
    accept_timeout: Duration,
) -> Result<String, String> {
    let (mut stream, _) = timeout(accept_timeout, listener.accept())
        .await
        .map_err(|_| {
            format!(
                "OAuth timeout: no callback received within {} seconds",
                accept_timeout.as_secs()
            )
        })?
        .map_err(|e| format!("TCP accept error: {e}"))?;

    let mut buf = vec![0u8; 4096];
    let n = stream
        .read(&mut buf)
        .await
        .map_err(|e| format!("TCP read error: {e}"))?;
    let request = String::from_utf8_lossy(&buf[..n]);

    let code = extract_code(&request).ok_or("No code found in OAuth callback")?;

    let html = success_html();
    let response = build_http_response(&html);
    let _ = stream.write_all(response.as_bytes()).await;
    drop(stream);

    Ok(code)
}

#[cfg(test)]
mod tests {
    use super::*;
    use tokio::net::TcpStream;

    #[test]
    fn encode_verifier_is_url_safe_no_pad() {
        // 0xFB,0xFF produce '+'/'/' in standard base64; URL-safe uses '-'/'_'.
        let encoded = encode_verifier(&[0xfb, 0xff, 0xfe]);
        assert!(!encoded.contains('+'));
        assert!(!encoded.contains('/'));
        assert!(!encoded.contains('='));
        assert!(encoded.contains('-') || encoded.contains('_'));
    }

    #[test]
    fn generate_code_verifier_round_trips_32_bytes() {
        let v = generate_code_verifier();
        // 32 bytes -> 43 base64 chars (no padding)
        assert_eq!(v.len(), 43);
        // two calls differ (randomness)
        assert_ne!(v, generate_code_verifier());
    }

    #[test]
    fn code_challenge_matches_known_s256_vector() {
        // RFC 7636 Appendix B test vector.
        let verifier = "dBjftJeZ4CVP-mB92K27uhbUJU1p1r_wW1gFWFOEjXk";
        let challenge = generate_code_challenge(verifier);
        assert_eq!(challenge, "E9Melhoa2OwvFrEMTJguCHaoeK1t8URWbuGJSstw-cM");
    }

    #[test]
    fn build_auth_url_contains_all_params() {
        let url = build_auth_url("client123", "http://127.0.0.1:5000/callback", "chal");
        assert!(url.starts_with("https://accounts.google.com/o/oauth2/v2/auth?"));
        assert!(url.contains("client_id=client123"));
        assert!(url.contains("redirect_uri=http%3A%2F%2F127.0.0.1%3A5000%2Fcallback"));
        assert!(url.contains("response_type=code"));
        assert!(url.contains("code_challenge=chal"));
        assert!(url.contains("code_challenge_method=S256"));
        assert!(url.contains("calendar.readonly"));
    }

    #[test]
    fn extract_code_parses_valid_callback() {
        let req = "GET /callback?code=abc123&scope=email HTTP/1.1\r\nHost: localhost\r\n\r\n";
        assert_eq!(extract_code(req).as_deref(), Some("abc123"));
    }

    #[test]
    fn extract_code_url_decodes() {
        let req = "GET /callback?code=a%2Fb%3Dc HTTP/1.1\r\n\r\n";
        assert_eq!(extract_code(req).as_deref(), Some("a/b=c"));
    }

    #[test]
    fn extract_code_returns_none_without_code() {
        let req = "GET /callback?state=xyz HTTP/1.1\r\n\r\n";
        assert_eq!(extract_code(req), None);
    }

    #[test]
    fn extract_code_returns_none_for_garbage() {
        assert_eq!(extract_code(""), None);
        assert_eq!(extract_code("nonsense"), None);
    }

    #[test]
    fn build_http_response_has_correct_content_length() {
        let html = "hello";
        let resp = build_http_response(html);
        assert!(resp.contains("Content-Length: 5\r\n"));
        assert!(resp.starts_with("HTTP/1.1 200 OK\r\n"));
        assert!(resp.ends_with("\r\n\r\nhello"));
    }

    #[test]
    fn success_html_is_nonempty_and_html() {
        let html = success_html();
        assert!(html.contains("Inloggen geslaagd"));
        assert!(html.starts_with("<!DOCTYPE html>"));
    }

    #[test]
    fn build_result_json_shape() {
        let json = build_result_json("c", "v", "r");
        let parsed: serde_json::Value = serde_json::from_str(&json).unwrap();
        assert_eq!(parsed["code"], "c");
        assert_eq!(parsed["verifier"], "v");
        assert_eq!(parsed["redirect_uri"], "r");
    }

    #[tokio::test]
    async fn handle_callback_reads_real_loopback_request() {
        let listener = TcpListener::bind("127.0.0.1:0").await.unwrap();
        let addr = listener.local_addr().unwrap();

        let server = tokio::spawn(handle_callback(listener));

        // Connect a client and send a realistic OAuth callback request.
        let mut client = TcpStream::connect(addr).await.unwrap();
        client
            .write_all(b"GET /callback?code=loopcode HTTP/1.1\r\nHost: x\r\n\r\n")
            .await
            .unwrap();

        // Read the success page back so the server's write completes.
        let mut resp = Vec::new();
        let mut buf = [0u8; 1024];
        loop {
            match client.read(&mut buf).await {
                Ok(0) => break,
                Ok(n) => resp.extend_from_slice(&buf[..n]),
                Err(_) => break,
            }
        }

        let code = server.await.unwrap().unwrap();
        assert_eq!(code, "loopcode");
        let resp_str = String::from_utf8_lossy(&resp);
        assert!(resp_str.contains("HTTP/1.1 200 OK"));
        assert!(resp_str.contains("Inloggen geslaagd"));
    }

    #[tokio::test]
    async fn handle_callback_times_out_without_connection() {
        let listener = TcpListener::bind("127.0.0.1:0").await.unwrap();
        // No client ever connects -> the accept times out.
        let err = handle_callback_with_timeout(listener, Duration::from_millis(20))
            .await
            .unwrap_err();
        assert_eq!(err, "OAuth timeout: no callback received within 0 seconds");
    }

    #[tokio::test]
    async fn handle_callback_errors_when_no_code() {
        let listener = TcpListener::bind("127.0.0.1:0").await.unwrap();
        let addr = listener.local_addr().unwrap();

        let server = tokio::spawn(handle_callback(listener));

        let mut client = TcpStream::connect(addr).await.unwrap();
        client
            .write_all(b"GET /callback?state=nope HTTP/1.1\r\n\r\n")
            .await
            .unwrap();
        // Drain so the connection can close.
        let mut buf = [0u8; 256];
        let _ = client.read(&mut buf).await;

        let err = server.await.unwrap().unwrap_err();
        assert_eq!(err, "No code found in OAuth callback");
    }
}
