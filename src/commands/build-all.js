import path from 'node:path'
import fs from 'node:fs'
import { run } from '../lib/exec.js'
import { findProjectRoot } from '../lib/project.js'

export function runBuildAll() {
  const rootDir = findProjectRoot()
  const projectName = process.env.CI_PROJECT_NAME || 'lectures'
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
    const outDir = path.join(rootDir, 'dist', deck.name)
    console.error(`-> Building ${deck.name} (base: /${projectName}/${deck.name}/)`)
    run('rm', ['-rf', outDir], { cwd: rootDir })
    run(
      'pnpm',
      ['slidev', 'build', deck.slidesPath, '--out', outDir, '--base', `/${projectName}/${deck.name}/`, '--without-notes'],
      { cwd: rootDir },
    )
  }

  console.error('Done: all decks built')
}
