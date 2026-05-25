export interface ISettingsRepository {
  getSelectedModel(): Promise<string | null>
  setSelectedModel(modelId: string): Promise<void>
}
