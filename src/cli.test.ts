import { describe, it, expect, vi, beforeEach, afterAll } from 'vitest'
import * as fs from 'fs'
import { publishToHashnode } from './publish'
import { runCli } from './index'
import { validateMarkdown, parseMarkdown } from './validation'

// Mock dependencies
vi.mock('fs')
vi.mock('./publish')
vi.mock('./validation')

// Mock console and process
const mockConsole = {
  log: vi.fn(),
  error: vi.fn()
}
vi.stubGlobal('console', mockConsole)

const mockProcess = {
  exit: vi.fn(),
  env: {}
}
vi.stubGlobal('process', mockProcess)

describe('CLI', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  afterAll(() => {
    vi.unstubAllGlobals()
  })

  it('should show help message when no command provided', async () => {
    await runCli([])
    expect(mockConsole.log).toHaveBeenCalledWith(expect.stringContaining('Usage:'))
    expect(mockProcess.exit).toHaveBeenCalledWith(0)
  })

  it('should show help message with --help flag', async () => {
    await runCli(['--help'])
    expect(mockConsole.log).toHaveBeenCalledWith(expect.stringContaining('Usage:'))
    expect(mockProcess.exit).toHaveBeenCalledWith(0)
  })

  it('should validate markdown file', async () => {
    const mockContent = 'test content'
    const mockValidation = { isValid: true, errors: [] }

    vi.mocked(fs.readFileSync).mockReturnValue(mockContent)
    vi.mocked(validateMarkdown).mockReturnValue(mockValidation)

    await runCli(['validate', 'test.md'])

    expect(fs.readFileSync).toHaveBeenCalledWith('test.md', 'utf8')
    expect(validateMarkdown).toHaveBeenCalledWith(mockContent)
    expect(mockConsole.log).toHaveBeenCalledWith('✅ Markdown file is valid')
  })

  it('should show validation errors', async () => {
    const mockContent = 'test content'
    const mockValidation = {
      isValid: false,
      errors: ['Error 1', 'Error 2']
    }

    vi.mocked(fs.readFileSync).mockReturnValue(mockContent)
    vi.mocked(validateMarkdown).mockReturnValue(mockValidation)

    await runCli(['validate', 'test.md'])

    expect(mockConsole.error).toHaveBeenCalledWith('❌ Validation errors:')
    expect(mockConsole.error).toHaveBeenCalledWith('  - Error 1')
    expect(mockConsole.error).toHaveBeenCalledWith('  - Error 2')
    expect(mockProcess.exit).toHaveBeenCalledWith(1)
  })

  it('should create draft with valid input', async () => {
    const mockContent = 'test content'
    const mockValidation = { isValid: true, errors: [] }
    const mockPublishResponse = {
      draftId: '123',
      title: 'Test Article'
    }

    vi.mocked(fs.readFileSync).mockReturnValue(mockContent)
    vi.mocked(validateMarkdown).mockReturnValue(mockValidation)
    vi.mocked(parseMarkdown).mockReturnValue({
      title: 'Test Article',
      content: 'Test content',
      tags: ['test']
    })
    vi.mocked(publishToHashnode).mockResolvedValue(mockPublishResponse)

    await runCli([
      'draft',
      'test.md',
      '--token=test-token',
      '--publication-id=test-pub'
    ])

    expect(publishToHashnode).toHaveBeenCalledWith({
      token: 'test-token',
      publicationId: 'test-pub',
      title: 'Test Article',
      content: 'Test content',
      tags: ['test'],
      isDraft: true
    })
    expect(mockConsole.log).toHaveBeenCalledWith('✅ Successfully created draft: Test Article')
    expect(mockConsole.log).toHaveBeenCalledWith('Draft ID: 123')
  })

  it('should handle dry run', async () => {
    const mockContent = 'test content'
    const mockValidation = { isValid: true, errors: [] }

    vi.mocked(fs.readFileSync).mockReturnValue(mockContent)
    vi.mocked(validateMarkdown).mockReturnValue(mockValidation)
    vi.mocked(parseMarkdown).mockReturnValue({
      title: 'Test Article',
      content: 'Test content',
      tags: ['test']
    })

    await runCli([
      'draft',
      'test.md',
      '--token=test-token',
      '--publication-id=test-pub',
      '--dry-run'
    ])

    expect(publishToHashnode).not.toHaveBeenCalled()
    expect(mockConsole.log).toHaveBeenCalledWith('✅ Validation passed (dry run)')
    expect(mockProcess.exit).toHaveBeenCalledWith(0)
  })

  it('should require token and publication ID for publishing', async () => {
    const mockContent = 'test content'
    const mockValidation = { isValid: true, errors: [] }

    vi.mocked(fs.readFileSync).mockReturnValue(mockContent)
    vi.mocked(validateMarkdown).mockReturnValue(mockValidation)
    vi.mocked(parseMarkdown).mockReturnValue({
      title: 'Test Article',
      content: 'Test content',
      tags: ['test']
    })

    await runCli(['publish', 'test.md'])

    expect(mockConsole.error).toHaveBeenCalledWith(
      'Error: --token and --publication-id are required for publishing (or set TOKEN and PUBLICATION_ID env vars)'
    )
    expect(mockProcess.exit).toHaveBeenCalledWith(1)
  })
})
