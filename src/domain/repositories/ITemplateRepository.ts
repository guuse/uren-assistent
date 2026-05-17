import type { Template } from '../entities/Template'

export interface ITemplateRepository {
  getAll(): Promise<Template[]>
  save(template: Template): Promise<void>
  delete(id: string): Promise<void>
}
