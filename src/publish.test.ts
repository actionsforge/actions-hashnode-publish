import { describe, it, expect, vi, beforeEach } from 'vitest'
import { publishToHashnode } from './publish'

// Mock fetch
const mockFetch = vi.fn()
vi.stubGlobal('fetch', mockFetch)

describe('publishToHashnode', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('should publish an article successfully (from unpublished)', async () => {
    const mockResponse = {
      data: {
        publishPost: {
          post: {
            id: 'article-id-123',
            title: 'Test Article'
          }
        }
      }
    }

    mockFetch.mockResolvedValueOnce({
      ok: true,
      json: async () => mockResponse
    })

    const result = await publishToHashnode({
      token: 'test-token',
      publicationId: 'test-pub',
      title: 'Test Article',
      content: 'Test content',
      tags: ['test'],
      isDraft: false // Direct publish
    })

    const expectedQuery = `\n  mutation PublishPost($input: PublishPostInput!) {\n    publishPost(input: $input) {\n      post {\n        id\n        title\n      }\n    }\n  }\n`

    expect(mockFetch).toHaveBeenCalledWith(
      'https://gql.hashnode.com',
      {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': 'test-token'
        },
        body: JSON.stringify({
          query: expectedQuery,
          variables: {
            input: {
              title: 'Test Article',
              contentMarkdown: 'Test content',
              publicationId: 'test-pub',
              tags: [{ name: 'test', slug: 'test' }]
            }
          }
        })
      }
    )

    expect(result).toEqual({
      articleId: 'article-id-123',
      title: 'Test Article'
    })
  })

  it('should create a draft successfully', async () => {
    const mockResponse = {
      data: {
        createDraft: {
          draft: {
            id: 'draft-id-456',
            title: 'Test Article'
          }
        }
      }
    }

    mockFetch.mockResolvedValueOnce({
      ok: true,
      json: async () => mockResponse
    })

    const result = await publishToHashnode({
      token: 'test-token',
      publicationId: 'test-pub',
      title: 'Test Article',
      content: 'Test content',
      tags: ['test'],
      isDraft: true
    })

    const expectedQuery = `\n  mutation CreateDraft($input: CreateDraftInput!) {\n    createDraft(input: $input) {\n      draft {\n        id\n        title\n      }\n    }\n  }\n`

    expect(mockFetch).toHaveBeenCalledWith(
      'https://gql.hashnode.com',
      {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': 'test-token'
        },
        body: JSON.stringify({
          query: expectedQuery,
          variables: {
            input: {
              title: 'Test Article',
              contentMarkdown: 'Test content',
              publicationId: 'test-pub',
              tags: [{ name: 'test', slug: 'test' }]
            }
          }
        })
      }
    )

    expect(result).toEqual({
      draftId: 'draft-id-456',
      title: 'Test Article'
    })
  })

  it('should publish an existing draft successfully', async () => {
    const mockResponse = {
      data: {
        publishDraft: {
          post: {
            id: 'article-id-789',
            title: 'Test Article (Published)'
          }
        }
      }
    }

    mockFetch.mockResolvedValueOnce({
      ok: true,
      json: async () => mockResponse
    })

    const result = await publishToHashnode({
      token: 'test-token',
      publicationId: 'test-pub',
      title: 'Test Article (Draft)', // Title might change upon publishing
      content: 'Test content',
      tags: ['test'],
      isDraft: false, // Indicate publishing
      existingDraftId: 'draft-id-456' // Provide existing draft ID
    })

    const expectedQuery = `\n  mutation PublishDraft($input: PublishDraftInput!) {\n    publishDraft(input: $input) {\n      post {\n        id\n        title\n      }\n    }\n  }\n`

    expect(mockFetch).toHaveBeenCalledWith(
      'https://gql.hashnode.com',
      {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': 'test-token'
        },
        body: JSON.stringify({
          query: expectedQuery,
          variables: {
            input: {
              draftId: 'draft-id-456'
            }
          }
        })
      }
    )

    expect(result).toEqual({
      articleId: 'article-id-789',
      title: 'Test Article (Published)'
    })
  })

  it('should handle API errors', async () => {
    const mockError = {
      errors: [{ message: 'Bad Request' }]
    }

    mockFetch.mockResolvedValueOnce({
      ok: true,
      json: async () => mockError
    })

    await expect(publishToHashnode({
      token: 'test-token',
      publicationId: 'test-pub',
      title: 'Test Article',
      content: 'Test content',
      tags: ['test'],
      isDraft: false
    })).rejects.toThrow('Hashnode API error: [{"message":"Bad Request"}]')
  })
})
