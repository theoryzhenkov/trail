# Filtering

Trail provides two types of property-based filtering: **Filters** control which files appear in a group, and **Show conditions** control when a group is visible at all.

---

## Filters

Filters limit which files appear in a group based on their frontmatter properties.

### Setting Up Filters

1. Open **Settings → Trail**
2. Expand the group you want to filter
3. In the **Filters** section, click **Add filter**
4. Configure the filter settings

### Filter Settings

#### Property Key

The frontmatter property to check. Case-insensitive.

**Examples:** `type`, `status`, `category`, `tags`

#### Operator

| Operator | Behavior |
|----------|----------|
| **Equals** | Property value exactly matches the filter value |
| **Contains** | Property value contains the filter value (for arrays/strings) |
| **Exists** | Property exists (any value, including empty) |
| **Not exists** | Property doesn't exist |

#### Value

The value to compare against. Required for Equals and Contains operators.

### Match Mode

When you have multiple filters, the match mode determines how they combine:

| Mode | Behavior |
|------|----------|
| **Match all** | File must pass ALL filters (AND logic) |
| **Match any** | File must pass AT LEAST ONE filter (OR logic) |

---

## Filter Examples

### Show Only Certain Note Types

**Filter:** Show only "person" type notes

| Property | Operator | Value |
|----------|----------|-------|
| `type` | Equals | `person` |

**In your notes:**

```yaml
---
type: person
name: Alice
---
```

Only notes with `type: person` appear in this group.

---

### Show Completed Tasks

**Filters:** Show completed tasks (Match all)

| Property | Operator | Value |
|----------|----------|-------|
| `type` | Equals | `task` |
| `status` | Equals | `done` |

Both conditions must be true.

---

### Show Any Active Item

**Filters:** Show active tasks OR in-progress projects (Match any)

| Property | Operator | Value |
|----------|----------|-------|
| `status` | Equals | `active` |
| `status` | Equals | `in-progress` |

Either condition being true includes the file.

---

### Exclude Archived Items

**Filter:** Hide archived notes

| Property | Operator | Value |
|----------|----------|-------|
| `archived` | Not exists | — |

Notes without an `archived` property pass. Add `archived: true` to any note to hide it from this group.

---

### Show Notes with Tags

**Filter:** Show notes tagged with "important"

| Property | Operator | Value |
|----------|----------|-------|
| `tags` | Contains | `important` |

Works with array properties:

```yaml
---
tags:
  - project
  - important
  - urgent
---
```

---

## Show Conditions

Show conditions control whether a group appears at all, based on the **active note's** properties (not the related notes).

### Use Case

Show a "Family Members" group only when viewing a person note. When viewing a project note, that group doesn't appear.

### Setting Up Show Conditions

1. Open **Settings → Trail**
2. Expand the group
3. In the **Show conditions** section, click **Add condition**
4. Configure like a regular filter

### How It Differs from Filters

| Feature | Filters | Show Conditions |
|---------|---------|-----------------|
| What it checks | Related notes | Active note |
| What it affects | Which items appear | Whether group is visible |
| When empty | Shows all items | Group always visible |

---

## Show Condition Examples

### Family Group for People

**Show conditions:** Only show when active note is a person

| Property | Operator | Value |
|----------|----------|-------|
| `type` | Equals | `person` |

When viewing a person note, the "Family" group appears. When viewing any other note type, it's hidden.

---

### Project Tasks for Projects

**Show conditions:** Show when active note is a project

| Property | Operator | Value |
|----------|----------|-------|
| `type` | Equals | `project` |

The "Tasks" group only appears when you're looking at a project note.

---

### Context-Aware Groups

You can create multiple groups with different show conditions:

**Group 1: "Ancestors"** (always visible)

- No show conditions

**Group 2: "Family Tree"** (people only)

- Show condition: `type` equals `person`

**Group 3: "Project Hierarchy"** (projects only)

- Show condition: `type` equals `project`

Each note type gets relevant groups without clutter from irrelevant ones.

---

## Combining Filters and Show Conditions

You can use both on the same group:

**Group: "Active Subtasks"**

**Show conditions:**

| Property | Operator | Value |
|----------|----------|-------|
| `type` | Equals | `task` |

**Filters:**

| Property | Operator | Value |
|----------|----------|-------|
| `status` | Equals | `active` |

This group:

1. Only appears when viewing a task note (show condition)
2. Only shows related notes that are active (filter)

---

## Property Value Types

Filters work with various frontmatter value types:

### Strings

```yaml
status: active
```

**Equals** `active` → matches

### Numbers

```yaml
priority: 1
```

**Equals** `1` → matches

### Booleans

```yaml
published: true
```

**Equals** `true` → matches

### Arrays

```yaml
tags:
  - important
  - work
```

**Contains** `important` → matches
**Equals** `important` → doesn't match (equals requires exact match)

---

## Best Practices

### Use Show Conditions for Note Types

If you have distinct note types (people, projects, papers), use show conditions to show relevant groups for each type.

### Use Filters for Status/State

Filter within groups to show only certain states (active, completed, archived).

### Keep Filter Logic Simple

Complex filter combinations can be hard to debug. If you need many filters, consider:

- Splitting into multiple groups
- Using a single property with clear values
- Simplifying your note schema

### Test Your Filters

After setting up filters:

1. Open a note that should match
2. Check the Trail pane
3. Open a note that shouldn't match
4. Verify it's excluded
