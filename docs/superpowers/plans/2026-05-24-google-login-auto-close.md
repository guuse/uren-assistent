# Google Login Auto-Close Browser + App Focus Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Na een succesvolle Google OAuth login sluit de browser-tab zichzelf automatisch en krijgt de Tauri-app automatisch focus.

**Architecture:** De Rust TCP-server in `auth.rs` stuurt een HTML-response terug met `window.close()` zodat de browser-tab zichzelf sluit. Direct daarna roept de Rust-code `set_focus()` aan op het main Tauri-window via de bestaande `AppHandle`.

**Tech Stack:** Rust, Tauri v2, `tauri::AppHandle`, `tauri::WebviewWindow`

---

## File Map

| Actie | Bestand |
|---|---|
| Modify | `src-tauri/src/commands/auth.rs` (regels 74-75) |

---

### Task 1: Vervang de HTML-response en voeg `set_focus()` toe

**Files:**
- Modify: `src-tauri/src/commands/auth.rs:74-78`

- [ ] **Step 1: Vervang de statische HTML-response (regel 74) door een pagina met `window.close()`**

Verander:
```rust
let response = "HTTP/1.1 200 OK\r\nContent-Type: text/html\r\n\r\n<html><body><h2>Inloggen geslaagd! Je kunt dit venster sluiten.</h2></body></html>";
writer.write_all(response.as_bytes()).await.map_err(|e| e.to_string())?;
```

Naar:
```rust
let html = "<!DOCTYPE html><html><body><p>Je bent ingelogd. Dit venster sluit automatisch.</p><script>window.close()</script></body></html>";
let response = format!(
    "HTTP/1.1 200 OK\r\nContent-Type: text/html\r\nContent-Length: {}\r\n\r\n{}",
    html.len(),
    html
);
writer.write_all(response.as_bytes()).await.map_err(|e| e.to_string())?;
```

- [ ] **Step 2: Voeg `set_focus()` toe direct na de response, vóór de return**

Voeg toe na de `writer.write_all(...)` regel:

```rust
if let Some(window) = app.get_webview_window("main") {
    let _ = window.set_focus();
}
```

Het volledige einde van de functie ziet er dan zo uit:

```rust
    let html = "<!DOCTYPE html><html><body><p>Je bent ingelogd. Dit venster sluit automatisch.</p><script>window.close()</script></body></html>";
    let response = format!(
        "HTTP/1.1 200 OK\r\nContent-Type: text/html\r\nContent-Length: {}\r\n\r\n{}",
        html.len(),
        html
    );
    writer.write_all(response.as_bytes()).await.map_err(|e| e.to_string())?;

    if let Some(window) = app.get_webview_window("main") {
        let _ = window.set_focus();
    }

    // Return code + verifier + redirect_uri for token exchange in JS
    Ok(serde_json::json!({ "code": code, "verifier": verifier, "redirect_uri": redirect_uri }).to_string())
}
```

- [ ] **Step 3: Verifieer dat het compileert**

```bash
cd src-tauri && cargo check
```

Verwacht: geen errors. Warnings over ongebruikte imports zijn OK.

- [ ] **Step 4: Test de flow handmatig**

Start de app met `make run`, klik op "Login met Google", log in bij Google. Verwacht:
1. Browser opent Google login
2. Na succesvol inloggen sluit de browser-tab automatisch
3. De Tauri-app komt naar de voorgrond

- [ ] **Step 5: Commit**

```bash
git add src-tauri/src/commands/auth.rs
git commit -m "feat: auto-close browser tab and focus app after google oauth"
```
