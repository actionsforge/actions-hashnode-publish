import * as core from '@actions/core'
import * as fs from 'fs'
import * as path from 'path'
import matter from 'gray-matter'
import { validateMarkdown, parseMarkdown } from './validation'
import { publishToHashnode } from './publish'

// Function to recursively find markdown files
function findMarkdownFiles(dirPath: string, recursive: boolean = false): string[] {
  const files: string[] = []
  const items = fs.readdirSync(dirPath)

  for (const item of items) {
    const fullPath = path.join(dirPath, item)
    const stat = fs.statSync(fullPath)

    if (stat.isDirectory() && recursive) {
      files.push(...findMarkdownFiles(fullPath, recursive))
    } else if (stat.isFile() && item.endsWith('.md')) {
      files.push(fullPath)
    }
  }

  return files
}

// Function to process a single markdown file
async function processMarkdownFile(filePath: string, token: string, publicationId: string, isDraftInput: boolean): Promise<void> {
  try {
    // Read and parse markdown file
    const fileContent = fs.readFileSync(filePath, 'utf8')
    const metadata = parseMarkdown(fileContent)

    // Validate markdown
    const validationResult = validateMarkdown(fileContent)
    if (!validationResult.isValid) {
      core.setFailed(`Validation failed for ${filePath}:\n${validationResult.errors.join('\n')}`)
      return
    }

    // Determine action based on existing IDs and input
    let shouldCreateDraft = false
    let shouldPublish = false
    let existingDraftId = metadata.draftId

    if (metadata.articleId) {
      core.info(`Article is already published with ID: ${metadata.articleId}`)
      return
    } else if (metadata.draftId) {
      if (isDraftInput) {
        core.info(`Article is already a draft with ID: ${metadata.draftId}`)
        return
      } else {
        shouldPublish = true
        existingDraftId = metadata.draftId
      }
    } else {
      if (isDraftInput) {
        shouldCreateDraft = true
      } else {
        shouldPublish = true
      }
    }

    let response
    if (shouldCreateDraft || shouldPublish) {
      try {
        const publishMetadata = shouldPublish && existingDraftId
          ? { ...metadata, draftId: undefined }
          : metadata

        response = await publishToHashnode({
          token,
          publicationId,
          ...publishMetadata,
          isDraft: shouldCreateDraft,
          existingDraftId
        })
      } catch (error) {
        core.setFailed(`Error processing ${filePath}: ${error instanceof Error ? error.message : 'API Error'}`)
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

    const newContent = matter.stringify(fileContent, newFrontmatter)
    fs.writeFileSync(filePath, newContent)
  } catch (error) {
    core.setFailed(`Error processing ${filePath}: ${error instanceof Error ? error.message : 'Unknown error'}`)
  }
}

export async function runAction(): Promise<void> {
  try {
    // Get inputs
    const token = core.getInput('token', { required: true })
    const publicationId = core.getInput('publication_id', { required: true })
    const filePath = core.getInput('file_path', { required: true })
    const isDraftInput = core.getInput('is_draft') === 'true'
    const recursive = core.getInput('recursive') === 'true'

    // Check if path exists
    if (!fs.existsSync(filePath)) {
      core.setFailed(`Path does not exist: ${filePath}`)
      return
    }

    // Get file stats
    const stats = fs.statSync(filePath)

    if (stats.isDirectory()) {
      if (!recursive) {
        core.setFailed(`Path is a directory but recursive mode is not enabled: ${filePath}`)
        return
      }
      const markdownFiles = findMarkdownFiles(filePath, recursive)
      if (markdownFiles.length === 0) {
        core.info(`No markdown files found in directory: ${filePath}`)
        return
      }
      core.info(`Found ${markdownFiles.length} markdown files to process`)
      for (const file of markdownFiles) {
        await processMarkdownFile(file, token, publicationId, isDraftInput)
      }
    } else if (stats.isFile()) {
      if (!filePath.endsWith('.md')) {
        core.setFailed(`File is not a markdown file: ${filePath}`)
        return
      }
      await processMarkdownFile(filePath, token, publicationId, isDraftInput)
    } else {
      core.setFailed(`Path is neither a file nor a directory: ${filePath}`)
    }
  } catch (error) {
    core.setFailed(error instanceof Error ? error.message : 'Unknown error')
  }
}

export async function runCli(args: string[] = process.argv.slice(2)): Promise<void> {
  const command = args[0]

  if (!command || command === '--help' || command === '-h') {
    // eslint-disable-next-line no-console
    console.log(`\nHashnode Publisher CLI\n\nUsage:\n  hashnode-publish <command> [options]\n\nCommands:\n  validate <file>    Validate a markdown file\n  draft <file>       Create a draft on Hashnode\n  publish <file>     Publish an article to Hashnode\n\nOptions:\n  --token <token>           Hashnode API token (or use TOKEN env var)\n  --publication-id <id>     Hashnode publication ID (or use PUBLICATION_ID env var)\n  --dry-run                 Validate without publishing\n  --continue-on-error       Continue even if validation fails\n  --recursive              Process directories recursively (default: false)\n  --help, -h               Show this help message\n\nExamples:\n  hashnode-publish validate blog/hello-world.md\n  hashnode-publish validate blog/ --recursive\n  hashnode-publish validate blog/ --continue-on-error --recursive\n  hashnode-publish draft blog/hello-world.md --token YOUR_TOKEN --publication-id YOUR_PUB_ID\n  hashnode-publish publish blog/hello-world.md --token YOUR_TOKEN --publication-id YOUR_PUB_ID\n  hashnode-publish draft blog/hello-world.md --token YOUR_TOKEN --publication-id YOUR_PUB_ID --dry-run\n    `)
    process.exit(0)
  }

  const filePath = args[1]
  if (!filePath) {
    // eslint-disable-next-line no-console
    console.error('Error: File path is required')
    process.exit(1)
  }

  try {
    const isDryRun = args.includes('--dry-run')

    if (command === 'validate') {
      const stat = fs.statSync(filePath)
      const continueOnError = args.includes('--continue-on-error')
      const recursive = args.includes('--recursive')
      if (stat.isDirectory()) {
        const files = findMarkdownFiles(filePath, recursive)
        if (files.length === 0) {
          // eslint-disable-next-line no-console
          console.error('❌ No markdown files found in directory')
          process.exit(1)
        }
        // eslint-disable-next-line no-console
        console.log(`Found ${files.length} markdown files to validate`)
        let hasErrors = false
        for (const file of files) {
          const fileContent = fs.readFileSync(file, 'utf8')
          const result = validateMarkdown(fileContent)
          if (result.isValid) {
            // eslint-disable-next-line no-console
            console.log(`✅ ${file} is valid`)
          } else {
            hasErrors = true
            // eslint-disable-next-line no-console
            console.error(`❌ Validation errors in ${file}:`)
            result.errors.forEach(error => {
              // eslint-disable-next-line no-console
              console.error(`  - ${error}`)
            })
          }
        }
        if (hasErrors && !continueOnError) {
          process.exit(1)
        }
        process.exit(0)
      } else {
        const fileContent = fs.readFileSync(filePath, 'utf8')
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
          if (!continueOnError) {
            process.exit(1)
          }
        }
        process.exit(0)
      }
    } else if (command === 'draft' || command === 'publish') {
      const fileContent = fs.readFileSync(filePath, 'utf8')
      const metadata = parseMarkdown(fileContent)
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
      const newFrontmatter = { ...matter(filePath).data };
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

      const newContent = matter.stringify(filePath, newFrontmatter);
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
