import fs from 'node:fs'
import path from 'node:path'

export function loadToolkitConfig(rootDir) {
  const configPath = path.join(rootDir, 'lecture-toolkit.config.json')
  if (!fs.existsSync(configPath)) {
    return {}
  }

  const raw = fs.readFileSync(configPath, 'utf8')
  const parsed = JSON.parse(raw)
  if (!parsed || typeof parsed !== 'object' || Array.isArray(parsed)) {
    throw new Error('lecture-toolkit.config.json must contain a JSON object at the root')
  }
  return parsed
}

export function pickSection(config, sectionName) {
  const section = config?.[sectionName]
  if (!section) {
    return {}
  }
  if (typeof section !== 'object' || Array.isArray(section)) {
    throw new Error(`Config section "${sectionName}" must be an object`)
  }
  return section
}
