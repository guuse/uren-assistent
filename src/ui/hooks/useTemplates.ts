import { useEffect, useState } from 'react'
import { templateRepo } from '../../application/container'
import { SaveTemplateUseCase } from '../../domain/usecases/SaveTemplateUseCase'
import { DeleteTemplateUseCase } from '../../domain/usecases/DeleteTemplateUseCase'
import type { Template } from '../../domain/entities/Template'

const saveUseCase = new SaveTemplateUseCase(templateRepo)
const deleteUseCase = new DeleteTemplateUseCase(templateRepo)

export function useTemplates() {
  const [templates, setTemplates] = useState<Template[]>([])
  const [isLoading, setIsLoading] = useState(true)

  async function load() {
    setIsLoading(true)
    const all = await templateRepo.getAll()
    setTemplates(all)
    setIsLoading(false)
  }

  useEffect(() => { void load() }, [])

  async function save(template: Template) {
    await saveUseCase.execute(template)
    await load()
  }

  async function remove(id: string) {
    await deleteUseCase.execute(id)
    await load()
  }

  return { templates, isLoading, save, remove, reload: load }
}
