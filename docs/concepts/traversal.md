# Traversal

Traversal is how Trail follows relations to build the trees you see in the Trail pane. Understanding traversal helps you configure groups effectively and predict what you'll see.

---

## The Basics

When you open a note, Trail traverses the graph for each group:

1. Start at the current note
2. Follow edges of the specified relation types
3. Stop when reaching depth limit or no more edges
4. Return the tree of discovered notes

---

## Traversal Direction

Trail follows edges in the direction they point:

### Outgoing Edges

From the current note to others:

```
Current Note ──up──▶ Parent Note ──up──▶ Grandparent
```

This is how `up` relations work—you see notes you linked *to*.

### Incoming Edges (via Implied)

If you only have `up` relations but want to see children, implied relations help:

```
Current Note ◀──down── Child Note
             (implied from Child's up::[[Current Note]])
```

The child linked `up` to you. Trail's implied relation creates a `down` edge pointing to the child.

---

## Depth

Depth controls how far traversal goes:

### Depth 0 (Unlimited)

Follow the chain as far as it goes:

```
Current → Parent → Grandparent → Great-Grandparent → ...
```

Good for hierarchies where you want full context.

### Depth 1

Only direct connections:

```
Current → Parent (stop)
```

Good for immediate context without deep ancestry.

### Depth N

Up to N levels:

```
Depth 2: Current → Parent → Grandparent (stop)
```

Balance between context and focus.

---

## Cycle Handling

Your graph might have cycles:

```
Note A ──up──▶ Note B ──up──▶ Note C ──up──▶ Note A (cycle!)
```

Trail handles this by tracking visited notes. Each note appears only once in the tree, preventing infinite loops.

---

## Tree Building

Traversal builds a tree structure:

```
Current Note
├── [up] Parent
│   └── [up] Grandparent
└── [up] Other Parent
    └── [up] Other Grandparent
```

### Multiple Paths

If the same note is reachable via different paths, it appears only once (first path found wins).

### Tree vs Graph

The underlying data is a graph (can have cycles, multiple paths). The display is a tree (hierarchical, no cycles). Traversal converts graph to tree.

---

## Visual Direction and Tree Orientation

Relations have a visual direction that affects how the tree is rendered:

### Ascending (e.g., `up`)

Tree is inverted—deepest nodes become roots:

```
Graph edges:        Display tree:
Current → Parent    Grandparent
Parent → Grandparent  └── Parent
                         └── (current note)
```

You see ancestors above you, with the highest at the top.

### Descending (e.g., `down`)

Tree shows direct connections at root:

```
Graph edges:        Display tree:
Current → Child     Child A
Child → Grandchild    └── Grandchild A1
                    Child B
```

Children appear at the top, their children nested below.

### Sequential (e.g., `next`, `prev`)

Tree is flattened to a list:

```
Graph edges:        Display tree:
Current → Next1     Prev2
Next1 → Next2       Prev1
Current → Prev1     Next1
Prev1 → Prev2       Next2
```

All items at the same level, sorted appropriately.

---

## Group Members

Groups can have multiple members, each with its own relation and depth:

**Group: "Context"**

| Relation | Depth |
|----------|-------|
| `up` | 0 |
| `related` | 1 |

Traversal runs for each member:

1. Follow `up` relations (unlimited depth)
2. Follow `related` relations (depth 1)
3. Combine results into one tree

---

## Extend

The `extend` feature chains traversals:

**Member configuration:**

| Relation | Depth | Extend |
|----------|-------|--------|
| `next` | 1 | Ancestors |

This means:

1. Find notes via `next` (depth 1)
2. For each found note, run "Ancestors" group's traversal
3. Attach ancestor results as children

Use case: See siblings and their ancestry for context.

---

## Performance

Traversal is optimized for speed:

### Lazy Evaluation

Only computes what's needed for visible groups.

### Caching

Results are cached until the graph changes.

### Early Termination

Stops as soon as depth limit is reached.

### Efficient Graph Storage

Uses adjacency lists for O(1) edge lookup.

---

## Debugging Traversal

### Nothing Showing Up

1. **Check relation exists**: Is the relation type defined?
2. **Check alias**: Does the relation have an alias matching your frontmatter?
3. **Check direction**: Are you looking for incoming edges without implied relations?
4. **Check filters**: Are group filters hiding the results?

### Unexpected Results

1. **Check implied relations**: Implied edges might create unexpected paths
2. **Check depth**: Limited depth might cut off expected results
3. **Check cycles**: A cycle might cause notes to appear in unexpected places (first path wins)

### Too Many Results

1. **Reduce depth**: Use depth 1-2 instead of 0
2. **Add filters**: Filter by properties
3. **Split groups**: Create focused groups for specific relation types

---

## Example: Full Traversal

**Setup:**

- Note: "Task A"
- Relations: Task A → `up` → Project, Project → `up` → Epic
- Group: "Ancestors" with `up` depth 0

**Traversal:**

1. Start: "Task A"
2. Follow `up`: Find "Project"
3. Continue from "Project", follow `up`: Find "Epic"
4. Continue from "Epic", follow `up`: No more edges
5. Build tree: Epic → Project → Task A (inverted for ascending)

**Display:**

```
▼ Ancestors
  up  Epic
    up  Project
```

The current note (Task A) isn't shown—it's implied as the starting point.
