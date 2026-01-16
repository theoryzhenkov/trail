# Core Concepts

Understanding how Trail works under the hood helps you use it more effectively. This section explains the key concepts that power Trail's relation system.

---

## The Relation Graph

Trail builds a directed graph from your notes:

- **Nodes**: Every note in your vault
- **Edges**: Relations between notes

Each edge has:

- **Source**: The note containing the link
- **Target**: The note being linked to
- **Type**: The relation name (`up`, `down`, etc.)
- **Origin**: Whether it's explicit or implied

```
┌──────────┐     up      ┌──────────┐
│  Child   │ ──────────▶ │  Parent  │
└──────────┘             └──────────┘
                              │
                              │ implied down
                              ▼
                         ┌──────────┐
                         │  Child   │
                         └──────────┘
```

---

## Key Concepts

### Relations

A relation is a named, directional connection. Unlike generic backlinks, relations carry semantic meaning:

| Link Type | What It Tells You |
|-----------|-------------------|
| Backlink | "These notes mention each other" |
| Relation | "This note is the parent/child/next/related-to that note" |

Learn more: [Configuring Relations](../configuration/relations.md)

### Implied Relations

Rules that automatically create relations based on existing ones. Define once, link everywhere.

Learn more: [Implied vs Explicit](implied-vs-explicit.md)

### Traversal

The algorithm that follows relations to build trees for display. Handles depth limits, cycles, and direction.

Learn more: [Traversal](traversal.md)

### Groups

Organize relations into visual sections. Each group can traverse different relations to different depths.

Learn more: [Configuring Groups](../configuration/groups.md)

---

## Data Flow

Here's how Trail processes your notes:

```
┌─────────────────┐
│   Your Notes    │
│  (frontmatter,  │
│   inline links) │
└────────┬────────┘
         │
         ▼
┌─────────────────┐
│     Parsing     │
│  Extract typed  │
│    relations    │
└────────┬────────┘
         │
         ▼
┌─────────────────┐
│  Graph Building │
│  Create nodes,  │
│  edges, apply   │
│  implied rules  │
└────────┬────────┘
         │
         ▼
┌─────────────────┐
│   Traversal     │
│  Follow edges,  │
│  build trees    │
│  for each group │
└────────┬────────┘
         │
         ▼
┌─────────────────┐
│   Rendering     │
│  Display trees  │
│  in Trail pane  │
└─────────────────┘
```

### 1. Parsing

Trail reads each note and extracts relations from:

- Inline syntax: `up::[[Parent]]`
- Frontmatter: `relations.up: "[[Parent]]"`

Only relation types you've defined (with matching aliases) are recognized.

### 2. Graph Building

Relations become edges in a directed graph. Implied relation rules are applied, creating additional edges.

### 3. Traversal

When you open a note, Trail traverses the graph:

- Starts from the current note
- Follows edges based on group configuration
- Respects depth limits
- Handles cycles (visits each note once)
- Builds a tree structure

### 4. Rendering

Trees are rendered in the Trail pane:

- Visual direction determines tree orientation
- Filters are applied
- Display properties are shown

---

## Design Principles

### Explicit Over Magic

Trail doesn't guess relationships. You explicitly define relation types and how they connect. This makes the system predictable and debuggable.

### Local First

All data stays in your vault as standard frontmatter and markdown. No proprietary formats, no external databases.

### Composable

Relations, groups, filters, and sorting are independent features that compose together. Learn them separately, combine as needed.

### Progressive Disclosure

Start with defaults. Add complexity only when you need it. The basic setup works out of the box.

---

## Mental Models

### Relations as Verbs

Think of relation names as verbs or prepositions:

- "This note is **up** from that note"
- "This note **contains** that note"
- "This note **cites** that note"

The relation describes the connection from the source's perspective.

### Groups as Questions

Each group answers a question:

- **Ancestors**: "What contains this note?"
- **Children**: "What does this note contain?"
- **References**: "What does this note cite?"

Design groups around the questions you ask while navigating.

### Implied Relations as Rules

Think of implied relations as logical rules:

- "If A is up from B, then B is down from A"
- "If A cites B, then B is cited-by A"

Trail applies these rules automatically to complete your graph.

---

## Next Steps

- [Traversal](traversal.md) — How Trail follows relations
- [Implied vs Explicit](implied-vs-explicit.md) — Understanding automatic relations
