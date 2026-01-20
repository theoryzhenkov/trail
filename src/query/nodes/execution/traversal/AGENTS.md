# Traversal Module - Agent Instructions

## Module Overview

This module handles graph traversal for TQL query execution. It visits nodes reachable via relations and builds result trees or flat lists.

## Key Invariants

1. **Single Traversal Implementation**: All traversal modes (tree, flat, partial flat) use the same core logic. Do NOT create separate functions for different modes.

2. **Filtering is Composable**: Filters (PRUNE, WHERE, etc.) are combined at the executor level, not in traversal. The traversal receives ONE `NodeFilter` and calls it once per node.

3. **Output Configuration, Not Strategy**: Output format (tree vs flat) is a configuration value, not a separate code path. The `TraversalState` handles result structuring.

4. **WHERE is Post-Traversal**: WHERE filtering happens AFTER traversal in `query-executor.ts`. This maintains ancestor paths for proper tree structure.

## File Responsibilities

| File | Responsibility | When to Modify |
|------|---------------|----------------|
| `types.ts` | Interfaces only | Adding new config options |
| `filter.ts` | Filter creation & composition | Adding filter types (LIMIT, UNTIL) |
| `state.ts` | Cycle detection, path tracking, result building | Changing output structure |
| `traverse.ts` | Graph walking (DFS/BFS) | Changing traversal order |
| `chain-handler.ts` | Chain (`>>`) processing | Changing chain behavior |
| `index.ts` | Exports | Adding new exports |

## Common Tasks

### Adding a New Filter Type

1. **Create filter function** in `filter.ts`:
```typescript
export function createMyFilter(param: Type, ctx: ExecutorContext): NodeFilter {
  return {
    evaluate(nodeCtx: NodeContext): FilterDecision {
      // Your logic here
      return { include: boolean, traverse: boolean };
    },
  };
}
```

2. **Add to FilterBuildOptions** interface in `filter.ts`

3. **Add to buildFilter()** function in `filter.ts`

4. **Call from query-executor.ts** with the new option

### Adding a New Output Mode

1. **Extend OutputConfig** in `types.ts`

2. **Handle in TraversalState.buildResultNode()** in `state.ts`

3. **If different traversal order needed**, add dispatch in `traverse()` in `traverse.ts`

### Modifying Chain Behavior

Edit `chain-handler.ts`. The `extendFromChain()` function recursively calls `traverse()` for each chain target.

## Anti-Patterns to Avoid

1. **DO NOT** create separate traversal functions for different modes. Use configuration.

2. **DO NOT** add query clause logic (parsing, validation) here. That belongs in clause nodes.

3. **DO NOT** handle WHERE in traversal. It's post-traversal for ancestor path maintenance.

4. **DO NOT** duplicate the node building logic. Use `TraversalState.buildResultNode()`.

5. **DO NOT** pass many parameters through recursive calls. Use `TraversalState` to carry state.

## Testing

Tests are in `src/query/executor-*.test.ts`:
- `executor-flatten.test.ts` - Flatten modes
- `executor-advanced.test.ts` - Chains and complex queries
- `executor.test.ts` - General traversal

Run tests with:
```bash
bun test executor
```

## Data Flow

```
Query Executor (query-executor.ts)
    │
    ├─ buildFilter(pruneExpr) → NodeFilter
    │
    ├─ createChainHandler(chain, filter) → LeafHandler
    │
    └─ traverse(ctx, config) ─────────────────────────┐
                                                      │
        ┌─────────────────────────────────────────────┴───┐
        │                    traverse.ts                   │
        │                                                  │
        │  if (flattenFrom === true)                      │
        │      traverseBfs() ← BFS for global dedup       │
        │  else                                            │
        │      traverseDfs() ← DFS for tree structure     │
        │                                                  │
        │  For each edge:                                  │
        │    1. Check cycle (state.isAncestor)            │
        │    2. Build context (state.buildNodeContext)    │
        │    3. Apply filter (filter.evaluate)            │
        │    4. Recurse into children                     │
        │    5. Handle leaf (onLeaf.handle)               │
        │    6. Build result (state.buildResultNode)      │
        └──────────────────────────────────────────────────┘
                                │
                                ▼
                         TraversalResult
                         { nodes, warnings }
```

## Performance Considerations

1. **Cycle detection** uses `Set<string>` for O(1) lookups
2. **BFS** uses a queue for memory efficiency
3. **Path cloning** (`[...path, newNode]`) happens at each level - unavoidable for immutability
4. **Filter evaluation** should be fast - avoid expensive operations in custom filters

## Dependencies

- `ExecutorContext` from `../context.ts` - provides graph access
- `QueryResultNode` from `../../types.ts` - result structure
- `ChainTarget` from `../../clauses/FromNode.ts` - chain syntax

## Backwards Compatibility

The old `TraversalOptions` interface was replaced with `TraversalConfig`. Key differences:
- `extendGroup` removed (deprecated, use `chain` instead)
- `pruneExpr` moved to filter composition
- `resolveGroup` moved to chain handler
- `flatten` renamed to `output.flattenFrom`

The executor handles the translation, so external code using `executeQueryClauses()` is unaffected.
