import fs from 'node:fs'
import process from 'node:process'

function splitLines(text) {
  return text.split(/\r?\n/)
}

function stripDeckHeadmatter(lines) {
  if (lines[0]?.trim() !== '---') {
    return lines
  }

  let index = 1
  while (index < lines.length && lines[index].trim() !== '---') {
    index += 1
  }

  if (index >= lines.length) {
    return lines
  }

  return {
    headmatter: lines.slice(0, index + 1),
    body: lines.slice(index + 1),
  }
}

function toggleFenceState(line, state) {
  const trimmed = line.trim()
  const marker = trimmed.match(/^(```+|~~~+)/)?.[1]
  if (!marker) {
    return state
  }

  if (!state.active) {
    return { active: true, marker: marker[0] }
  }

  if (state.marker === marker[0]) {
    return { active: false, marker: null }
  }

  return state
}

function parseSlides(lines) {
  const slides = []
  let index = 0

  while (index < lines.length) {
    const leading = []
    while (index < lines.length && lines[index].trim() === '') {
      leading.push(lines[index])
      index += 1
    }

    if (index >= lines.length) {
      if (leading.length > 0) {
        slides.push(leading.join('\n'))
      }
      break
    }

    const slideLines = [...leading]

    if (lines[index].trim() === '---') {
      slideLines.push(lines[index])
      index += 1
      while (index < lines.length) {
        slideLines.push(lines[index])
        if (lines[index].trim() === '---') {
          index += 1
          break
        }
        index += 1
      }
    }

    let fenceState = { active: false, marker: null }
    while (index < lines.length) {
      const line = lines[index]
      if (!fenceState.active && line.trim() === '---') {
        break
      }
      slideLines.push(line)
      fenceState = toggleFenceState(line, fenceState)
      index += 1
    }

    slides.push(slideLines.join('\n'))
  }

  return slides
}

function stripTrailingNotesFromSlide(slide) {
  let body = slide.trimEnd()

  while (true) {
    const match = body.match(/<!--([\s\S]*?)-->\s*$/)
    if (!match || match.index === undefined) {
      break
    }
    body = body.slice(0, match.index).trimEnd()
  }

  return body
}

function normalizeTrailingWhitespace(text) {
  return splitLines(text)
    .map((line) => line.replace(/[ \t]+$/g, ''))
    .join('\n')
    .replace(/\n{3,}/g, '\n\n')
    .trimEnd()
}

export function stripPresenterNotesFile(inputPath) {
  const raw = fs.readFileSync(inputPath, 'utf8')
  const stripped = stripDeckHeadmatter(splitLines(raw))

  if (Array.isArray(stripped)) {
    return normalizeTrailingWhitespace(raw) + '\n'
  }

  const slides = parseSlides(stripped.body).map(stripTrailingNotesFromSlide)
  const output = [...stripped.headmatter, ...splitLines(normalizeTrailingWhitespace(slides.join('\n---\n')))]
    .join('\n')
    .trimEnd()

  return output + '\n'
}

export function runStripPresenterNotes(argv) {
  const inputPath = argv[0]
  if (!inputPath) {
    throw new Error('Usage: lecture-toolkit strip-presenter-notes <slides.md>')
  }

  process.stdout.write(stripPresenterNotesFile(inputPath))
}
