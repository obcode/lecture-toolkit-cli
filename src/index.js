import { runBuildAll } from './commands/build-all.js'
import { runBuildDeck } from './commands/build-deck.js'
import { runBuildIndex } from './commands/build-index.js'
import { runDevDeck } from './commands/dev-deck.js'
import { runExportNotes } from './commands/export-notes.js'
import { runExportPdfDeck } from './commands/export-pdf-deck.js'
import { runExportPdfs } from './commands/export-pdfs.js'
import { runGenerateChangelogs } from './commands/generate-changelogs.js'
import { runRenderDot } from './commands/render-dot.js'
import { runRenderTikz } from './commands/render-tikz.js'
import { runStripPresenterNotes } from './commands/strip-presenter-notes.js'
import { runWatchNotes } from './commands/watch-notes.js'
import process from 'node:process'

function usage() {
  console.error('lecture-toolkit commands:')
  console.error('  export-notes <deck>')
  console.error('  watch-notes <deck>')
  console.error('  dev-deck <deck>')
  console.error('  build-deck <deck>')
  console.error('  build-all')
  console.error('  build-index [--course-title <value>] [--subtitle <value>] [--site-title <value>]')
  console.error('  export-pdf-deck <deck>')
  console.error('  export-pdfs')
  console.error('  render-dot')
  console.error('  render-tikz')
  console.error('  generate-changelogs')
  console.error('  strip-presenter-notes <slides.md>')
}

export async function runCommand(argv) {
  const args = [...argv]
  const command = args.shift()

  switch (command) {
    case 'export-notes':
      runExportNotes(args)
      return
    case 'watch-notes':
      runWatchNotes(args)
      return
    case 'dev-deck':
      await runDevDeck(args)
      return
    case 'build-deck':
      runBuildDeck(args)
      return
    case 'build-all':
      runBuildAll(args)
      return
    case 'build-index':
      runBuildIndex(args)
      return
    case 'export-pdf-deck':
      runExportPdfDeck(args)
      return
    case 'export-pdfs':
      runExportPdfs(args)
      return
    case 'render-dot':
      runRenderDot(args)
      return
    case 'render-tikz':
      runRenderTikz(args)
      return
    case 'generate-changelogs':
      runGenerateChangelogs(args)
      return
    case 'strip-presenter-notes':
      runStripPresenterNotes(args)
      return
    case '-h':
    case '--help':
    case 'help':
    case undefined:
      usage()
      return
    default:
      throw new Error(`Unknown command: ${command}`)
  }
}

if (import.meta.url === `file://${process.argv[1]}`) {
  runCommand(process.argv.slice(2)).catch((error) => {
    console.error(error instanceof Error ? error.message : String(error))
    process.exit(1)
  })
}
