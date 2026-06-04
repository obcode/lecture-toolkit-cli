#!/usr/bin/env node

import process from 'node:process'
import { runCommand } from '../src/index.js'

runCommand(process.argv.slice(2)).catch((error) => {
  console.error(error instanceof Error ? error.message : String(error))
  process.exit(1)
})
