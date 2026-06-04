import fs from 'node:fs'
import path from 'node:path'
import { run } from '../lib/exec.js'
import { findProjectRoot } from '../lib/project.js'

export function runRenderTikz() {
  const rootDir = findProjectRoot()
  const deckRoot = path.join(rootDir, 'decks')
  const decks = fs
    .readdirSync(deckRoot, { withFileTypes: true })
    .filter((entry) => entry.isDirectory())
    .map((entry) => path.join(deckRoot, entry.name))

  for (const deckDir of decks) {
    const tikzDir = path.join(deckDir, 'figures-src', 'tikz')
    if (!fs.existsSync(tikzDir) || !fs.statSync(tikzDir).isDirectory()) {
      continue
    }

    const texFiles = fs
      .readdirSync(tikzDir)
      .filter((name) => name.endsWith('.tex'))
      .sort()

    for (const file of texFiles) {
      const name = path.basename(file, '.tex')
      const outputPath = path.join(deckDir, 'figures', `${name}.svg`)
      console.error(`tikz -> ${path.relative(rootDir, outputPath)}`)

      run('pdflatex', ['-interaction=nonstopmode', file], { cwd: tikzDir })
      run('pdf2svg', [`${name}.pdf`, path.join('..', '..', 'figures', `${name}.svg`)], { cwd: tikzDir })
    }
  }
}
