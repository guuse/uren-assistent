import { KeychainRepository } from '../infrastructure/keychain/KeychainRepository'
import { SimplicateRepository } from '../infrastructure/simplicate/SimplicateRepository'
import { MappingCacheRepository } from '../infrastructure/storage/MappingCacheRepository'
import { HistoryStore } from '../infrastructure/storage/HistoryStore'
import { StarredProjectsStore } from '../infrastructure/storage/StarredProjectsStore'
import { CopilotRepository } from '../infrastructure/copilot/CopilotRepository'
import { GoogleCalendarRepository } from '../infrastructure/googlecalendar/GoogleCalendarRepository'
import { TauriSettingsRepository } from '../infrastructure/storage/TauriSettingsRepository'
import { GetCopilotModelsUseCase } from '../domain/usecases/GetCopilotModelsUseCase'
import { GetSelectedModelUseCase } from '../domain/usecases/GetSelectedModelUseCase'
import { SetSelectedModelUseCase } from '../domain/usecases/SetSelectedModelUseCase'
import { FetchSimplicateDataUseCase } from '../domain/usecases/FetchSimplicateDataUseCase'
import { ParseBrowserHistoryUseCase } from '../domain/usecases/ParseBrowserHistoryUseCase'
import { ClassifyHistoryBlocksUseCase } from '../domain/usecases/ClassifyHistoryBlocksUseCase'
import { FetchCalendarEventsUseCase } from '../domain/usecases/FetchCalendarEventsUseCase'
import { ClassifyCalendarBlocksUseCase } from '../domain/usecases/ClassifyCalendarBlocksUseCase'
import { GroupAndClassifyDayUseCase } from '../domain/usecases/GroupAndClassifyDayUseCase'
import { GetWeekEntriesUseCase } from '../domain/usecases/GetWeekEntriesUseCase'
import { GenerateSuggestionsUseCase } from '../domain/usecases/GenerateSuggestionsUseCase'
import { BookHoursUseCase } from '../domain/usecases/BookHoursUseCase'
import { DeleteHourEntryUseCase } from '../domain/usecases/DeleteHourEntryUseCase'
import type { ISimplicateRepository } from '../domain/repositories/ISimplicateRepository'
import type { ICopilotRepository } from '../domain/repositories/ICopilotRepository'
import type { Project, Service } from '../domain/repositories/ICopilotRepository'
import { GitHubRepository } from '../infrastructure/github/GitHubRepository'
import { LinearRepository } from '../infrastructure/linear/LinearRepository'
import { ProcessWeekUseCase } from '../domain/usecases/ProcessWeekUseCase'
import { ProcessDayUseCase } from '../domain/usecases/ProcessDayUseCase'
import { ClearDayBlocksUseCase } from '../domain/usecases/ClearDayBlocksUseCase'
import { ClearWeekBlocksUseCase } from '../domain/usecases/ClearWeekBlocksUseCase'
import { GetActiveProjectsForDateUseCase } from '../domain/usecases/GetActiveProjectsForDateUseCase'
import type { IGitHubRepository } from '../domain/repositories/IGitHubRepository'
import type { ILinearRepository } from '../domain/repositories/ILinearRepository'

const GOOGLE_CLIENT_ID = import.meta.env.VITE_GOOGLE_CLIENT_ID as string
const GOOGLE_CLIENT_SECRET = import.meta.env.VITE_GOOGLE_CLIENT_SECRET as string

// Repositories
export const keychainRepo = new KeychainRepository()
export const mappingCacheRepo = new MappingCacheRepository()
export const historyStore = new HistoryStore()
export const starredProjectsStore = new StarredProjectsStore()

export const settingsRepo = new TauriSettingsRepository()

export function createGetCopilotModelsUseCase(copilotRepo: ICopilotRepository): GetCopilotModelsUseCase {
  return new GetCopilotModelsUseCase(copilotRepo)
}

export function createGetSelectedModelUseCase(): GetSelectedModelUseCase {
  return new GetSelectedModelUseCase(settingsRepo)
}

export function createSetSelectedModelUseCase(): SetSelectedModelUseCase {
  return new SetSelectedModelUseCase(settingsRepo)
}

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

export function createUseCases(simplicateRepo: ISimplicateRepository) {
  return {
    fetchSimplicateData: new FetchSimplicateDataUseCase(simplicateRepo),
    parseBrowserHistory: new ParseBrowserHistoryUseCase(),
    classifyHistoryBlocks: (copilotRepo: ICopilotRepository) =>
      new ClassifyHistoryBlocksUseCase(copilotRepo, mappingCacheRepo),
    getWeekEntries: new GetWeekEntriesUseCase(simplicateRepo),
    generateSuggestions: new GenerateSuggestionsUseCase(),
    bookHours: new BookHoursUseCase(simplicateRepo),
    deleteHourEntry: new DeleteHourEntryUseCase(simplicateRepo),
  }
}

export function createGitHubRepository(token: string): IGitHubRepository {
  return new GitHubRepository(token)
}

export function createLinearRepository(token: string): ILinearRepository {
  return new LinearRepository(token)
}

export function createGetActiveProjectsUseCase(simplicateRepo: ISimplicateRepository): GetActiveProjectsForDateUseCase {
  return new GetActiveProjectsForDateUseCase(simplicateRepo)
}

export function createProcessWeekUseCase(
  githubToken: string,
  linearToken: string,
  calendarRepo: ReturnType<typeof createCalendarRepository>,
  copilotRepo: ICopilotRepository,
  projects: Project[],
  services: Service[],
  githubUsername: string,
  simplicateRepo: ISimplicateRepository,
  simplicateEmployeeId: string,
): ProcessWeekUseCase {
  return new ProcessWeekUseCase(
    new GitHubRepository(githubToken),
    new LinearRepository(linearToken),
    calendarRepo,
    historyStore,
    copilotRepo,
    mappingCacheRepo,
    projects,
    services,
    githubUsername,
    simplicateRepo,
    simplicateEmployeeId,
  )
}

export function createProcessDayUseCase(
  githubToken: string,
  linearToken: string,
  calendarRepo: ReturnType<typeof createCalendarRepository>,
  copilotRepo: ICopilotRepository,
  projects: Project[],
  services: Service[],
  githubUsername: string,
  simplicateRepo: ISimplicateRepository,
  simplicateEmployeeId: string,
): ProcessDayUseCase {
  return new ProcessDayUseCase(
    new GitHubRepository(githubToken),
    new LinearRepository(linearToken),
    calendarRepo,
    historyStore,
    copilotRepo,
    mappingCacheRepo,
    projects,
    services,
    githubUsername,
    simplicateRepo,
    simplicateEmployeeId,
  )
}

export function createClearDayBlocksUseCase(): ClearDayBlocksUseCase {
  return new ClearDayBlocksUseCase(historyStore)
}

export function createClearWeekBlocksUseCase(): ClearWeekBlocksUseCase {
  return new ClearWeekBlocksUseCase(historyStore)
}
