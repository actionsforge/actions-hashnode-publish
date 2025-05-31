import { describe, it, expect, vi, beforeEach } from 'vitest'
import { Stats } from 'fs'

// ✅ Define spies inside the factory
vi.mock('@actions/core', () => {
  return {
    getInput: vi.fn(),
    setFailed: vi.fn(),
    setOutput: vi.fn(),
    info: vi.fn(),
    error: vi.fn()
  }
})

vi.mock('fs')
vi.mock('./validation')
vi.mock('./publish')

// ✅ Imports must come after all mocks
import * as core from '@actions/core'
import * as fs from 'fs'
import { validateMarkdown, parseMarkdown } from './validation'
import { publishToHashnode } from './publish'
import { runAction } from './index'

describe('GitHub Action', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('should successfully create a draft when is_draft is true and no IDs exist', async () => {
    const mockContent = 'test content'
    const mockValidation = { isValid: true, errors: [] }
    const mockMetadata = {
      title: 'Test Article',
      content: 'test content',
      tags: ['test'],
      articleId: undefined,
      draftId: undefined,
    }
    const mockPublishResponse = {
      draftId: 'draft-id-123',
      title: 'Test Article'
    }

    vi.mocked(core.getInput).mockImplementation((name: string) => {
      switch (name) {
        case 'command': return 'publish'
        case 'token': return 'test-token'
        case 'publication_id': return 'test-pub'
        case 'file_path': return 'test.md'
        case 'is_draft': return 'true' // Create draft
        default: return ''
      }
    })

    vi.mocked(fs.existsSync).mockReturnValue(true)
    vi.mocked(fs.statSync).mockReturnValue({ isFile: () => true, isDirectory: () => false } as Stats)
    vi.mocked(fs.readFileSync).mockReturnValue(mockContent)
    vi.mocked(validateMarkdown).mockReturnValue(mockValidation)
    vi.mocked(parseMarkdown).mockReturnValue(mockMetadata)
    vi.mocked(publishToHashnode).mockResolvedValue(mockPublishResponse)

    await runAction()

    expect(publishToHashnode).toHaveBeenCalledWith({
      token: 'test-token',
      publicationId: 'test-pub',
      title: 'Test Article',
      content: 'test content',
      tags: ['test'],
      isDraft: true,
      existingDraftId: undefined,
    })
    expect(core.setOutput).toHaveBeenCalledWith('draft_id', 'draft-id-123')
    expect(core.setOutput).toHaveBeenCalledWith('title', 'Test Article')
    expect(core.info).toHaveBeenCalledWith('Successfully created draft: Test Article')
    expect(core.setFailed).not.toHaveBeenCalled()
  })

  it('should successfully publish an article when is_draft is false and no IDs exist', async () => {
    const mockContent = 'test content'
    const mockValidation = { isValid: true, errors: [] }
    const mockMetadata = {
      title: 'Test Article',
      content: 'test content',
      tags: ['test'],
      articleId: undefined,
      draftId: undefined,
    }
    const mockPublishResponse = {
      articleId: 'article-id-456',
      title: 'Test Article'
    }

    vi.mocked(core.getInput).mockImplementation((name: string) => {
      switch (name) {
        case 'command': return 'publish'
        case 'token': return 'test-token'
        case 'publication_id': return 'test-pub'
        case 'file_path': return 'test.md'
        case 'is_draft': return 'false' // Publish directly
        default: return ''
      }
    })

    vi.mocked(fs.existsSync).mockReturnValue(true)
    vi.mocked(fs.statSync).mockReturnValue({ isFile: () => true, isDirectory: () => false } as Stats)
    vi.mocked(fs.readFileSync).mockReturnValue(mockContent)
    vi.mocked(validateMarkdown).mockReturnValue(mockValidation)
    vi.mocked(parseMarkdown).mockReturnValue(mockMetadata)
    vi.mocked(publishToHashnode).mockResolvedValue(mockPublishResponse)

    await runAction()

    expect(publishToHashnode).toHaveBeenCalledWith({
      token: 'test-token',
      publicationId: 'test-pub',
      title: 'Test Article',
      content: 'test content',
      tags: ['test'],
      isDraft: false,
      existingDraftId: undefined,
    })
    expect(core.setOutput).toHaveBeenCalledWith('article_id', 'article-id-456')
    expect(core.setOutput).toHaveBeenCalledWith('title', 'Test Article')
    expect(core.info).toHaveBeenCalledWith('Successfully published article: Test Article')
    expect(core.setFailed).not.toHaveBeenCalled()
  })

  it('should successfully publish a draft when is_draft is false and draftId exists', async () => {
    const mockContent = 'test content'
    const mockValidation = { isValid: true, errors: [] }
    const mockMetadata = {
      title: 'Test Article (Draft)',
      content: 'test content',
      tags: ['test'],
      articleId: undefined,
      draftId: 'draft-id-456',
    }
    const mockPublishResponse = {
      articleId: 'article-id-789',
      title: 'Test Article (Published)'
    }

    vi.mocked(core.getInput).mockImplementation((name: string) => {
      switch (name) {
        case 'command': return 'publish'
        case 'token': return 'test-token'
        case 'publication_id': return 'test-pub'
        case 'file_path': return 'test.md'
        case 'is_draft': return 'false' // Publish draft
        default: return ''
      }
    })

    vi.mocked(fs.existsSync).mockReturnValue(true)
    vi.mocked(fs.statSync).mockReturnValue({ isFile: () => true, isDirectory: () => false } as Stats)
    vi.mocked(fs.readFileSync).mockReturnValue(mockContent)
    vi.mocked(validateMarkdown).mockReturnValue(mockValidation)
    vi.mocked(parseMarkdown).mockReturnValue(mockMetadata)
    vi.mocked(publishToHashnode).mockResolvedValue(mockPublishResponse)

    await runAction()

    expect(publishToHashnode).toHaveBeenCalledWith({
      token: 'test-token',
      publicationId: 'test-pub',
      title: 'Test Article (Draft)',
      content: 'test content',
      tags: ['test'],
      isDraft: false,
      existingDraftId: 'draft-id-456', // Pass draftId to publish
    })
    expect(core.setOutput).toHaveBeenCalledWith('article_id', 'article-id-789')
    expect(core.setOutput).toHaveBeenCalledWith('title', 'Test Article (Published)')
    expect(core.info).toHaveBeenCalledWith('Successfully published article: Test Article (Published)')
    expect(core.setFailed).not.toHaveBeenCalled()
  })

  it('should prevent creating a draft if draftId exists', async () => {
    const mockContent = 'test content'
    const mockValidation = { isValid: true, errors: [] }
    const mockMetadata = {
      title: 'Test Article (Draft)',
      content: 'test content',
      tags: ['test'],
      articleId: undefined,
      draftId: 'draft-id-456',
    }

    vi.mocked(core.getInput).mockImplementation((name: string) => {
      switch (name) {
        case 'command': return 'publish'
        case 'token': return 'test-token'
        case 'publication_id': return 'test-pub'
        case 'file_path': return 'test.md'
        case 'is_draft': return 'true' // Try to create draft again
        default: return ''
      }
    })

    vi.mocked(fs.existsSync).mockReturnValue(true)
    vi.mocked(fs.statSync).mockReturnValue({ isFile: () => true, isDirectory: () => false } as Stats)
    vi.mocked(fs.readFileSync).mockReturnValue(mockContent)
    vi.mocked(validateMarkdown).mockReturnValue(mockValidation)
    vi.mocked(parseMarkdown).mockReturnValue(mockMetadata)
    // publishToHashnode should NOT be called

    await runAction()

    expect(publishToHashnode).not.toHaveBeenCalled()
    expect(core.info).toHaveBeenCalledWith('Article is already a draft with ID: draft-id-456')
    expect(core.setFailed).not.toHaveBeenCalled()
  })

  it('should prevent any action if articleId exists', async () => {
    const mockContent = 'test content'
    const mockValidation = { isValid: true, errors: [] }
    const mockMetadata = {
      title: 'Test Article (Published)',
      content: 'test content',
      tags: ['test'],
      articleId: 'article-id-123',
      draftId: undefined,
    }

    vi.mocked(core.getInput).mockImplementation((name: string) => {
      switch (name) {
        case 'command': return 'publish'
        case 'token': return 'test-token'
        case 'publication_id': return 'test-pub'
        case 'file_path': return 'test.md'
        case 'is_draft': return 'true' // Try to create draft
        default: return ''
      }
    })

    vi.mocked(fs.existsSync).mockReturnValue(true)
    vi.mocked(fs.statSync).mockReturnValue({ isFile: () => true, isDirectory: () => false } as Stats)
    vi.mocked(fs.readFileSync).mockReturnValue(mockContent)
    vi.mocked(validateMarkdown).mockReturnValue(mockValidation)
    vi.mocked(parseMarkdown).mockReturnValue(mockMetadata)
    // publishToHashnode should NOT be called

    await runAction()

    expect(publishToHashnode).not.toHaveBeenCalled()
    expect(core.info).toHaveBeenCalledWith('Article is already published with ID: article-id-123')
    expect(core.setFailed).not.toHaveBeenCalled()
  })

  it('should fail on validation errors', async () => {
    const mockContent = 'test content'
    const mockValidation = {
      isValid: false,
      errors: ['Error 1', 'Error 2']
    }

    vi.mocked(core.getInput).mockImplementation((name: string) => {
      switch (name) {
        case 'command': return 'validate'
        case 'token': return 'test-token'
        case 'publication_id': return 'test-pub'
        case 'file_path': return 'test.md'
        default: return ''
      }
    })

    vi.mocked(fs.existsSync).mockReturnValue(true)
    vi.mocked(fs.statSync).mockReturnValue({ isFile: () => true, isDirectory: () => false } as Stats)
    vi.mocked(fs.readFileSync).mockReturnValue(mockContent)
    vi.mocked(validateMarkdown).mockReturnValue(mockValidation)

    await runAction()

    expect(core.setFailed).toHaveBeenCalledWith('Validation failed')
    expect(publishToHashnode).not.toHaveBeenCalled()
  })

  it('should handle API errors', async () => {
    const mockContent = 'test content'
    const mockValidation = { isValid: true, errors: [] }
    const mockMetadata = {
      title: 'Test Article',
      content: 'test content',
      tags: ['test'],
      articleId: undefined,
      draftId: undefined,
    }

    vi.mocked(core.getInput).mockImplementation((name: string) => {
      switch (name) {
        case 'command': return 'publish'
        case 'token': return 'test-token'
        case 'publication_id': return 'test-pub'
        case 'file_path': return 'test.md'
        case 'is_draft': return 'false'
        default: return ''
      }
    })

    vi.mocked(fs.existsSync).mockReturnValue(true)
    vi.mocked(fs.statSync).mockReturnValue({ isFile: () => true, isDirectory: () => false } as Stats)
    vi.mocked(fs.readFileSync).mockReturnValue(mockContent)
    vi.mocked(validateMarkdown).mockReturnValue(mockValidation)
    vi.mocked(parseMarkdown).mockReturnValue(mockMetadata)
    vi.mocked(publishToHashnode).mockRejectedValue(new Error('API Error'))

    await runAction()

    expect(core.setFailed).toHaveBeenCalledWith('Error processing test.md: API Error')
  })

  it('should fail if file does not exist', async () => {
    vi.mocked(core.getInput).mockImplementation((name: string) => {
      switch (name) {
        case 'command': return 'publish'
        case 'token': return 'test-token'
        case 'publication_id': return 'test-pub'
        case 'file_path': return 'test.md'
        default: return ''
      }
    })

    vi.mocked(fs.existsSync).mockReturnValue(false)

    await runAction()

    expect(core.setFailed).toHaveBeenCalledWith('Path does not exist: test.md')
    expect(publishToHashnode).not.toHaveBeenCalled()
  })

  it('should fail if path is a directory but recursive is not enabled', async () => {
    vi.mocked(core.getInput).mockImplementation((name: string) => {
      switch (name) {
        case 'command': return 'publish'
        case 'token': return 'test-token'
        case 'publication_id': return 'test-pub'
        case 'file_path': return 'test-dir'
        case 'recursive': return 'false'
        default: return ''
      }
    })

    vi.mocked(fs.existsSync).mockReturnValue(true)
    vi.mocked(fs.statSync).mockReturnValue({ isFile: () => false, isDirectory: () => true } as Stats)

    await runAction()

    expect(core.setFailed).toHaveBeenCalledWith('Path is a directory but recursive mode is not enabled: test-dir')
    expect(publishToHashnode).not.toHaveBeenCalled()
  })

  it('should process multiple files in a directory when recursive is enabled', async () => {
    const mockContent = 'test content'
    const mockValidation = { isValid: true, errors: [] }
    const mockMetadata = {
      title: 'Test Article',
      content: 'test content',
      tags: ['test'],
      articleId: undefined,
      draftId: undefined,
    }
    const mockPublishResponse = {
      articleId: 'article-id-123',
      title: 'Test Article'
    }

    vi.mocked(core.getInput).mockImplementation((name: string) => {
      switch (name) {
        case 'command': return 'publish'
        case 'token': return 'test-token'
        case 'publication_id': return 'test-pub'
        case 'file_path': return 'test-dir'
        case 'recursive': return 'true'
        case 'is_draft': return 'false'
        default: return ''
      }
    })

    vi.mocked(fs.existsSync).mockReturnValue(true)
    vi.mocked(fs.statSync).mockImplementation((path) => {
      if (path === 'test-dir') {
        return { isFile: () => false, isDirectory: () => true } as Stats
      }
      if (path === 'test-dir/file1.md' || path === 'test-dir/file2.md') {
        return { isFile: () => true, isDirectory: () => false } as Stats
      }
      return { isFile: () => true, isDirectory: () => false } as Stats
    })
    vi.mocked(fs.readdirSync).mockReturnValue(['file1.md', 'file2.md'] as unknown as fs.Dirent<Buffer>[])
    vi.mocked(fs.readFileSync).mockReturnValue(mockContent)
    vi.mocked(validateMarkdown).mockReturnValue(mockValidation)
    vi.mocked(parseMarkdown).mockReturnValue(mockMetadata)
    vi.mocked(publishToHashnode).mockResolvedValue(mockPublishResponse)

    await runAction()

    expect(core.info).toHaveBeenCalledWith('Found 2 markdown files to process')
    expect(publishToHashnode).toHaveBeenCalledTimes(2)
  })
})
