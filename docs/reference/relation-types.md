# Relation Types Reference

Complete reference for all relation settings and how they interact.

---

## Relation Settings

### Name

**Type:** String

**Constraints:**
- Lowercase letters, numbers, dashes, underscores only
- No spaces
- Must be unique

**Examples:** `up`, `parent`, `cites`, `related-to`, `step_1`

**Normalized:** Input is automatically lowercased. `UP` becomes `up`.

---

### Visual Direction

**Type:** Enum

**Options:**

| Value | Display Behavior | Tree Orientation |
|-------|------------------|------------------|
| `ascending` | Deepest items at root | Inverted tree |
| `descending` | Direct items at root | Normal tree |
| `sequential` | Flat sorted list | No nesting |

**Default:** `descending`

---

### Aliases

**Type:** Array of alias objects

Each alias maps a frontmatter format to this relation.

#### Alias Types

| Type | Format | Example Key | Matches |
|------|--------|-------------|---------|
| `property` | Direct property | `up` | `up: "[[Note]]"` |
| `dotProperty` | Namespaced | `relations.up` | `relations.up: "[[Note]]"` |
| `relationsMap` | In relations object | `up` | `relations: { up: ... }` |

**Multiple aliases:** A relation can have many aliases. Useful for supporting multiple property names or all three formats.

---

### Implied Relations

**Type:** Array of implied relation objects

Each implied relation creates automatic edges based on this relation's edges.

#### Implied Relation Settings

**Target Relation:** Which relation to create (must exist)

**Direction:**

| Value | From | To | Use Case |
|-------|------|-----|----------|
| `forward` | Source | Target | Aliases |
| `reverse` | Target | Source | Bidirectional links |
| `both` | Both directions | Both | Symmetric relations |

---

## Valid Relation Names

### Character Rules

| Allowed | Not Allowed |
|---------|-------------|
| `a-z` | Uppercase (normalized) |
| `0-9` | Spaces |
| `-` (dash) | Special characters |
| `_` (underscore) | Periods, colons, etc. |

### Examples

| Input | Result | Notes |
|-------|--------|-------|
| `up` | `up` | Valid |
| `UP` | `up` | Normalized |
| `Parent Note` | Invalid | Contains space |
| `parent-note` | `parent-note` | Valid |
| `parent_note` | `parent_note` | Valid |
| `parent.note` | Invalid | Contains period |
| `123` | `123` | Valid (numbers only) |

---

## Visual Direction Details

### Ascending

For relations that point "upward" in a hierarchy.

**Graph:**
```
Current → Parent → Grandparent
```

**Display:**
```
Grandparent
  └── Parent
       └── (current note implied)
```

Deepest ancestor at root, progressively closer items nested below.

**Use cases:** `up`, `parent`, `belongs-to`, `part-of`

---

### Descending

For relations that point "downward" in a hierarchy.

**Graph:**
```
Current → Child → Grandchild
```

**Display:**
```
Child
  └── Grandchild
```

Direct children at root, their children nested below.

**Use cases:** `down`, `child`, `contains`, `has`

---

### Sequential

For relations that form ordered sequences.

**Graph:**
```
Current → Next1 → Next2
Current → Prev1 → Prev2
```

**Display:**
```
Prev2
Prev1
Next1
Next2
```

Flat list, sorted by chain order or properties.

**Use cases:** `next`, `prev`, `follows`, `precedes`

---

## Alias Configuration

### Property Alias

Maps a top-level frontmatter property.

**Frontmatter:**
```yaml
---
up: "[[Parent]]"
---
```

**Configuration:**
- Type: `property`
- Key: `up`

---

### Dot Property Alias

Maps a namespaced frontmatter property.

**Frontmatter:**
```yaml
---
relations.up: "[[Parent]]"
---
```

**Configuration:**
- Type: `dotProperty`
- Key: `relations.up`

---

### Relations Map Alias

Maps a key within a `relations` object.

**Frontmatter:**
```yaml
---
relations:
  up: "[[Parent]]"
---
```

**Configuration:**
- Type: `relationsMap`
- Key: `up`

---

## Implied Relation Direction

### Forward

Same direction as source edge.

```
Source: A -up-> B
Rule:   up → parent (forward)
Result: A -parent-> B
```

**Use:** Creating aliases or synonyms.

---

### Reverse

Opposite direction from source edge.

```
Source: A -up-> B
Rule:   up → down (reverse)
Result: B -down-> A
```

**Use:** Bidirectional hierarchies.

---

### Both

Creates edges in both directions.

```
Source: A -related-> B
Rule:   related → related (both)
Result: A -related-> B (same as explicit)
        B -related-> A (new)
```

**Use:** Symmetric relationships like "related" or "sibling".

---

## Common Patterns

### Bidirectional Hierarchy

```
up (ascending)
  → down (reverse)

down (descending)
  → up (reverse)
```

### Citation Network

```
cites (descending)
  → cited-by (reverse)

cited-by (descending)
  (no implications - derived only)
```

### Symmetric Relation

```
related (descending)
  → related (reverse)
```

### Multi-Level Hierarchy

```
project (ascending)
  → epic (reverse)

epic (descending)
  → project (reverse)

task (descending)
  → subtask (reverse)

subtask (ascending)
  → task (reverse)
```

---

## Troubleshooting

### Relation Not Recognized

1. **Check aliases:** Does the relation have an alias matching your syntax?
2. **Check key:** Is the alias key exactly right (case-sensitive)?
3. **Check type:** Is the alias type correct for your frontmatter format?

### Implied Relation Missing

1. **Check source relation:** Does the source relation have the implied rule?
2. **Check target exists:** Is the target relation defined?
3. **Check direction:** Is forward/reverse/both correct for your use case?

### Wrong Visual Direction

1. **Check the relation:** Is visual direction set correctly?
2. **Ascending:** Deep items at root (for "up" relations)
3. **Descending:** Direct items at root (for "down" relations)
4. **Sequential:** Flat list (for "next/prev" relations)
