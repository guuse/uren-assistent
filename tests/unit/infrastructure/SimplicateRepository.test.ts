import { describe, it, expect, vi, beforeEach } from 'vitest'
import { SimplicateRepository } from '../../../src/infrastructure/simplicate/SimplicateRepository'

const mockFetch = vi.fn()
global.fetch = mockFetch

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
    mockFetch.mockResolvedValueOnce({
      ok: true,
      json: async () => ({
        data: [{ id: 'p1', name: 'Harborn', organization: { name: 'Harborn B.V.' } }],
      }),
    })
    const projects = await repo.getProjects()
    expect(projects).toEqual([{ id: 'p1', name: 'Harborn', organizationName: 'Harborn B.V.' }])
    expect(mockFetch).toHaveBeenCalledWith(
      `${baseUrl}/projects/project`,
      expect.objectContaining({
        headers: expect.objectContaining({ 'Authentication': `App ${apiKey}:${apiSecret}` }),
      }),
    )
  })

  it('fetches services filtered by projectId', async () => {
    mockFetch.mockResolvedValueOnce({
      ok: true,
      json: async () => ({
        data: [{ id: 's1', name: 'Ceremonies', project: { id: 'p1' } }],
      }),
    })
    const services = await repo.getServices('p1')
    expect(services).toEqual([{ id: 's1', name: 'Ceremonies', projectId: 'p1' }])
    expect(mockFetch).toHaveBeenCalledWith(
      `${baseUrl}/projects/service?project_id=p1`,
      expect.anything(),
    )
  })

  it('throws on non-ok response', async () => {
    mockFetch.mockResolvedValueOnce({ ok: false, status: 401, json: async () => ({}) })
    await expect(repo.getProjects()).rejects.toThrow('Simplicate API error: 401')
  })
})
