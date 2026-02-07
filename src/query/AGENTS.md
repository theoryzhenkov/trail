# Query Module - Agent Instructions

## Module Overview

This module implements TQL (Trail Query Language) - a query language for traversing note graphs. It handles parsing, validation, and execution of queries.

## Key Invariants

1. **Node Registration is Required**: All node types MUST use the `@register` decorator. The registry is used for function lookup, completion, and documentation.

2. **Validation Before Execution**: Never call `execute()` without `validate()`. The executor assumes valid AST.

3. **Contexts are Distinct**: `ValidationContext` is immutable and used for static checks. `ExecutorContext` is mutable and tracks current file state during traversal.

4. **WHERE is Post-Traversal**: WHERE filtering happens AFTER traversal in `query-executor.ts`, not during traversal. This maintains ancestor paths for tree structure.

5. **Grammar and Nodes Must Match**: Changes to `tql.grammar` require corresponding node classes with `static fromSyntax()` methods.

6. **Conversion Logic Lives in Node Classes**: Each node class provides its own `static fromSyntax(node, ctx)` factory method, registered via `@register({ term: "GrammarTermName" })`. The tree-converter is a thin dispatcher.

## File Responsibilities

| File | Responsibility | When to Modify |
|------|---------------|----------------|
| `index.ts` | Public API exports | Adding new public types/functions |
| `executor.ts` | Execution entry point | Rarely - it's a thin wrapper |
| `errors.ts` | Error types | Adding new error codes |
| `cache.ts` | Query caching | Changing cache invalidation |
| `nodes/parser.ts` | Lezer → typed AST | Rarely - delegates to tree-converter |
| `nodes/tree-converter.ts` | Thin dispatcher + structural converters | Rarely - only for non-1:1 grammar mappings |
| `nodes/registry.ts` | Node registration + converter registry | Adding registration categories |
| `nodes/context.ts` | Execution context | Adding context properties |
| `codemirror/tql.grammar` | Lezer grammar | Syntax changes |
| `codemirror/complete.ts` | Autocomplete | Completion behavior changes |
| `codemirror/hover.ts` | Hover tooltips | Documentation display changes |

## Common Tasks

### Adding a New Clause

1. **Define the node class** in `nodes/clauses/` with a `static fromSyntax()` method:

```typescript
// nodes/clauses/LimitNode.ts
import type { SyntaxNode } from "@lezer/common";
import { ClauseNode } from "../base/ClauseNode";
import { register, type ConvertContext } from "../registry";
import type { Span, NodeDoc, ValidationContext, Completable } from "../types";

@register("LimitNode", { clause: true })
export class LimitNode extends ClauseNode {
  readonly count: number;

  static documentation: NodeDoc = {
    title: "LIMIT clause",
    description: "Limits the number of results returned.",
    syntax: "limit <number>",
  };

  static completable: Completable = {
    keywords: ["limit"],
    context: "clause",
    priority: 50,
    category: "keyword",
  };

  constructor(count: number, span: Span) {
    super(span);
    this.count = count;
  }

  validate(ctx: ValidationContext): void {
    if (this.count < 0) {
      ctx.addError("Limit must be non-negative", this.span, "invalid-limit");
    }
  }

  static fromSyntax(node: SyntaxNode, ctx: ConvertContext): LimitNode {
    const numNode = node.getChild("Number");
    if (!numNode) throw new Error("Missing limit count");
    const count = parseInt(ctx.text(numNode), 10);
    return new LimitNode(count, ctx.span(node));
  }
}
```

2. **Update the grammar** in `codemirror/tql.grammar`:

```lezer
Limit { kw<"limit"> Number }
QueryClause { Group | From | Prune | Where | When | Sort | Display | Limit }
```

3. **Update QueryNode** to include the new clause and call `LimitNode.fromSyntax` in its own `fromSyntax`:

No changes needed in `tree-converter.ts` — conversion logic is in the node class.

4. **Update QueryNode** to include the new clause:

```typescript
// nodes/clauses/QueryNode.ts
readonly limit?: LimitNode;

constructor(..., limit?: LimitNode) {
  // ...
  this.limit = limit;
}

validate(ctx: ValidationContext): QueryNode {
  // ...
  if (this.limit) this.limit.validate(ctx);
  return this;
}
```

5. **Integrate in execution** - modify `executeQueryClauses()` in `nodes/execution/query-executor.ts`.

6. **Export from index** - add to `nodes/clauses/index.ts` and `index.ts`.

7. **Regenerate parser** - run `bun run build` to regenerate parser from grammar.

### Adding a New Function

1. **Create the function class** in the appropriate category under `nodes/functions/`:

```typescript
// nodes/functions/string/ReverseFunction.ts
import { FunctionExprNode } from "../../base/FunctionExprNode";
import { register } from "../../registry";
import type { ExprNode } from "../../base/ExprNode";
import type { Span, Value, NodeDoc, Completable } from "../../types";
import type { ExecutorContext } from "../../context";

@register("ReverseFunction", { function: "reverse" })
export class ReverseFunction extends FunctionExprNode {
  static minArity = 1;
  static maxArity = 1;

  static documentation: NodeDoc = {
    title: "reverse(string)",
    description: "Reverses a string.",
    syntax: "reverse(value)",
    examples: ['reverse("hello") → "olleh"'],
  };

  static completable: Completable = {
    keywords: ["reverse"],
    context: "expression",
    priority: 50,
    category: "function",
  };

  constructor(args: ExprNode[], span: Span) {
    super(args, span);
  }

  evaluate(ctx: ExecutorContext): Value {
    const value = this.args[0]?.evaluate(ctx);
    if (typeof value !== "string") return null;
    return value.split("").reverse().join("");
  }
}
```

2. **Import in category index** - add to `nodes/functions/string/index.ts`:

```typescript
import "./ReverseFunction";
```

3. **Test the function** - add tests to the appropriate test file.

That's it - the `@register` decorator handles function lookup and completion.

### Adding a New Modifier

Modifiers are metadata-only (not instantiated in AST). They provide completion suggestions.

```typescript
// nodes/modifiers/LimitModifier.ts
import { ModifierNode } from "../base/ModifierNode";
import { register } from "../registry";
import type { NodeDoc, Completable } from "../types";

@register("LimitModifier", { modifier: true })
export class LimitModifier extends ModifierNode {
  static keyword = ":limit";

  static documentation: NodeDoc = {
    title: ":limit modifier",
    description: "Limits traversal results.",
    syntax: "relation:limit(N)",
  };

  static completable: Completable = {
    keywords: [":limit"],
    context: "modifier",
    priority: 50,
    category: "modifier",
  };
}
```

### Adding a New Expression Type

1. **Create the node class** in `nodes/expressions/` with `fromSyntax` and `term` registration:

```typescript
import type { SyntaxNode } from "@lezer/common";
import { register, type ConvertContext } from "../registry";

@register("TernaryExprNode", { expr: true, term: "TernaryExpr" })
export class TernaryExprNode extends ExprNode {
  // ...

  static fromSyntax(node: SyntaxNode, ctx: ConvertContext): TernaryExprNode {
    // Conversion logic here - use ctx.expr() for recursive conversion
    // Use node.getChild("Name") for Lezer string-based child lookup
  }
}
```

2. **Update the grammar** if new syntax is needed.

3. **Export from `nodes/expressions/index.ts`**.

No changes needed in `tree-converter.ts` — the `@register({ term: "TernaryExpr" })` auto-registers the converter.

### Modifying Traversal Behavior

See `nodes/execution/traversal/AGENTS.md` for detailed instructions. Key points:

- DO NOT create separate traversal functions for different modes
- Use filter composition for new filtering types
- Output format is configuration, not separate code paths

## Anti-Patterns to Avoid

1. **DO NOT** add node types without `@register` - they won't be found by the system.

2. **DO NOT** modify `executor.ts` for clause-specific logic - that belongs in node classes or `query-executor.ts`.

3. **DO NOT** add validation logic to the parser - keep parsing and validation separate.

4. **DO NOT** access graph directly in expression nodes - use `ExecutorContext` methods.

5. **DO NOT** mutate AST nodes - they should be immutable after construction.

6. **DO NOT** add new syntax without a corresponding `fromSyntax` method on the node class.

7. **DO NOT** add conversion logic to `tree-converter.ts` unless the grammar node doesn't map 1:1 to a node class (e.g., ParenExpr unwrapping, FunctionCall dispatch).

7. **DO NOT** forget to rebuild parser after grammar changes (`bun run build`).

## Testing Strategy

### Unit Tests

- Parser tests: `nodes/parser.test.ts`
- Add tests for new node types in the same directory

### Integration Tests

- Executor tests: `executor*.test.ts`
- Test complete query execution with realistic scenarios

### Test Utilities

Use `test-utils.ts` for creating test contexts:

```typescript
import { createTestContext, createTestGraph } from "./test-utils";

const graph = createTestGraph({
  "root.md": { children: ["a.md", "b.md"] },
  // ...
});
const ctx = createTestContext(graph);
```

## Performance Considerations

1. **Parser caching** - The Lezer parser is stateless and fast; no caching needed.

2. **Traversal** - Uses cycle detection with `Set<string>` for O(1) lookups.

3. **Filter evaluation** - Keep filter logic simple; it runs for every node.

4. **Registry lookups** - Use Maps for O(1) lookups; avoid iteration.

5. **Result building** - Avoid deep cloning; use structural sharing where possible.

## Debugging Tips

1. **Parse errors**: Check `tql.grammar` for syntax issues. Use `bun run dev` to see Lezer parser output.

2. **Type errors in tree-converter**: The grammar and converter can get out of sync. Check `parser.terms.ts` (generated) for term IDs.

3. **Functions not found**: Ensure the function file is imported in its category's `index.ts`.

4. **Completion not appearing**: Check `completable.context` matches the cursor position context.

5. **Validation not running**: Ensure `validate()` is called and errors are propagated to UI.

## Dependencies

External:
- `@lezer/lr` - Parser runtime
- `@codemirror/state`, `@codemirror/view` - Editor state
- `@codemirror/autocomplete`, `@codemirror/language` - Editor features

Internal:
- `src/types.ts` - Shared types (`FileProperties`, `RelationEdge`, etc.)
- `src/graph/` - Graph access layer (used via `QueryContext`)

## Related Documentation

- `README.md` - Architecture overview
- `nodes/README.md` - Node system details
- `nodes/AGENTS.md` - Node modification guidelines
- `nodes/execution/traversal/README.md` - Traversal implementation
- `nodes/execution/traversal/AGENTS.md` - Traversal modification guidelines
