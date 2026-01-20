# TQL Nodes Module

The class-based AST node system for Trail Query Language (TQL). Provides typed nodes for parsing, validation, and execution of TQL queries.

## Architecture

```
┌─────────────────────────────────────────────────────────────────────┐
│                           TQL Pipeline                               │
│                                                                      │
│   Source String → Lezer Parser → Tree Converter → Typed AST Nodes   │
│                                                                      │
│   "from down"   →  SyntaxTree  →    convert()   →    QueryNode      │
└─────────────────────────────────────────────────────────────────────┘
```

### Data Flow

1. **Lezer Parser** (`src/query/codemirror/parser.ts`) - Parses TQL source into a generic syntax tree
2. **Tree Converter** (`tree-converter.ts`) - Converts Lezer `SyntaxNode` to typed class instances
3. **Typed AST Nodes** - Provide `validate()` and `evaluate()`/`execute()` methods
4. **Executor** (`execution/query-executor.ts`) - Runs validated queries against the graph

## Node Class Hierarchy

```
Node (base)
├── ExprNode (expressions that produce values)
│   ├── FunctionExprNode (functions like contains(), len())
│   ├── BinaryNode (and, or, comparisons, arithmetic)
│   ├── UnaryNode (not)
│   ├── LiteralNode (strings, numbers, booleans)
│   ├── PropertyNode (property access)
│   ├── AggregateNode (count, sum, avg)
│   └── InlineQueryNode (@(...) subqueries)
│
├── ClauseNode (query clauses)
│   ├── QueryNode (top-level, contains all clauses)
│   ├── FromNode (relations and chains)
│   ├── WhereNode (filter expression)
│   ├── PruneNode (subtree filter)
│   ├── WhenNode (visibility filter)
│   ├── SortNode (ordering)
│   └── DisplayNode (property selection)
│
├── TokenNode (lexical tokens for keywords)
│   ├── Keyword tokens (FromToken, WhereToken, etc.)
│   ├── Operator tokens (EqToken, LtToken, etc.)
│   └── Delimiter tokens (CommaToken, DotToken, etc.)
│
└── ModifierNode (metadata-only, for completion)
    ├── AscModifier, DescModifier (sort direction)
    ├── DepthModifier, FlattenModifier (relation options)
    └── ChainModifier, ExtendModifier (traversal options)
```

### Base Class Responsibilities

| Base Class | Purpose | Key Methods |
|------------|---------|-------------|
| `Node` | Source span, validation | `validate(ctx)` |
| `ExprNode` | Expression evaluation | `evaluate(ctx): Value` |
| `FunctionExprNode` | Function call pattern | `args`, arity validation |
| `ClauseNode` | Query clause structure | - |
| `TokenNode` | Keyword/operator metadata | `static keyword` |
| `ModifierNode` | Completion metadata only | Not instantiated in AST |

## Registry System

The registry (`registry.ts`) maintains a central index of all node types. It enables:
- Parser lookup of node classes by Lezer grammar name
- Function lookup by name for dynamic dispatch
- Completion system access to all completable nodes
- Documentation extraction for hover/autocomplete

### The `@register` Decorator

```typescript
// Register a function
@register("ContainsNode", {function: "contains"})
export class ContainsFunction extends FunctionExprNode { ... }

// Register a clause
@register("WhereNode", {clause: true})
export class WhereNode extends ClauseNode { ... }

// Register a token
@register("WhereToken", {keyword: "where"})
export class WhereToken extends TokenNode { ... }

// Register a modifier (metadata-only)
@register("AscModifier", {modifier: true})
export class AscModifier extends ModifierNode { ... }

// Register an expression
@register("OrExprNode", {expr: true})
export class OrExprNode extends BinaryNode<ExprNode> { ... }

// Register a builtin ($file, $traversal)
@register("FileBuiltin", {builtin: "$file"})
export class FileBuiltin extends BuiltinNode { ... }
```

### Registration Types

| Option | Registry Method | Purpose |
|--------|----------------|---------|
| `{function: "name"}` | `registerFunction()` | Function nodes callable by name |
| `{clause: true}` | `registerClause()` | Query clause nodes |
| `{keyword: "word"}` | `registerToken()` | Keyword tokens for lexer |
| `{modifier: true}` | `registerModifier()` | Metadata-only modifiers |
| `{expr: true}` | `registerExpr()` | Expression nodes |
| `{builtin: "$name"}` | `registerBuiltin()` | Built-in property namespaces |

## Parser Integration

The tree converter bridges Lezer's generic syntax tree to typed nodes:

```typescript
// parser.ts
export function parse(input: string): QueryNode {
  const tree = parser.parse(input);  // Lezer parse
  return convert(tree, input);        // Convert to typed AST
}

// tree-converter.ts
export function convert(tree: Tree, source: string): QueryNode {
  const top = tree.topNode;
  return convertQuery(top, source);
}
```

Key conversion functions in `tree-converter.ts`:
- `convertQuery()` - Top-level query with all clauses
- `convertExpression()` - Dispatches to specific expression converters
- `convertFunctionCall()` - Looks up function in registry, validates arity

### Grammar to Node Mapping

Lezer grammar names map to node classes:

| Grammar Name | Node Class | Converter Function |
|--------------|------------|-------------------|
| `Query` | `QueryNode` | `convertQuery()` |
| `From` | `FromNode` | `convertFromClause()` |
| `OrExpr` | `OrExprNode` | `convertOrExpr()` |
| `FunctionCall` | `*Function` | `convertFunctionCall()` |

## Documentation Flow

Node documentation flows from static properties to hover/autocomplete:

```
Node Class                    docs.ts                      CodeMirror
┌──────────────────┐       ┌──────────────┐         ┌─────────────────────┐
│ static doc = {   │  ──▶  │ getDoc()     │   ──▶   │ Hover tooltip       │
│   title,         │       │ getFuncDoc() │         │ Autocomplete detail │
│   description,   │       │ getKeyword() │         │                     │
│   syntax,        │       └──────────────┘         └─────────────────────┘
│   examples       │
│ }                │
└──────────────────┘
```

### Documentation Static Properties

```typescript
class ContainsFunction extends FunctionExprNode {
  static documentation: NodeDoc = {
    title: "contains",
    description: "Check if string contains substring (case-sensitive).",
    syntax: "contains(haystack, needle)",
    returnType: "boolean",
    examples: ['contains(title, "draft")', 'contains(file.name, "project")'],
  };
}
```

### Completion Metadata

```typescript
class WhereNode extends ClauseNode {
  static completable: Completable = {
    keywords: ["where"],      // Triggers this completion
    context: "clause",        // When to show
    priority: 80,             // Sort order
    category: "keyword",      // Grouping
  };
}
```

## Key Entry Points

| File | Purpose |
|------|---------|
| `index.ts` | Public API, re-exports, `TQL` pipeline object |
| `parser.ts` | `parse()` function for TQL strings |
| `registry.ts` | Global registry and `@register` decorator |
| `docs.ts` | Documentation extraction utilities |
| `context.ts` | `ExecutorContext` and `ValidationContext` |
| `tree-converter.ts` | Lezer to typed AST conversion |

## Module Organization

```
nodes/
├── base/           # Abstract base classes
├── clauses/        # Query clause nodes (FROM, WHERE, etc.)
├── expressions/    # Expression nodes (AND, OR, comparisons)
├── functions/      # Built-in functions by category
│   ├── array/      #   Array functions (len, first, last)
│   ├── date/       #   Date functions (now, day, month)
│   ├── existence/  #   Null handling (exists, coalesce)
│   ├── file/       #   File functions (hasTag, inFolder)
│   └── string/     #   String functions (contains, upper)
├── literals/       # Literal value nodes (string, number, date)
├── modifiers/      # Modifier metadata (asc, desc, depth)
├── tokens/         # Keyword and operator tokens
│   ├── delimiters/ #   Punctuation tokens
│   ├── keywords/   #   Clause and operator keywords
│   └── operators/  #   Comparison operators
└── execution/      # Query execution engine
    └── traversal/  # Graph traversal implementation
```

## Relationship to Other Modules

- **`src/query/codemirror/`** - Lezer grammar definition, CodeMirror integration
- **`src/query/errors.ts`** - Error types (`ParseError`, `ValidationError`)
- **`src/graph/`** - Graph data structures queried by TQL
- **`src/types.ts`** - Shared types (`FileProperties`, `RelationEdge`)
