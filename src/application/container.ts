import { KeychainRepository } from '../infrastructure/keychain/KeychainRepository'
import { SimplicateRepository } from '../infrastructure/simplicate/SimplicateRepository'
import { TemplateStorageRepository } from '../infrastructure/storage/TemplateStorageRepository'
import { BookTemplateUseCase } from '../domain/usecases/BookTemplateUseCase'
import { DeleteTemplateUseCase } from '../domain/usecases/DeleteTemplateUseCase'
import { FetchSimplicateDataUseCase } from '../domain/usecases/FetchSimplicateDataUseCase'
import { SaveTemplateUseCase } from '../domain/usecases/SaveTemplateUseCase'

// Repositories
export const keychainRepo = new KeychainRepository()
export const templateRepo = new TemplateStorageRepository()

// SimplicateRepository is created lazily after credentials are loaded
export function createSimplicateRepository(baseUrl: string, apiKey: string, apiSecret: string) {
  return new SimplicateRepository(baseUrl, apiKey, apiSecret)
}

// Use cases (stateless, created with injected repos)
export function createUseCases(simplicateRepo: SimplicateRepository) {
  return {
    saveTemplate: new SaveTemplateUseCase(templateRepo),
    deleteTemplate: new DeleteTemplateUseCase(templateRepo),
    bookTemplate: new BookTemplateUseCase(simplicateRepo),
    fetchSimplicateData: new FetchSimplicateDataUseCase(simplicateRepo),
  }
}
