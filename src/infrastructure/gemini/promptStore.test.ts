import { describe, it, expect, vi, beforeEach } from 'vitest'

vi.mock('@tauri-apps/plugin-fs', () => ({
  readTextFile: vi.fn(),
  writeTextFile: vi.fn(),
  mkdir: vi.fn(),
}))
vi.mock('@tauri-apps/api/path', () => ({
  appDataDir: vi.fn().mockResolvedValue('/mock/app/data'),
}))

import { readTextFile, writeTextFile, mkdir } from '@tauri-apps/plugin-fs'
import { loadPromptTemplate, renderPrompt, BUNDLED_HASHES } from './promptStore'

const mockRead = readTextFile as ReturnType<typeof vi.fn>
const mockWrite = writeTextFile as ReturnType<typeof vi.fn>
const mockMkdir = mkdir as ReturnType<typeof vi.fn>

const VERSIONS_PATH = '/mock/app/data/prompts/versions.json'

/** Wires readTextFile so the versions sidecar and the template file return distinct content. */
function mockDisk(opts: { versions?: Record<string, string>; diskCopy?: string | null }) {
  mockRead.mockImplementation((p: string) => {
    if (p === VERSIONS_PATH) {
      return opts.versions ? Promise.resolve(JSON.stringify(opts.versions)) : Promise.reject(new Error('no versions'))
    }
    return opts.diskCopy != null ? Promise.resolve(opts.diskCopy) : Promise.reject(new Error('not found'))
  })
}

describe('renderPrompt', () => {
  it('substitutes {{key}} tokens with the matching value', () => {
    const out = renderPrompt('Hi {{name}}, list:\n{{items}}', { name: 'Guus', items: '- a\n- b' })
    expect(out).toBe('Hi Guus, list:\n- a\n- b')
  })

  it('replaces every occurrence of a repeated token', () => {
    expect(renderPrompt('{{d}} ... {{d}}', { d: '2026-05-30' })).toBe('2026-05-30 ... 2026-05-30')
  })

  it('replaces unknown tokens with an empty string', () => {
    expect(renderPrompt('a{{missing}}b', {})).toBe('ab')
  })

  it('does not re-scan injected values for further substitution', () => {
    expect(renderPrompt('{{a}}', { a: '{{b}}', b: 'NOPE' })).toBe('{{b}}')
  })
})

describe('loadPromptTemplate', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('honours the on-disk copy when the bundled prompt is unchanged', async () => {
    mockDisk({ versions: { 'classify-blocks': BUNDLED_HASHES['classify-blocks'] }, diskCopy: 'CUSTOM PROMPT' })
    const result = await loadPromptTemplate('classify-blocks')
    expect(result).toBe('CUSTOM PROMPT')
    expect(mockRead).toHaveBeenCalledWith('/mock/app/data/prompts/classify-blocks.md')
    expect(mockWrite).not.toHaveBeenCalled()
  })

  it('re-seeds from the repo when the bundled prompt changed', async () => {
    mockDisk({ versions: { 'classify-blocks': 'stale-hash' }, diskCopy: 'OLD CUSTOM PROMPT' })
    const result = await loadPromptTemplate('classify-blocks')

    expect(mockWrite).toHaveBeenCalledWith('/mock/app/data/prompts/classify-blocks.md', result)
    expect(mockWrite).toHaveBeenCalledWith('/mock/app/data/prompts/versions.json', expect.stringContaining(BUNDLED_HASHES['classify-blocks']))
    expect(result).toContain('You are a time-tracking assistant')
  })

  it('seeds the bundled default when the file is missing', async () => {
    mockDisk({ diskCopy: null })
    const result = await loadPromptTemplate('classify-blocks')

    expect(mockMkdir).toHaveBeenCalledWith('/mock/app/data/prompts', { recursive: true })
    expect(mockWrite).toHaveBeenCalledWith('/mock/app/data/prompts/classify-blocks.md', result)
    expect(result).toContain('You are a time-tracking assistant')
  })

  it('re-seeds when the bundled hash matches but the disk copy is gone', async () => {
    mockDisk({ versions: { 'classify-blocks': BUNDLED_HASHES['classify-blocks'] }, diskCopy: null })
    const result = await loadPromptTemplate('classify-blocks')
    expect(mockWrite).toHaveBeenCalledWith('/mock/app/data/prompts/classify-blocks.md', result)
    expect(result).toContain('You are a time-tracking assistant')
  })

  it('seeds the Dutch day template for classify-day', async () => {
    mockDisk({ diskCopy: null })
    const result = await loadPromptTemplate('classify-day')
    expect(result).toContain('Je bent een tijdregistratie-assistent')
    expect(result).toContain('patternBlocks')
  })
})
