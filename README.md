# Hashnode Publisher

[![test](https://github.com/actionsforge/actions-hashnode-publish/actions/workflows/test-action.yml/badge.svg)](https://github.com/actionsforge/actions-hashnode-publish/actions/workflows/test-action.yml)

[![ci](https://github.com/actionsforge/actions-hashnode-publish/actions/workflows/ci.yml/badge.svg)](https://github.com/actionsforge/actions-hashnode-publish/actions/workflows/ci.yml)

[![Build, Commit, Tag & Release](https://github.com/actionsforge/actions-hashnode-publish/actions/workflows/build-and-tag.yml/badge.svg)](https://github.com/actionsforge/actions-hashnode-publish/actions/workflows/build-and-tag.yml)

A GitHub Action and CLI tool to publish markdown articles to Hashnode from a GitHub repository using GraphQL API.

## Features

- Validate markdown files
- Create drafts or publish articles directly to Hashnode
- Support for tags and frontmatter
- GitHub Action integration
- CLI tool for local usage
- Prevents duplicate submissions with status tracking
- Recursive directory processing for batch publishing

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
# Validate a single markdown file
node dist/index.js validate blog/hello-world.md

# Validate all markdown files in a folder (non-recursive)
node dist/index.js validate blog/

# Validate all markdown files in a folder recursively
node dist/index.js validate blog/ --recursive

# Validate and continue even if there are errors
node dist/index.js validate blog/ --continue-on-error

# Validate recursively and continue on error
node dist/index.js validate blog/ --recursive --continue-on-error

# Create a draft
node dist/index.js draft blog/hello-world.md --token YOUR_TOKEN --publication-id YOUR_PUB_ID

# Publish an article
node dist/index.js publish blog/hello-world.md --token YOUR_TOKEN --publication-id YOUR_PUB_ID

# Dry run (validate without publishing)
node dist/index.js draft blog/hello-world.md --token YOUR_TOKEN --publication-id YOUR_PUB_ID --dry-run
```

You can also set your Hashnode token and publication ID as environment variables:

```bash
export TOKEN=your_hashnode_token
export PUBLICATION_ID=your_publication_id
```

Then you can run the commands without specifying them:

```bash
node dist/index.js validate blog/hello-world.md
node dist/index.js validate blog/
node dist/index.js validate blog/ --continue-on-error
node dist/index.js draft blog/hello-world.md
node dist/index.js publish blog/hello-world.md
```

## GitHub Action Usage

> **Note:** The `command` input is now required for all modes (including validation). Set it to `validate`, `draft`, or `publish` as needed.

```yaml
name: Publish to Hashnode

on:
  push:
    branches: [ main ]
    paths:
      - 'blog/**/*.md'

jobs:
  validate:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
      - uses: actions-hashnode-publish@v1
        with:
          command: validate  # Required: validate, draft, or publish
          file_path: blog/
          recursive: true  # Process all markdown files in subdirectories
          continue_on_error: true  # Continue even if some files have validation errors

  publish:
    needs: validate
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
      - uses: actions-hashnode-publish@v1
        with:
          command: publish  # Required
          token: ${{ secrets.HASHNODE_TOKEN }}
          publication_id: ${{ secrets.HASHNODE_PUBLICATION_ID }}
          file_path: blog/hello-world.md  # Can be a single file or directory
          is_draft: false
          recursive: true  # Process all markdown files in subdirectories
```

### Inputs

| Name | Description | Required | Default |
|------|-------------|----------|---------|
| `command` | Command to run (`validate`, `draft`, `publish`) | Yes | - |
| `token` | Hashnode API token | Yes (for draft/publish) | - |
| `publication_id` | Hashnode publication ID | Yes (for draft/publish) | - |
| `file_path` | Path to the markdown file or directory to process | Yes | - |
| `is_draft` | Whether to create a draft or publish directly | No | false |
| `recursive` | Process all markdown files in subdirectories | No | false |
| `continue_on_error` | Continue even if validation fails (for batch/recursive) | No | false |

### Outputs

| Name | Description |
|------|-------------|
| `draft_id` | ID of the created draft |
| `article_id` | ID of the published article |
| `title` | Title of the published article |

### Validation Error Messages

- For single file validation, the action will fail with a generic message: `Validation failed`.
- For recursive/batch validation, errors for each file are logged, and the action will fail with `Validation failed for one or more files` unless `continue_on_error` is set to `true`.

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

This project is licensed under the MIT License. See the [LICENSE](LICENSE) file for details.
