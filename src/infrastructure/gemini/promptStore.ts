import { readTextFile, writeTextFile, mkdir } from '@tauri-apps/plugin-fs'
import { appDataDir } from '@tauri-apps/api/path'
import classifyBlocksDefault from '../../../.claude/skills/uren-classificatie/classify-blocks.md?raw'
import classifyDayDefault from '../../../.claude/skills/uren-classificatie/classify-day.md?raw'

export type PromptTemplateName = 'classify-blocks' | 'classify-day'

/**
 * Bundled defaults — the canonical prompt templates from the
 * `uren-classificatie` skill (.claude/skills/uren-classificatie/), inlined at
 * build time. The repo is the source of truth.
 */
const DEFAULTS: Record<PromptTemplateName, string> = {
  'classify-blocks': classifyBlocksDefault,
  'classify-day': classifyDayDefault,
}

const SUBDIR = 'prompts'
// No leading dot: the Tauri fs scope ($APPDATA/**) does not match dotfiles.
const VERSIONS_FILE = 'versions.json'

/** Stable, dependency-free string hash (djb2) used to detect a changed bundled prompt. */
function hashString(s: string): string {
  let h = 5381
  for (let i = 0; i < s.length; i++) {
    h = ((h << 5) + h + s.charCodeAt(i)) | 0
  }
  return (h >>> 0).toString(36)
}

/** Hash of each bundled prompt, computed once at module load. Exported for tests. */
export const BUNDLED_HASHES: Record<PromptTemplateName, string> = {
  'classify-blocks': hashString(DEFAULTS['classify-blocks']),
  'classify-day': hashString(DEFAULTS['classify-day']),
}

async function templatePath(name: PromptTemplateName): Promise<string> {
  const dir = await appDataDir()
  return `${dir}/${SUBDIR}/${name}.md`
}

async function versionsPath(): Promise<string> {
  const dir = await appDataDir()
  return `${dir}/${SUBDIR}/${VERSIONS_FILE}`
}

async function readVersions(): Promise<Partial<Record<PromptTemplateName, string>>> {
  try {
    return JSON.parse(await readTextFile(await versionsPath())) as Partial<Record<PromptTemplateName, string>>
  } catch {
    return {}
  }
}

/**
 * Loads a prompt template from `$APPDATA/prompts/<name>.md`.
 *
 * The repo's bundled prompt wins whenever it changes: we stamp the bundled
 * content's hash next to the file, and re-seed the on-disk copy whenever that
 * hash differs from what was last written. Between releases the on-disk copy is
 * left alone, so it can still be tweaked live without a rebuild — but the next
 * build with a changed prompt overwrites those tweaks.
 */
export async function loadPromptTemplate(name: PromptTemplateName): Promise<string> {
  const path = await templatePath(name)
  const bundledHash = BUNDLED_HASHES[name]
  const versions = await readVersions()

  // Bundled prompt unchanged since last seed → honour the on-disk copy (live edits).
  if (versions[name] === bundledHash) {
    try {
      return await readTextFile(path)
    } catch {
      // Disk copy missing — fall through and re-seed.
    }
  }

  // First run, changed bundled prompt, or missing disk copy → (re-)seed from the repo.
  const dir = await appDataDir()
  await mkdir(`${dir}/${SUBDIR}`, { recursive: true })
  await writeTextFile(path, DEFAULTS[name])
  await writeTextFile(await versionsPath(), JSON.stringify({ ...versions, [name]: bundledHash }, null, 2))
  return DEFAULTS[name]
}

/**
 * Substitutes `{{key}}` tokens in a template with the matching `vars` value.
 * Unknown tokens become empty strings; injected values are not re-scanned.
 */
export function renderPrompt(template: string, vars: Record<string, string>): string {
  return template.replace(/\{\{(\w+)\}\}/g, (_, key: string) => vars[key] ?? '')
}
