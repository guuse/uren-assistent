import { describe, it, expect, vi, beforeEach } from 'vitest'
import { invoke } from '@tauri-apps/api/core'
import { SimplicateRepository } from './SimplicateRepository'
import type { HourEntry } from '../../domain/entities/HourEntry'

vi.mock('@tauri-apps/api/core', () => ({
  invoke: vi.fn(),
}))

const invokeMock = vi.mocked(invoke)

function repo() {
  return new SimplicateRepository('https://api.simplicate.test', 'key', 'secret')
}

/** Returns the parsed `args` of the nth simplicate_request invoke call. */
function callArgs(n = 0) {
  return (invokeMock.mock.calls[n]![1] as { args: Record<string, unknown> }).args
}

beforeEach(() => {
  invokeMock.mockReset()
})

describe('SimplicateRepository', () => {
  describe('getProjects', () => {
    it('paginates and filters out closed projects', async () => {
      const open = (id: string) => ({
        id,
        name: `Project ${id}`,
        organization: { name: 'Org' },
        project_status: { label: 'tab_pactive' },
        end_date: null,
      })
      const page1 = Array.from({ length: 100 }, (_, i) => open(`p${i}`))
      const page2 = [
        open('last'),
        { ...open('closed'), project_status: { label: 'tab_pclosed' } },
      ]
      invokeMock
        .mockResolvedValueOnce(JSON.stringify({ data: page1 }))
        .mockResolvedValueOnce(JSON.stringify({ data: page2 }))

      const result = await repo().getProjects()

      expect(invokeMock).toHaveBeenCalledTimes(2)
      expect(callArgs(0).url).toContain('limit=100&offset=0')
      expect(callArgs(1).url).toContain('offset=100')
      expect(result).toHaveLength(101)
      expect(result.find((p) => p.id === 'closed')).toBeUndefined()
      expect(result[0]).toEqual({ id: 'p0', name: 'Project p0', organizationName: 'Org' })
    })
  })

  describe('getServices', () => {
    const baseService = {
      id: 's1',
      name: 'Dev',
      project_id: 'proj1',
      write_hours_start_date: null,
      write_hours_end_date: null,
      hour_types: [
        { hourstype: { id: 'ht1', label: 'Normaal', blocked: false } },
        { hourstype: { id: 'ht2', label: 'Geblokkeerd', blocked: true } },
      ],
    }

    it('maps services and drops blocked hour types', async () => {
      invokeMock.mockResolvedValueOnce(JSON.stringify({ data: [baseService] }))
      const result = await repo().getServices('proj1', '2026-05-20')
      expect(callArgs(0).url).toContain('q%5Bproject_id%5D=proj1')
      expect(result).toEqual([{ id: 's1', name: 'Dev', projectId: 'proj1', hourTypeIds: ['ht1'] }])
    })

    it('filters services outside the write-hours window', async () => {
      const tooLate = { ...baseService, id: 'late', write_hours_start_date: '2026-06-01' }
      const tooEarly = { ...baseService, id: 'early', write_hours_end_date: '2026-04-01' }
      const inWindow = { ...baseService, id: 'ok', write_hours_start_date: '2026-05-01', write_hours_end_date: '2026-05-31' }
      invokeMock.mockResolvedValueOnce(JSON.stringify({ data: [tooLate, tooEarly, inWindow] }))
      const result = await repo().getServices('proj1', '2026-05-20')
      expect(result.map((s) => s.id)).toEqual(['ok'])
    })
  })

  describe('getHourTypes', () => {
    it('maps id and label', async () => {
      invokeMock.mockResolvedValueOnce(JSON.stringify({ data: [{ id: 'h1', label: 'Direct' }] }))
      expect(await repo().getHourTypes()).toEqual([{ id: 'h1', label: 'Direct' }])
    })
  })

  describe('getEmployee', () => {
    it('finds the employee by email', async () => {
      invokeMock.mockResolvedValueOnce(
        JSON.stringify({ data: [{ id: 'e1', name: 'Guus', work_email: 'guus@harborn.com' }] }),
      )
      expect(await repo().getEmployee('guus@harborn.com')).toEqual({
        id: 'e1',
        name: 'Guus',
        email: 'guus@harborn.com',
      })
    })

    it('throws when not found', async () => {
      invokeMock.mockResolvedValueOnce(JSON.stringify({ data: [] }))
      await expect(repo().getEmployee('missing@harborn.com')).rejects.toThrow(
        'Employee not found for email: missing@harborn.com',
      )
    })
  })

  describe('bookHours', () => {
    it('posts one entry per booking', async () => {
      invokeMock.mockResolvedValue(JSON.stringify({ data: {} }))
      const entries: HourEntry[] = [
        {
          employeeId: 'e1',
          projectId: 'p1',
          projectServiceId: 'ps1',
          hourTypeId: 'ht1',
          hours: 1,
          startDate: '2026-05-20',
          startTime: '09:00',
          endTime: '10:00',
          note: 'work',
        },
      ]
      await repo().bookHours(entries)
      expect(invokeMock).toHaveBeenCalledTimes(1)
      const args = callArgs(0)
      expect(args.method).toBe('POST')
      const body = JSON.parse(args.body as string)
      expect(body).toMatchObject({
        employee_id: 'e1',
        project_id: 'p1',
        projectservice_id: 'ps1',
        type_id: 'ht1',
        hours: 1,
        start_date: '2026-05-20 09:00:00',
        end_date: '2026-05-20 10:00:00',
        note: 'work',
        is_time_defined: true,
        is_recurring: false,
      })
    })
  })

  describe('getHourEntries', () => {
    it('paginates and maps entries', async () => {
      const entry = {
        id: 'h1',
        employee: { id: 'e1' },
        project: { id: 'p1' },
        projectservice: { id: 'ps1' },
        type: { id: 'ht1' },
        hours: 2,
        start_date: '2026-05-20 09:00:00',
        end_date: '2026-05-20 11:00:00',
        note: 'note',
      }
      invokeMock.mockResolvedValueOnce(JSON.stringify({ data: [entry] }))
      const result = await repo().getHourEntries('e1', '2026-05-19', '2026-05-23')
      expect(callArgs(0).url).toContain('q%5Bemployee.id%5D=e1')
      expect(result).toEqual([
        {
          id: 'h1',
          employeeId: 'e1',
          projectId: 'p1',
          projectServiceId: 'ps1',
          hourTypeId: 'ht1',
          hours: 2,
          startDate: '2026-05-20',
          startTime: '09:00',
          endTime: '11:00',
          note: 'note',
        },
      ])
    })
  })

  describe('deleteHourEntry', () => {
    it('issues a DELETE with encoded id', async () => {
      invokeMock.mockResolvedValueOnce('')
      await repo().deleteHourEntry('h 1')
      const args = callArgs(0)
      expect(args.method).toBe('DELETE')
      expect(args.url).toContain('/hours/hours/h%201')
      expect(args.body).toBeNull()
    })
  })

  describe('updateHourEntry', () => {
    it('issues a PUT and tolerates an empty (204) body', async () => {
      invokeMock.mockResolvedValueOnce('   ')
      const entry: HourEntry = {
        id: 'h1',
        employeeId: 'e1',
        projectId: 'p1',
        projectServiceId: 'ps1',
        hourTypeId: 'ht1',
        hours: 1,
        startDate: '2026-05-20',
        startTime: '09:00',
        endTime: '10:00',
        note: 'n',
      }
      await repo().updateHourEntry(entry)
      const args = callArgs(0)
      expect(args.method).toBe('PUT')
      expect(args.url).toContain('/hours/hours/h1')
      const body = JSON.parse(args.body as string)
      expect(body).toMatchObject({ employee_id: 'e1', start_date: '2026-05-20 09:00:00' })
    })

    it('parses a non-empty PUT body', async () => {
      invokeMock.mockResolvedValueOnce(JSON.stringify({ data: { ok: true } }))
      const entry: HourEntry = {
        id: 'h2',
        employeeId: 'e1',
        projectId: 'p1',
        projectServiceId: 'ps1',
        hourTypeId: 'ht1',
        hours: 1,
        startDate: '2026-05-20',
        startTime: '09:00',
        endTime: '10:00',
        note: 'n',
      }
      await repo().updateHourEntry(entry)
      expect(invokeMock).toHaveBeenCalledTimes(1)
    })
  })

  describe('submitHours', () => {
    it('posts the submission range', async () => {
      invokeMock.mockResolvedValueOnce(JSON.stringify({ data: {} }))
      await repo().submitHours('e1', '2026-05-19', '2026-05-23')
      const args = callArgs(0)
      expect(args.method).toBe('POST')
      expect(args.url).toContain('/hours/submission')
      expect(JSON.parse(args.body as string)).toEqual({
        employee_id: 'e1',
        start_date: '2026-05-19',
        end_date: '2026-05-23',
      })
    })
  })

  describe('withdrawHours', () => {
    it('deletes the submission range with a body', async () => {
      invokeMock.mockResolvedValueOnce('')
      await repo().withdrawHours('e1', '2026-05-19', '2026-05-23')
      const args = callArgs(0)
      expect(args.method).toBe('DELETE')
      expect(JSON.parse(args.body as string)).toEqual({
        employee_id: 'e1',
        start_date: '2026-05-19',
        end_date: '2026-05-23',
      })
    })
  })

  describe('getSubmissions', () => {
    it('queries with exact q[employee_id]/q[start_date]/q[end_date]', async () => {
      invokeMock.mockResolvedValueOnce(JSON.stringify({ data: [] }))
      await repo().getSubmissions('e1', '2026-05-25', '2026-05-31')
      const url = callArgs(0).url
      expect(url).toContain('q%5Bemployee_id%5D=e1')
      expect(url).toContain('q%5Bstart_date%5D=2026-05-25')
      expect(url).toContain('q%5Bend_date%5D=2026-05-31')
      expect(url).not.toContain('%5Bge%5D')
      expect(url).not.toContain('%5Ble%5D')
    })

    it('keeps only submitted/approved per-day records and maps them to single dates', async () => {
      invokeMock.mockResolvedValueOnce(
        JSON.stringify({
          data: [
            { employee_id: 'employee:e1', date: '2026-05-25', status: 'submitted' },
            { employee_id: 'employee:e1', date: '2026-05-26', status: 'approved' },
            { employee_id: 'employee:e1', date: '2026-05-30', status: 'no_registrations' },
            { employee_id: 'employee:e1', date: '2026-05-31', status: 'open' },
            { employee_id: 'employee:e1', status: 'submitted' }, // no date -> dropped
          ],
        }),
      )
      const result = await repo().getSubmissions('e1', '2026-05-25', '2026-05-31')
      expect(result).toEqual([
        { startDate: '2026-05-25', endDate: '2026-05-25', status: 'submitted' },
        { startDate: '2026-05-26', endDate: '2026-05-26', status: 'approved' },
      ])
    })
  })
})
