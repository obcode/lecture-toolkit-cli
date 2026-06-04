import { runBuildAll } from './commands/build-all.js'
import { runBuildDeck } from './commands/build-deck.js'
import { runDevDeck } from './commands/dev-deck.js'
import { runExportNotes } from './commands/export-notes.js'
import { runExportPdfDeck } from './commands/export-pdf-deck.js'
import { runExportPdfs } from './commands/export-pdfs.js'
import { runWatchNotes } from './commands/watch-notes.js'

function usage() {
  console.error('lecture-toolkit commands:')
  console.error('  export-notes <deck>')
  console.error('  watch-notes <deck>')
  console.error('  dev-deck <deck>')
  console.error('  build-deck <deck>')
  console.error('  build-all')
  console.error('  export-pdf-deck <deck>')
  console.error('  export-pdfs')
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
    case 'export-pdf-deck':
      runExportPdfDeck(args)
      return
    case 'export-pdfs':
      runExportPdfs(args)
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
