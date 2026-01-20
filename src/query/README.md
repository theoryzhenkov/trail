# Query Module

Trail Query Language (TQL) implementation. This module provides parsing, validation, and execution of TQL queries for traversing the note graph.

## Architecture

```
┌─────────────────────────────────────────────────────────────────────────┐
│                              Public API                                  │
│                              (index.ts)                                  │
│   parse() • execute() • run() • TQL namespace • type exports            │
└─────────────────────────────────────────────────────────────────────────┘
          │                    │                    │
          ▼                    ▼                    ▼
┌─────────────────┐  ┌─────────────────┐  ┌─────────────────────────────┐
│     Parser      │  │    Executor     │  │      CodeMirror             │
│  (nodes/parser) │  │  (executor.ts)  │  │      (codemirror/)          │
│                 │  │                 │  │                             │
│  Lezer parser   │  │ ExecutorContext │  │ Highlighting, completion,   │
│  → tree-convert │  │ → QueryNode.    │  │ linting, hover tooltips     │
│  → QueryNode    │  │    execute()    │  │                             │
└────────┬────────┘  └────────┬────────┘  └─────────────────────────────┘
         │                    │
         ▼                    ▼
┌─────────────────────────────────────────────────────────────────────────┐
│                           Node System                                    │
│                           (nodes/)                                       │
│                                                                          │
│  ┌──────────┐  ┌──────────┐  ┌──────────┐  ┌──────────┐  ┌──────────┐ │
│  │  base/   │  │ clauses/ │  │  exprs/  │  │  funcs/  │  │ literals/│ │
│  │          │  │          │  │          │  │          │  │          │ │
│  │  Node    │  │ QueryNode│  │ AndExpr  │  │ Contains │  │ String   │ │
│  │  ExprNode│  │ FromNode │  │ OrExpr   │  │ HasTag   │  │ Number   │ │
│  │  Clause  │  │ WhereNode│  │ Compare  │  │ DateDiff │  │ Boolean  │ │
│  │  ...     │  │ SortNode │  │ Property │  │ ...50+   │  │ Date     │ │
│  └──────────┘  └──────────┘  └──────────┘  └──────────┘  └──────────┘ │
│                                                                          │
│  ┌──────────────────────┐  ┌──────────────────────────────────────────┐ │
│  │      registry.ts     │  │              execution/                  │ │
│  │                      │  │                                          │ │
│  │  Node registration   │  │  query-executor.ts  - clause execution   │ │
│  │  Function lookup     │  │  traversal/         - graph walking      │ │
│  │  Completion metadata │  │  sorting.ts         - result ordering    │ │
│  └──────────────────────┘  └──────────────────────────────────────────┘ │
└─────────────────────────────────────────────────────────────────────────┘
```

## Data Flow

### 1. Parsing

```
TQL Query String
    │
    ▼
Lezer Parser (codemirror/parser.ts)
    │ produces generic syntax tree
    ▼
Tree Converter (nodes/tree-converter.ts)
    │ converts to typed AST nodes
    ▼
QueryNode (root of typed AST)
```

The parser is generated from the Lezer grammar (`codemirror/tql.grammar`). The tree converter walks the generic syntax tree and instantiates the appropriate node classes based on the grammar node types.

### 2. Validation

```
QueryNode
    │
    ▼
validate(ValidationContext)
    │ checks:
    │   - relation names exist
    │   - group names exist
    │   - function arity correct
    │   - type constraints
    ▼
ValidationErrors (if any)
```

Validation is recursive - each node validates itself and its children. The `ValidationContext` provides access to available relations and groups.

### 3. Execution

```
QueryNode
    │
    ▼
execute(ExecutorContext)
    │
    ├─ WHEN clause: evaluate against active file
    │
    ├─ FROM clause: traverse graph
    │     │
    │     ▼
    │   traversal/ module
    │     - builds filter from PRUNE
    │     - walks graph via relations
    │     - handles chains (>>)
    │     - respects depth/flatten
    │
    ├─ WHERE clause: filter results post-traversal
    │
    ├─ SORT clause: order results
    │
    └─ DISPLAY clause: select properties
    │
    ▼
QueryResult { visible, results[], warnings[] }
```

The `ExecutorContext` provides mutable state for the current file being evaluated, plus access to the graph (edges, properties, metadata).

## Entry Points

| File | Purpose |
|------|---------|
| `index.ts` | Public API - exports `parse()`, `execute()`, `run()`, `TQL` namespace |
| `executor.ts` | Thin wrapper that creates `ExecutorContext` and calls `QueryNode.execute()` |
| `nodes/parser.ts` | `parse()` function - Lezer parse + tree conversion |
| `nodes/index.ts` | `TQL` namespace with pipeline API |

### Usage Examples

```typescript
import { parse, execute, run, TQL } from "./query";

// Option 1: Full pipeline
const result = run(queryString, validationCtx, queryCtx);

// Option 2: Step by step
const query = parse(queryString);
query.validate(validationCtx);
const result = execute(query, queryCtx);

// Option 3: TQL namespace
const result = TQL.run(queryString, queryCtx, relationNames, groupNames);
```

## Submodules

### `nodes/`

The typed AST node system. See `nodes/README.md` for details.

| Directory | Contents |
|-----------|----------|
| `base/` | Abstract base classes (`Node`, `ExprNode`, `ClauseNode`, etc.) |
| `clauses/` | Query clause nodes (`QueryNode`, `FromNode`, `WhereNode`, etc.) |
| `expressions/` | Expression nodes (`AndExprNode`, `CompareExprNode`, `PropertyNode`, etc.) |
| `functions/` | Built-in functions organized by category (array, date, file, string, etc.) |
| `literals/` | Literal value nodes (`StringNode`, `NumberNode`, `DateLiteralNode`, etc.) |
| `tokens/` | Keyword and operator token nodes (for completion metadata) |
| `modifiers/` | Modifier metadata (`depth`, `flatten`, `asc`, `desc`) |
| `execution/` | Execution logic - `query-executor.ts` and `traversal/` |

### `codemirror/`

CodeMirror 6 integration for the TQL editor.

| File | Purpose |
|------|---------|
| `tql.grammar` | Lezer grammar definition |
| `language.ts` | Language support bundle with syntax highlighting |
| `complete.ts` | Autocomplete provider |
| `linter.ts` | Parse/validation error diagnostics |
| `hover.ts` | Hover tooltips from node documentation |
| `theme.ts` | Editor theme |
| `index.ts` | `createTQLEditor()` factory |

### Other Files

| File | Purpose |
|------|---------|
| `cache.ts` | Query result caching |
| `errors.ts` | Error types (`ParseError`, `ValidationError`, `RuntimeError`) |
| `migration.ts` | Query format migrations |
| `chain-sort.ts` | Chain-aware sorting logic |

## Key Concepts

### Node Registration

All node types register themselves with the global `registry` via the `@register` decorator:

```typescript
@register("ContainsFunction", { function: "contains" })
export class ContainsFunction extends FunctionExprNode {
  // ...
}
```

The registry enables:
- Function lookup by name during parsing
- Completion metadata collection
- Documentation aggregation for hover tooltips

### Contexts

Two context types flow through the system:

1. **ValidationContext** (immutable) - provides relation/group name lookup for validation
2. **ExecutorContext** (mutable) - provides graph access, current file state, error collection

### Filter Composition

The traversal module uses composable filters. PRUNE creates a filter that prevents traversal into matching subtrees. Filters are combined at the executor level, not in traversal:

```typescript
const filter = buildFilter(ctx, { pruneExpr: prune?.expression });
const result = traverse(ctx, { filter, ... });
```

See `nodes/execution/traversal/README.md` for details.

## Testing

Test files are colocated:

```
executor.test.ts           - General query execution
executor-clauses.test.ts   - Clause-specific tests
executor-filtering.test.ts - WHERE/PRUNE filtering
executor-flatten.test.ts   - Flatten modes
executor-chain-sort.test.ts - Chain sorting
executor-advanced.test.ts  - Complex scenarios
nodes/parser.test.ts       - Parser tests
```

Run tests:

```bash
bun test query
```

## Related Documentation

- `nodes/README.md` - Node system architecture
- `nodes/AGENTS.md` - Node modification guidelines
- `nodes/execution/traversal/README.md` - Traversal implementation
- `docs/syntax/query.md` - TQL syntax specification
