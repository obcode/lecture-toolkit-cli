# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## What this is

A reusable CLI (`lecture-toolkit`) that wraps [Slidev](https://sli.dev) workflows for lecture repositories. It is **not** itself a lecture repo — it is installed as a dev dependency into lecture repos (e.g. `mpd-lectures`) that contain a `decks/` directory, one subdirectory per deck with a `slides.md`.

Pure ESM Node project (`"type": "module"`, Node >= 20). No build step, no TypeScript, no test suite, and no lint config — source in `src/` is published and run as-is. pnpm is the package manager.

## Running / developing

```bash
node bin/lecture-toolkit.js <command> [args]   # run the CLI directly from this repo
```

There are **no `dev`/`build`/`test`/`lint` scripts** in package.json. The only script is `release` (semantic-release, normally run by CI). To exercise commands manually you must run inside a lecture repo containing a `decks/` directory, since nearly every command calls `findProjectRoot()` and aborts otherwise.

Releases are automated: Conventional Commits on `main` drive semantic-release (`.releaserc.json`, `.github/workflows/release.yml`), publishing a git tag, GitHub Release, and an npm package to GitHub Packages. `fix:` → patch, `feat:` → minor, `feat!:`/`BREAKING CHANGE:` → major. Commit messages therefore directly determine version bumps.

## Architecture

Entry: `bin/lecture-toolkit.js` → `src/index.js` `runCommand()`, a single `switch` dispatching the first argv token to one `run*` function per command in `src/commands/`. To add a command: create `src/commands/<name>.js` exporting a `run*` function, then import + add a `case` in `src/index.js` and a line in `usage()`.

Three shared libraries in `src/lib/` underpin every command:

- **`project.js`** — the contract all commands share. `findProjectRoot()` walks up from cwd looking for a `decks/` dir (throws if none). `resolveSlidesPath()`/`ensureSlidesPath()` turn a `<deck>` argument into an absolute `slides.md` path, accepting three forms: a **directory-name prefix** (e.g. `09` or `09-DFS-BFS`, first match by sorted order), `decks/<deck>`, or `decks/<deck>/slides.md`. `parseDeckArg()` extracts the single deck arg (tolerating a leading `--`). Any command taking a deck should reuse these rather than re-parsing paths.
- **`exec.js`** — `run(command, args, opts)` wraps `spawnSync` with `stdio: 'inherit'` and throws on non-zero exit. This is how commands shell out to `pnpm slidev`, `dot`, `pdflatex`, `bash`, etc. Use it for synchronous external tools; commands needing concurrency (`dev-deck`, `watch-notes`) use `spawn`/`spawnSync` directly.
- **`config.js`** — `loadToolkitConfig(rootDir)` reads optional `lecture-toolkit.config.json` from the lecture repo root (returns `{}` if absent); `pickSection(config, name)` pulls a validated object subsection. Config sections seen so far: `index` (build-index branding) and `changelog`.

### Command groups

- **Notes**: `export-notes` parses `slides.md` (frontmatter-aware, fenced-code-aware slide splitting) and writes a `notes.md` with a timestamped header, GitLab blob links, and a Bear tag footer; the lecture short-name is derived from the repo-name prefix (`mpd-lectures` → `mpd`). `watch-notes` debounce-regenerates `notes.md` on file changes. `strip-presenter-notes` removes presenter `<!-- ... -->` notes from a `slides.md` (also invoked standalone by the changelog script).
- **Build/export**: `build-deck`/`build-all` run `pnpm slidev build` per deck into `dist/<name>` with `--base /<CI_PROJECT_NAME or "lectures">/<name>/ --without-notes`. This subpath base is broken by a **Slidev 52.16.0 regression**: in-deck navigation under any non-root base doubles the path (`…/<deck>/<deck>/2` → 404) in both `history` and `hash` routerMode. Cause: the client's `getSlidePath()` began prepending `import.meta.env.BASE_URL` while `createWebHistory(BASE_URL)` already adds it (base-relative `/${no}` up to 52.15.0, base-prefixed from 52.16.0). The fix lives in the consuming repo, not here — pin `@slidev/cli` to `52.15.0`. See the README "Subpath Hosting" section. `export-pdf-deck`/`export-pdfs` produce PDFs. `build-index` generates a landing `index.html` over all decks (branding from the `index` config section / CLI flags). `dev-deck` runs `slidev --remote` and auto-spawns `watch-notes` so `notes.md` stays current while editing.
- **Figures**: `render-dot` (Graphviz `.dot` → `.svg`) and `render-tikz` (LaTeX TikZ → image) scan every deck's `figures-src/` and write into the deck's `figures/`.
- **Changelogs**: `generate-changelogs.js` is a thin wrapper that shells into `src/scripts/generate-changelogs.sh`, passing all configuration via `LECTURE_TOOLKIT_*` env vars (decks dir, output dir, global reset file/date, and the path to the strip-presenter-notes script). The substantive logic lives in the bash script.

### Conventions

- Commands `throw` on error; the top-level runners in `bin/` and `src/index.js` catch, print the message, and `process.exit(1)`. Don't add ad-hoc `process.exit` inside command bodies — throw instead.
- Diagnostic/progress output goes to **stderr** (`console.error`), keeping stdout clean.
- `CI_PROJECT_NAME` (GitLab CI) sets the deploy base path for builds; defaults to `lectures` locally.
- Conventions, paths, and the `decks/` layout are a contract with consuming lecture repos — changing argument forms, output locations, or config keys is a breaking change for downstream repos and should be a `feat!:`/`BREAKING CHANGE:` commit.
