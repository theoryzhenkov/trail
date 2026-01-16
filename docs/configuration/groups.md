# Groups

Groups organize relations in the Trail pane. Instead of a flat list of all connections, you see organized sections like "Ancestors", "Children", and "Siblings"—each with its own configuration for what to show and how.

---

## Creating a Group

1. Open **Settings → Trail**
2. In the **Groups** section, click **Add group**
3. Configure the group settings

---

## Group Settings

### Name

The label displayed in the Trail pane. Choose something descriptive:

- "Ancestors"
- "Project Tasks"
- "References"
- "Related Notes"

---

### Members

Members define which relations appear in this group and how they're traversed.

Each member has three settings:

#### Relation

Which relation type to include. Select from your defined relations.

#### Depth

How many levels to traverse:

| Depth | Behavior |
|-------|----------|
| `0` | Unlimited—follow the chain as far as it goes |
| `1` | Direct connections only |
| `2` | Direct connections + one level deeper |
| `n` | Up to n levels |

**Example:** With `up` at depth 0, if your note links up to a parent, which links up to a grandparent, which links up to a great-grandparent—you see all of them.

With `up` at depth 1, you only see the direct parent.

#### Extend

Optionally continue traversal using another group's configuration.

**Use case:** The default "Siblings" group extends from "Ancestors":

1. First, find notes via `next` and `prev` (depth 1)
2. Then, for each sibling found, apply the "Ancestors" group's traversal

This lets you see siblings' context without redefining the traversal rules.

---

## Default Groups

Trail includes three groups out of the box:

### Ancestors

| Member | Depth |
|--------|-------|
| `up` | 0 (unlimited) |

Shows the full chain of parent notes above the current note.

### Children

| Member | Depth |
|--------|-------|
| `down` | 0 (unlimited) |

Shows all descendant notes below the current note.

### Siblings

| Member | Depth | Extend |
|--------|-------|--------|
| `next` | 1 | Ancestors |
| `prev` | 1 | Ancestors |

Shows notes linked via `next`/`prev`, then shows their ancestry for context.

---

## Multiple Members

Groups can include multiple relation types:

**Group: "Project Context"**

| Member | Depth |
|--------|-------|
| `project` | 0 |
| `milestone` | 1 |
| `related` | 1 |

This shows:

- All projects up the chain (unlimited)
- Direct milestone connections
- Direct related notes

All combined in one section.

---

## Visual Direction and Groups

The relations' visual direction affects how the group renders:

### Ascending Relations

For `up`-style relations (visual direction = ascending), Trail inverts the tree so the deepest ancestor appears at the root:

```
▼ Ancestors
  up  Great-Grandparent
    up  Grandparent
      up  Parent
```

### Descending Relations

For `down`-style relations (visual direction = descending), the tree shows direct connections at the root:

```
▼ Children
  down  Child A
    down  Grandchild A1
    down  Grandchild A2
  down  Child B
```

### Sequential Relations

For `next`/`prev` relations (visual direction = sequential), items appear in a flat sorted list:

```
▼ Siblings
  prev  Previous Note
  next  Next Note
```

---

## Managing Groups

### Reordering

Groups appear in the Trail pane in the order they're configured. Use the arrow buttons to reorder.

### Deleting

1. Expand the group section
2. Click **Delete group**

---

## Examples

### Academic Paper Hierarchy

**Group: "Paper Context"**

| Member | Depth |
|--------|-------|
| `field` | 0 |
| `topic` | 2 |

Shows the research field hierarchy and immediate topic context.

---

### Project Management

**Group: "Project Hierarchy"**

| Member | Depth |
|--------|-------|
| `project` | 0 |
| `epic` | 1 |

**Group: "Task Children"**

| Member | Depth |
|--------|-------|
| `subtask` | 0 |
| `blocks` | 1 |

Separate groups for looking up vs looking down.

---

### Daily Notes Sequence

**Group: "Timeline"**

| Member | Depth |
|--------|-------|
| `next` | 3 |
| `prev` | 3 |

Shows three days forward and back, not the entire timeline.

---

## Best Practices

### One Purpose Per Group

Each group should answer one question:

- "What contains this note?" → Ancestors
- "What does this note contain?" → Children
- "What's related to this note?" → Related

Don't cram everything into one group.

### Use Depth Limits

Unlimited depth (0) is useful for hierarchies, but can be overwhelming for other relations. Start with depth 1-2 and increase if needed.

### Order Groups by Importance

Put the most useful groups first. You'll see them without scrolling.

### Use Extend Sparingly

Extend is powerful but can create complex traversals. Make sure you understand what it does before using it.
