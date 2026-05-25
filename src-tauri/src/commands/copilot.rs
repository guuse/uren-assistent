use reqwest::Client;
use serde::Deserialize;

#[derive(Deserialize)]
pub struct CopilotRequestArgs {
    pub token: String,
    pub body: String,
}

#[tauri::command]
pub async fn copilot_request(args: CopilotRequestArgs) -> Result<String, String> {
    let client = Client::new();

    let response = client
        .post("https://api.githubcopilot.com/chat/completions")
        .header("Authorization", format!("Bearer {}", args.token))
        .header("Content-Type", "application/json")
        .header("Copilot-Integration-Id", "quiet-wizard")
        .body(args.body)
        .send()
        .await
        .map_err(|e| format!("Request failed: {}", e))?;

    let status = response.status();
    let text = response
        .text()
        .await
        .map_err(|e| format!("Failed to read response: {}", e))?;

    if !status.is_success() {
        return Err(format!("Copilot API error: {} — {}", status.as_u16(), text));
    }

    Ok(text)
}

#[derive(Deserialize)]
pub struct CopilotGetArgs {
    pub token: String,
    pub endpoint: String,
}

#[tauri::command]
pub async fn copilot_get(args: CopilotGetArgs) -> Result<String, String> {
    let client = Client::new();

    let response = client
        .get(&args.endpoint)
        .header("Authorization", format!("Bearer {}", args.token))
        .header("Copilot-Integration-Id", "quiet-wizard")
        .send()
        .await
        .map_err(|e| format!("Request failed: {}", e))?;

    let status = response.status();
    let text = response
        .text()
        .await
        .map_err(|e| format!("Failed to read response: {}", e))?;

    if !status.is_success() {
        return Err(format!("Copilot API error: {} — {}", status.as_u16(), text));
    }

    Ok(text)
}
