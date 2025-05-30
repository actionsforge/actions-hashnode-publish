import { ArticleMetadata } from './validation'

interface PublishOptions extends ArticleMetadata {
  token: string
  publicationId: string
  isDraft: boolean
  existingDraftId?: string
}

interface PublishResponse {
  articleId?: string
  draftId?: string
  title: string
}

interface TagInput {
  name: string
  slug: string
}

interface Draft {
  id: string
  title: string
}

interface Article {
  id: string
  title: string
  slug: string
}

interface PublicationArticleResponse {
  publication: {
    post: Article | null;
  }
}

interface PublicationDraftsResponse {
  publication: {
    drafts: Draft[];
  }
}

interface CreateDraftResponse {
  createDraft: {
    draft: Draft;
  }
}

interface PublishPostResponse {
  publishPost: {
    post: Article;
  }
}

interface PublishDraftResponse {
  publishDraft: {
    post: Article;
  }
}

function createTagInput(tag: string): TagInput {
  // Convert tag to slug format (lowercase, replace spaces with hyphens)
  const slug = tag.toLowerCase().replace(/[^a-z0-9\s-]/g, '').replace(/\s+/g, '-')
  return {
    name: tag,
    slug
  }
}

const CREATE_DRAFT_MUTATION = `
  mutation CreateDraft($input: CreateDraftInput!) {
    createDraft(input: $input) {
      draft {
        id
        title
      }
    }
  }
`

const PUBLISH_POST_MUTATION = `
  mutation PublishPost($input: PublishPostInput!) {
    publishPost(input: $input) {
      post {
        id
        title
      }
    }
  }
`

// Update mutation for publishing an existing draft to take an input object
const PUBLISH_DRAFT_MUTATION = `
  mutation PublishDraft($input: PublishDraftInput!) {
    publishDraft(input: $input) {
      post {
        id
        title
      }
    }
  }
`

// Using 'any' here due to varied API response structures - trying to refine this.
async function makeHashnodeRequest(
  token: string,
  query: string,
  variables: object
): Promise<PublicationArticleResponse | PublicationDraftsResponse | CreateDraftResponse | PublishPostResponse | PublishDraftResponse> {
  const response = await fetch('https://gql.hashnode.com', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': token
    },
    body: JSON.stringify({
      query,
      variables
    })
  })

  const result = await response.json()

  if (result.errors) {
    throw new Error(`Hashnode API error: ${JSON.stringify(result.errors)}`)
  }

  return result.data
}

export async function publishToHashnode(options: PublishOptions): Promise<PublishResponse> {
  const { token, publicationId, title, content, tags = [], isDraft, existingDraftId } = options

  let mutation;
  let mutationVariables;
  let result;

  if (existingDraftId) {
    // Publish an existing draft
    mutation = PUBLISH_DRAFT_MUTATION;
    // Pass draftId within the input object
    mutationVariables = { input: { draftId: existingDraftId } };
    result = await makeHashnodeRequest(token, mutation, mutationVariables) as PublishDraftResponse;
    // Assuming publishDraft returns the published article details
    return {
      articleId: result.publishDraft.post.id,
      title: result.publishDraft.post.title
    };
  } else if (isDraft) {
    // Create a new draft
    mutation = CREATE_DRAFT_MUTATION;
    mutationVariables = {
      input: {
        title,
        contentMarkdown: content,
        publicationId,
        tags: tags.map(createTagInput)
      }
    };
    result = await makeHashnodeRequest(token, mutation, mutationVariables) as CreateDraftResponse;
    return {
      draftId: result.createDraft.draft.id,
      title: result.createDraft.draft.title
    };
  } else {
     // Create a new post (if no existing draft ID is provided)
     mutation = PUBLISH_POST_MUTATION;
     mutationVariables = {
       input: {
         title,
         contentMarkdown: content,
         publicationId,
         tags: tags.map(createTagInput)
       }
     };
     result = await makeHashnodeRequest(token, mutation, mutationVariables) as PublishPostResponse;
     return {
       articleId: result.publishPost.post.id,
       title: result.publishPost.post.title
     };
  }
}
