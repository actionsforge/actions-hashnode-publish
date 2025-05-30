import { describe, it, expect, vi, beforeEach, afterAll } from 'vitest'
import * as fs from 'fs'
import { publishToHashnode } from './publish'
import { runCli } from './index'
import { validateMarkdown, parseMarkdown } from './validation'

// Mock dependencies
vi.mock('fs')
vi.mock('./validation')
vi.mock('./publish')

// Mock console and process
const mockConsole = {
  log: vi.fn(),
  error: vi.fn(),
  info: vi.fn()
}
const mockProcess = {
  exit: vi.fn()
}

vi.stubGlobal('console', mockConsole)
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

    vi.mocked(fs.statSync).mockReturnValue({ isFile: () => true, isDirectory: () => false } as fs.Stats)
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

    vi.mocked(fs.statSync).mockReturnValue({ isFile: () => true, isDirectory: () => false } as fs.Stats)
    vi.mocked(fs.readFileSync).mockReturnValue(mockContent)
    vi.mocked(validateMarkdown).mockReturnValue(mockValidation)

    await runCli(['validate', 'test.md'])

    expect(mockConsole.error).toHaveBeenCalledWith('❌ Validation errors:')
    expect(mockConsole.error).toHaveBeenCalledWith('  - Error 1')
    expect(mockConsole.error).toHaveBeenCalledWith('  - Error 2')
    expect(mockProcess.exit).toHaveBeenCalledWith(1)
  })

  it('should validate markdown files in directory', async () => {
    const mockContent = 'test content'
    const mockValidation = { isValid: true, errors: [] }

    vi.mocked(fs.statSync).mockReturnValue({ isFile: () => false, isDirectory: () => true } as fs.Stats)
    vi.mocked(fs.readdirSync).mockReturnValue(['file1.md', 'file2.md'] as unknown as fs.Dirent<Buffer>[])
    vi.mocked(fs.readFileSync).mockReturnValue(mockContent)
    vi.mocked(validateMarkdown).mockReturnValue(mockValidation)
    vi.mocked(fs.existsSync).mockReturnValue(true)

    // Create a temporary directory with test files
    const testDir = 'test-dir'
    vi.mocked(fs.statSync).mockImplementation((path: fs.PathLike) => {
      if (path === testDir) {
        return { isFile: () => false, isDirectory: () => true } as fs.Stats
      }
      return { isFile: () => true, isDirectory: () => false } as fs.Stats
    })

    await runCli(['validate', testDir])

    expect(mockConsole.log).toHaveBeenCalledWith('Found 2 markdown files to validate')
    expect(mockConsole.log).toHaveBeenCalledWith('✅ test-dir/file1.md is valid')
    expect(mockConsole.log).toHaveBeenCalledWith('✅ test-dir/file2.md is valid')
  })

  it('should show validation errors for files in directory', async () => {
    const mockContent = 'test content'
    const mockValidation = {
      isValid: false,
      errors: ['Error 1']
    }

    vi.mocked(fs.statSync).mockReturnValue({ isFile: () => false, isDirectory: () => true } as fs.Stats)
    vi.mocked(fs.readdirSync).mockReturnValue(['file1.md'] as unknown as fs.Dirent<Buffer>[])
    vi.mocked(fs.readFileSync).mockReturnValue(mockContent)
    vi.mocked(validateMarkdown).mockReturnValue(mockValidation)
    vi.mocked(fs.existsSync).mockReturnValue(true)

    // Create a temporary directory with test files
    const testDir = 'test-dir'
    vi.mocked(fs.statSync).mockImplementation((path: fs.PathLike) => {
      if (path === testDir) {
        return { isFile: () => false, isDirectory: () => true } as fs.Stats
      }
      return { isFile: () => true, isDirectory: () => false } as fs.Stats
    })

    await runCli(['validate', testDir])

    expect(mockConsole.log).toHaveBeenCalledWith('Found 1 markdown files to validate')
    expect(mockConsole.error).toHaveBeenCalledWith('❌ Validation errors in test-dir/file1.md:')
    expect(mockConsole.error).toHaveBeenCalledWith('  - Error 1')
    expect(mockProcess.exit).toHaveBeenCalledWith(1)
  })

  it('should validate only top-level markdown files in directory by default (non-recursive)', async () => {
    const mockContent = 'test content'
    const mockValidation = { isValid: true, errors: [] }
    const testDir = 'test-dir'
    // Only top-level files
    vi.mocked(fs.statSync).mockImplementation((path: fs.PathLike) => {
      if (path === testDir) return { isFile: () => false, isDirectory: () => true } as fs.Stats
      if (path === 'test-dir/file1.md' || path === 'test-dir/file2.md') return { isFile: () => true, isDirectory: () => false } as fs.Stats
      // subdir
      if (path === 'test-dir/subdir') return { isFile: () => false, isDirectory: () => true } as fs.Stats
      if (path === 'test-dir/subdir/file3.md') return { isFile: () => true, isDirectory: () => false } as fs.Stats
      return { isFile: () => false, isDirectory: () => false } as fs.Stats
    })
    vi.mocked(fs.readdirSync).mockImplementation((dir: fs.PathLike) => {
      if (dir === testDir) return ['file1.md', 'file2.md', 'subdir'] as unknown as fs.Dirent<Buffer>[]
      if (dir === 'test-dir/subdir') return ['file3.md'] as unknown as fs.Dirent<Buffer>[]
      return [] as unknown as fs.Dirent<Buffer>[]
    })
    vi.mocked(fs.readFileSync).mockReturnValue(mockContent)
    vi.mocked(validateMarkdown).mockReturnValue(mockValidation)
    vi.mocked(fs.existsSync).mockReturnValue(true)

    await runCli(['validate', testDir])

    expect(mockConsole.log).toHaveBeenCalledWith('Found 2 markdown files to validate')
    expect(mockConsole.log).toHaveBeenCalledWith('✅ test-dir/file1.md is valid')
    expect(mockConsole.log).toHaveBeenCalledWith('✅ test-dir/file2.md is valid')
    expect(mockConsole.log).not.toHaveBeenCalledWith('✅ test-dir/subdir/file3.md is valid')
  })

  it('should validate all markdown files recursively with --recursive', async () => {
    const mockContent = 'test content'
    const mockValidation = { isValid: true, errors: [] }
    const testDir = 'test-dir'
    vi.mocked(fs.statSync).mockImplementation((path: fs.PathLike) => {
      if (path === testDir) return { isFile: () => false, isDirectory: () => true } as fs.Stats
      if (path === 'test-dir/file1.md' || path === 'test-dir/file2.md') return { isFile: () => true, isDirectory: () => false } as fs.Stats
      if (path === 'test-dir/subdir') return { isFile: () => false, isDirectory: () => true } as fs.Stats
      if (path === 'test-dir/subdir/file3.md') return { isFile: () => true, isDirectory: () => false } as fs.Stats
      return { isFile: () => false, isDirectory: () => false } as fs.Stats
    })
    vi.mocked(fs.readdirSync).mockImplementation((dir: fs.PathLike) => {
      if (dir === testDir) return ['file1.md', 'file2.md', 'subdir'] as unknown as fs.Dirent<Buffer>[]
      if (dir === 'test-dir/subdir') return ['file3.md'] as unknown as fs.Dirent<Buffer>[]
      return [] as unknown as fs.Dirent<Buffer>[]
    })
    vi.mocked(fs.readFileSync).mockReturnValue(mockContent)
    vi.mocked(validateMarkdown).mockReturnValue(mockValidation)
    vi.mocked(fs.existsSync).mockReturnValue(true)

    await runCli(['validate', testDir, '--recursive'])

    expect(mockConsole.log).toHaveBeenCalledWith('Found 3 markdown files to validate')
    expect(mockConsole.log).toHaveBeenCalledWith('✅ test-dir/file1.md is valid')
    expect(mockConsole.log).toHaveBeenCalledWith('✅ test-dir/file2.md is valid')
    expect(mockConsole.log).toHaveBeenCalledWith('✅ test-dir/subdir/file3.md is valid')
  })

  it('should create draft with valid input', async () => {
    const mockContent = 'test content'
    const mockValidation = { isValid: true, errors: [] }
    const mockPublishResponse = {
      draftId: '123',
      title: 'Test Article'
    }

    vi.mocked(fs.statSync).mockReturnValue({ isFile: () => true, isDirectory: () => false } as fs.Stats)
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

    vi.mocked(fs.statSync).mockReturnValue({ isFile: () => true, isDirectory: () => false } as fs.Stats)
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

    vi.mocked(fs.statSync).mockReturnValue({ isFile: () => true, isDirectory: () => false } as fs.Stats)
    vi.mocked(fs.readFileSync).mockReturnValue(mockContent)
    vi.mocked(validateMarkdown).mockReturnValue(mockValidation)
    vi.mocked(parseMarkdown).mockReturnValue({
      title: 'Test Article',
      content: 'Test content',
      tags: ['test']
    })
    vi.mocked(fs.existsSync).mockReturnValue(true)

    // Mock process.env
    const originalEnv = process.env
    process.env = {}
    vi.stubGlobal('process', { ...mockProcess, env: {} })

    await runCli(['publish', 'test.md'])

    // Restore process.env
    process.env = originalEnv

    expect(mockConsole.error).toHaveBeenCalledWith(
      'Error: --token and --publication-id are required for publishing (or set TOKEN and PUBLICATION_ID env vars)'
    )
    expect(mockProcess.exit).toHaveBeenCalledWith(1)
  })

  it('should continue on validation errors with --continue-on-error flag', async () => {
    const mockContent = 'test content'
    const mockValidation = {
      isValid: false,
      errors: ['Error 1']
    }

    vi.mocked(fs.statSync).mockReturnValue({ isFile: () => true, isDirectory: () => false } as fs.Stats)
    vi.mocked(fs.readFileSync).mockReturnValue(mockContent)
    vi.mocked(validateMarkdown).mockReturnValue(mockValidation)
    vi.mocked(fs.existsSync).mockReturnValue(true)

    await runCli(['validate', 'test.md', '--continue-on-error'])

    expect(mockConsole.error).toHaveBeenCalledWith('❌ Validation errors:')
    expect(mockConsole.error).toHaveBeenCalledWith('  - Error 1')
    expect(mockProcess.exit).toHaveBeenCalledWith(0)
  })
})
