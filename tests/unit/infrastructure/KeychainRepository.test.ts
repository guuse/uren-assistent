import { describe, it, expect, vi, beforeEach } from 'vitest'
import { KeychainRepository } from '../../../src/infrastructure/keychain/KeychainRepository'

vi.mock('@tauri-apps/api/core', () => ({
  invoke: vi.fn(),
}))

import { invoke } from '@tauri-apps/api/core'

const mockInvoke = vi.mocked(invoke)

describe('KeychainRepository', () => {
  let repo: KeychainRepository

  beforeEach(() => {
    repo = new KeychainRepository()
    vi.clearAllMocks()
  })

  it('returns null when secret does not exist', async () => {
    mockInvoke.mockResolvedValueOnce(null)
    const result = await repo.get('missing-key')
    expect(result).toBeNull()
    expect(mockInvoke).toHaveBeenCalledWith('get_secret', { key: 'missing-key' })
  })

  it('returns value when secret exists', async () => {
    mockInvoke.mockResolvedValueOnce('my-api-key')
    const result = await repo.get('simplicate-api-key')
    expect(result).toBe('my-api-key')
  })

  it('calls set_secret on set', async () => {
    mockInvoke.mockResolvedValueOnce(undefined)
    await repo.set('simplicate-api-key', 'abc123')
    expect(mockInvoke).toHaveBeenCalledWith('set_secret', { key: 'simplicate-api-key', value: 'abc123' })
  })

  it('calls delete_secret on delete', async () => {
    mockInvoke.mockResolvedValueOnce(undefined)
    await repo.delete('simplicate-api-key')
    expect(mockInvoke).toHaveBeenCalledWith('delete_secret', { key: 'simplicate-api-key' })
  })
})
