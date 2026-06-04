import path from 'node:path'
import process from 'node:process'
import { run } from '../lib/exec.js'
import { findProjectRoot } from '../lib/project.js'
import { loadToolkitConfig, pickSection } from '../lib/config.js'

export function runGenerateChangelogs() {
  const rootDir = findProjectRoot()
  const config = loadToolkitConfig(rootDir)
  const changelogConfig = pickSection(config, 'changelog')

  const scriptPath = path.join(import.meta.dirname, '..', 'scripts', 'generate-changelogs.sh')
  const stripScriptPath = path.join(import.meta.dirname, 'strip-presenter-notes.js')

  run('bash', [scriptPath], {
    cwd: rootDir,
    env: {
      ...process.env,
      LECTURE_TOOLKIT_STRIP_SCRIPT: stripScriptPath,
      LECTURE_TOOLKIT_DECKS_DIR: changelogConfig.decksDir ?? 'decks',
      LECTURE_TOOLKIT_OUTPUT_DIR: changelogConfig.outputDir ?? 'dist/changelogs',
      LECTURE_TOOLKIT_GLOBAL_RESET_FILE: changelogConfig.globalResetFile ?? 'decks/.changelog-reset',
      LECTURE_TOOLKIT_GLOBAL_RESET_DEFAULT: changelogConfig.globalResetDefault ?? '2026-05-18',
    },
  })
}
