# Trail Query Language (TQL) Specification

## Overview

TQL is a custom DSL for defining Trail groups with rich filtering, sorting, and traversal capabilities. It provides a declarative way to query and display relationships between notes in an Obsidian vault.

## Example Query

```
group "Project Ancestors"
from up extend Children depth unlimited, down depth 2
prune status = "archived"
where priority >=? 3
when type = "project" or hasTag("active")
sort by chain, date desc
display status, priority, file.modified
```

---

## 1. Syntax Specification

### 1.1 Complete Grammar (EBNF)

```ebnf
Query         = GroupClause FromClause PruneClause? WhereClause? WhenClause? 
                SortClause? DisplayClause?

GroupClause   = "group" String

FromClause    = "from" RelationList
RelationList  = RelationSpec ("," RelationSpec)*
RelationSpec  = Identifier RelationMod*
RelationMod   = DepthMod | ExtendMod
DepthMod      = "depth" (Number | "unlimited")
ExtendMod     = "extend" (Identifier | String)

PruneClause   = "prune" Expression

WhereClause   = "where" Expression

WhenClause    = "when" Expression

SortClause    = "sort" "by" SortKey ("," SortKey)*
SortKey       = ("chain" | PropertyAccess) ("asc" | "desc")?

DisplayClause = "display" DisplayList
DisplayList   = "all" ("," PropertyAccess)* | PropertyAccess ("," PropertyAccess)*

Expression    = OrExpr
OrExpr        = AndExpr ("or" AndExpr)*
AndExpr       = NotExpr ("and" NotExpr)*
NotExpr       = ("not" | "!") NotExpr | CompareExpr
CompareExpr   = RangeExpr | InExpr | ArithExpr (CompareOp ArithExpr)?
ArithExpr     = Term (("+" | "-") Term)*
RangeExpr     = ArithExpr "in" ArithExpr ".." ArithExpr
InExpr        = ArithExpr "in" ArithExpr
CompareOp     = "=" | "!=" | ">" | "<" | ">=" | "<=" | "=?" | "!=?"
Term          = Literal | DateExpr | PropertyAccess | FunctionCall | "(" Expression ")"
DateExpr      = DateTerm (("+" | "-") Duration)?
DateTerm      = DateLiteral | RelativeDate | PropertyAccess
PropertyAccess = Identifier ("." Identifier)* | "prop" "(" String ")"
FunctionCall  = Identifier "(" (Expression ("," Expression)*)? ")"
Literal       = String | Number | Boolean | Duration | "null"

String        = '"' <characters> '"'
Number        = <digits> ("." <digits>)?
Boolean       = "true" | "false"
DateLiteral   = <YYYY-MM-DD> | <YYYY-MM-DDTHH:MM:SS>
Duration      = Number ("d" | "w" | "m" | "y")
RelativeDate  = "today" | "yesterday" | "tomorrow" | "startOfWeek" | "endOfWeek"
Identifier    = <letter> (<letter> | <digit> | "_" | "-")*
```

**Note:** Modifiers within clauses can appear in any order. For example, `depth 5 extend Children` and `extend Children depth 5` are equivalent.

### 1.2 Syntax Rules

| Aspect | Rule |
|--------|------|
| **Strings** | Double quotes only: `"value"` |
| **Comments** | Not supported |
| **Case** | Fully case-sensitive |
| **Whitespace** | Free multiline (newlines = spaces) |
| **Keywords** | `group`, `from`, `depth`, `unlimited`, `extend`, `prune`, `where`, `when`, `sort`, `by`, `chain`, `asc`, `desc`, `display`, `all`, `and`, `or`, `not`, `in`, `true`, `false`, `null`, `today`, `yesterday`, `tomorrow`, `startOfWeek`, `endOfWeek` |
| **Reserved word properties** | Use `prop("keyword")` to access properties named like keywords |
| **Context-sensitive keywords** | `chain` is only a keyword in `SortKey` context |
| **Comparison operators** | Standard: `=`, `!=`, `<`, `>`, `<=`, `>=`; Null-safe: `=?`, `!=?` |
| **Arithmetic operators** | `+`, `-` for numbers and date arithmetic |
| **Negation** | Both `not` and `!` supported |

### 1.3 String Escape Sequences

| Escape | Meaning |
|--------|---------|
| `\\` | Backslash |
| `\"` | Double quote |
| `\n` | Newline |
| `\t` | Tab |

**Example:**
```
matches(file.name, "^\\d{4}-\\d{2}-\\d{2}$")  -- regex with escaped backslashes
where title = "Say \"Hello\""                  -- escaped quotes
```

### 1.4 Property Access

```
status                    -- simple property
file.name                 -- nested/prefixed (parsed as path)
file.created              -- file metadata
traversal.depth           -- traversal context
prop("due-date")          -- properties with special characters
prop("from")              -- properties named like keywords
prop("chain")             -- property named "chain" (not the sort keyword)
prop("null")              -- property named "null" (not the null value)
```

### 1.5 Date & Duration Examples

```
date = 2024-01-15                    -- ISO date literal
date > today                          -- relative date
date < today - 7d                     -- date arithmetic
date < file.created + 1m              -- date arithmetic with property
date in 2024-01-01..2024-12-31       -- date range
date in 2024-01-01..today - 30d      -- range with arithmetic
modified > startOfWeek               -- start of current week
created < today - 1m                 -- one month ago
```

---

## 2. Clause Reference

### 2.1 GROUP Clause

Defines the display name for this group in the Trail pane.

```
group "Ancestors"
group "Related Projects"
```

### 2.2 FROM Clause

Specifies which relations to traverse and how. Each relation can have independent depth and extend modifiers in any order.

**Syntax:**
```
from up depth unlimited
from up, down depth 2
from up extend Children, down depth 2 extend Siblings
```

**Per-relation modifiers (any order):**
- `depth N` - Limit traversal depth (default: `unlimited`)
- `extend GroupName` - For leaf nodes, apply another group's query

**Examples:**
```
from up depth unlimited              -- traverse up with no depth limit
from up, down depth 2                -- up unlimited, down limited to 2
from up depth 5 extend Children      -- modifiers in any order
from up extend Children depth 5      -- equivalent to above
```

### 2.3 PRUNE Clause

Filters nodes **during traversal**. Nodes where the condition is **true are removed**, along with their entire subtrees.

Use PRUNE for performance when you don't want to traverse certain subtrees.

**Polarity:** `prune X` removes nodes where X is true.

```
prune status = "archived"            -- REMOVE archived nodes and subtrees
prune hasTag("private")              -- REMOVE private notes and their children
prune true                           -- REMOVE everything (empty result)
```

### 2.4 WHERE Clause

Filters nodes **after traversal**. Nodes where the condition is **true are kept**; others are hidden but their children remain visible with a gap indicator (`...`).

**Polarity:** `where X` keeps nodes where X is true (opposite of PRUNE).

```
where priority >= 3                  -- KEEP high priority notes
where status !=? "archived"          -- KEEP non-archived (null-safe)
where hasTag("project")              -- KEEP only project notes
where true                           -- KEEP everything (no filtering)
```

**Gap indicator behavior:** When a node's parent was filtered by WHERE, the UI shows `...` marker to indicate hidden ancestry. Children maintain their true depth value, but UI indentation is recalculated relative to visible ancestors.

### 2.5 WHEN Clause

Conditional visibility for the entire group based on the **active file**. If the condition fails, the group returns `{ visible: false }` without traversal.

```
when type = "project"                -- show group only for project notes
when hasTag("daily")                 -- show only for daily notes
when file.folder = "Projects"        -- show only in Projects folder
```

### 2.6 SORT Clause

Specifies sort order for siblings at each tree level.

```
sort by date desc                    -- sort by date, newest first
sort by chain, date desc             -- chain order primary, date secondary
sort by priority asc, file.name      -- priority first, then name
```

**The `chain` keyword:**
- Reserved keyword for chain/sequence ordering
- Position in sort list determines priority
- To sort by a property named "chain", use `prop("chain")`

### 2.7 DISPLAY Clause

Controls which properties are shown in the Trail pane.

```
display status, priority             -- show specific properties
display all                          -- show all frontmatter properties
display all, file.created            -- all frontmatter plus file metadata
```

**`display all` includes:**
- All frontmatter properties from the file

**`display all` excludes:**
- Relation-alias properties
- File metadata (must be explicit: `file.created`, `file.modified`)
- Traversal context

---

## 3. Type System

### 3.1 Runtime Values

```typescript
type Value = string | number | boolean | Date | null | Value[];
```

### 3.2 Type Coercion Rules

| Left Type | Operator | Right Type | Behavior |
|-----------|----------|------------|----------|
| Number | `<` `>` `<=` `>=` | Number | Numeric comparison |
| Number | `=` `!=` | Number | Numeric equality |
| String | any comparison | String | Lexicographic comparison |
| Date | any comparison | Date | Temporal comparison |
| Date | `+` `-` | Duration | Date arithmetic |
| Any | `=` `!=` | null | See null handling below |
| String/Number | any | other type | Coerce to string |

### 3.3 Null Handling

**Standard operators** (`=`, `!=`, `<`, etc.):
- Comparisons with null return null
- Null results filter out (node excluded)

**Null-safe operators** (`=?`, `!=?`):
- `value =? x` → false if value is null, true only if equal
- `value !=? x` → true if value is null OR value != x

**Examples:**
```
status = "active"         -- excludes notes without status
status !=? "archived"     -- includes notes without status
```

### 3.4 Array Handling

Arrays are first-class values:
- `"x" in arr` checks membership
- Array functions operate on arrays
- Properties can be arrays (e.g., tags)

### 3.5 Range Expression Restrictions

`value in lower..upper` is only valid for:
- Numbers
- Dates

String ranges are **not supported**:
```
name in "a".."z"     -- ERROR: string ranges not supported
```

---

## 4. Built-in Properties

### 4.1 File Metadata (`file.*`)

| Property | Type | Description |
|----------|------|-------------|
| `file.name` | string | Filename without extension |
| `file.path` | string | Full vault path |
| `file.folder` | string | Parent folder path |
| `file.created` | Date | Creation date |
| `file.modified` | Date | Modification date |
| `file.size` | number | File size in bytes |
| `file.tags` | string[] | Array of tags |
| `file.links` | string[] | Array of outgoing links |
| `file.backlinks` | string[] | Array of incoming links |

### 4.2 Traversal Context (`traversal.*`)

| Property | Type | Description |
|----------|------|-------------|
| `traversal.depth` | number | Depth from active file |
| `traversal.relation` | string | Relation name that led here |
| `traversal.isImplied` | boolean | Whether edge is implied |
| `traversal.parent` | string | Parent node path |
| `traversal.path` | string[] | Array of paths from root |

---

## 5. Built-in Functions

All functions use **camelCase**.

### 5.1 String Functions

| Function | Description |
|----------|-------------|
| `contains(haystack, needle)` | Substring check |
| `startsWith(str, prefix)` | Prefix check |
| `endsWith(str, suffix)` | Suffix check |
| `length(str)` | String length |
| `lower(str)` | Lowercase |
| `upper(str)` | Uppercase |
| `trim(str)` | Remove whitespace |
| `split(str, delimiter)` | Returns array |
| `matches(str, pattern)` | Regex match (case-sensitive) |
| `matches(str, pattern, flags)` | Regex with flags: `"i"`, `"m"`, `"s"` |

**matches() examples:**
```
matches(file.name, "^daily-")
matches(title, "TODO", "i")
```

### 5.2 File Functions

File functions operate on the **currently-evaluated node**:
- In `WHEN`: the active file (query root)
- In `PRUNE`/`WHERE`: each traversed node

| Function | Description |
|----------|-------------|
| `inFolder(folderPath)` | Checks if file is in folder |
| `hasExtension(ext)` | Checks file extension |
| `hasTag(tag)` | Checks if file has tag |
| `tags()` | Returns all tags |
| `hasLink(target)` | Checks outgoing links |
| `backlinks()` | Returns backlink paths |
| `outlinks()` | Returns outlink paths |

### 5.3 Array Functions

| Function | Description |
|----------|-------------|
| `len(array)` | Array length |
| `length(value)` | Works for strings and arrays |
| `first(array)` | First element or null |
| `last(array)` | Last element or null |
| `isEmpty(value)` | True if null, empty string, or empty array |

### 5.4 Existence & Null Functions

| Function | Description |
|----------|-------------|
| `exists(property)` | True if defined and not null |
| `coalesce(a, b, ...)` | First non-null value |
| `ifnull(value, default)` | Value if not null, else default |

### 5.5 Date Functions

| Function | Description |
|----------|-------------|
| `now()` | Current timestamp |
| `date(str)` | Parse date from string |
| `year(date)` | Extract year |
| `month(date)` | Extract month |
| `day(date)` | Extract day |

### 5.6 Function Arity

Functions have defined arities. The validator checks argument counts:

| Function | Arity |
|----------|-------|
| `contains`, `startsWith`, `endsWith` | 2 |
| `length`, `len`, `lower`, `upper`, `trim`, `first`, `last`, `isEmpty`, `exists` | 1 |
| `split` | 2 |
| `matches` | 2-3 (pattern, optional flags) |
| `inFolder`, `hasExtension`, `hasTag`, `hasLink` | 1 |
| `tags`, `backlinks`, `outlinks`, `now` | 0 |
| `date`, `year`, `month`, `day` | 1 |
| `coalesce` | 1+ (variadic) |
| `ifnull` | 2 |

Incorrect arity produces a `ValidationError` with code `INVALID_ARITY`.

---

## 6. The `in` Operator

The `in` operator has dynamic behavior based on the right operand type:

| Expression | Right Type | Behavior |
|------------|------------|----------|
| `"x" in tags` | Array | Membership check |
| `"sub" in title` | String | Substring check |
| `5 in values` | Array | Membership check |
| `5 in "12345"` | String | `contains("12345", "5")` |
| `x in 1..10` | Range | Range check (numbers/dates only) |

---

## 7. Query Execution

### 7.1 Execution Order

```
1. WHEN     -- evaluate against active file (short-circuit if false)
2. FROM     -- traverse relations, collecting nodes into tree
3. PRUNE    -- during traversal, skip filtered subtrees
4. WHERE    -- post-traversal filter on collected nodes
5. SORT     -- sort siblings at each tree level
6. DISPLAY  -- mark which properties to show
```

### 7.2 Key Behaviors

| Behavior | Rule |
|----------|------|
| **Result shape** | Tree structure (nested children) |
| **Query root** | Always active file |
| **Active file in results** | Never included |
| **Multiple relations** | Union - combine into single tree (see `traversal-dedup.md` for details) |
| **Default depth** | Unlimited |
| **Default sort** | Chain order (for sequential), then alphabetical |
| **Empty results** | Return `{ visible: true, results: [] }` |
| **Unknown relations** | Warning during validation, error during execution |
| **Circular extend** | Runtime detection - track visited, stop on cycle |
| **Implied edges** | Included by default, filterable via `traversal.isImplied` |
| **Visual direction** | Affects tree structure (ascending = ancestors-first) |

### 7.3 PRUNE vs WHERE Behavior

**PRUNE (during traversal):**
- Matching nodes are skipped entirely
- Their subtrees are NOT traversed
- Use for performance

**WHERE (post-traversal):**
- Matching nodes are hidden from display
- Children remain visible
- Gap indicator (`...`) shows filtered ancestry

### 7.4 Default Values

| Setting | Default |
|---------|---------|
| `depth` modifier | `unlimited` |
| Sort direction | `asc` |
| `GroupDefinition.enabled` | `true` |
| `WHEN` clause omitted | Group visible for all notes |
| `PRUNE` clause omitted | No nodes pruned |
| `WHERE` clause omitted | All nodes kept |
| `DISPLAY` clause omitted | No properties displayed |

---

## 8. AST Types

### 8.1 Core Structures

```typescript
interface Span {
  start: number;
  end: number;
}

interface Query {
  type: 'query';
  group: string;
  from: FromClause;
  prune?: Expr;
  where?: Expr;
  when?: Expr;
  sort?: SortKey[];
  display?: DisplayClause;
  span: Span;
}

interface FromClause {
  type: 'from';
  relations: RelationSpec[];
  span: Span;
}

interface RelationSpec {
  type: 'relationSpec';
  name: string;
  depth: number | 'unlimited';  // default: 'unlimited'
  extend?: string;
  span: Span;
}

interface SortKey {
  type: 'sortKey';
  key: 'chain' | PropertyAccess;  // 'chain' keyword or property path
  direction: 'asc' | 'desc';  // default: 'asc'
  span: Span;
}

interface DisplayClause {
  type: 'display';
  all: boolean;                    // true if 'display all' was used
  properties: PropertyAccess[];    // additional properties (when all=true) or all properties
  span: Span;
}
```

### 8.2 Expressions

```typescript
type Expr =
  | LogicalExpr
  | CompareExpr
  | ArithExpr
  | UnaryExpr
  | InExpr
  | RangeExpr
  | FunctionCall
  | PropertyAccess
  | DateExpr
  | Literal;

interface LogicalExpr {
  type: 'logical';
  op: 'and' | 'or';
  left: Expr;
  right: Expr;
  span: Span;
}

interface CompareExpr {
  type: 'compare';
  op: '=' | '!=' | '<' | '>' | '<=' | '>=' | '=?' | '!=?';
  left: Expr;
  right: Expr;
  span: Span;
}

interface ArithExpr {
  type: 'arith';
  op: '+' | '-';
  left: Expr;
  right: Expr;
  span: Span;
}

interface UnaryExpr {
  type: 'unary';
  op: 'not';
  operand: Expr;
  span: Span;
}

interface InExpr {
  type: 'in';
  value: Expr;
  collection: Expr;
  span: Span;
}

interface RangeExpr {
  type: 'range';
  value: Expr;
  lower: Expr;
  upper: Expr;
  span: Span;
}

interface FunctionCall {
  type: 'call';
  name: string;
  args: Expr[];
  span: Span;
}

interface PropertyAccess {
  type: 'property';
  path: string[];  // ['file', 'name'] or ['status']
  span: Span;
}

interface DateExpr {
  type: 'dateExpr';
  base: DateLiteral | RelativeDateLiteral | PropertyAccess;
  offset?: { op: '+' | '-'; duration: DurationLiteral };
  span: Span;
}
```

### 8.3 Literals

```typescript
// Basic literals (in Literal production)
type Literal =
  | { type: 'string'; value: string; span: Span }
  | { type: 'number'; value: number; span: Span }
  | { type: 'boolean'; value: boolean; span: Span }
  | { type: 'null'; span: Span }
  | DurationLiteral;

interface DurationLiteral {
  type: 'duration';
  value: number;
  unit: 'd' | 'w' | 'm' | 'y';
  span: Span;
}

// Date-related literals (in DateExpr production only)
interface DateLiteral {
  type: 'date';
  value: Date;  // parsed from YYYY-MM-DD or YYYY-MM-DDTHH:MM:SS
  span: Span;
}

interface RelativeDateLiteral {
  type: 'relativeDate';
  kind: 'today' | 'yesterday' | 'tomorrow' | 'startOfWeek' | 'endOfWeek';
  span: Span;
}
```

### 8.4 Multi-Phase Processing

```
Source String
     │
     ▼ (Lexer)
 Token[]
     │
     ▼ (Parser - fail fast)
 ParsedQuery     -- may reference unknown relations/groups
     │
     ▼ (Validator - collect all errors)
 ValidatedQuery  -- all references resolved, types checked
     │
     ▼ (Executor)
 QueryResult
```

---

## 9. Query Context

### 9.1 Interface

```typescript
interface QueryContext {
  // Graph access
  getOutgoingEdges(path: string, relation?: string): RelationEdge[];
  getIncomingEdges(path: string, relation?: string): RelationEdge[];
  getProperties(path: string): FileProperties;
  getFileMetadata(path: string): FileMetadata;
  
  // Settings access
  getRelationDef(name: string): RelationDefinition | undefined;
  resolveGroupRef(name: string): ValidatedQuery | undefined;
  getRelationNames(): string[];
  
  // Active file
  activeFilePath: string;
  activeFileProperties: FileProperties;
  
  // Caching
  getCachedResult(query: ValidatedQuery): QueryResult | undefined;
  setCachedResult(query: ValidatedQuery, result: QueryResult): void;
  invalidateCache(affectedPaths: Set<string>): void;
}
```

### 9.2 Usage

```typescript
const context = new QueryContext(graphStore, settings, activeFilePath);
const result = execute(validatedQuery, context);
```

---

## 10. Result Types

```typescript
interface QueryResult {
  visible: boolean;          // false if WHEN clause failed
  results: QueryResultNode[];
  errors: QueryWarning[];    // non-fatal warnings
}

interface QueryResultNode {
  path: string;
  relation: string;
  depth: number;
  implied: boolean;
  impliedFrom?: string;
  properties: FileProperties;
  displayProperties: string[];  // filtered by DISPLAY clause
  visualDirection: VisualDirection;
  hasFilteredAncestor: boolean; // true if any ancestor was WHERE-filtered
  children: QueryResultNode[];
}

interface QueryWarning {
  message: string;
  span?: Span;
}
```

---

## 11. Error Handling

### 11.1 Error Classes

```typescript
abstract class TQLError extends Error {
  constructor(message: string, public span?: Span) {
    super(message);
  }
}

class ParseError extends TQLError {
  constructor(message: string, span: Span, public expected?: string[]) {
    super(message, span);
  }
}

class ValidationError extends TQLError {
  constructor(message: string, span: Span, public code: ValidationErrorCode) {
    super(message, span);
  }
}

class RuntimeError extends TQLError {
  constructor(message: string, span?: Span) {
    super(message, span);
  }
}

type ValidationErrorCode = 
  | 'UNKNOWN_RELATION'
  | 'UNKNOWN_GROUP'
  | 'UNKNOWN_FUNCTION'
  | 'INVALID_ARITY'
  | 'CIRCULAR_REFERENCE'
  | 'TYPE_MISMATCH'
  | 'INVALID_RANGE_TYPE';
```

### 11.2 Error Handling Strategy

| Phase | Behavior |
|-------|----------|
| **Lexer** | Fail fast on invalid character |
| **Parser** | Fail fast on syntax error |
| **Validator** | Collect ALL errors, return array |
| **Executor** | Throw on runtime errors |

---

## 12. Caching

### 12.1 Cache Structure

```typescript
private cache: Map<string, {
  ast: ValidatedQuery;       // parsed + validated AST
  results: Map<string, QueryResult>;  // keyed by activeFilePath
}>;
```

### 12.2 Cache Keys

- **AST cache**: Query string (exact match)
- **Result cache**: ValidatedQuery (by reference) + active file path

### 12.3 Smart Invalidation

When a file changes:
1. Get set of affected paths (changed file + files linking to it)
2. For each cached query, check if any result node has path in affected set
3. If yes, invalidate that query's result cache

---

## 13. Settings & Storage

### 13.1 Group Definition

```typescript
interface GroupDefinition {
  query: string;                    // TQL query string (authoritative)
  name?: string;                    // override name from query
  enabled?: boolean;                // default true
  visualEditable?: boolean;         // can this query be edited visually?
  displayOptions?: {
    collapsed?: boolean;
    iconColor?: string;
  };
}
```

### 13.2 Settings Structure

```typescript
interface TrailSettings {
  relations: RelationDefinition[];
  groups: GroupDefinition[];        // TQL-based
  legacyGroups?: RelationGroup[];   // OLD: kept during migration period
  editorMode: 'visual' | 'query' | 'auto';  // auto = visual if possible
  hideEmptyGroups: boolean;
}
```

---

## 14. Migration

### 14.1 Strategy

- **Detection**: Check for presence of `legacyGroups` or groups with `members` array
- **Conversion**: Best-effort conversion to TQL string
- **UI**: Banner in settings prompting manual review
- **Support period**: One version (old format readable, saves as new)

### 14.2 Conversion Example

**Old format:**
```typescript
{
  name: "Ancestors",
  members: [{ relation: "up", depth: 0 }],
  filters: [{ key: "status", operator: "equals", value: "active" }],
  filtersMatchMode: "all",
  sortBy: [{ property: "date", direction: "desc" }],
  chainSort: "primary",
  displayProperties: ["status"],
  showConditions: [{ key: "type", operator: "equals", value: "project" }]
}
```

**New TQL:**
```
group "Ancestors"
from up depth unlimited
where status = "active"
when type = "project"
sort by chain, date desc
display status
```

### 14.3 Unconvertible Cases

- Complex filter combinations → best effort + warning
- Custom/unknown operators → skip with warning

---

## 15. UI

### 15.1 Dual-Mode Editor

**Visual Editor** (default for new users):
- Similar to current group settings UI
- Generates TQL internally
- Limited to expressible subset (no complex boolean, no ranges)
- Shows "View as query" to see generated TQL

**Query Editor** (power users):
- CodeMirror with syntax highlighting
- Full TQL capabilities
- Shows "Visual editor" if query is simple enough

### 15.2 Error Display

- **Inline**: Red text below input showing error message + location
- **Notice**: Obsidian notice on save attempt with errors

### 15.3 Validation Timing

- Validate on blur (when user leaves input)
- Show errors inline persistently until fixed

---

## 16. File Structure

```
src/
  query/
    index.ts           # Public API: parse(), validate(), execute()
    ast.ts             # AST type definitions (discriminated unions)
    tokens.ts          # Token types
    lexer.ts           # Tokenization with spans
    parser.ts          # Recursive descent parser
    validator.ts       # Validation phase
    executor.ts        # Query execution
    context.ts         # QueryContext interface and impl
    result.ts          # QueryResult types
    errors.ts          # Error classes
    builtins/
      index.ts         # Built-in function registry
      string.ts        # String functions
      file.ts          # File functions
      date.ts          # Date functions
      array.ts         # Array functions
    cache.ts           # Caching logic
    migration.ts       # Old format conversion
    codemirror/
      language.ts      # CodeMirror language support
      highlighting.ts  # Syntax highlighting
```

---

## Appendix A: Complete Example Queries

### A.1 Project Hierarchy

```
group "Project Tree"
from up depth unlimited, down depth 3
prune status = "archived"
where priority >=? 3 and hasTag("active")
when type = "project"
sort by chain, priority desc
display status, priority, file.modified
```

### A.2 Daily Notes with Links

```
group "Related Notes"
from parent depth 1, child depth 2
where file.folder != "Archive"
when matches(file.name, "^\\d{4}-\\d{2}-\\d{2}$")
sort by file.modified desc
display all
```

### A.3 Filtered Ancestors with Extension

```
group "Active Ancestors"
from up extend Children depth unlimited
prune status = "archived" or hasTag("private")
where exists(priority)
sort by chain
display status, priority
```

### A.4 Date-Based Filtering

```
group "Recent Changes"
from up, down depth 2
where file.modified > today - 7d
sort by file.modified desc
display file.modified, status
```

---

## Appendix B: Reserved Keywords

```
group, from, depth, unlimited, extend, prune, where, when,
sort, by, chain, asc, desc, display, all, and, or, not, in,
true, false, null, today, yesterday, tomorrow, startOfWeek, endOfWeek
```

**Context-sensitive:** `chain` is only reserved in `SortKey` context.

Use `prop("keyword")` to access properties with reserved names.
