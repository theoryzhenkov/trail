# Project Hierarchy

Organize projects with epics, tasks, and subtasks. This example shows filtering by status, sorting by priority, and context-aware groups.

---

## Goal

Create a project management system where:

- Projects contain epics, epics contain tasks, tasks contain subtasks
- Filter out completed items
- Sort by priority and due date
- Show different groups based on note type

---

## Configuration

### Relations

**Relation: `project`**

| Setting | Value |
|---------|-------|
| Name | `project` |
| Visual direction | Ascending |
| Aliases | Property: `project`, Property: `up` |
| Implied | `epic` (reverse) |

**Relation: `epic`**

| Setting | Value |
|---------|-------|
| Name | `epic` |
| Visual direction | Descending |
| Aliases | Property: `epic` |
| Implied | `project` (reverse) |

**Relation: `task`**

| Setting | Value |
|---------|-------|
| Name | `task` |
| Visual direction | Descending |
| Aliases | Property: `task`, Property: `contains` |
| Implied | `subtask` (reverse) |

**Relation: `subtask`**

| Setting | Value |
|---------|-------|
| Name | `subtask` |
| Visual direction | Ascending |
| Aliases | Property: `subtask`, Property: `parent` |
| Implied | `task` (reverse) |

### Groups

**Group: "Project Context"**

| Setting | Value |
|---------|-------|
| Name | Project Context |
| Members | `project` depth 0, `epic` depth 1 |
| Show conditions | `type` not equals `project` |
| Display properties | `status` |

**Group: "Epics"**

| Setting | Value |
|---------|-------|
| Name | Epics |
| Members | `epic` depth 1 |
| Show conditions | `type` equals `project` |
| Filters | `status` not equals `done` |
| Sort by | `priority` ascending |
| Display properties | `status`, `priority` |

**Group: "Tasks"**

| Setting | Value |
|---------|-------|
| Name | Tasks |
| Members | `task` depth 0 |
| Show conditions | `type` equals `epic` |
| Filters | `status` not equals `done` |
| Sort by | `priority` ascending, `due` ascending |
| Display properties | `status`, `priority`, `due` |

**Group: "Subtasks"**

| Setting | Value |
|---------|-------|
| Name | Subtasks |
| Members | `task` depth 1 |
| Show conditions | `type` equals `task` |
| Filters | `status` not equals `done` |
| Display properties | `status` |

---

## Sample Notes

### Website Redesign.md (Project)

```markdown
---
type: project
status: active
---

# Website Redesign

Complete redesign of company website.

## Goals

- Modern design
- Improved performance
- Mobile-first approach
```

### Homepage Epic.md (Epic)

```markdown
---
type: epic
status: active
priority: 1
project: "[[Website Redesign]]"
---

# Homepage Epic

Redesign the main homepage.
```

### Update Hero Section.md (Task)

```markdown
---
type: task
status: active
priority: 2
due: 2024-03-15
epic: "[[Homepage Epic]]"
---

# Update Hero Section

Create new hero section with video background.

## Acceptance Criteria

- [ ] Video loads within 2 seconds
- [ ] Fallback image for slow connections
- [ ] Mobile-optimized version
```

### Create Video Assets.md (Subtask)

```markdown
---
type: task
status: active
parent: "[[Update Hero Section]]"
---

# Create Video Assets

Produce and compress hero video.
```

---

## How It Works

### Viewing a Project

When viewing "Website Redesign":

```
▼ Epics
  epic  Homepage Epic        [active] [1]
  epic  Contact Page Epic    [active] [2]
  epic  Blog Epic            [active] [3]
```

Only sees direct epics, filtered to non-done, sorted by priority.

### Viewing an Epic

When viewing "Homepage Epic":

```
▼ Project Context
  project  Website Redesign  [active]

▼ Tasks
  task  Fix Mobile Layout    [active] [1] [2024-03-10]
  task  Update Hero Section  [active] [2] [2024-03-15]
  task  Add Newsletter       [active] [3] [2024-03-20]
```

Sees project context above, tasks below sorted by priority then due date.

### Viewing a Task

When viewing "Update Hero Section":

```
▼ Project Context
  project  Website Redesign  [active]
    epic  Homepage Epic      [active]

▼ Subtasks
  task  Create Video Assets  [active]
  task  Write Copy           [active]
```

Sees full project hierarchy above, subtasks below.

---

## Status Workflow

Use consistent status values:

| Status | Meaning |
|--------|---------|
| `backlog` | Not yet planned |
| `planned` | Scheduled for future |
| `active` | Currently working |
| `blocked` | Waiting on something |
| `done` | Completed |

### Filtering Out Done Items

The group filters hide `status: done` items. Completed work doesn't clutter your view.

### Showing All Items

Create a separate group without filters:

**Group: "All Tasks (including done)"**

| Setting | Value |
|---------|-------|
| Filters | (none) |

---

## Priority System

Use numeric priorities for easy sorting:

| Priority | Meaning |
|----------|---------|
| `1` | Critical |
| `2` | High |
| `3` | Medium |
| `4` | Low |

Sort ascending puts critical items first.

---

## Tips

### Quick Capture

Use templates with default frontmatter:

```markdown
---
type: task
status: backlog
priority: 3
epic: ""
---

# {{title}}
```

### Blocked Tasks

Add a `blocked-by` relation to track dependencies:

**Relation: `blocked-by`**

| Setting | Value |
|---------|-------|
| Name | `blocked-by` |
| Visual direction | Ascending |
| Implied | `blocks` (reverse) |

### Archive Completed Projects

When a project is done, add `archived: true` and filter:

| Setting | Value |
|---------|-------|
| Filters | `archived` not exists |

---

## Alternative: Simpler Setup

If the full hierarchy is overkill, use just `up`/`down`:

**Relations:**

1. `up` (ascending) → implied: `down` (reverse)
2. `down` (descending) → implied: `up` (reverse)

**Groups:**

1. Context: `up` depth 0
2. Contents: `down` depth 0

Same result with less configuration. Add specificity only when you need it.

---

## Complete Configuration

**Relations:**

1. `project` (ascending) → implied: `epic` (reverse)
2. `epic` (descending) → implied: `project` (reverse)
3. `task` (descending) → implied: `subtask` (reverse)
4. `subtask` (ascending) → implied: `task` (reverse)

**Groups:**

1. Project Context: `project` + `epic`, show when not project, display: `status`
2. Epics: `epic`, show on projects, filter not done, sort priority, display: `status, priority`
3. Tasks: `task`, show on epics, filter not done, sort priority + due, display: `status, priority, due`
4. Subtasks: `task`, show on tasks, filter not done, display: `status`
