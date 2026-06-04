#!/bin/bash
# Generiert pro Deck ein Changelog-HTML und aktualisiert .last-change-Metadaten.

set -e

DECKS_DIR="${LECTURE_TOOLKIT_DECKS_DIR:-decks}"
GLOBAL_RESET_FILE="${LECTURE_TOOLKIT_GLOBAL_RESET_FILE:-$DECKS_DIR/.changelog-reset}"
GLOBAL_RESET_DEFAULT="${LECTURE_TOOLKIT_GLOBAL_RESET_DEFAULT:-2026-05-18}"
OUTPUT_DIR="${LECTURE_TOOLKIT_OUTPUT_DIR:-dist/changelogs}"
STRIP_NOTES_SCRIPT="${LECTURE_TOOLKIT_STRIP_SCRIPT:?LECTURE_TOOLKIT_STRIP_SCRIPT is required}"

# Globale Konfiguration: Standard-Reset-Datum aus Datei, falls vorhanden
GLOBAL_RESET_DATE=$(cat "$GLOBAL_RESET_FILE" 2>/dev/null || printf '%s' "$GLOBAL_RESET_DEFAULT")

mkdir -p "$OUTPUT_DIR"

TMP_ROOT="$(mktemp -d)"
cleanup() {
  rm -rf "$TMP_ROOT"
}
trap cleanup EXIT

escape_html() {
  sed 's/&/\&amp;/g; s/</\&lt;/g; s/>/\&gt;/g'
}

extract_frontmatter_title() {
  awk '
    NR == 1 && $0 == "---" { in_frontmatter = 1; next }
    in_frontmatter && $0 == "---" { exit }
    in_frontmatter && $0 ~ /^[[:space:]]*title:[[:space:]]*/ {
      line = $0
      sub(/^[[:space:]]*title:[[:space:]]*/, "", line)
      gsub(/^"|"$/, "", line)
      gsub(/^\x27|\x27$/, "", line)
      print line
      exit
    }
  ' "$1"
}

format_display_datetime() {
  TZ=Europe/Berlin date -d "$1" '+%d.%m.%y, %H:%M Uhr'
}

normalize_reset_datetime() {
  case "$1" in
    ????-??-??) printf '%s 00:00:00' "$1" ;;
    *) printf '%s' "$1" ;;
  esac
}

max_datetime() {
  local first="$1"
  local second="$2"
  local first_ts
  local second_ts

  first_ts=$(date -d "$first" +%s 2>/dev/null || echo 0)
  second_ts=$(date -d "$second" +%s 2>/dev/null || echo 0)

  if [ "$first_ts" -ge "$second_ts" ]; then
    printf '%s' "$first"
  else
    printf '%s' "$second"
  fi
}

strip_presenter_notes_to_file() {
  local input_file="$1"
  local output_file="$2"
  node "$STRIP_NOTES_SCRIPT" "$input_file" > "$output_file"
}

write_sanitized_revision() {
  local revision="$1"
  local output_file="$2"

  if [ -z "$revision" ]; then
    : > "$output_file"
    return 0
  fi

  local raw_file="$output_file.raw"
  git show "$revision" > "$raw_file"
  strip_presenter_notes_to_file "$raw_file" "$output_file"
  rm -f "$raw_file"
}

visible_diff_exists() {
  local old_file="$1"
  local new_file="$2"

  if git diff --no-index --quiet -- "$old_file" "$new_file"; then
    return 1
  fi

  return 0
}

build_visible_patch() {
  local old_file="$1"
  local new_file="$2"
  git diff --no-index --no-prefix -- "$old_file" "$new_file" 2>/dev/null \
    | sed "1s|.*|diff --git slides.before.md slides.after.md|; 3s|.*|--- slides.before.md|; 4s|.*|+++ slides.after.md|" \
    || true
}

commit_parent_revision() {
  local hash="$1"
  if git rev-parse "$hash^" >/dev/null 2>&1; then
    printf '%s^:%s' "$hash" "$slides_file"
  else
    printf ''
  fi
}

commit_visible_change() {
  local hash="$1"
  local deck_tmp_dir="$2"
  local current_file="$deck_tmp_dir/$hash.current.md"
  local parent_file="$deck_tmp_dir/$hash.parent.md"
  local current_revision="$hash:$slides_file"
  local parent_revision
  parent_revision=$(commit_parent_revision "$hash")

  write_sanitized_revision "$current_revision" "$current_file"
  write_sanitized_revision "$parent_revision" "$parent_file"

  if visible_diff_exists "$parent_file" "$current_file"; then
    return 0
  fi

  return 1
}

# Hilfsfunktion: Änderungsdatum und Changelog generieren
generate_changelog() {
  local deck_dir="$1"
  local deck_name
  deck_name=$(basename "$deck_dir")
  local slides_file="${deck_dir%/}/slides.md"
  local deck_title_raw
  deck_title_raw=$(extract_frontmatter_title "$slides_file")
  local deck_title="${deck_title_raw:-$deck_name}"
  local deck_title_html
  deck_title_html=$(printf '%s' "$deck_title" | escape_html)
  local reset_file="$deck_dir/.changelog-reset"
  local global_reset_since
  global_reset_since=$(normalize_reset_datetime "$GLOBAL_RESET_DATE")
  local deck_reset_raw="$GLOBAL_RESET_DATE"
  [ -f "$reset_file" ] && deck_reset_raw=$(cat "$reset_file")
  local deck_reset_since
  deck_reset_since=$(normalize_reset_datetime "$deck_reset_raw")
  local reset_since
  reset_since=$(max_datetime "$global_reset_since" "$deck_reset_since")
  local reset_date_display
  reset_date_display=$(format_display_datetime "$reset_since")
  local changelog_file="$OUTPUT_DIR/$deck_name.html"
  local deck_tmp_dir="$TMP_ROOT/$deck_name"
  mkdir -p "$deck_tmp_dir"

  local raw_commits
  raw_commits=$(TZ=Europe/Berlin git log --no-merges --since="$reset_since" --pretty=format:'%H|%cI|%cd|%s' --date=format-local:'%d.%m.%y, %H:%M Uhr' -- "$slides_file")

  local visible_commits=""
  local last_change=""

  while IFS='|' read -r hash iso_date display_date subject; do
    [ -z "$hash" ] && continue

    if ! git diff-tree --root --no-commit-id --name-only -r "$hash" -- "$slides_file" | grep -q .; then
      continue
    fi

    if ! commit_visible_change "$hash" "$deck_tmp_dir"; then
      continue
    fi

    if [ -z "$last_change" ]; then
      last_change="$iso_date"
    fi

    visible_commits+="$hash|$display_date|$subject"$'\n'
  done <<< "$raw_commits"

  if [ -n "$last_change" ]; then

    # HTML-Seite schreiben
    cat > "$changelog_file" <<EOF
<!DOCTYPE html>
<html lang="de">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>Changelog für $deck_title_html</title>
  <style>
    :root {
      --bg: #f3f4f6;
      --panel: rgba(255, 255, 255, 0.88);
      --border: #e5e7eb;
      --text: #111827;
      --muted: #6b7280;
      --accent: #2563eb;
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
      padding: 1.5rem 1.5rem 1.25rem;
      box-shadow: 0 18px 40px rgba(17, 24, 39, 0.08);
      margin-bottom: 1.5rem;
    }

    .eyebrow {
      margin: 0 0 0.5rem;
      color: var(--accent);
      font-size: 0.85rem;
      font-weight: 700;
      text-transform: uppercase;
      letter-spacing: 0.08em;
    }

    h1 {
      margin: 0;
      font-size: clamp(1.9rem, 3vw, 2.6rem);
      line-height: 1.05;
    }

    .subtitle {
      margin: 0.5rem 0 0;
      color: var(--muted);
      font-size: 1rem;
    }

    .hero-actions {
      margin-top: 1rem;
    }

    .back-link {
      display: inline-flex;
      align-items: center;
      gap: 0.35rem;
      color: var(--accent);
      text-decoration: none;
      border: 1px solid rgba(37, 99, 235, 0.20);
      background: rgba(255, 255, 255, 0.85);
      padding: 0.35rem 0.75rem;
      border-radius: 999px;
      font-size: 0.9rem;
      font-weight: 600;
    }

    .back-link:hover {
      background: rgba(239, 246, 255, 0.95);
    }

    .timeline {
      display: grid;
      gap: 1rem;
      min-width: 0;
    }

    .commit {
      background: var(--panel);
      backdrop-filter: blur(10px);
      border: 1px solid var(--border);
      border-radius: 1rem;
      padding: 1rem 1rem 1.15rem;
      box-shadow: 0 10px 24px rgba(17, 24, 39, 0.05);
      min-width: 0;
      max-width: 100%;
      overflow: hidden;
    }

    .commit.no-diff {
      padding-bottom: 1rem;
    }

    .commit-header {
      display: flex;
      justify-content: space-between;
      align-items: baseline;
      gap: 1rem;
      margin-bottom: 0.75rem;
      flex-wrap: wrap;
    }

    .commit.no-diff .commit-header {
      margin-bottom: 0;
      align-items: center;
    }

    .commit-date {
      color: var(--muted);
      font-weight: 700;
      white-space: nowrap;
    }

    .commit-message {
      color: var(--text);
      font-size: 1.05rem;
      font-weight: 650;
      margin: 0;
    }

    pre.diff {
      margin: 0;
      display: block;
      width: 100%;
      max-width: 100%;
      background: #fcfcfd;
      border: 1px solid var(--border);
      border-radius: 0.85rem;
      padding: 0.9rem 1rem;
      overflow-x: auto;
      overflow-y: hidden;
      font-size: 0.84rem;
      line-height: 1.25;
      white-space: normal;
      font-family: ui-monospace, SFMono-Regular, Menlo, Consolas, monospace;
    }
    .diff-line { display: block; white-space: pre; }
    .diff-line code { padding: 0; border-radius: 0; background: transparent; }
    .diff-add code { color: #15803d; }
    .diff-del code { color: #b91c1c; }
    .diff-meta code { color: #6b7280; }
    .diff-hunk code { color: #374151; font-weight: 600; }

  </style>
</head>
<body>
  <div class="page">
    <section class="hero">
      <p class="eyebrow">Changelog</p>
      <h1>Changelog für $deck_title_html</h1>
      <p class="subtitle">Änderungen seit $reset_date_display</p>
      <div class="hero-actions">
        <a class="back-link" href="../">Zurück zur Startseite</a>
      </div>
    </section>
    <section class="timeline">
EOF

    while IFS='|' read -r hash date subject; do
      [ -z "$hash" ] && continue

      local no_diff=0
      if printf '%s' "$subject" | grep -qi '\[changelog:no-diff\]'; then
        no_diff=1
      fi

      local clean_subject
      clean_subject=$(printf '%s' "$subject" | sed 's/\[changelog:no-diff\]//Ig; s/^[[:space:]]*//; s/[[:space:]]*$//')
      [ -z "$clean_subject" ] && clean_subject="Änderung ohne Diff"

      local clean_subject_html
      clean_subject_html=$(printf '%s' "$clean_subject" | escape_html)

      local commit_class="commit"
      [ "$no_diff" -eq 1 ] && commit_class="commit no-diff"

      local commit_patch=""
      if [ "$no_diff" -eq 0 ]; then
        local current_file="$deck_tmp_dir/$hash.current.md"
        local parent_file="$deck_tmp_dir/$hash.parent.md"
        commit_patch=$(build_visible_patch "$parent_file" "$current_file")
        [ -z "$commit_patch" ] && continue
      fi

      {
        cat <<EOF
  <article class="$commit_class">
    <div class="commit-header">
      <div class="commit-message">$clean_subject_html</div>
      <div class="commit-date">$date</div>
    </div>
EOF

        if [ "$no_diff" -eq 0 ]; then
          cat <<EOF
    <pre class="diff">
EOF

          while IFS= read -r diff_line; do
            local diff_class="diff-meta"
            case "$diff_line" in
              +++*|---*) diff_class="diff-meta" ;;
              @@*) diff_class="diff-hunk" ;;
              +*) diff_class="diff-add" ;;
              -*) diff_class="diff-del" ;;
            esac

            local escaped_diff_line
            escaped_diff_line=$(printf '%s' "$diff_line" | escape_html)
            printf '      <span class="diff-line %s"><code>%s</code></span>\n' "$diff_class" "$escaped_diff_line"
          done <<< "$commit_patch"

          cat <<EOF
      </pre>
EOF
        fi

        cat <<EOF
  </article>
EOF
      } >> "$changelog_file"
    done <<< "$visible_commits"

    cat >> "$changelog_file" <<EOF
    </section>
  </div>
</body>
</html>
EOF
  fi

  # Änderungsinfo-Datei für build-index.sh erzeugen
  local info_file="$OUTPUT_DIR/$deck_name.last-change"
  if [ -n "$last_change" ]; then
    echo "$last_change|$deck_name.html" > "$info_file"
  else
    rm -f "$changelog_file"
    local stand_change
    stand_change=""
    local previous_commits
    previous_commits=$(TZ=Europe/Berlin git log --no-merges --before="$reset_since" --pretty=format:'%H|%cI' -- "$slides_file")

    while IFS='|' read -r hash iso_date; do
      [ -z "$hash" ] && continue
      if ! commit_visible_change "$hash" "$deck_tmp_dir"; then
        continue
      fi
      stand_change="$iso_date"
      break
    done <<< "$previous_commits"

    if [ -n "$stand_change" ]; then
      echo "$stand_change|" > "$info_file"
    else
      rm -f "$info_file"
    fi
  fi
  # Rückgabe: letztes Änderungsdatum (leer, falls keine Änderung)
  echo "$last_change"
}

# Für jedes Deck Changelog generieren
for deck in "$DECKS_DIR"/*/; do
  generate_changelog "$deck"
done

# Nach dem Erzeugen aller Changelogs Debug-Ausgabe
echo "[DEBUG] Inhalt von $OUTPUT_DIR:"
ls -lR "$OUTPUT_DIR"
echo "[DEBUG] Inhalt der .last-change-Dateien falls vorhanden:"
cat "$OUTPUT_DIR"/*.last-change 2>/dev/null || true

exit 0
