# Relations

Relations are the foundation of Trail. Each relation type represents a specific kind of connection between notes—like `parent`, `child`, `references`, or any semantic link that makes sense for your content.

---

## Creating a Relation

1. Open **Settings → Trail**
2. In the **Relations** section, click **Add relation**
3. Configure the relation settings

---

## Relation Settings

### Name

The unique identifier for this relation type.

**Requirements:**

- Lowercase letters, numbers, dashes, and underscores only
- No spaces
- Must be unique across all relations

**Examples:** `up`, `parent`, `cites`, `related-to`, `step_1`

!!! warning "Names are permanent"
    Once you start using a relation name in your notes, changing it requires updating all those notes. Choose meaningful names from the start.

---

### Visual Direction

Controls how related notes are displayed in the Trail pane.

| Direction | Description | Use Case |
|-----------|-------------|----------|
| **Descending** | Children appear below, indented | Parent → child hierarchies |
| **Ascending** | Ancestors appear above, with deepest first | Child → parent lookups |
| **Sequential** | Flat list, sorted | Next/prev sequences |

**Example:** With `up` set to **Ascending**, the Trail pane shows:

```
▼ Ancestors
  up  Grandparent
    up  Parent
```

The deepest ancestor appears at the root, with closer ancestors nested below.

With `down` set to **Descending**:

```
▼ Children
  down  Child A
    down  Grandchild A1
  down  Child B
```

Direct children appear at the root, their children nested below.

---

### Aliases

Aliases map frontmatter properties to this relation. Trail supports three alias types:

#### Property Alias

Direct frontmatter property:

```yaml
---
up: "[[Parent]]"
---
```

**Configuration:** Type = Property, Key = `up`

#### Dot Property Alias

Namespaced under `relations.`:

```yaml
---
relations.up: "[[Parent]]"
---
```

**Configuration:** Type = Dot property, Key = `relations.up`

#### Relations Map Alias

Key within a `relations` object:

```yaml
---
relations:
  up: "[[Parent]]"
---
```

**Configuration:** Type = Map, Key = `up`

---

### Adding Multiple Aliases

One relation can have many aliases. This lets you use different property names:

**Relation:** `parent`

**Aliases:**

- Property: `parent`
- Property: `up`
- Dot property: `relations.parent`
- Map: `parent`

Now all of these create `parent` relations:

```yaml
---
parent: "[[Mom]]"
up: "[[Dad]]"
relations.parent: "[[Guardian]]"
relations:
  parent: "[[Stepparent]]"
---
```

---

## Managing Relations

### Reordering

Use the arrow buttons in each relation's header to change order. Order affects:

- Display order in the filter menu
- Default order when relation names are equal

### Deleting

1. Expand the relation section
2. Click **Delete relation**

!!! danger "Cascading effects"
    Deleting a relation also removes:
    
    - All implied relations targeting this relation
    - All group members using this relation

---

## Default Relations

Trail ships with four relations preconfigured:

| Name | Visual Direction | Implied | Purpose |
|------|------------------|---------|---------|
| `up` | Ascending | → `down` (reverse) | Links to parent/container |
| `down` | Descending | → `up` (reverse) | Links to children/contents |
| `next` | Sequential | → `prev` (reverse) | Links to next in sequence |
| `prev` | Sequential | → `next` (reverse) | Links to previous in sequence |

Each includes all three alias types by default.

---

## Examples

### Hierarchy Relations

```
parent (ascending)
  └── Alias: parent, up, relations.parent

child (descending)
  └── Alias: child, down, contains
```

### Citation Relations

```
cites (descending)
  └── Alias: cites, references, sources
  └── Implied: cited-by (reverse)

cited-by (descending)
  └── Alias: cited-by
```

### Project Relations

```
project (ascending)
  └── Alias: project, belongs-to
  └── Implied: task (reverse)

task (descending)
  └── Alias: task, contains
```

---

## Best Practices

### Use Semantic Names

Choose names that describe the relationship:

| Generic | Semantic |
|---------|----------|
| `link1` | `parent` |
| `ref` | `cites` |
| `rel` | `precedes` |

### Plan Your Schema

Before creating relations, sketch out:

1. What types of notes do you have?
2. How do they relate to each other?
3. Which relationships should be bidirectional?

### Keep It Minimal

Start with few relations. Add more only when you have a clear need. Too many relation types create confusion.
