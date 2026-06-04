import fs from 'node:fs'
import path from 'node:path'

export function findProjectRoot(startDir = process.cwd()) {
  let current = path.resolve(startDir)

  while (true) {
    const decksDir = path.join(current, 'decks')
    if (fs.existsSync(decksDir) && fs.statSync(decksDir).isDirectory()) {
      return current
    }

    const parent = path.dirname(current)
    if (parent === current) {
      throw new Error('Could not locate project root. Run this command inside a lecture repo containing a decks/ directory.')
    }
    current = parent
  }
}

export function resolveSlidesPath(input, rootDir) {
  if (!input) {
    return null
  }

  const normalizedInput = input.replace(/^\.\//, '')

  if (normalizedInput.endsWith('/slides.md')) {
    return path.resolve(rootDir, normalizedInput)
  }

  if (normalizedInput.startsWith('decks/')) {
    return path.resolve(rootDir, normalizedInput, 'slides.md')
  }

  const deckRoot = path.join(rootDir, 'decks')
  const matches = fs
    .readdirSync(deckRoot, { withFileTypes: true })
    .filter((entry) => entry.isDirectory() && entry.name.startsWith(normalizedInput))
    .map((entry) => path.join(deckRoot, entry.name, 'slides.md'))
    .sort()

  return matches[0] ?? null
}

export function ensureSlidesPath(input, rootDir) {
  const slidesPath = resolveSlidesPath(input, rootDir)
  if (!slidesPath || !fs.existsSync(slidesPath)) {
    throw new Error(`Deck not found for input: ${input ?? '<empty>'}`)
  }
  return slidesPath
}

export function parseDeckArg(argv) {
  const args = [...argv]
  if (args[0] === '--') {
    args.shift()
  }

  const deckArg = args.shift()
  if (args.length > 0) {
    throw new Error(`Unexpected argument: ${args[0]}`)
  }
  return deckArg
}
