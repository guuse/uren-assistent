import { useState, useEffect, useCallback } from 'react'
import { starredProjectsStore } from '../../application/container'

export function useStarredProjects() {
  const [starredIds, setStarredIds] = useState<ReadonlySet<string>>(new Set())

  useEffect(() => {
    void starredProjectsStore.load().then(() => {
      setStarredIds(new Set(starredProjectsStore.getStarredIds()))
    })
  }, [])

  const toggle = useCallback(async (projectId: string) => {
    await starredProjectsStore.toggle(projectId)
    setStarredIds(new Set(starredProjectsStore.getStarredIds()))
  }, [])

  return { starredIds, toggle }
}
