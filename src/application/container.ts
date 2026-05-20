import { KeychainRepository } from '../infrastructure/keychain/KeychainRepository'
import { SimplicateRepository } from '../infrastructure/simplicate/SimplicateRepository'
import { TemplateStorageRepository } from '../infrastructure/storage/TemplateStorageRepository'
import { MappingCacheRepository } from '../infrastructure/storage/MappingCacheRepository'
import { CopilotRepository } from '../infrastructure/copilot/CopilotRepository'
import { GoogleCalendarRepository } from '../infrastructure/googlecalendar/GoogleCalendarRepository'
import { BookTemplateUseCase } from '../domain/usecases/BookTemplateUseCase'
import { DeleteTemplateUseCase } from '../domain/usecases/DeleteTemplateUseCase'
import { FetchSimplicateDataUseCase } from '../domain/usecases/FetchSimplicateDataUseCase'
import { SaveTemplateUseCase } from '../domain/usecases/SaveTemplateUseCase'
import { ParseBrowserHistoryUseCase } from '../domain/usecases/ParseBrowserHistoryUseCase'
import { ClassifyHistoryBlocksUseCase } from '../domain/usecases/ClassifyHistoryBlocksUseCase'
import { FetchCalendarEventsUseCase } from '../domain/usecases/FetchCalendarEventsUseCase'
import { ClassifyCalendarBlocksUseCase } from '../domain/usecases/ClassifyCalendarBlocksUseCase'
import { GroupAndClassifyDayUseCase } from '../domain/usecases/GroupAndClassifyDayUseCase'
import type { ISimplicateRepository } from '../domain/repositories/ISimplicateRepository'
import type { ICopilotRepository } from '../domain/repositories/ICopilotRepository'
import type { Project, Service } from '../domain/repositories/ICopilotRepository'

const GOOGLE_CLIENT_ID = import.meta.env.VITE_GOOGLE_CLIENT_ID as string
const GOOGLE_CLIENT_SECRET = import.meta.env.VITE_GOOGLE_CLIENT_SECRET as string

// Repositories
export const keychainRepo = new KeychainRepository()
export const templateRepo = new TemplateStorageRepository()
export const mappingCacheRepo = new MappingCacheRepository()

// SimplicateRepository is created lazily after credentials are loaded
export function createSimplicateRepository(baseUrl: string, apiKey: string, apiSecret: string) {
  return new SimplicateRepository(baseUrl, apiKey, apiSecret)
}

export function createCopilotRepository(token: string): ICopilotRepository {
  return new CopilotRepository(token)
}

export function createCalendarRepository() {
  return new GoogleCalendarRepository(keychainRepo, GOOGLE_CLIENT_ID, GOOGLE_CLIENT_SECRET)
}

export function createFetchCalendarEventsUseCase() {
  return new FetchCalendarEventsUseCase(createCalendarRepository())
}

export function createClassifyCalendarBlocksUseCase(copilotRepo: ICopilotRepository) {
  return new ClassifyCalendarBlocksUseCase(copilotRepo)
}

export function createGroupAndClassifyDayUseCase(
  copilotRepo: ICopilotRepository,
  projects: Project[],
  services: Service[],
): GroupAndClassifyDayUseCase {
  return new GroupAndClassifyDayUseCase(copilotRepo, mappingCacheRepo, projects, services)
}

// Use cases (stateless, created with injected repos)
export function createUseCases(simplicateRepo: ISimplicateRepository) {
  return {
    saveTemplate: new SaveTemplateUseCase(templateRepo),
    deleteTemplate: new DeleteTemplateUseCase(templateRepo),
    bookTemplate: new BookTemplateUseCase(simplicateRepo),
    fetchSimplicateData: new FetchSimplicateDataUseCase(simplicateRepo),
    parseBrowserHistory: new ParseBrowserHistoryUseCase(),
    classifyHistoryBlocks: (copilotRepo: ICopilotRepository) =>
      new ClassifyHistoryBlocksUseCase(copilotRepo, mappingCacheRepo),
  }
}
