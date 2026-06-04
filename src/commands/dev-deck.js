import { spawn } from 'node:child_process'
import process from 'node:process'
import { ensureSlidesPath, findProjectRoot, parseDeckArg } from '../lib/project.js'

export async function runDevDeck(argv) {
  const rootDir = findProjectRoot()
  const deckArg = parseDeckArg(argv)

  if (!deckArg) {
    throw new Error('Usage: lecture-toolkit dev-deck <deck|decks/<deck>|decks/<deck>/slides.md>')
  }

  const slidesPath = ensureSlidesPath(deckArg, rootDir)
  const cliEntryPath = new URL('../index.js', import.meta.url).pathname

  const watch = spawn(process.execPath, [cliEntryPath, 'watch-notes', deckArg], {
    cwd: rootDir,
    stdio: 'inherit',
  })

  const slidev = spawn('pnpm', ['slidev', slidesPath, '--remote'], {
    cwd: rootDir,
    stdio: 'inherit',
  })

  const stopWatcher = () => {
    if (!watch.killed) {
      watch.kill('SIGTERM')
    }
  }

  slidev.on('exit', (code) => {
    stopWatcher()
    process.exit(code ?? 0)
  })

  slidev.on('error', (error) => {
    stopWatcher()
    console.error(error instanceof Error ? error.message : String(error))
    process.exit(1)
  })
}
