import fs from 'node:fs'
import path from 'node:path'
import process from 'node:process'
import { ensureSlidesPath, findProjectRoot, parseDeckArg } from '../lib/project.js'

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

  return lines.slice(index + 1)
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
    const slideLines = []

    while (index < lines.length && lines[index].trim() === '') {
      index += 1
    }

    if (index >= lines.length) {
      break
    }

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
        index += 1
        break
      }
      slideLines.push(line)
      fenceState = toggleFenceState(line, fenceState)
      index += 1
    }

    const raw = slideLines.join('\n').trim()
    if (raw) {
      slides.push(raw)
    }
  }

  return slides
}

function stripSlideFrontmatter(slide) {
  const lines = splitLines(slide)
  if (lines[0]?.trim() !== '---') {
    return slide.trim()
  }

  let index = 1
  while (index < lines.length && lines[index].trim() !== '---') {
    index += 1
  }

  if (index >= lines.length) {
    return slide.trim()
  }

  return lines.slice(index + 1).join('\n').trim()
}

function trimOuterBlankLines(text) {
  const lines = text.split(/\r?\n/)

  while (lines.length > 0 && lines[0].trim() === '') {
    lines.shift()
  }

  while (lines.length > 0 && lines[lines.length - 1].trim() === '') {
    lines.pop()
  }

  return lines.join('\n')
}

function extractTrailingNotes(slideBody) {
  let body = slideBody.trimEnd()
  const notes = []

  while (true) {
    const match = body.match(/<!--([\s\S]*?)-->\s*$/)
    if (!match || match.index === undefined) {
      break
    }

    const content = trimOuterBlankLines(match[1])

    if (content) {
      notes.unshift(content)
    }

    body = body.slice(0, match.index).trimEnd()
  }

  return {
    body,
    notes: notes.join('\n\n').trim(),
  }
}

function extractTitle(slideBody, fallbackIndex) {
  const heading = slideBody.match(/^#{1,6}\s+(.+)$/m)?.[1]?.trim()
  if (heading) {
    return heading
  }

  const firstText = splitLines(slideBody)
    .map((line) => line.trim())
    .find((line) => line && !line.startsWith('![') && !line.startsWith('<'))

  return firstText ? firstText.slice(0, 80) : `Slide ${fallbackIndex}`
}

function timestamp() {
  const formatter = new Intl.DateTimeFormat('de-DE', {
    day: '2-digit',
    month: '2-digit',
    year: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
    hour12: false,
    timeZone: 'Europe/Berlin',
  })

  return `${formatter.format(new Date())} Uhr`
}

function deriveRepoInfo(rootDir) {
  const repoName = path.basename(rootDir)
  const [lecture, project] = repoName.split('-', 2)

  if (!lecture || !project) {
    return {
      lecture: 'mpd',
      project: 'lectures',
    }
  }

  return { lecture, project }
}

function buildRepoBlobUrl(rootDir, relativePath) {
  const { lecture, project } = deriveRepoInfo(rootDir)
  return `https://gitlab.lrz.de/${lecture}/${project}/-/blob/main/${relativePath}`
}

function buildOutputPath(slidesPath) {
  return path.join(path.dirname(slidesPath), 'notes.md')
}

const TIMESTAMP_LABEL = 'Letzte Änderung'

function buildMarkdown(deckTitle, rootDir, slidesPath, slideNotes, changedAt) {
  const relativeSlidesPath = path.relative(rootDir, slidesPath)
  const relativeNotesPath = path.relative(rootDir, buildOutputPath(slidesPath))
  const sourceUrl = buildRepoBlobUrl(rootDir, relativeSlidesPath)
  const notesUrl = buildRepoBlobUrl(rootDir, relativeNotesPath)
  const { lecture } = deriveRepoInfo(rootDir)

  const parts = [
    `# ${deckTitle} - Notizen`,
    '',
    '> [!NOTE]',
    `> ${TIMESTAMP_LABEL}: ${changedAt}`,
    `> Quelle: [${relativeSlidesPath}](${sourceUrl})`,
    `> Notes: [${relativeNotesPath}](${notesUrl})`,
    '',
  ]

  if (slideNotes.length === 0) {
    parts.push('Keine Slidev-Notes gefunden.')
    parts.push('')
    parts.push('Lege Presenter-Notes am Ende einer Slide als HTML-Kommentar an, zum Beispiel:')
    parts.push('')
    parts.push('```md')
    parts.push('# Beispiel')
    parts.push('')
    parts.push('<!-- Livecoding: zuerst visited beim Enqueue setzen -->')
    parts.push('```')
  } else {
    for (const slide of slideNotes) {
      parts.push(`## ${slide.title}`)
      parts.push('')
      parts.push(slide.notes)
      parts.push('')
    }
  }

  parts.push(`#hm/lectures/${lecture}/notes`)
  parts.push('')

  return parts.join('\n')
}

function stripTimestampLine(markdown) {
  const prefix = `> ${TIMESTAMP_LABEL}:`
  return splitLines(markdown)
    .filter((line) => !line.startsWith(prefix))
    .join('\n')
}

export function exportNotes(slidesPath, rootDir) {
  const raw = fs.readFileSync(slidesPath, 'utf8')
  const lines = stripDeckHeadmatter(splitLines(raw))
  const slideBlocks = parseSlides(lines)

  const deckTitle = raw.match(/^title:\s*(.+)$/m)?.[1]?.trim() ?? path.basename(path.dirname(slidesPath))
  const slideNotes = slideBlocks
    .map((slide, index) => {
      const withoutFrontmatter = stripSlideFrontmatter(slide)
      const extracted = extractTrailingNotes(withoutFrontmatter)
      if (!extracted.notes) {
        return null
      }

      return {
        title: extractTitle(extracted.body, index + 1),
        notes: extracted.notes,
      }
    })
    .filter(Boolean)

  const outputPath = buildOutputPath(slidesPath)
  const previous = fs.existsSync(outputPath) ? fs.readFileSync(outputPath, 'utf8') : null

  const candidate = buildMarkdown(deckTitle, rootDir, slidesPath, slideNotes, timestamp())

  if (previous && stripTimestampLine(previous) === stripTimestampLine(candidate)) {
    // Nothing changed except the timestamp — keep the existing file (and its
    // recorded timestamp) untouched so notes.md stays clean in git.
    return outputPath
  }

  fs.mkdirSync(path.dirname(outputPath), { recursive: true })
  fs.writeFileSync(outputPath, candidate, 'utf8')

  return outputPath
}

export function runExportNotes(argv) {
  const rootDir = findProjectRoot()
  const deckArg = parseDeckArg(argv)

  if (!deckArg) {
    throw new Error('Usage: lecture-toolkit export-notes <deck|decks/<deck>|decks/<deck>/slides.md>')
  }

  const slidesPath = ensureSlidesPath(deckArg, rootDir)
  const outputPath = exportNotes(slidesPath, rootDir)
  console.error(`Wrote ${path.relative(rootDir, outputPath)}`)
}

if (import.meta.url === `file://${process.argv[1]}`) {
  runExportNotes(process.argv.slice(2))
}
