import fs from 'node:fs'
import path from 'node:path'
import { run } from '../lib/exec.js'
import { findProjectRoot } from '../lib/project.js'

export function runRenderDot() {
  const rootDir = findProjectRoot()
  const deckRoot = path.join(rootDir, 'decks')
  const decks = fs
    .readdirSync(deckRoot, { withFileTypes: true })
    .filter((entry) => entry.isDirectory())
    .map((entry) => path.join(deckRoot, entry.name))

  for (const deckDir of decks) {
    const dotDir = path.join(deckDir, 'figures-src', 'dot')
    const outDir = path.join(deckDir, 'figures')
    if (!fs.existsSync(dotDir) || !fs.statSync(dotDir).isDirectory()) {
      continue
    }

    const dotFiles = fs
      .readdirSync(dotDir)
      .filter((name) => name.endsWith('.dot'))
      .sort()

    for (const file of dotFiles) {
      const inputPath = path.join(dotDir, file)
      const outputPath = path.join(outDir, `${path.basename(file, '.dot')}.svg`)
      console.error(`dot -> ${path.relative(rootDir, outputPath)}`)
      run('dot', ['-Tsvg', inputPath, '-o', outputPath], { cwd: rootDir })
    }
  }
}
