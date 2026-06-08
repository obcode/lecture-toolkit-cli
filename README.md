# lecture-toolkit-cli

Reusable CLI toolkit for Slidev-based lecture repositories.

## Install

```bash
pnpm add -D github:obcode/lecture-toolkit-cli#v0.1.0
```

via GitHub Packages (npm registry):

```bash
pnpm add -D @obcode/lecture-toolkit-cli
```

or run on demand:

```bash
pnpm dlx lecture-toolkit-cli --help
```

## Commands

```bash
lecture-toolkit export-notes <deck>
lecture-toolkit watch-notes <deck>
lecture-toolkit dev-deck <deck>
lecture-toolkit build-deck <deck>
lecture-toolkit build-all
lecture-toolkit build-index
lecture-toolkit export-pdf-deck <deck>
lecture-toolkit export-pdfs
lecture-toolkit render-dot
lecture-toolkit render-tikz
lecture-toolkit generate-changelogs
lecture-toolkit strip-presenter-notes <slides.md>
```

`dev-deck` starts `watch-notes` automatically so `notes.md` is generated and updated while developing slides.

## Repository Config

Create `lecture-toolkit.config.json` in your lecture repository root to customize shared behavior.

Example:

```json
{
	"index": {
		"eyebrow": "Vorlesungsfolien",
		"courseTitle": "Moderne Programmierkonzepte und Datenstrukturen",
		"subtitle": "Prof. Dr. Oliver Braun",
		"siteTitle": "Moderne Programmierkonzepte und Datenstrukturen - Prof. Dr. Oliver Braun",
		"locale": "de-DE",
		"timezone": "Europe/Berlin"
	},
	"changelog": {
		"globalResetDefault": "2026-05-18"
	}
}
```

`build-index` also supports CLI overrides such as:

```bash
pnpm exec lecture-toolkit build-index --course-title "Algorithms" --subtitle "Prof. Ada" --site-title "Algorithms - Prof. Ada"
```

`<deck>` supports:

- Prefix lookup like `09-DFS-BFS`
- `decks/<deck>`
- `decks/<deck>/slides.md`

The command must run inside a repository that contains a `decks/` directory.

## Keep Local Shell Wrappers

Existing local shell scripts can stay as thin wrappers, for example:

```bash
#!/usr/bin/env bash
set -e
pnpm exec lecture-toolkit dev-deck "$@"
```

## CI Example

```yaml
build-all:
	image: node:20
	script:
		- pnpm install --frozen-lockfile
		- pnpm exec lecture-toolkit build-all
```

## Subpath Hosting: pin Slidev to 52.15.0 (avoid 52.16.0)

`build-deck`/`build-all` build each deck with a subpath base of `--base /<CI_PROJECT_NAME or "lectures">/<deck>/`, required when serving from a subfolder such as `https://<group>.pages.example.com/lectures/<deck>/`.

**Slidev 52.16.0 has a regression that breaks in-deck navigation under any non-root base.** Stepping from slide 1 to 2 doubles the base path (e.g. `…/<deck>/1` → `…/<deck>/<deck>/2` → 404). The client's `getSlidePath()` started prepending `import.meta.env.BASE_URL` to the route, while the router history (`createWebHistory(BASE_URL)`) already adds it — so the base is applied twice. This affects both `history` and `hash` `routerMode`, so hash routing does **not** work around it. Reproduced and bisected: `getSlidePath` returns base-relative `/${no}` up to 52.15.0 and base-prefixed `${BASE_URL}${no}` from 52.16.0.

Fix in the consuming lecture repo's `package.json` — pin Slidev to the last good version:

```jsonc
"devDependencies": {
  "@slidev/cli": "52.15.0"   // NOT "^52.16.0" — the caret allows 52.16.0
}
```

then `pnpm install`. Default `history` routing then produces correct URLs (`…/<deck>/2`). Once a Slidev version > 52.16.0 ships with the fix, the pin can be relaxed.

## GitHub Release Automation

This repository is configured for Semantic Release via GitHub Actions.

- Workflow: `.github/workflows/release.yml`
- Config: `.releaserc.json`
- Trigger: push to `main`

The release workflow publishes:

- Git tag + GitHub Release
- npm package to GitHub Packages (`npm.pkg.github.com`)

Required repository secret:

- `GH_PACKAGES_TOKEN`: classic PAT (or fine-grained token) with `write:packages` (and `read:packages`) for owner `obcode`.

The workflow maps `NPM_TOKEN` and `NODE_AUTH_TOKEN` to `GH_PACKAGES_TOKEN` and also uses `GITHUB_TOKEN` for release/tag operations.

To consume the package from GitHub Packages, configure `.npmrc` in the consuming repo or user profile:

```ini
@obcode:registry=https://npm.pkg.github.com
//npm.pkg.github.com/:_authToken=${GITHUB_TOKEN}
```

Use Conventional Commits for release versioning, for example:

- `fix: ...` -> patch release
- `feat: ...` -> minor release
- `feat!: ...` or `BREAKING CHANGE:` -> major release

## Notes Export Format

`export-notes` writes:

- Header callout with export timestamp in `dd.mm.yy, HH:MM Uhr`
- Source and notes links in GitLab blob format
- Bear tag footer `#hm/lectures/<lecture>/notes`

`<lecture>` is derived from repository name prefix, for example `mpd-lectures` -> `mpd`.
