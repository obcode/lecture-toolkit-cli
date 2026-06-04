# lecture-toolkit-cli

Reusable CLI toolkit for Slidev-based lecture repositories.

## Install

```bash
pnpm add -D lecture-toolkit-cli
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
lecture-toolkit export-pdf-deck <deck>
lecture-toolkit export-pdfs
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

## npm Release Automation

This repository is configured for Semantic Release via GitHub Actions.

- Workflow: `.github/workflows/release.yml`
- Config: `.releaserc.json`
- Trigger: push to `main`

Required GitHub repository secrets:

- `NPM_TOKEN`: npm automation token with publish permission for `lecture-toolkit-cli`

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
