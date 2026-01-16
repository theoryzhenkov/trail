# Default Configuration

Trail ships with a sensible default configuration. This page documents exactly what's included out of the box.

---

## Default Relations

Trail includes four relations by default:

### up

| Setting | Value |
|---------|-------|
| **Name** | `up` |
| **Visual direction** | Ascending |
| **Aliases** | Property: `up`<br>Dot property: `relations.up`<br>Map: `up` |
| **Implied relations** | `down` (reverse) |

**Purpose:** Link to parent/container notes. Shows ancestry above the current note.

---

### down

| Setting | Value |
|---------|-------|
| **Name** | `down` |
| **Visual direction** | Descending |
| **Aliases** | Property: `down`<br>Dot property: `relations.down`<br>Map: `down` |
| **Implied relations** | `up` (reverse) |

**Purpose:** Link to child/contained notes. Shows descendants below the current note.

---

### next

| Setting | Value |
|---------|-------|
| **Name** | `next` |
| **Visual direction** | Sequential |
| **Aliases** | Property: `next`<br>Dot property: `relations.next`<br>Map: `next` |
| **Implied relations** | `prev` (reverse) |

**Purpose:** Link to the following note in a sequence. Creates flat, sorted lists.

---

### prev

| Setting | Value |
|---------|-------|
| **Name** | `prev` |
| **Visual direction** | Sequential |
| **Aliases** | Property: `prev`<br>Dot property: `relations.prev`<br>Map: `prev` |
| **Implied relations** | `next` (reverse) |

**Purpose:** Link to the preceding note in a sequence.

---

## Default Groups

Trail includes three groups by default:

### Ancestors

| Setting | Value |
|---------|-------|
| **Name** | Ancestors |
| **Members** | `up`, depth 0 |
| **Display properties** | (none) |
| **Filters** | (none) |
| **Show conditions** | (none) |
| **Sort by** | (none, alphabetical) |
| **Chain sort** | Primary |

**Purpose:** Show the full chain of parent notes, from direct parent to the root.

---

### Children

| Setting | Value |
|---------|-------|
| **Name** | Children |
| **Members** | `down`, depth 0 |
| **Display properties** | (none) |
| **Filters** | (none) |
| **Show conditions** | (none) |
| **Sort by** | (none, alphabetical) |
| **Chain sort** | Primary |

**Purpose:** Show all descendant notes, from direct children to the deepest level.

---

### Siblings

| Setting | Value |
|---------|-------|
| **Name** | Siblings |
| **Members** | `next`, depth 1<br>`prev`, depth 1 |
| **Display properties** | (none) |
| **Filters** | (none) |
| **Show conditions** | (none) |
| **Sort by** | (none, alphabetical) |
| **Chain sort** | Primary |

**Purpose:** Show immediately adjacent notes in a sequence. Limited to depth 1 for focus.

---

## Implied Relation Matrix

The default configuration creates a complete bidirectional graph:

| If you add... | Trail implies... |
|---------------|------------------|
| `A -up-> B` | `B -down-> A` |
| `A -down-> B` | `B -up-> A` |
| `A -next-> B` | `B -prev-> A` |
| `A -prev-> B` | `B -next-> A` |

This means you only need to link in one direction—Trail fills in the reverse.

---

## Syntax Support

All default relations support all syntax formats:

### Inline

```markdown
up::[[Parent]]
[[Child]]::down
next::[[Following]]
[[Previous]]::prev
```

### Frontmatter Property

```yaml
---
up: "[[Parent]]"
down: "[[Child]]"
next: "[[Following]]"
prev: "[[Previous]]"
---
```

### Frontmatter Dot Property

```yaml
---
relations.up: "[[Parent]]"
relations.down: "[[Child]]"
---
```

### Frontmatter Map

```yaml
---
relations:
  up: "[[Parent]]"
  down:
    - "[[Child 1]]"
    - "[[Child 2]]"
---
```

---

## When to Customize

### Keep Defaults If...

- You're just starting with Trail
- Your hierarchy is simple (parent/child structure)
- You use next/prev for sequences
- You don't need filtering or special sorting

### Customize If...

- You need domain-specific relation names (`parent`, `cites`, `blocks`)
- You want filtered views for different note types
- You need property-based sorting
- You want to show metadata badges
- You have complex multi-type hierarchies

---

## Resetting to Defaults

Trail doesn't have a "reset to defaults" button. To restore defaults:

1. Delete all existing relations
2. Delete all existing groups
3. Add new relations with default settings (see above)
4. Add new groups with default settings

Or, delete Trail's data file and restart:

1. Close Obsidian
2. Delete `<Vault>/.obsidian/plugins/trail/data.json`
3. Reopen Obsidian
4. Trail starts with fresh defaults

!!! warning
    This erases all your Trail settings. Back up `data.json` first if you might want to restore.
