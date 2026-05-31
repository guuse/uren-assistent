import '@testing-library/jest-dom'
import { describe, it, expect } from 'vitest'
import { render, screen } from '@testing-library/react'
import EvidencePanel from './EvidencePanel'
import type { GitHubCommit } from '../../domain/entities/GitHubCommit'
import type { LinearIssue } from '../../domain/entities/LinearIssue'

describe('EvidencePanel — extra coverage', () => {
  it('falls back to raw string for an unparseable URL (displayUrl catch)', () => {
    // A string that the URL constructor cannot parse even after prefixing.
    render(<EvidencePanel rawUrls={['http://']} />)
    // Host falls back to the raw input.
    expect(screen.getByText('http://')).toBeInTheDocument()
  })

  it('uses "?" initial fallback when the host is empty', () => {
    // An empty string parses to an empty host, exercising the initial "?" fallback.
    const { container } = render(<EvidencePanel rawUrls={['']} />)
    expect(container.textContent).toContain('?')
  })

  it('uses auth/login domain styling branch', () => {
    render(<EvidencePanel rawUrls={['https://accounts.google.com/signin']} />)
    expect(screen.getByText('accounts.google.com/signin')).toBeInTheDocument()
  })

  it('renders when only a summary is provided', () => {
    render(<EvidencePanel summary="Just a summary" />)
    expect(screen.getByText('"Just a summary"')).toBeInTheDocument()
  })

  it('falls back to urls/titles props when raw arrays are empty', () => {
    render(<EvidencePanel rawUrls={[]} urls={['https://example.com/x']} titles={['Example title']} />)
    expect(screen.getByText('example.com/x')).toBeInTheDocument()
    expect(screen.getByText('Example title')).toBeInTheDocument()
  })

  it('renders GitHub commits section', () => {
    const commits: GitHubCommit[] = [
      {
        sha: 'abc123',
        message: 'fix: bug',
        repo: 'org/repo',
        branch: 'main',
        timestamp: '2026-05-13T09:00:00Z',
        time: '09:00',
        date: '2026-05-13',
      },
    ]
    render(<EvidencePanel rawUrls={['https://example.com']} commits={commits} />)
    expect(screen.getByText('GitHub commits (1)')).toBeInTheDocument()
    expect(screen.getByText('fix: bug')).toBeInTheDocument()
    expect(screen.getByText('org/repo · 09:00')).toBeInTheDocument()
  })

  it('renders Linear issues section', () => {
    const issues: LinearIssue[] = [
      { identifier: 'ENG-42', title: 'Do the thing', completedAt: '2026-05-13T09:00:00Z', url: 'https://linear.app/x' },
    ]
    render(<EvidencePanel rawUrls={['https://example.com']} linearIssues={issues} />)
    expect(screen.getByText('Linear (deze week, afgerond)')).toBeInTheDocument()
    expect(screen.getByText('ENG-42 · Do the thing')).toBeInTheDocument()
    expect(screen.getByText('✓ done')).toBeInTheDocument()
  })

  it('formats meeting time from string dates', () => {
    render(
      <EvidencePanel
        meetings={[
          {
            id: 'm1',
            title: 'String-date meeting',
            start: '2026-05-13T09:00:00' as unknown as Date,
            end: '2026-05-13T10:00:00' as unknown as Date,
            attendees: [],
            status: 'accepted',
          },
        ]}
      />
    )
    expect(screen.getByText('String-date meeting')).toBeInTheDocument()
    expect(screen.getByText(/09:00–10:00/)).toBeInTheDocument()
  })
})
