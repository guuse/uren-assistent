export interface CachedMapping {
  projectId: string
  serviceId: string
  note: string
}

export interface IMappingCacheRepository {
  get(urlPattern: string): CachedMapping | undefined
  set(urlPattern: string, mapping: CachedMapping): Promise<void>
  getAll(): Record<string, CachedMapping>
}
