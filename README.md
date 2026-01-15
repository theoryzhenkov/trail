# Trail

Trail is an Obsidian plugin for adding named relations between notes and traversing them through a dedicated pane.

## Features

- Inline typed relations using a concise `::` syntax.
- Frontmatter relations via `relations` map and `relations.<type>` properties.
- Implied relations with forward/reverse/both direction rules.
- Hierarchy view to browse all ancestors of the active note.

## Inline syntax

Single relation per link, prefix or suffix:

- `up::[[Parent]]`
- `[[Child]]::down`

## Frontmatter relations

Map format:

```yaml
relations:
  up: "[[Parent]]"
  down:
    - "Child A"
    - "[[Child B]]"
```

Dot property format:

```yaml
relations.up: "[[Parent]]"
```

## Implied relations

In **Settings → Trail**, add implied relation rules:

- Base relation
- Implied relation
- Direction: `forward`, `reverse`, or `both`

Examples:

- `up -> parent (forward)` makes `A -up-> B` imply `A -parent-> B`
- `up -> parent (reverse)` makes `A -up-> B` imply `B -parent-> A`

## Using the Trail pane

- Open with the **Open Trail pane** command.
- Select which relation types to include.
- Browse the full ancestor chain of the active note.

## Development

```bash
npm install
npm run dev
```

## Manual install

Copy `main.js`, `styles.css`, `manifest.json` to:

```
<Vault>/.obsidian/plugins/<plugin-id>/
```
