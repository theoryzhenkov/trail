# Family Tree

Track family relationships with parent/child relations. This example shows how to set up biographical notes with automatic bidirectional linking.

---

## Goal

Create a family tree where:

- Each person note links to their parents
- Children are automatically shown (via implied relations)
- Display birth year and gender as badges

---

## Configuration

### Relations

**Relation: `parent`**

| Setting | Value |
|---------|-------|
| Name | `parent` |
| Visual direction | Ascending |
| Aliases | Property: `parent` |
| Implied | `child` (reverse) |

**Relation: `child`**

| Setting | Value |
|---------|-------|
| Name | `child` |
| Visual direction | Descending |
| Aliases | Property: `child` |
| Implied | `parent` (reverse) |

### Groups

**Group: "Parents"**

| Setting | Value |
|---------|-------|
| Name | Parents |
| Members | `parent`, depth 0 |
| Display properties | `birth`, `gender` |

**Group: "Children"**

| Setting | Value |
|---------|-------|
| Name | Children |
| Members | `child`, depth 0 |
| Display properties | `birth`, `gender` |

---

## Sample Notes

### Alice Smith.md

```markdown
---
type: person
birth: 1960
gender: F
parent:
  - "[[Robert Smith]]"
  - "[[Mary Johnson]]"
---

# Alice Smith

Alice is a software engineer.

## Biography

Born in 1960 to Robert Smith and Mary Johnson.
```

### Bob Wilson.md

```markdown
---
type: person
birth: 1958
gender: M
parent:
  - "[[James Wilson]]"
  - "[[Susan Brown]]"
---

# Bob Wilson

Bob is a teacher.
```

### Carol Smith.md

```markdown
---
type: person
birth: 1985
gender: F
parent:
  - "[[Alice Smith]]"
  - "[[Bob Wilson]]"
---

# Carol Smith

Carol is a doctor.

## Family

Daughter of Alice Smith and Bob Wilson.
```

---

## How It Works

### From Carol's Perspective

When viewing Carol Smith, the Trail pane shows:

```
▼ Parents
  parent  Alice Smith      [1960] [F]
    parent  Robert Smith   [1935] [M]
    parent  Mary Johnson   [1938] [F]
  parent  Bob Wilson       [1958] [M]
    parent  James Wilson   [1930] [M]
    parent  Susan Brown    [1932] [F]

▼ Children
  (no children yet)
```

Carol sees her full ancestry—parents, grandparents, and so on.

### From Alice's Perspective

When viewing Alice Smith:

```
▼ Parents
  parent  Robert Smith     [1935] [M]
  parent  Mary Johnson     [1938] [F]

▼ Children
  child  Carol Smith       [1985] [F]
```

Alice sees her parents above and Carol as her child below. The `child` relation is **implied**—you never added it to Alice's note, but Trail inferred it from Carol's `parent` link.

---

## Adding Spouse Relations

Extend the family tree with spouse relationships:

### Additional Relation

**Relation: `spouse`**

| Setting | Value |
|---------|-------|
| Name | `spouse` |
| Visual direction | Sequential |
| Aliases | Property: `spouse` |
| Implied | `spouse` (reverse) |

### Additional Group

**Group: "Spouse"**

| Setting | Value |
|---------|-------|
| Name | Spouse |
| Members | `spouse`, depth 1 |
| Display properties | `birth`, `gender` |

### Updated Note

```markdown
---
type: person
birth: 1960
gender: F
spouse: "[[Bob Wilson]]"
parent:
  - "[[Robert Smith]]"
  - "[[Mary Johnson]]"
---

# Alice Smith
```

Now Alice shows Bob as spouse, and Bob shows Alice (implied reverse).

---

## Filtering by Gender

Show different views for different people:

### "Brothers & Sisters" Group

| Setting | Value |
|---------|-------|
| Name | Siblings |
| Members | `sibling`, depth 1 |
| Filters | (none) |

### Alternative: Separate Groups by Gender

**Group: "Brothers"**

| Setting | Value |
|---------|-------|
| Filters | `gender` equals `M` |

**Group: "Sisters"**

| Setting | Value |
|---------|-------|
| Filters | `gender` equals `F` |

---

## Tips

### Consistency

Use consistent property values:

| Property | Consistent Values |
|----------|-------------------|
| `gender` | `M`, `F` (not "Male", "female", etc.) |
| `birth` | YYYY format (1960, not "1960" or "Jan 1960") |

### Orphan Detection

Notes without `parent` relations are "orphans" in your tree. Use a filter group to find them:

**Group: "Unconnected"**

| Setting | Value |
|---------|-------|
| Filters | `parent` not exists |

### Large Trees

For large family trees, consider:

- Limiting depth (e.g., depth 2 for grandparents only)
- Using show conditions to only show family groups on person notes
- Splitting into separate groups for maternal/paternal lines

---

## Complete Configuration

Copy this to get started quickly:

**Relations:**

1. `parent` (ascending) → implied: `child` (reverse)
2. `child` (descending) → implied: `parent` (reverse)
3. `spouse` (sequential) → implied: `spouse` (reverse)

**Groups:**

1. Parents: `parent` depth 0, display: `birth, gender`
2. Children: `child` depth 0, display: `birth, gender`
3. Spouse: `spouse` depth 1, display: `birth, gender`
