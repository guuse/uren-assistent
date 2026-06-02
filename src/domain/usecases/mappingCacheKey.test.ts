import { describe, it, expect } from 'vitest'
import { mappingCacheKey } from './mappingCacheKey'

describe('mappingCacheKey', () => {
  it('strips the @HH:mm session suffix from github commit patterns', () => {
    expect(mappingCacheKey('github.com/acme/web@09:15')).toBe('github.com/acme/web')
    expect(mappingCacheKey('github.com/acme/web@14:00')).toBe('github.com/acme/web')
  })

  it('maps two sessions of the same repo to the same key', () => {
    expect(mappingCacheKey('github.com/acme/api@08:30')).toBe(
      mappingCacheKey('github.com/acme/api@16:45'),
    )
  })

  it('leaves a github pattern without a time suffix untouched', () => {
    expect(mappingCacheKey('github.com/acme/web')).toBe('github.com/acme/web')
  })

  it('leaves non-github url patterns untouched', () => {
    expect(mappingCacheKey('app.linear.team/issue')).toBe('app.linear.team/issue')
    expect(mappingCacheKey('docs.google.com/document')).toBe('docs.google.com/document')
  })
})
