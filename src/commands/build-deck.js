import path from 'node:path'
import { run } from '../lib/exec.js'
import { ensureSlidesPath, findProjectRoot, parseDeckArg } from '../lib/project.js'

export function runBuildDeck(argv) {
  const rootDir = findProjectRoot()
  const deckArg = parseDeckArg(argv)

  if (!deckArg) {
    throw new Error('Usage: lecture-toolkit build-deck <deck|decks/<deck>|decks/<deck>/slides.md>')
  }

  const slidesPath = ensureSlidesPath(deckArg, rootDir)
  const projectName = process.env.CI_PROJECT_NAME || 'lectures'
  const deckDir = path.dirname(slidesPath)
  const name = path.basename(deckDir)
  const outDir = path.join(rootDir, 'dist', name)

  run('rm', ['-rf', outDir], { cwd: rootDir })
  run('pnpm', ['slidev', 'build', slidesPath, '--out', outDir, '--base', `/${projectName}/${name}/`, '--without-notes'], {
    cwd: rootDir,
  })
}
