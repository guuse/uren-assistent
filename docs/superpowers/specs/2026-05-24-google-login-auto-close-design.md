# Design: Google Login — automatisch sluiten browser + app focus

**Datum:** 2026-05-24

## Probleemstelling

Na een succesvolle Google OAuth login blijft de browser-tab open met een statische tekst. De gebruiker moet handmatig terugschakelen naar de app.

## Doel

1. De browser-tab sluit zichzelf automatisch na de OAuth callback.
2. De Tauri-app krijgt automatisch focus (komt naar de voorgrond).

## Aanpak

Minimale wijziging in `src-tauri/src/commands/auth.rs`. Geen nieuwe plugins of dependencies.

### Wijziging 1 — HTML-response met `window.close()`

Verander de statische HTML-response (regel 74) naar een pagina die zichzelf sluit via JavaScript:

```html
HTTP/1.1 200 OK
Content-Type: text/html

<!DOCTYPE html>
<html>
<body>
<p>Je bent ingelogd. Dit venster sluit automatisch.</p>
<script>window.close()</script>
</body>
</html>
```

`window.close()` werkt betrouwbaar in Chrome, Edge en Safari voor OAuth-flows op een Tauri desktop app.

### Wijziging 2 — App-focus via `AppHandle`

Direct na het ontvangen van de callback, vóór de return, focus het main window:

```rust
if let Some(window) = app.get_webview_window("main") {
    let _ = window.set_focus();
}
```

`AppHandle` is al aanwezig als parameter (`app: AppHandle`) in het bestaande command.

## Wat er NIET verandert

- `useAuth.ts` — ongewijzigd
- Google Cloud Console redirect URIs — ongewijzigd (`http://localhost:{port}/callback`)
- Geen nieuwe Tauri plugins of Cargo dependencies

## Bestanden die wijzigen

| Bestand | Wijziging |
|---|---|
| `src-tauri/src/commands/auth.rs` | Regel 74: nieuwe HTML-response; na regel 75: `set_focus()` aanroep |
