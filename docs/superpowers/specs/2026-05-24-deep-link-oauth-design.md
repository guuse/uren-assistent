# Design: Deep Link OAuth + nette fallback-pagina

**Datum:** 2026-05-24

## Probleemstelling

`window.close()` werkt onbetrouwbaar in Chrome/Firefox omdat de tab niet via `window.open()` is geopend. De oplossing is een custom URL scheme (`uren-schrijven://`) zodat Google de browser redirect naar de Tauri-app via het OS — de browser-tab wordt nooit echt gebruikt als callback-ontvanger.

## Aanpak

`tauri-plugin-deep-link` registreert `uren-schrijven://` als macOS URL scheme. De OAuth redirect URI wordt `uren-schrijven://oauth/callback`. Google opent de browser, de browser redirect naar het scheme, macOS activeert de Tauri-app, de app vangt de code op via een deep link event.

De lokale TCP-server in `auth.rs` vervalt. In plaats daarvan wacht de Rust-code op een deep link event via een one-shot channel.

## Fallback HTML

Alleen getoond als Google de deep link om een of andere reden niet kan openen (bijv. bij een browser die het scheme niet herkent). Stijl: "Success card" — wit, groen vinkje-cirkel, "Inloggen geslaagd", subtitel "Dit venster sluit automatisch", fallback link `uren-schrijven://oauth/callback`.

## Bestanden die wijzigen

| Bestand | Wijziging |
|---|---|
| `src-tauri/Cargo.toml` | `tauri-plugin-deep-link = "2"` toevoegen aan `[dependencies]` en `[build-dependencies]` |
| `src-tauri/tauri.conf.json` | URL scheme registreren: `bundle.macOS.urls = ["uren-schrijven://"]` |
| `src-tauri/src/lib.rs` | Plugin registreren: `.plugin(tauri_plugin_deep_link::init())`; deep link event handler registreren die code doorstuurt via een channel |
| `src-tauri/src/commands/auth.rs` | TCP-server verwijderen; redirect URI wordt `uren-schrijven://oauth/callback`; wachten op deep link event via channel; fallback HTML aanpassen naar success card stijl |
| `src/ui/hooks/useAuth.ts` | `redirect_uri` aanpassen in token exchange naar `uren-schrijven://oauth/callback` (Rust geeft dit terug) — geen verdere wijzigingen |

## Google Cloud Console

Handmatige stap (niet geautomatiseerd): voeg `uren-schrijven://oauth/callback` toe als Authorised Redirect URI. De bestaande `http://localhost:*` URIs kunnen blijven staan.

## Deep link architectuur in Rust

```
lib.rs:
  - Maak een Arc<Mutex<Option<oneshot::Sender<String>>>> aan als app state
  - Registreer deep link event handler: als URL binnenkomt, stuur code via sender
  - Registreer als Tauri managed state

auth.rs:
  - Bouw auth URL met redirect_uri = "uren-schrijven://oauth/callback"
  - Open browser
  - Maak oneshot channel (tx, rx)
  - Zet tx in managed state
  - Wacht op rx (met timeout van 120 seconden)
  - Extraheer code uit de ontvangen URL
  - Geef { code, verifier, redirect_uri } terug aan JS
```

## Wat er NIET verandert

- JS token exchange logica in `useAuth.ts` — ongewijzigd behalve dat `redirect_uri` nu `uren-schrijven://oauth/callback` is (dit komt al uit de Rust return waarde)
- Keychain opslag
- Session restore flow
