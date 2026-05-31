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

#[tauri::command]
pub async fn simplicate_request(args: SimplicateRequestArgs) -> Result<String, String> {
    let client = Client::new();

    let builder = match args.method.to_uppercase().as_str() {
        "GET" => client.get(&args.url),
        "POST" => {
            let mut b = client.post(&args.url);
            if let Some(body) = args.body {
                b = b.header("Content-Type", "application/json").body(body);
            }
            b
        }
        "PUT" => {
            let mut b = client.put(&args.url);
            if let Some(body) = args.body {
                b = b.header("Content-Type", "application/json").body(body);
            }
            b
        }
        "DELETE" => client.delete(&args.url),
        other => return Err(format!("Unsupported method: {}", other)),
    };

    let response = builder
        .header("Content-Type", "application/json")
        .header("Authentication-Key", args.api_key)
        .header("Authentication-Secret", args.api_secret)
        .send()
        .await
        .map_err(|e| format!("Request failed: {}", e))?;

    let status = response.status();
    let text = response
        .text()
        .await
        .map_err(|e| format!("Failed to read response: {}", e))?;

    if !status.is_success() {
        return Err(format!("Simplicate API error: {} — {}", status.as_u16(), text));
    }

    Ok(text)
}
