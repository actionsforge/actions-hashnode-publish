import * as core from '@actions/core'
import * as fs from 'fs'
import matter from 'gray-matter'
import { validateMarkdown, parseMarkdown } from './validation'
import { publishToHashnode } from './publish'

export async function runAction(): Promise<void> {
  try {
    // Get inputs
    const token = core.getInput('token', { required: true })
    const publicationId = core.getInput('publication_id', { required: true })
    const filePath = core.getInput('file_path', { required: true })
    const isDraftInput = core.getInput('is_draft') === 'true'

    // Read and parse markdown file
    const fileContent = fs.readFileSync(filePath, 'utf8')
    const metadata = parseMarkdown(fileContent)

    // Validate markdown
    const validationResult = validateMarkdown(fileContent)
    if (!validationResult.isValid) {
      core.setFailed(`Validation failed:\n${validationResult.errors.join('\n')}`)
      return
    }

    // Determine action based on existing IDs and input
    let shouldCreateDraft = false;
    let shouldPublish = false;
    let existingDraftId = metadata.draftId;

    if (metadata.articleId) {
      // Already published
      core.info(`Article is already published with ID: ${metadata.articleId}`)
      return;
    } else if (metadata.draftId) {
      // Existing draft
      if (isDraftInput) {
         core.info(`Article is already a draft with ID: ${metadata.draftId}`)
         return;
      } else {
         shouldPublish = true;
         existingDraftId = metadata.draftId; // Use existing draft ID to publish
      }
    } else {
      // Unpublished
      if (isDraftInput) {
        shouldCreateDraft = true;
      } else {
        shouldPublish = true;
      }
    }

    let response;
    if (shouldCreateDraft || shouldPublish) {
      try {
        // When publishing a draft, we don't need to pass the draftId in metadata
        const publishMetadata = shouldPublish && existingDraftId
          ? { ...metadata, draftId: undefined }
          : metadata;

        response = await publishToHashnode({
          token,
          publicationId,
          ...publishMetadata,
          isDraft: shouldCreateDraft,
          existingDraftId
        })
      } catch (error) {
        core.setFailed(error instanceof Error ? error.message : 'API Error')
        return
      }
    }

    // Update the markdown file with the new ID
    const newFrontmatter = { ...matter(fileContent).data }
    if (shouldCreateDraft && response?.draftId) {
      newFrontmatter.draftId = response.draftId
      core.setOutput('draft_id', response.draftId)
      core.setOutput('title', response.title)
      core.info(`Successfully created draft: ${response.title}`)
    } else if (shouldPublish && response?.articleId) {
      newFrontmatter.articleId = response.articleId
      delete newFrontmatter.draftId
      core.setOutput('article_id', response.articleId)
      core.setOutput('title', response.title)
      core.info(`Successfully published article: ${response.title}`)
    }

    const newContent = matter.stringify(fileContent, newFrontmatter);
    fs.writeFileSync(filePath, newContent);

  } catch (error) {
    core.setFailed(error instanceof Error ? error.message : 'Unknown error')
  }
}

export async function runCli(args: string[] = process.argv.slice(2)): Promise<void> {
  const command = args[0]

  if (!command || command === '--help' || command === '-h') {
    // eslint-disable-next-line no-console
    console.log(`\nHashnode Publisher CLI\n\nUsage:\n  hashnode-publish <command> [options]\n\nCommands:\n  validate <file>    Validate a markdown file\n  draft <file>       Create a draft on Hashnode\n  publish <file>     Publish an article to Hashnode\n\nOptions:\n  --token <token>           Hashnode API token (or use TOKEN env var)\n  --publication-id <id>     Hashnode publication ID (or use PUBLICATION_ID env var)\n  --dry-run                 Validate without publishing\n  --help, -h               Show this help message\n\nExamples:\n  hashnode-publish validate blog.md\n  hashnode-publish draft blog.md --token YOUR_TOKEN --publication-id YOUR_PUB_ID\n  hashnode-publish publish blog.md --token YOUR_TOKEN --publication-id YOUR_PUB_ID\n  hashnode-publish draft blog.md --token YOUR_TOKEN --publication-id YOUR_PUB_ID --dry-run\n    `)
    process.exit(0)
  }

  const filePath = args[1]
  if (!filePath) {
    // eslint-disable-next-line no-console
    console.error('Error: File path is required')
    process.exit(1)
  }

  try {
    const fileContent = fs.readFileSync(filePath, 'utf8')
    const isDryRun = args.includes('--dry-run')
    const metadata = parseMarkdown(fileContent);

    if (command === 'validate') {
      const result = validateMarkdown(fileContent)
      if (result.isValid) {
        // eslint-disable-next-line no-console
        console.log('✅ Markdown file is valid')
      } else {
        // eslint-disable-next-line no-console
        console.error('❌ Validation errors:')
        result.errors.forEach(error => {
          // eslint-disable-next-line no-console
          console.error(`  - ${error}`)
        })
        process.exit(1)
      }
    } else if (command === 'draft' || command === 'publish') {
      const token = args.find(arg => arg.startsWith('--token='))?.split('=')[1] || process.env.TOKEN
      const publicationId = args.find(arg => arg.startsWith('--publication-id='))?.split('=')[1] || process.env.PUBLICATION_ID

      if (!token || !publicationId) {
        // eslint-disable-next-line no-console
        console.error('Error: --token and --publication-id are required for publishing (or set TOKEN and PUBLICATION_ID env vars)')
        process.exit(1)
      }

      // Validate markdown again before attempting API calls
      const validationResult = validateMarkdown(fileContent)
      if (!validationResult.isValid) {
        // eslint-disable-next-line no-console
        console.error('❌ Validation errors:')
        validationResult.errors.forEach(error => {
          // eslint-disable-next-line no-console
          console.error(`  - ${error}`)
        })
        process.exit(1)
      }

      if (isDryRun) {
        // eslint-disable-next-line no-console
        console.log('✅ Validation passed (dry run)')
        process.exit(0)
        return
      }

      // Determine action based on existing IDs and command
      let shouldCreateDraft = false;
      let shouldPublish = false;
      let existingDraftId = metadata.draftId;

      if (metadata.articleId) {
        // Already published
        // eslint-disable-next-line no-console
        console.info('ℹ️ Article is already published. Cannot create a new draft or publish again.');
        process.exit(1);
      } else if (metadata.draftId) {
        // Existing draft
        if (command === 'draft') {
           // eslint-disable-next-line no-console
           console.info(`ℹ️ Article is already a draft with ID ${metadata.draftId}. Use publish command to publish it.`);
           process.exit(1);
        } else {
           shouldPublish = true;
           existingDraftId = metadata.draftId; // Use existing draft ID to publish
        }
      } else {
        // Unpublished
        if (command === 'publish') {
          shouldPublish = true;
        } else {
          shouldCreateDraft = true;
        }
      }

      let response;
      if (shouldCreateDraft || shouldPublish) {
        try {
          response = await publishToHashnode({
            token,
            publicationId,
            ...metadata,
            isDraft: shouldCreateDraft, // Pass true for draft creation
            existingDraftId: existingDraftId // Pass draft ID for publishing existing draft
          });
        } catch (error) {
          // eslint-disable-next-line no-console
          console.error('Error:', error instanceof Error ? error.message : 'Unknown API error');
          process.exit(1);
        }
      }

      // Update the markdown file with the new ID
      const newFrontmatter = { ...matter(fileContent).data };
      if (shouldCreateDraft && response?.draftId) {
          newFrontmatter.draftId = response.draftId;
          // eslint-disable-next-line no-console
          console.log(`✅ Successfully created draft: ${response.title}`)
          // eslint-disable-next-line no-console
          console.log(`Draft ID: ${response.draftId}`)
      } else if (shouldPublish && response?.articleId) {
          newFrontmatter.articleId = response.articleId;
          // Remove draftId if it was published
          delete newFrontmatter.draftId;
          // eslint-disable-next-line no-console
          console.log(`✅ Successfully published article: ${response.title}`)
          // eslint-disable-next-line no-console
          console.log(`Article ID: ${response.articleId}`)
      }

      const newContent = matter.stringify(fileContent, newFrontmatter);
      fs.writeFileSync(filePath, newContent);

    } else {
      // eslint-disable-next-line no-console
      console.error(`Error: Unknown command "${command}"`)
      process.exit(1)
    }
  } catch (error) {
    // eslint-disable-next-line no-console
    console.error('Error:', error instanceof Error ? error.message : 'Unknown error')
    process.exit(1)
  }
}

if (require.main === module) {
  // If the first argument is a known CLI command, run CLI, else run as GitHub Action
  const cliCommands = ['validate', 'draft', 'publish', '--help', '-h']
  const userArg = process.argv[2]
  if (cliCommands.includes(userArg)) {
    runCli()
  } else {
    runAction()
  }
}
