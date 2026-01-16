# Inline Syntax

Inline syntax lets you add relations directly in your note content using the `::` operator. Relations appear right where they're meaningful, making your notes more readable.

---

## Prefix Syntax

Place the relation name *before* the link:

```markdown
up::[[Parent Note]]
```

This creates a relation of type `up` pointing to `Parent Note`.

### Examples

```markdown
# My Project Task

up::[[Project Overview]]

This task is part of the main project.

Related reading: up::[[Background Research]]
```

!!! tip "Spacing"
    Spaces around `::` are optional. These are equivalent:
    
    - `up::[[Note]]`
    - `up:: [[Note]]`
    - `up ::[[Note]]`
    - `up :: [[Note]]`

---

## Suffix Syntax

Place the relation name *after* the link:

```markdown
[[Child Note]]::down
```

This creates a relation of type `down` pointing to `Child Note`.

### Examples

```markdown
# Table of Contents

- [[Chapter 1]]::down
- [[Chapter 2]]::down
- [[Chapter 3]]::down
```

Suffix syntax reads naturally in prose:

```markdown
This continues in [[Part 2]]::next, which covers advanced topics.
```

---

## When to Use Each

| Syntax | Best For | Example |
|--------|----------|---------|
| Prefix | Standalone relation declarations | `up::[[Parent]]` at top of note |
| Suffix | Relations that flow in sentences | `See [[Related]]::related for more` |

Both create identical relations—the difference is purely stylistic.

---

## Multiple Relations

### To the Same Target

You cannot add multiple relation types to one link in a single statement. Use separate declarations:

```markdown
up::[[Reference Note]]
related::[[Reference Note]]
```

### From One Note

Add as many relations as you need throughout your note:

```markdown
# Research Paper

up::[[Research Project]]
up::[[Academic Papers]]

This paper builds on [[Prior Work]]::prior and contradicts [[Other Paper]]::contradicts.

## References

- [[Source A]]::source
- [[Source B]]::source
- [[Source C]]::source
```

---

## Relation Name Rules

Inline relations follow the same naming rules as all relations:

| Allowed | Not Allowed |
|---------|-------------|
| `up`, `down`, `next`, `prev` | Names with spaces |
| `parent-note`, `child_note` | Special characters (except `-` and `_`) |
| `step1`, `part2` | Starting with numbers |

Names are automatically normalized to lowercase:

```markdown
UP::[[Note]]      → creates 'up' relation
Parent::[[Note]]  → creates 'parent' relation
```

---

## Limitations

### One Relation Per Link

Each `::` declaration creates one relation. For multiple relation types to the same note, declare them separately.

### No Aliased Targets

The link target is extracted without aliases:

```markdown
up::[[Note Name|Display Text]]
```

Creates a relation to `Note Name`, not `Display Text`.

### Must Use Wiki Links

Inline syntax requires wiki-style links:

```markdown
up::[[Valid Link]]        ✓
up::[Invalid](markdown)   ✗
up::Plain Text            ✗
```

For plain text targets, use [frontmatter syntax](frontmatter.md) instead.

---

## Combining with Frontmatter

Inline and frontmatter relations work together. This note uses both:

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
