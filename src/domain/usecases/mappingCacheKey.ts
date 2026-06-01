/**
 * Canonical key under which a block's project/service mapping is cached.
 *
 * Most blocks key on their `urlPattern` directly. Commit blocks are the
 * exception: their pattern is `github.com/owner/repo@HH:mm` (the start time is
 * baked in so multiple sessions of one repo stay distinct in the history
 * store). Keying the *mapping* on that time-specific pattern means a repo's
 * learned project never gets reused — every day's session has a new time and
 * misses the cache. Strip the `@HH:mm` suffix so the repo→project mapping is
 * stable across days.
 */
export function mappingCacheKey(urlPattern: string): string {
  if (urlPattern.startsWith('github.com/')) {
    const at = urlPattern.indexOf('@')
    return at === -1 ? urlPattern : urlPattern.slice(0, at)
  }
  return urlPattern
}
