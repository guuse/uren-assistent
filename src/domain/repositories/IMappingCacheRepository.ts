export interface CachedMapping {
  projectId: string
  serviceId: string
  note: string
  blockName?: string   // LLM-generated human-readable name, persisted for reuse
  summary?: string     // LLM-generated summary, persisted for reuse
}

export interface IMappingCacheRepository {
  get(urlPattern: string): CachedMapping | undefined
  set(urlPattern: string, mapping: CachedMapping): Promise<void>
  getAll(): Record<string, CachedMapping>
}
