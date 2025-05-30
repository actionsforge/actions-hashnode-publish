# Hashnode Publisher

A GitHub Action and CLI tool to publish markdown articles to Hashnode from a GitHub repository using GraphQL API.

## Features

- Validate markdown files
- Create drafts or publish articles directly to Hashnode
- Support for tags and frontmatter
- GitHub Action integration
- CLI tool for local usage
- Prevents duplicate submissions with status tracking

## Markdown Format

Your markdown files should include frontmatter with the following format:

```markdown
---
title: "Your Article Title"
tags: ["tag1", "tag2", "tag3"]
articleId: "123"      # Optional: ID of an existing article
draftId: "456"        # Optional: ID of an existing draft
---

Your article content here...
```

### Frontmatter Fields

| Field | Description | Required |
|-------|-------------|----------|
| `title` | Article title (max 100 chars) | Yes |
| `tags` | Array of tags (max 5, each max 20 chars) | Yes |
| `articleId` | ID of an existing article (for updates) | No |
| `draftId` | ID of an existing draft (for updates) | No |

The `articleId` and `draftId` fields are used to update existing articles or drafts:

- Use `articleId` when updating a published article
- Use `draftId` when updating an existing draft
- These fields are automatically populated when you create drafts or publish articles

## CLI Usage

The tool can be used as a CLI tool by running `node dist/index.js` with the following commands:

```bash
# Validate a markdown file
node dist/index.js validate blog.md

# Create a draft
node dist/index.js draft blog.md --token YOUR_TOKEN --publication-id YOUR_PUB_ID

# Publish an article
node dist/index.js publish blog.md --token YOUR_TOKEN --publication-id YOUR_PUB_ID

# Dry run (validate without publishing)
node dist/index.js draft blog.md --token YOUR_TOKEN --publication-id YOUR_PUB_ID --dry-run
```

You can also set your Hashnode token and publication ID as environment variables:

```bash
export TOKEN=your_hashnode_token
export PUBLICATION_ID=your_publication_id
```

Then you can run the commands without specifying them:

```bash
node dist/index.js validate blog.md
node dist/index.js draft blog.md
node dist/index.js publish blog.md
```

## GitHub Action Usage

```yaml
name: Publish to Hashnode

on:
  push:
    branches: [ main ]
    paths:
      - 'blog/**/*.md'

jobs:
  publish:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
      - uses: actions-hashnode-publish@v1
        with:
          token: ${{ secrets.HASHNODE_TOKEN }}
          publication_id: ${{ secrets.HASHNODE_PUBLICATION_ID }}
          file_path: blog/my-article.md
          is_draft: false
```

### Inputs

| Name | Description | Required |
|------|-------------|----------|
| `token` | Hashnode API token | Yes |
| `publication_id` | Hashnode publication ID | Yes |
| `file_path` | Path to the markdown file to publish | Yes |
| `is_draft` | Whether to create a draft or publish directly (default: false) | No |

### Outputs

| Name | Description |
|------|-------------|
| `draft_id` | ID of the created draft |
| `title` | Title of the published article |

## Development

```bash
# Install dependencies
npm install

# Run tests
npm test

# Build
npm run build
```

## License

MIT
