# Inline Syntax

Inline syntax lets you add relations directly in your note content using the `::` operator. Relations appear right where they're meaningful, making your notes more readable.

---

## Basic Syntax

### Prefix Syntax

Place the relation name *before* the link:

```markdown
up::[[Parent Note]]
```

This creates a relation from the **current file** to `Parent Note`.

### Suffix Syntax

Place the relation name *after* the link:

```markdown
[[Child Note]]::down
```

This creates a relation from `Child Note` to the **current file**.

!!! note "Direction Matters"
    Prefix and suffix create edges in opposite directions:
    
    - `next::[[B]]` → currentFile -next-> B
    - `[[A]]::next` → A -next-> currentFile

!!! tip "Spacing"
    Spaces around `::` are optional: `up::[[Note]]`, `up:: [[Note]]`, `up :: [[Note]]`

---

## External Edge Syntax

Declare relations between *other* notes from within a MoC or index note:

### Triple Syntax

```markdown
[[Source]]::relation::[[Target]]
```

Creates an edge from `Source` to `Target`, not involving the current file.

```markdown
# Project Index

[[Phase 1]]::next::[[Phase 2]]
[[Phase 2]]::next::[[Phase 3]]
```

### Fan-out (Multiple Targets)

Add multiple targets from the same source:

```markdown
[[Parent]]::down::[[Child A]]::[[Child B]]::[[Child C]]
```

Creates: Parent → Child A, Parent → Child B, Parent → Child C

### Chain Syntax

Use `::-::` to chain from the previous target:

```markdown
[[A]]::next::[[B]]::-::[[C]]::-::[[D]]
```

Creates: A → B, B → C, C → D

### Mixed Fan-out and Chain

Combine both patterns:

```markdown
[[A]]::next::[[B]]::[[C]]::-::[[D]]
```

Creates: A → B, A → C, C → D

---

## Context and Continuation

Patterns with a relation set **context** that persists across the file. Use `::[[Target]]` or `::-::[[Target]]` to continue from context.

### Fan-out Continuation

```markdown
[[Project]]::down

::[[Phase 1]]
::[[Phase 2]]
::[[Phase 3]]
```

All phases are children of Project.

### Chain Continuation

```markdown
[[Chapter 1]]::next::[[Chapter 2]]

Reading order continues:
::-::[[Chapter 3]]
::-::[[Chapter 4]]
```

Creates: Ch1 → Ch2 → Ch3 → Ch4

### Context Rules

1. Any pattern with a relation keyword sets new context
2. `::[[X]]` uses context source → X (fan-out)
3. `::-::[[X]]` uses context lastTarget → X (chain)
4. Context persists until a new relation keyword appears

```markdown
[[A]]::next         # Context: source=A, relation=next
::[[B]]             # A → B
::[[C]]             # A → C

[[X]]::prev         # New context: source=X, relation=prev
::[[Y]]             # X → Y
```

---

## When to Use Each

| Syntax | Use Case | Example |
|--------|----------|---------|
| Prefix `rel::[[A]]` | Declare from current file | `up::[[Parent]]` |
| Suffix `[[A]]::rel` | Declare to current file | `[[Child]]::down` |
| Triple `[[A]]::rel::[[B]]` | External edge in MoC | `[[Ch1]]::next::[[Ch2]]` |
| Fan-out `::[[B]]::[[C]]` | Multiple targets | `[[Parent]]::down::[[A]]::[[B]]` |
| Chain `::-::[[C]]` | Sequential relations | `[[A]]::next::[[B]]::-::[[C]]` |

---

## Relation Name Rules

Inline relations follow the same naming rules as all relations:

| Allowed | Not Allowed |
|---------|-------------|
| `up`, `down`, `next`, `prev` | Names with spaces |
| `parent-note`, `child_note` | Special characters (except `-` and `_`) |
| `step1`, `part2` | Names starting with `-` or `_` alone |

Names are automatically normalized to lowercase:

```markdown
UP::[[Note]]      → creates 'up' relation
Parent::[[Note]]  → creates 'parent' relation
```

---

## Limitations

### Link Aliases

The link target is extracted without aliases:

```markdown
up::[[Note Name|Display Text]]
```

Creates a relation to `Note Name`, not `Display Text`.

### Wiki Links Only

Inline syntax requires wiki-style links:

```markdown
up::[[Valid Link]]        ✓
up::[Invalid](markdown)   ✗
up::Plain Text            ✗
```

For plain text targets, use [frontmatter syntax](frontmatter.md) instead.

---

## Combining with Frontmatter

Inline and frontmatter relations work together:

```markdown
---
relations:
  up: "[[Main Category]]"
---

# My Note

up::[[Secondary Category]]

Content here...
```

Both relations are recognized. Trail combines them when building the graph.

---

## Complete Example

A Map of Contents note using all syntax features:

```markdown
# Project MoC

up::[[Projects]]

## Phases

[[Phase 1]]::next::[[Phase 2]]::-::[[Phase 3]]::-::[[Phase 4]]

## Team Structure

[[Team Lead]]::manages
::[[Developer A]]
::[[Developer B]]
::[[Designer]]

## Related

- [[Requirements Doc]]::related
- [[Design Spec]]::related
```
