# TQL Nodes Module - Agent Instructions

## Module Overview

This module defines the typed AST nodes for TQL (Trail Query Language). Nodes are created from Lezer parse trees and provide validation and execution logic.

## File Responsibilities

| File/Folder | Responsibility | When to Modify |
|-------------|---------------|----------------|
| `base/` | Abstract base classes | Rarely - only for new node categories |
| `base/Node.ts` | Root class with `span`, `validate()` | Adding universal node behavior |
| `base/ExprNode.ts` | Expression base with `evaluate()` | Changing evaluation semantics |
| `base/FunctionExprNode.ts` | Function pattern with args/arity | Changing function behavior |
| `base/ClauseNode.ts` | Clause base (minimal) | Adding shared clause behavior |
| `base/TokenNode.ts` | Token base with keyword metadata | Adding token-wide behavior |
| `base/ModifierNode.ts` | Metadata-only modifier base | Adding modifier-wide behavior |
| `clauses/` | Query clause implementations | Adding new clauses (e.g., LIMIT) |
| `expressions/` | Expression nodes (AND, OR, etc.) | Adding new expression types |
| `functions/` | Built-in function implementations | Adding new functions |
| `literals/` | Literal value nodes | Adding new literal types |
| `modifiers/` | Modifier metadata classes | Adding new modifiers |
| `tokens/` | Keyword/operator token classes | Adding new keywords |
| `registry.ts` | Central node registry + converter registry | Rarely - adding registration types |
| `parser.ts` | TQL parse entry point | Rarely - changing parse API |
| `tree-converter.ts` | Thin dispatcher + structural converters | Rarely - only for non-1:1 grammar mappings |
| `expressions/convert-helpers.ts` | Shared conversion utilities | Adding grammar-level helpers |
| `docs.ts` | Documentation extraction | Adding doc retrieval patterns |
| `context.ts` | Execution/validation contexts | Adding context fields |
| `types.ts` | Shared type definitions | Adding new types |
| `builtins.ts` | Built-in namespaces ($file, etc.) | Adding new built-in properties |

## Common Tasks

### Adding a New Function

1. **Create the function file** in the appropriate category folder:

```typescript
// functions/string/MyFunction.ts
import {FunctionExprNode, toString} from "../../base/FunctionExprNode";
import type {Value, NodeDoc, Span} from "../../types";
import type {ExecutorContext} from "../../context";
import type {ExprNode} from "../../base/ExprNode";
import {register} from "../../registry";

@register("MyFunctionNode", {function: "myfunction"})
export class MyFunction extends FunctionExprNode {
  static minArity = 1;
  static maxArity = 2;
  static documentation: NodeDoc = {
    title: "myfunction",
    description: "What the function does.",
    syntax: "myfunction(arg1, arg2?)",
    returnType: "string",
    examples: ['myfunction("hello")', 'myfunction("hello", "world")'],
  };

  // Optional: for autocomplete
  static completable = {
    keywords: ["myfunction"],
    context: "expression" as const,
    priority: 50,
    category: "function" as const,
  };

  constructor(args: ExprNode[], span: Span) {
    super(args, span);
  }

  evaluate(ctx: ExecutorContext): Value {
    const args = this.evaluateArgs(ctx);
    // Implementation
    return toString(args[0] ?? null);
  }
}
```

2. **Export from category index** (e.g., `functions/string/index.ts`):

```typescript
export * from "./MyFunction";
```

3. **Grammar already handles function calls** - No grammar changes needed for standard `name(args)` syntax.

### Adding a New Clause

1. **Create the clause file** in `clauses/` with `static fromSyntax()`:

```typescript
// clauses/LimitNode.ts
import type {SyntaxNode} from "@lezer/common";
import {ClauseNode} from "../base/ClauseNode";
import type {Span, NodeDoc, ValidationContext, Completable} from "../types";
import {register, type ConvertContext} from "../registry";

@register("LimitNode", {clause: true})
export class LimitNode extends ClauseNode {
  readonly count: number;

  static documentation: NodeDoc = {
    title: "LIMIT clause",
    description: "Limits the number of results returned.",
    syntax: "limit Number",
    examples: ["limit 10", "limit 100"],
  };

  static completable: Completable = {
    keywords: ["limit"],
    context: "clause",
    priority: 60,
    category: "keyword",
  };

  constructor(count: number, span: Span) {
    super(span);
    this.count = count;
  }

  validate(ctx: ValidationContext): void {
    // Validation logic
  }

  static fromSyntax(node: SyntaxNode, ctx: ConvertContext): LimitNode {
    const numNode = node.getChild("Number");
    if (!numNode) throw new Error("Missing limit count");
    const count = parseInt(ctx.text(numNode), 10);
    return new LimitNode(count, ctx.span(node));
  }
}
```

2. **Add to `clauses/index.ts`**:

```typescript
export * from "./LimitNode";
```

3. **Update Lezer grammar** (`src/query/codemirror/tql.grammar`) to parse the clause.

4. **Wire into QueryNode** - Add to `QueryNode` constructor, `fromSyntax`, and execution.

No changes needed in `tree-converter.ts` — conversion logic is in the node class.

### Adding a New Expression Type

1. **Create in `expressions/`** with `fromSyntax` and `term` registration:

```typescript
import type {SyntaxNode} from "@lezer/common";
import {register, type ConvertContext} from "../registry";

@register("MyExprNode", {expr: true, term: "MyExpr"})
export class MyExprNode extends ExprNode {
  // ...

  static fromSyntax(node: SyntaxNode, ctx: ConvertContext): MyExprNode {
    // Use ctx.expr() for recursive child conversion
    // Use node.getChild("Name") for Lezer string-based child lookup
  }
}
```

2. **Add grammar rule** in `tql.grammar`.

3. **Export from `nodes/expressions/index.ts`**.

The `@register({ term: "MyExpr" })` auto-registers the converter. No changes needed in `tree-converter.ts`.

### Adding a New Token/Keyword

1. **Create in `tokens/keywords/`**:

```typescript
@register("LimitToken", {keyword: "limit"})
export class LimitToken extends TokenNode {
  static keyword = "limit";
  static highlighting = "keyword" as const;
}
```

2. **Export from `tokens/keywords/index.ts`**.

3. **Add to grammar** as a keyword.

### Adding a New Modifier

Modifiers are metadata-only (not instantiated in AST). They exist for completion/docs.

```typescript
// modifiers/MyModifier.ts
@register("MyModifier", {modifier: true})
export class MyModifier extends ModifierNode {
  static keyword = ":mymod";
  static highlighting = "typeName" as const;
  static documentation: NodeDoc = {
    title: ":mymod",
    description: "What it does.",
    examples: ["from down :mymod"],
  };
  static completable: Completable = {
    keywords: [":mymod"],
    context: "after-relation",
    priority: 40,
    category: "keyword",
  };
}
```

### Adding a New Built-in Property

Add to the appropriate builtin class in `builtins.ts`:

```typescript
@register("FileBuiltin", {builtin: "$file"})
export class FileBuiltin extends BuiltinNode {
  static properties: BuiltinProperty[] = [
    // Existing properties...
    {name: "extension", type: "string", description: "File extension"},
  ];
}
```

Then implement the property access in `PropertyNode.evaluate()`.

## Key Invariants

1. **All nodes extend a base class**: `Node`, `ExprNode`, `ClauseNode`, `TokenNode`, or `ModifierNode`.

2. **All nodes must call `@register()`**: This registers them with the global registry. Unregistered nodes won't work.

3. **Registration type must match the node kind**:
   - Functions: `{function: "name"}`
   - Clauses: `{clause: true}`
   - Tokens: `{keyword: "word"}`
   - Modifiers: `{modifier: true}`
   - Expressions: `{expr: true}`

4. **Static properties for metadata**: Documentation and completion info are static properties, not instance properties.

5. **FunctionExprNode requires arity**: All functions must declare `static minArity` and `static maxArity`.

6. **validate() must call children**: Node validation should recursively validate child nodes.

7. **evaluate() must handle null**: Expression evaluation should gracefully handle null values.

8. **Naming convention**: Node classes end with `Node` or `Function`, tokens end with `Token`, modifiers end with `Modifier`.

9. **Registration name matches class name**: `@register("WhereNode", ...)` for `class WhereNode`.

## Anti-Patterns to Avoid

1. **DO NOT** skip the `@register` decorator - nodes won't be discoverable.

2. **DO NOT** put execution logic in the parser - keep parsing and execution separate.

3. **DO NOT** access the registry during module load - use lazy initialization.

4. **DO NOT** create instance documentation - use static `documentation` property.

5. **DO NOT** modify the global registry directly - use the `@register` decorator.

6. **DO NOT** forget to export new nodes from the appropriate index file.

7. **DO NOT** add grammar rules without corresponding `fromSyntax` methods on the node class.

8. **DO NOT** add conversion logic to `tree-converter.ts` unless the grammar node doesn't map 1:1 to a node class (e.g., ParenExpr, FunctionCall).

## Testing

Tests are in:
- `parser.test.ts` - Parser tests for syntax
- `src/query/executor*.test.ts` - Execution tests

Run tests:
```bash
bun test parser
bun test executor
```

## Data Flow Example

```
User types: where status = "active"
                │
                ▼
┌──────────────────────────────────────┐
│ Lezer Parser                          │
│ → WhereClause                         │
│   → where keyword                     │
│   → CompareExpr                       │
│     → PropertyAccess (status)         │
│     → = operator                      │
│     → String ("active")               │
└──────────────────────────────────────┘
                │
                ▼
┌──────────────────────────────────────┐
│ Tree Converter                        │
│ convertWhereClause() →               │
│   WhereNode(                         │
│     CompareExprNode(                 │
│       "=",                           │
│       PropertyNode(["status"]),      │
│       StringNode("active")           │
│     )                                │
│   )                                  │
└──────────────────────────────────────┘
                │
                ▼
┌──────────────────────────────────────┐
│ Validation                            │
│ WhereNode.validate() →               │
│   CompareExprNode.validate() →       │
│     PropertyNode.validate()          │
│     StringNode.validate()            │
└──────────────────────────────────────┘
                │
                ▼
┌──────────────────────────────────────┐
│ Execution                             │
│ For each traversed node:              │
│   WhereNode.test(ctx) →              │
│     CompareExprNode.evaluate() →     │
│       PropertyNode.evaluate() → "active"
│       StringNode.evaluate() → "active"
│       "active" = "active" → true     │
└──────────────────────────────────────┘
```

## Dependencies

- **Lezer parser** (`@lezer/common`, `@lezer/lr`) - Parse tree types
- **Parser terms** (`../codemirror/parser.terms`) - Grammar term IDs
- **Types** (`../../types.ts`) - Shared plugin types

## Registry Lookup Patterns

```typescript
// Get function by name
const cls = getFunctionClass("contains");
const node = new cls(args, span);

// Get token by keyword
const tokenCls = getTokenClass("where");

// Check if function exists
if (hasFunction(name)) { ... }

// Get all completables for a context
const suggestions = registry.getCompletablesForContext("expression");

// Get documentation
const doc = getFunctionDoc("contains");
```
