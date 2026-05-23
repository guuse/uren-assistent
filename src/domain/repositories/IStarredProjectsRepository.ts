export interface IStarredProjectsRepository {
  load(): Promise<void>
  getStarredIds(): ReadonlySet<string>
  toggle(projectId: string): Promise<void>
}
