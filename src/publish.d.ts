import { ArticleMetadata } from './validation'

export interface PublishOptions extends ArticleMetadata {
  token: string
  publicationId: string
  isDraft: boolean
}

export interface PublishResponse {
  draftId: string
  title: string
}

export function publishToHashnode(options: PublishOptions): Promise<PublishResponse>
