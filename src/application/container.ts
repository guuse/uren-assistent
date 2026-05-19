import { KeychainRepository } from '../infrastructure/keychain/KeychainRepository'
import { SimplicateRepository } from '../infrastructure/simplicate/SimplicateRepository'
import { TemplateStorageRepository } from '../infrastructure/storage/TemplateStorageRepository'
import { MappingCacheRepository } from '../infrastructure/storage/MappingCacheRepository'
import { CopilotRepository } from '../infrastructure/copilot/CopilotRepository'
import { BookTemplateUseCase } from '../domain/usecases/BookTemplateUseCase'
import { DeleteTemplateUseCase } from '../domain/usecases/DeleteTemplateUseCase'
import { FetchSimplicateDataUseCase } from '../domain/usecases/FetchSimplicateDataUseCase'
import { SaveTemplateUseCase } from '../domain/usecases/SaveTemplateUseCase'
import { ParseBrowserHistoryUseCase } from '../domain/usecases/ParseBrowserHistoryUseCase'
import { ClassifyHistoryBlocksUseCase } from '../domain/usecases/ClassifyHistoryBlocksUseCase'
import type { ISimplicateRepository } from '../domain/repositories/ISimplicateRepository'
import type { ICopilotRepository } from '../domain/repositories/ICopilotRepository'

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
