import '@testing-library/jest-dom'

// Make unit tests hermetic. The app reads VITE_SIMPLICATE_BASE_URL from
// import.meta.env at module-load time. Locally a developer's (gitignored) .env
// supplies it, but CI has no .env, leaving the value `undefined` and breaking
// tests that assert a base URL was passed. Pin a deterministic fallback so the
// suite never depends on a local .env. A real env value (if set) still wins.
import.meta.env.VITE_SIMPLICATE_BASE_URL ??=
  'https://test.simplicate.test/api/v2'
