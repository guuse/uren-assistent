export interface TokenTestResult {
  ok: boolean
  label: string
}

export async function testGitHubToken(token: string): Promise<TokenTestResult> {
  try {
    const res = await fetch('https://api.github.com/user', {
      headers: {
        Authorization: `Bearer ${token}`,
        Accept: 'application/vnd.github+json',
      },
    })
    if (!res.ok) return { ok: false, label: `GitHub: HTTP ${res.status}` }
    const data = await res.json() as { login?: string }
    return { ok: true, label: `GitHub: verbonden als ${data.login ?? '?'}` }
  } catch {
    return { ok: false, label: 'GitHub: geen verbinding' }
  }
}

export async function testLinearToken(token: string): Promise<TokenTestResult> {
  try {
    const res = await fetch('https://api.linear.app/graphql', {
      method: 'POST',
      headers: {
        Authorization: token,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ query: '{ viewer { name } }' }),
    })
    if (!res.ok) return { ok: false, label: `Linear: HTTP ${res.status}` }
    const data = await res.json() as { data?: { viewer?: { name?: string } }; errors?: unknown[] }
    if (data.errors) return { ok: false, label: 'Linear: ongeldige token' }
    return { ok: true, label: `Linear: verbonden als ${data.data?.viewer?.name ?? '?'}` }
  } catch {
    return { ok: false, label: 'Linear: geen verbinding' }
  }
}

