# Syntax Overview

Trail supports multiple ways to define and configure relationships between notes:

- **Inline syntax**: Add relations directly in note content with `::` notation
- **Frontmatter syntax**: Define relations in YAML frontmatter
- **Query Language (TQL)**: Write powerful queries to configure groups

The first two define relations between notes. TQL configures how those relations are displayed in the Trail pane.

---

## At a Glance

### Relation Syntax

| Format | Example | Best For |
|--------|---------|----------|
| [Inline prefix](inline.md#prefix-syntax) | `up::[[Parent]]` | Quick, contextual links |
| [Inline suffix](inline.md#suffix-syntax) | `[[Child]]::down` | Reading naturally in sentences |
| [Frontmatter property](frontmatter.md#property-format) | `up: "[[Parent]]"` | Simple, single relations |
| [Frontmatter dot property](frontmatter.md#dot-property-format) | `relations.up: "[[Parent]]"` | Namespaced properties |
| [Frontmatter map](frontmatter.md#map-format) | `relations: { up: ... }` | Multiple relations, organized |

### Query Language

| Format | Example | Best For |
|--------|---------|----------|
| [TQL Query](query.md) | `from up where status = "active"` | Advanced group configuration |

---

## Choosing a Syntax

### Use Inline Syntax When...

- You want the relation visible in context
- The link naturally fits in your prose
- You're quickly adding a single relation
- You prefer keeping frontmatter minimal

```markdown
This note continues from up::[[Previous Chapter]] and leads to [[Next Chapter]]::down.
```

### Use Frontmatter Syntax When...

- You have many relations to define
- You want relations separate from content
- You're using templates
- You prefer structured metadata

```yaml
---
relations:
  up: "[[Projects]]"
  next:
    - "[[Part 2]]"
    - "[[Part 3]]"
---
```

---

## Link Formats

All syntax variants accept standard Obsidian link formats:

| Format | Example | Notes |
|--------|---------|-------|
| Wiki link | `[[Note Name]]` | Most common |
| Wiki link with alias | `[[Note Name\|Display Text]]` | Alias ignored for relations |
| Plain text | `Note Name` | Frontmatter only |

!!! tip "Consistency tip"
    In frontmatter, you can omit the brackets: `up: "Parent Note"` works the same as `up: "[[Parent Note]]"`. Trail normalizes both to the same target.

---

## Valid Relation Names

Relation names must follow these rules:

- **Characters**: Letters (a-z), numbers (0-9), underscores (`_`), and dashes (`-`)
- **Case**: Names are normalized to lowercase (`UP` becomes `up`)
- **No spaces**: Use dashes or underscores instead (`related-to`, `related_to`)

| Valid | Invalid |
|-------|---------|
| `up` | `UP` (normalized to `up`) |
| `parent-note` | `parent note` (has space) |
| `step_1` | `step 1` (has space) |
| `rel2` | `rel.2` (has period) |

---

## Next Steps

- [Inline syntax](inline.md) — Detailed guide to `::` syntax
- [Frontmatter syntax](frontmatter.md) — YAML formats and examples
- [Trail Query Language](query.md) — Powerful query language for group configuration