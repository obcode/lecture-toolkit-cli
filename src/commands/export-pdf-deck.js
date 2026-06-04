import path from 'node:path'
import { run } from '../lib/exec.js'
import { ensureSlidesPath, findProjectRoot, parseDeckArg } from '../lib/project.js'

export function runExportPdfDeck(argv) {
  const rootDir = findProjectRoot()
  const deckArg = parseDeckArg(argv)

  if (!deckArg) {
    throw new Error('Usage: lecture-toolkit export-pdf-deck <deck|decks/<deck>|decks/<deck>/slides.md>')
  }

  const slidesPath = ensureSlidesPath(deckArg, rootDir)
  const deckDir = path.dirname(slidesPath)
  const name = path.basename(deckDir)
  const outFile = path.join(rootDir, 'dist', `${name}.pdf`)

  run('pnpm', ['slidev', 'export', slidesPath, '--output', outFile, '--format', 'pdf'], { cwd: rootDir })
}
