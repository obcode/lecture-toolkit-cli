import path from 'node:path'
import fs from 'node:fs'
import { run } from '../lib/exec.js'
import { findProjectRoot } from '../lib/project.js'

export function runExportPdfs() {
  const rootDir = findProjectRoot()
  const deckRoot = path.join(rootDir, 'decks')

  const decks = fs
    .readdirSync(deckRoot, { withFileTypes: true })
    .filter((entry) => entry.isDirectory())
    .map((entry) => ({
      name: entry.name,
      slidesPath: path.join(deckRoot, entry.name, 'slides.md'),
    }))
    .filter((entry) => fs.existsSync(entry.slidesPath))
    .sort((a, b) => a.name.localeCompare(b.name))

  for (const deck of decks) {
    const outFile = path.join(rootDir, 'dist', `${deck.name}.pdf`)
    console.error(`-> Exporting PDF: ${deck.name}`)
    run('pnpm', ['slidev', 'export', deck.slidesPath, '--output', outFile, '--format', 'pdf'], { cwd: rootDir })
  }

  console.error('Done: all PDFs exported')
}
