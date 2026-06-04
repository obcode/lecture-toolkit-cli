import fs from 'node:fs'
import path from 'node:path'
import process from 'node:process'
import { findProjectRoot } from '../lib/project.js'
import { loadToolkitConfig, pickSection } from '../lib/config.js'

function escapeHtml(value) {
  return value
    .replaceAll('&', '&amp;')
    .replaceAll('<', '&lt;')
    .replaceAll('>', '&gt;')
}

function formatDisplayDatetime(input, locale, timeZone) {
  const date = input === 'now' ? new Date() : new Date(input)
  if (Number.isNaN(date.getTime())) {
    return input
  }

  const formatter = new Intl.DateTimeFormat(locale, {
    day: '2-digit',
    month: '2-digit',
    year: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
    hour12: false,
    timeZone,
  })

  return `${formatter.format(date)} Uhr`
}

function extractFrontmatterTitle(filePath) {
  const raw = fs.readFileSync(filePath, 'utf8')
  const lines = raw.split(/\r?\n/)
  if (lines[0]?.trim() !== '---') {
    return ''
  }

  for (let index = 1; index < lines.length; index += 1) {
    const line = lines[index]
    if (line.trim() === '---') {
      break
    }

    const match = line.match(/^\s*title:\s*(.+)\s*$/)
    if (!match) {
      continue
    }

    return match[1].trim().replace(/^['"]|['"]$/g, '')
  }

  return ''
}

function parseFlags(argv) {
  const args = [...argv]
  const flags = {}

  while (args.length > 0) {
    const token = args.shift()
    if (!token?.startsWith('--')) {
      throw new Error(`Unexpected argument: ${token}`)
    }

    const key = token.slice(2)
    const value = args.shift()
    if (!value) {
      throw new Error(`Missing value for --${key}`)
    }

    flags[key] = value
  }

  return flags
}

export function runBuildIndex(argv) {
  const rootDir = findProjectRoot()
  const config = loadToolkitConfig(rootDir)
  const indexConfig = pickSection(config, 'index')
  const flags = parseFlags(argv)

  const locale = flags.locale ?? indexConfig.locale ?? 'de-DE'
  const timeZone = flags.timezone ?? indexConfig.timezone ?? 'Europe/Berlin'
  const eyebrow = flags.eyebrow ?? indexConfig.eyebrow ?? 'Vorlesungsfolien'
  const courseTitle = flags['course-title'] ?? indexConfig.courseTitle ?? 'Course'
  const subtitle = flags.subtitle ?? indexConfig.subtitle ?? ''
  const siteTitle = flags['site-title'] ?? indexConfig.siteTitle ?? [courseTitle, subtitle].filter(Boolean).join(' - ')

  const project = process.env.CI_PROJECT_NAME || 'lectures'
  const generatedAt = formatDisplayDatetime('now', locale, timeZone)
  const distDir = path.join(rootDir, 'dist')
  const changelogDir = path.join(distDir, 'changelogs')

  fs.mkdirSync(distDir, { recursive: true })

  const deckRoot = path.join(rootDir, 'decks')
  const deckNames = fs
    .readdirSync(deckRoot, { withFileTypes: true })
    .filter((entry) => entry.isDirectory())
    .map((entry) => entry.name)
    .sort((a, b) => a.localeCompare(b))

  const listItems = []

  for (const deckName of deckNames) {
    const slidesPath = path.join(deckRoot, deckName, 'slides.md')
    if (!fs.existsSync(slidesPath)) {
      continue
    }

    const title = extractFrontmatterTitle(slidesPath) || deckName
    const titleHtml = escapeHtml(title)

    let lastChangeText = '<p class="deck-meta">Letzte Änderung: keine</p>'
    let changelogButton = ''
    const changeFile = path.join(changelogDir, `${deckName}.last-change`)

    if (fs.existsSync(changeFile)) {
      const [rawDate = '', changePage = ''] = fs.readFileSync(changeFile, 'utf8').trim().split('|')
      const formattedDate = formatDisplayDatetime(rawDate, locale, timeZone)

      if (changePage) {
        lastChangeText = `<p class="deck-meta">Letzte Änderung: ${escapeHtml(formattedDate)}</p>`
        changelogButton = `<a class="btn btn-change" href="/${project}/changelogs/${escapeHtml(changePage)}">Changelog</a>`
      } else {
        lastChangeText = `<p class="deck-meta">Stand: ${escapeHtml(formattedDate)}</p>`
      }
    }

    const pdfPath = path.join(distDir, `${deckName}.pdf`)
    const pdfLink = fs.existsSync(pdfPath)
      ? `<a class="btn btn-pdf" href="/${project}/${deckName}.pdf">PDF</a>`
      : ''

    listItems.push(`    <li>
      <div class="deck-info">
        <p class="deck-title">${titleHtml}</p>
        ${lastChangeText}
      </div>
      <div class="actions">
        <a class="btn btn-primary" href="/${project}/${deckName}/">Slides</a>
        ${pdfLink}
        ${changelogButton}
      </div>
    </li>`)
  }

  const html = `<!DOCTYPE html>
<html lang="de">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>${escapeHtml(siteTitle)}</title>
  <style>
    :root {
      --bg: #f3f4f6;
      --panel: rgba(255, 255, 255, 0.88);
      --border: #e5e7eb;
      --text: #111827;
      --muted: #6b7280;
      --accent: #2563eb;
      --success: #059669;
    }

    * { box-sizing: border-box; }

    body {
      margin: 0;
      font-family: system-ui, -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif;
      color: var(--text);
      background:
        radial-gradient(circle at top left, rgba(37, 99, 235, 0.12), transparent 30%),
        radial-gradient(circle at top right, rgba(16, 185, 129, 0.10), transparent 24%),
        var(--bg);
    }

    .page {
      max-width: 1080px;
      margin: 0 auto;
      padding: 2rem 1rem 3rem;
    }

    .hero {
      background: var(--panel);
      backdrop-filter: blur(10px);
      border: 1px solid var(--border);
      border-radius: 1.25rem;
      padding: 1.5rem;
      box-shadow: 0 18px 40px rgba(17, 24, 39, 0.08);
      margin-bottom: 1.5rem;
    }

    .eyebrow {
      margin: 0 0 0.4rem;
      color: var(--accent);
      font-size: 0.85rem;
      font-weight: 700;
      text-transform: uppercase;
      letter-spacing: 0.08em;
    }

    h1 {
      margin: 0;
      font-size: clamp(1.9rem, 3vw, 2.7rem);
      line-height: 1.05;
    }

    .subtitle {
      margin: 0.5rem 0 0;
      color: var(--muted);
      font-size: 1rem;
    }

    .timestamp {
      margin: 0.5rem 0 0;
      color: var(--muted);
      font-size: 0.88rem;
    }

    ul {
      list-style: none;
      padding: 0;
      margin: 0;
      display: grid;
      gap: 1rem;
    }

    li {
      background: var(--panel);
      backdrop-filter: blur(10px);
      border: 1px solid var(--border);
      border-radius: 1rem;
      padding: 1rem 1rem 1.1rem;
      box-shadow: 0 10px 24px rgba(17, 24, 39, 0.05);
      display: flex;
      align-items: center;
      justify-content: space-between;
      gap: 1rem;
      flex-wrap: wrap;
    }

    .deck-info {
      min-width: 0;
      flex: 1 1 320px;
    }

    .deck-title {
      color: var(--text);
      font-size: 1.12rem;
      font-weight: 700;
      display: block;
      margin-bottom: 0.2rem;
    }

    .deck-meta {
      color: var(--muted);
      font-size: 0.92rem;
      margin: 0;
    }

    .actions {
      display: flex;
      align-items: center;
      gap: 0.6rem;
      flex-wrap: wrap;
    }

    .btn {
      font-size: 0.85rem;
      color: var(--muted);
      border: 1px solid var(--border);
      padding: 0.3rem 0.7rem;
      border-radius: 999px;
      text-decoration: none;
      background: rgba(255, 255, 255, 0.7);
    }

    .btn:hover { background: #f8fafc; }

    .btn-primary {
      color: var(--accent);
      border-color: rgba(37, 99, 235, 0.28);
      background: rgba(239, 246, 255, 0.95);
    }

    .btn-primary:hover { background: #dbeafe; }

    .btn-pdf {
      color: #b91c1c;
      border-color: rgba(185, 28, 28, 0.28);
      background: rgba(254, 242, 242, 0.95);
    }

    .btn-pdf:hover { background: #fee2e2; }

    .btn-change {
      font-size: 0.85rem;
      color: var(--success);
      border: 1px solid rgba(5, 150, 105, 0.25);
      padding: 0.3rem 0.7rem;
      border-radius: 999px;
      text-decoration: none;
      background: rgba(236, 253, 245, 0.9);
    }

    .btn-change:hover { background: #d1fae5; }

    @media (max-width: 640px) {
      .page { padding-top: 1rem; }
      li { align-items: flex-start; }
      .actions { width: 100%; }
    }
  </style>
</head>
<body>
  <div class="page">
    <section class="hero">
      <p class="eyebrow">${escapeHtml(eyebrow)}</p>
      <h1>${escapeHtml(courseTitle)}</h1>
      <p class="subtitle">${escapeHtml(subtitle)}</p>
      <p class="timestamp">Zuletzt erzeugt am ${escapeHtml(generatedAt)}</p>
    </section>
    <ul>
${listItems.join('\n')}
    </ul>
  </div>
</body>
</html>
`

  fs.writeFileSync(path.join(distDir, 'index.html'), html, 'utf8')
}
