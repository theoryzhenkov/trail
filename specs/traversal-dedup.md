# Traversal and Node Duplication Specification

## Overview

This document specifies how TQL handles nodes that are reachable via multiple paths during traversal.

## Current Behavior (Legacy)

The current implementation uses a global `visited` set during traversal:

```typescript
const visited = new Set<string>();
visited.add(startPath);

// During traversal:
if (visited.has(edge.toPath)) {
  continue;  // Skip already-visited nodes
}
visited.add(edge.toPath);
```

**Consequences:**
- Each node appears at most once in results
- First path to reach a node "wins"
- Later paths to the same node are silently ignored
- Relation information may be misleading (shows first relation, not all)

## Target Behavior

Nodes should be allowed to appear multiple times when reachable via different relations or paths.

### Use Cases

**Example 1: Multiple relations to same node**
```
from up, down depth 2
```

If node X is reachable via `up` at depth 1 AND via `down` at depth 2:
- Node X appears twice in results
- Each appearance has correct `relation` and `depth`
- UI shows both occurrences

**Example 2: Diamond patterns**
```
     A
    / \
   B   C
    \ /
     D
```

Query `from child depth 2` from A should show:
- B (via A→B)
- C (via A→C)  
- D (via A→B→D)
- D (via A→C→D) - duplicate with different path

### Result Structure

Each `QueryResultNode` includes path information:

```typescript
interface QueryResultNode {
  path: string;
  relation: string;
  depth: number;
  implied: boolean;
  impliedFrom?: string;
  properties: FileProperties;
  displayProperties: string[];
  visualDirection: VisualDirection;
  hasFilteredAncestor: boolean;
  children: QueryResultNode[];
  
  // Traversal path for deduplication awareness
  traversalPath: string[];  // e.g., ['A.md', 'B.md', 'D.md']
}
```

### Cycle Detection

Cycles must still be detected to prevent infinite traversal:

```typescript
// Per-path visited tracking instead of global
function traverse(currentPath: string, ancestorPaths: Set<string>) {
  if (ancestorPaths.has(currentPath)) {
    return;  // Cycle detected on THIS path
  }
  
  const newAncestors = new Set(ancestorPaths);
  newAncestors.add(currentPath);
  
  for (const edge of getEdges(currentPath)) {
    traverse(edge.toPath, newAncestors);
  }
}
```

**Key difference:**
- Old: `visited` is global, persists across all branches
- New: `ancestorPaths` is per-branch, only detects cycles on current path

## Implementation Changes

### GraphStore Changes

```typescript
// Before
private evaluateMember(
  sourcePath: string,
  group: RelationGroup,
  member: RelationGroupMember,
  edgesBySource: Map<string, RelationEdge[]>,
  visited: Set<string>,  // Global visited
  currentDepth: number
): GroupTreeNode[]

// After  
private evaluateMember(
  sourcePath: string,
  group: RelationGroup,
  member: RelationGroupMember,
  edgesBySource: Map<string, RelationEdge[]>,
  ancestorPaths: Set<string>,  // Per-path ancestors (for cycle detection only)
  currentDepth: number,
  traversalPath: string[]  // Full path from root
): GroupTreeNode[]
```

### UI Considerations

When the same file appears multiple times:
- Each occurrence is rendered independently
- File links work normally (all point to same file)
- Collapse state could be shared or independent (TBD)

### Performance Considerations

Allowing duplicates may increase result size significantly in highly connected graphs. Consider:
- Result size limits (configurable)
- Warning when result exceeds threshold
- Optional "deduplicate" flag to restore old behavior

## Configuration

Add optional deduplication control:

```typescript
interface GroupDefinition {
  query: string;
  // ... existing fields ...
  allowDuplicates?: boolean;  // default: true (new behavior)
}
```

Or as a query clause (future):
```
group "Example"
from up, down depth 2
deduplicate          -- optional: restore old single-occurrence behavior
```

## Migration

- New behavior is opt-in initially (keep `allowDuplicates: false` as default)
- After testing, switch default to `true`
- Provide migration notice for users who relied on deduplication

## Status

**Current:** Not implemented. This is a planned enhancement.

**Dependencies:**
- Refactor `GraphStore.evaluateMember()` to use per-path cycle detection
- Update `QueryResultNode` to include `traversalPath`
- Update UI to handle duplicate file entries
