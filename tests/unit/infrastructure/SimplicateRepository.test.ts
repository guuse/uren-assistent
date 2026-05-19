import { describe, it, expect, vi, beforeEach } from 'vitest'
import { SimplicateRepository } from '../../../src/infrastructure/simplicate/SimplicateRepository'

vi.mock('@tauri-apps/api/core', () => ({
  invoke: vi.fn(),
}))

import { invoke } from '@tauri-apps/api/core'
const mockInvoke = vi.mocked(invoke)

const baseUrl = 'https://test.simplicate.nl/api/v2'
const apiKey = 'test-api-key'
const apiSecret = 'test-api-secret'

describe('SimplicateRepository', () => {
  let repo: SimplicateRepository

  beforeEach(() => {
    repo = new SimplicateRepository(baseUrl, apiKey, apiSecret)
    vi.clearAllMocks()
  })

  it('fetches projects and maps to domain type', async () => {
    mockInvoke.mockResolvedValueOnce(JSON.stringify({
      data: [{ id: 'p1', name: 'Harborn', organization: { name: 'Harborn B.V.' }, project_status: { label: 'active' } }],
    }))
    const projects = await repo.getProjects()
    expect(projects).toEqual([{ id: 'p1', name: 'Harborn', organizationName: 'Harborn B.V.' }])
    expect(mockInvoke).toHaveBeenCalledWith('simplicate_request', expect.objectContaining({
      args: expect.objectContaining({
        method: 'GET',
        url: expect.stringContaining('/projects/project'),
        api_key: apiKey,
        api_secret: apiSecret,
      }),
    }))
  })

  it('fetches services filtered by projectId', async () => {
    mockInvoke.mockResolvedValueOnce(JSON.stringify({
      data: [{
        id: 's1',
        name: 'Ceremonies',
        project_id: 'p1',
        write_hours_end_date: null,
        hour_types: [
          { hourstype: { id: 'ht1', blocked: false } },
          { hourstype: { id: 'ht2', blocked: true } },
        ],
      }],
    }))
    const services = await repo.getServices('p1')
    expect(services).toEqual([{ id: 's1', name: 'Ceremonies', projectId: 'p1', hourTypeIds: ['ht1'] }])
    expect(mockInvoke).toHaveBeenCalledWith('simplicate_request', expect.objectContaining({
      args: expect.objectContaining({
        url: expect.stringContaining('p1'),
      }),
    }))
  })

  it('throws on non-ok response', async () => {
    mockInvoke.mockRejectedValueOnce(new Error('Simplicate API error: 401'))
    await expect(repo.getProjects()).rejects.toThrow('Simplicate API error: 401')
  })
})
