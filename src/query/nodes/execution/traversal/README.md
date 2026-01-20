# Traversal Module

Unified graph traversal for TQL query execution. This module provides a single traversal implementation that handles all output modes (tree, flat, partial flat) with composable filtering.

## Architecture

The traversal system separates three concerns:

```
┌─────────────────────────────────────────────────────────────────┐
│                        Query Executor                           │
│  Composes filter from PRUNE, WHERE, etc. and calls traverse()  │
└─────────────────────────────────────────────────────────────────┘
                                │
                                ▼
┌─────────────────────────────────────────────────────────────────┐
│                         traverse()                              │
│  Single entry point - dispatches to DFS or BFS based on config │
└─────────────────────────────────────────────────────────────────┘
        │                       │                       │
        ▼                       ▼                       ▼
┌───────────────┐    ┌───────────────────┐    ┌───────────────┐
│  NodeFilter   │    │  TraversalState   │    │  LeafHandler  │
│  (filtering)  │    │ (result building) │    │   (chains)    │
└───────────────┘    └───────────────────┘    └───────────────┘
```

### 1. Filtering (`filter.ts`)

Filters determine which nodes to include and traverse. They are **composable** - the executor combines multiple filters (PRUNE, WHERE, future filters) into one.

```typescript
interface NodeFilter {
  evaluate(ctx: NodeContext): FilterDecision;
}

interface FilterDecision {
  include: boolean;  // Include in output?
  traverse: boolean; // Visit children?
}
```

Filter semantics:
- **PRUNE**: `include: false, traverse: false` - skip node and subtree
- **WHERE**: `include: false, traverse: true` - skip node but visit children

### 2. Output Configuration (`types.ts`)

Controls result structure without changing traversal logic:

```typescript
interface OutputConfig {
  flattenFrom?: number | true;
}
```

- `undefined`: Tree output with nested children
- `true`: Flat output, all nodes at depth 1
- `number`: Tree until depth N, then flatten

### 3. State Management (`state.ts`)

`TraversalState` manages:
- Ancestor tracking (cycle detection)
- Path tracking through graph
- Result building (tree vs flat)

### 4. Chain Handling (`chain-handler.ts`)

Handles `>>` chain syntax at leaf nodes:

```
from up >> down >> same
```

When traversal reaches a leaf, the chain handler continues with the next relation.

## Usage

### Basic Traversal

```typescript
import { traverse, buildFilter } from './traversal';

const filter = buildFilter(ctx, { pruneExpr: myPruneExpr });

const result = traverse(ctx, {
  startPath: "root.md",
  relation: "down",
  maxDepth: Infinity,
  filter,
  output: { flattenFrom: undefined }, // tree mode
});
```

### With Chains

```typescript
import { traverse, buildFilter, createChainHandler } from './traversal';

const filter = buildFilter(ctx, { pruneExpr });
const onLeaf = createChainHandler(ctx, {
  chain: relationChain.chain,
  filter,
  resolveGroup,
});

const result = traverse(ctx, {
  startPath: "root.md",
  relation: "up",
  maxDepth: 2,
  filter,
  output: { flattenFrom: undefined },
  onLeaf,
});
```

### Flat Output

```typescript
const result = traverse(ctx, {
  startPath: "root.md",
  relation: "down",
  maxDepth: Infinity,
  filter,
  output: { flattenFrom: true }, // all nodes flat at depth 1
});
```

### Partial Flatten

```typescript
const result = traverse(ctx, {
  startPath: "root.md",
  relation: "down",
  maxDepth: 5,
  filter,
  output: { flattenFrom: 2 }, // tree until depth 2, then flat
});
```

## Files

| File | Purpose |
|------|---------|
| `types.ts` | Core interfaces (NodeFilter, OutputConfig, etc.) |
| `filter.ts` | Composable filter builders |
| `state.ts` | TraversalState for cycle detection and result building |
| `traverse.ts` | Main traverse() function |
| `chain-handler.ts` | Chain/extend handling at leaves |
| `index.ts` | Public exports |

## Design Decisions

### Why Single Traversal?

The old implementation had 4 separate traversal functions with ~70% duplicated code. A single implementation:
- Eliminates duplication
- Makes behavior consistent across modes
- Simplifies testing and maintenance

### Why Composable Filters?

Filters are combined at the executor level, not in traversal. This means:
- Easy to add new filter types (LIMIT, UNTIL, etc.)
- Filter logic is testable in isolation
- Traversal doesn't know about query clauses

### Why BFS for Full Flatten?

Full flatten uses BFS for **global deduplication**. Each node appears exactly once regardless of how many paths lead to it. DFS would visit nodes multiple times in DAGs.

### Why Post-Traversal WHERE?

WHERE needs to maintain ancestor paths for proper tree structure. If a WHERE-filtered node has matching children, those children need to be promoted. This is easier to handle post-traversal.

## Extending

### Adding a New Filter Type

1. Create the filter in `filter.ts`:

```typescript
export function createLimitFilter(maxNodes: number): NodeFilter {
  let count = 0;
  return {
    evaluate(ctx: NodeContext): FilterDecision {
      if (count >= maxNodes) {
        return { include: false, traverse: false };
      }
      count++;
      return { include: true, traverse: true };
    },
  };
}
```

2. Add to `buildFilter()`:

```typescript
export function buildFilter(ctx: ExecutorContext, options: FilterBuildOptions): NodeFilter {
  const filters: NodeFilter[] = [];
  
  if (options.pruneExpr) {
    filters.push(createPruneFilter(options.pruneExpr, ctx));
  }
  if (options.limit) {
    filters.push(createLimitFilter(options.limit));
  }
  
  return combineFilters(...filters);
}
```

### Adding a New Output Mode

1. Add to `OutputConfig` in `types.ts`
2. Handle in `TraversalState.buildResultNode()` in `state.ts`
3. If needed, add dispatch logic in `traverse.ts`
