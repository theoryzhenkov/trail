# Display Properties

Display properties let you show frontmatter values as badges next to file names in the Trail pane. See important metadata at a glance without opening each note.

---

## Setting Up Display Properties

1. Open **Settings → Trail**
2. Expand the group where you want to show properties
3. Find the **Display properties** field
4. Enter property names, comma-separated

**Example:** `status, priority, due`

---

## How It Looks

With display properties configured, the Trail pane shows:

```
▼ Children
  down  Task A      [active] [high]
  down  Task B      [done]
  down  Task C      [active] [low] [2024-03-15]
```

Each property value appears as a small badge after the file name.

---

## Property Display

### What's Shown

The property's value is displayed directly:

| Property Value | Badge |
|----------------|-------|
| `status: active` | `[active]` |
| `priority: 1` | `[1]` |
| `due: 2024-03-15` | `[2024-03-15]` |

### Missing Properties

If a note doesn't have a configured property, no badge appears for that property. This is normal—not every note needs every property.

### Array Properties

For array properties, only the first value is shown:

```yaml
tags:
  - important
  - work
  - urgent
```

With `tags` as a display property → `[important]`

---

## Choosing Display Properties

### Good Candidates

Properties that help you quickly identify or prioritize notes:

| Property | Use Case |
|----------|----------|
| `status` | See task states at a glance |
| `priority` | Identify high-priority items |
| `type` | Distinguish note categories |
| `due` | Spot upcoming deadlines |
| `author` | Attribution in references |
| `year` | Chronological context |

### Less Useful

Properties that don't add quick-scan value:

| Property | Why It's Less Useful |
|----------|----------------------|
| `title` | Already shown as file name |
| `description` | Too long for a badge |
| `content` | Not meant for badges |
| `relations` | Internal, not metadata |

---

## Examples

### Task Management

**Group:** "Project Tasks"
**Display properties:** `status, priority`

```
▼ Project Tasks
  down  Fix login bug     [active] [high]
  down  Update docs       [active] [low]
  down  Add tests         [done]
  down  Review PR         [pending]
```

---

### Academic Papers

**Group:** "Citations"
**Display properties:** `year, author`

```
▼ Citations
  cites  Machine Learning Overview  [2023] [Smith]
  cites  Neural Networks Study      [2022] [Jones]
  cites  AI Ethics Paper            [2024] [Lee]
```

---

### Family Tree

**Group:** "Family"
**Display properties:** `birth, gender`

```
▼ Family
  parent  Alice Smith    [1960] [F]
  parent  Bob Smith      [1958] [M]
  child   Carol Smith    [1985] [F]
```

---

### Project Hierarchy

**Group:** "Milestones"
**Display properties:** `due, status`

```
▼ Milestones
  milestone  Phase 1    [2024-Q1] [done]
  milestone  Phase 2    [2024-Q2] [active]
  milestone  Phase 3    [2024-Q3] [planned]
```

---

## Different Properties Per Group

Each group has its own display properties setting. This lets you show relevant metadata for different contexts:

**Group: "Ancestors"**
Display properties: `type`

**Group: "Children"**
Display properties: `status, priority`

**Group: "Siblings"**
Display properties: `order`

---

## Formatting Considerations

### Keep Values Short

Long property values become unwieldy badges:

| Value | Badge Appearance |
|-------|------------------|
| `active` | `[active]` ✓ Good |
| `This is a very long status description` | `[This is a very long...]` ✗ Too long |

Use concise values for properties you'll display.

### Use Consistent Value Formats

Inconsistent values make badges less useful:

| Inconsistent | Consistent |
|--------------|------------|
| `done`, `Done`, `DONE`, `completed` | `done`, `done`, `done`, `done` |
| `high`, `HIGH`, `1`, `urgent` | `high`, `high`, `high`, `high` |

Standardize your property values across notes.

### Order Matters

Properties appear in the order you list them:

- `status, priority` → `[active] [high]`
- `priority, status` → `[high] [active]`

Put the most important property first.

---

## Performance Note

Display properties require reading each file's frontmatter. For groups with many items, this is fast but not instant. Keep display properties focused on what you actually need to see.

---

## Best Practices

1. **Start minimal**: Begin with one or two properties and add more only if needed
2. **Match context**: Different groups often benefit from different properties
3. **Use short values**: Design your property values to display well as badges
4. **Be consistent**: Standardize values across your vault
