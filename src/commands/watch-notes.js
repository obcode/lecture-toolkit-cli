import fs from 'node:fs'
import path from 'node:path'
import process from 'node:process'
import { ensureSlidesPath, findProjectRoot, parseDeckArg } from '../lib/project.js'
import { exportNotes } from './export-notes.js'

export function runWatchNotes(argv) {
  const rootDir = findProjectRoot()
  const deckArg = parseDeckArg(argv)

  if (!deckArg) {
    throw new Error('Usage: lecture-toolkit watch-notes <deck|decks/<deck>|decks/<deck>/slides.md>')
  }

  const slidesPath = ensureSlidesPath(deckArg, rootDir)
  const watchDir = path.dirname(slidesPath)
  const outputPath = path.join(watchDir, 'notes.md')
  const watchedFileName = path.basename(slidesPath)

  let exportTimer = null
  let isShuttingDown = false

  function writeNotes(reason) {
    try {
      exportNotes(slidesPath, rootDir)
      console.error(`[notes] Updated ${path.relative(process.cwd(), outputPath)} (${reason})`)
    } catch (error) {
      console.error(`[notes] Export failed after ${reason}`)
      console.error(error instanceof Error ? error.message : String(error))
    }
  }

  function scheduleWrite(reason) {
    if (exportTimer) {
      clearTimeout(exportTimer)
    }

    exportTimer = setTimeout(() => {
      exportTimer = null
      writeNotes(reason)
    }, 120)
  }

  function shutdown() {
    if (isShuttingDown) {
      return
    }
    isShuttingDown = true
    if (exportTimer) {
      clearTimeout(exportTimer)
      exportTimer = null
    }
    watcher.close()
  }

  if (!fs.existsSync(slidesPath)) {
    throw new Error(`Slides file not found: ${slidesPath}`)
  }

  writeNotes('startup')

  const watcher = fs.watch(watchDir, (eventType, fileName) => {
    if (!fileName || fileName !== watchedFileName) {
      return
    }

    if (!fs.existsSync(slidesPath) && eventType === 'rename') {
      return
    }

    scheduleWrite(eventType)
  })

  process.on('SIGINT', () => {
    shutdown()
    process.exit(0)
  })

  process.on('SIGTERM', () => {
    shutdown()
    process.exit(0)
  })

  process.on('exit', shutdown)
}
