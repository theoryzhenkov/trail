# Trail Language Specification

This document specifies the Trail language family:
- **TCL** (Trail Core Language) - shared expression and pattern syntax
- **TQL** (Trail Query Language) - for defining display groups
- **TRL** (Trail Relation Language) - for defining relation implication rules

## Design Principles

1. **Shared core**: TCL provides the foundation for both TQL and TRL
2. **Minimal syntax**: Prefer concise, readable syntax
3. **Explicit over implicit**: Complex patterns use explicit variable binding
4. **Efficient by default**: Syntax encourages patterns that can be evaluated efficiently

---

## TCL: Trail Core Language

TCL is the shared foundation providing expressions, patterns, and property access.

### Literals

| Type | Examples | Notes |
|------|----------|-------|
| String | `"hello"`, `"with \"escapes\""` | Double-quoted |
| Number | `42`, `3.14`, `-10` | Integer or float |
| Boolean | `true`, `false` | |
| Null | `null` | |
| Date | `2024-01-15`, `2024-01-15T10:30:00` | ISO 8601 |
| Duration | `3d`, `2w`, `1m`, `1y` | Days, weeks, months, years |
| Relative Date | `today`, `yesterday`, `tomorrow`, `startOfWeek`, `endOfWeek` | |

### Operators

**Comparison:**
| Operator | Meaning |
|----------|---------|
| `=` | Equals |
| `!=` | Not equals |
| `<`, `>`, `<=`, `>=` | Ordering |
| `=?`, `!=?` | Null-safe equals/not-equals |

**Logical:**
| Operator | Meaning |
|----------|---------|
| `and` | Logical AND (short-circuit) |
| `or` | Logical OR (short-circuit) |
| `not` | Logical NOT |

**Arithmetic:**
| Operator | Meaning |
|----------|---------|
| `+` | Addition (numbers) or date + duration |
| `-` | Subtraction |

**Range:**
| Operator | Meaning |
|----------|---------|
| `in X..Y` | Value in range (inclusive) |

### Property Access

```
# Direct property (from file frontmatter)
status
nested.property.path

# File metadata
$file.name          # File name without extension
$file.path          # Full vault path
$file.folder        # Parent folder path
$file.created       # Creation date
$file.modified      # Modification date
$file.size          # File size in bytes
$file.tags          # Array of tags
$file.extension     # File extension

# Explicit frontmatter access
$file.properties.key

# Traversal context (only available during graph traversal)
$traversal.depth      # Current traversal depth
$traversal.relation   # Relation used to reach this node
$traversal.isImplied  # Whether edge is implied
$traversal.parent     # Parent node path
$traversal.path       # Full traversal path
```

### Variables

Variables are used in bound patterns to capture matched nodes:

```
$identifier    # User-defined variable
$file          # Reserved: current/active file (anchor)
$result        # Reserved: end of traversal chain (implicit in simple patterns)
$traversal     # Reserved: traversal context (for $traversal.depth, etc.)
```

**Implicit variables in simple patterns:**

When using simple patterns without explicit variable binding:
```
from up >> down
where status = "active"
```

Two implicit variables are available:
- `$file` - the starting file
- `$result` - the file at the end of the chain

These can be used in `where`, `implies`, etc.:
```
rule example
from up >> down
where $result.status = "active"
implies $file >related> $result
```

### Functions

#### String Functions
| Function | Description |
|----------|-------------|
| `contains(haystack, needle)` | Substring check |
| `length(str)` | String length |
| `upper(str)`, `lower(str)` | Case conversion |
| `startsWith(str, prefix)` | Prefix check |
| `endsWith(str, suffix)` | Suffix check |
| `split(str, delimiter)` | Split to array |
| `matches(str, regex)` | Regex match |
| `trim(str)` | Remove whitespace |

#### Array Functions
| Function | Description |
|----------|-------------|
| `len(array)` | Array length |
| `first(array)`, `last(array)` | First/last element |
| `isEmpty(array)` | Check if empty |
| `join(array, delimiter)` | Join to string |

#### Date Functions
| Function | Description |
|----------|-------------|
| `now()` | Current datetime |
| `today()` | Today at midnight |
| `date(str)` | Parse date string |
| `dateDiff(d1, d2, unit)` | Difference (units: d, w, m, y, h, min) |
| `day(date)`, `month(date)`, `year(date)` | Components |
| `weekday(date)` | Day of week (0-6) |
| `format(date, format)` | Format date |

#### File Functions
| Function | Description |
|----------|-------------|
| `hasTag(tag)` | Check if file has tag |
| `inFolder(path)` | Check if in folder |
| `folderName(path)` | Extract folder name from path |
| `fileName(path)` | Extract file name from path |
| `hasLink(path)` | Check if file links to path |
| `tags()` | Get all tags |
| `outlinks()` | Get outgoing links |
| `backlinks()` | Get incoming links |

#### Null Handling
| Function | Description |
|----------|-------------|
| `exists(value)` | Check if not null |
| `coalesce(v1, v2, ...)` | First non-null |
| `ifNull(value, default)` | Default for null |

### Pattern Syntax

Patterns describe graph traversal paths with optional variable binding.

#### Simple Patterns (for common cases)

```
# Single relation
up

# Multiple parallel relations
up, down

# Chain (sequential traversal)
up >> down >> next
```

#### Quantifiers

Quantifiers specify how many times a relation can be traversed:

| Syntax | Meaning |
|--------|---------|
| `up` | Exactly one hop |
| `up?` | Zero or one hop (optional) |
| `up+` | One or more hops (unlimited depth) |
| `up*` | Zero or more hops (includes self) |
| `up{3}` | Exactly 3 hops |
| `up{2,5}` | Between 2 and 5 hops |
| `up{,3}` | 1 to 3 hops (at most 3) |
| `up{2,}` | 2 or more hops (at least 2) |

Examples:
```
from up+                    # All ancestors (any depth)
from up{,3}                 # Parents up to 3 levels
from down{2}                # Exactly grandchildren
from up >> down+            # Parent's descendants at any depth
from (up >> same)+          # Repeated: parent's sibling's parent's sibling...
```

**Note on `*` (zero or more):** Includes the starting node itself. Useful for "self or ancestors":
```
from $file >up*> $ancestor  # $ancestor could be $file itself
```

#### Bound Patterns (for complex cases)

```
# Edge pattern: capture nodes in variables
$a >relation> $b

# Chain with variables
$file >up> $parent >up> $grandparent

# Multiple edges (for multi-target patterns)
$parent >down> $a, $parent >down> $b

# Property pattern: match files by condition
$x where <condition>
```

#### Edge Syntax

| Syntax | Meaning |
|--------|---------|
| `$a >rel> $b` | Directed: traverse `rel` from $a to $b |
| `$a <rel> $b` | Undirected: traverse `rel` in either direction |

Examples:
```
$file >up> $parent           # file's parent (directed)
$a >down> $b >next> $c       # a's child's next sibling
$p >down> $x, $p >down> $y   # two children of same parent
$file <related> $other       # files connected via 'related' in either direction
$file <link>+ $connected     # all files reachable via 'link' edges (any direction)
```

**When to use undirected (`<rel>`):**
- Symmetric relations like `same`, `sibling`, `related`
- When edge direction was defined inconsistently
- When you want to treat the graph as undirected

### Aggregate Functions

Aggregates operate on sets of files:

| Function | Description |
|----------|-------------|
| `count(source[, condition])` | Count matching |
| `sum(source, property)` | Sum values |
| `avg(source, property)` | Average |
| `min(source, property)` | Minimum |
| `max(source, property)` | Maximum |
| `any(source, condition)` | Any match? |
| `all(source, condition)` | All match? |

Sources:
- Relation name: `count(children)`
- Group reference: `count(@"GroupName")`
- Inline query: `sum(@(from down where active), priority)`

---

## TQL: Trail Query Language

TQL defines display groups - what related files to show in the UI.

### Syntax

```
group "Group Name"
from <pattern> [modifiers]
[prune <expression>]
[where <expression>]
[when <expression>]
[sort <sort-spec>]
[display <display-spec>]
[select <variable>]
```

### Clauses

#### `group` (required)
Names the display group.
```
group "Parents"
group "Active Tasks"
```

#### `from` (required)
Specifies what relations to traverse.

**Simple form:**
```
from up                    # Single relation
from up, down              # Multiple parallel
from up >> next            # Chain
from up{,3}                # Up to 3 levels (replaces :depth 3)
from up+                   # Unlimited depth
from up+ :flatten          # Flatten all results
from up+ :flatten 2        # Flatten from depth 2
```

**Bound form:**
```
from $file >up> $parent >same> $sibling
select $sibling
```

**References with `@`:**
```
from @"Other Group"        # Reference another TQL group by name
from @(from up+ where x)   # Inline TQL subquery
```

The `@` operator embeds queries within the current language context:
- In TQL: `@(...)` embeds inline TQL, `@"Name"` references a TQL group
- In TRL: `@(...)` embeds inline TRL patterns, `@name` references a TRL rule

**Negation via inline queries:**
```
# Files with no parent (root nodes)
where not exists(@($file >up> $_))

# Files whose parent is a root
from $file >up> $parent
where not exists(@($parent >up> $_))
```

#### `prune` (optional)
Filter applied during traversal - stops traversal into matching subtrees.
```
prune status = "archived"  # Don't traverse into archived nodes
```

#### `where` (optional)
Filter applied after traversal - hides non-matching but keeps their children.
```
where status = "active" and priority > 3
```

#### `when` (optional)
Condition on the active file - controls whether group is visible.
```
when hasTag("project")     # Only show group for project files
when $file.folder = "Work" # Only in Work folder
```

#### `sort` (optional)
Order results.
```
sort priority :desc
sort $file.modified :desc
sort status :asc, priority :desc
sort :chain                # Sort by traversal chain position
```

#### `display` (optional)
Which properties to show as badges.
```
display status, priority
display all                # Show all frontmatter
```

#### `select` (optional, for bound patterns)
Which variable to display when using bound patterns.
```
from $file >up> $p >same> $sibling
select $sibling
```

### Modifiers

| Modifier | Meaning |
|----------|---------|
| `:flatten` | Flatten all results to single level |
| `:flatten N` | Flatten results from depth N onwards |
| `:asc` | Sort ascending (for `sort`) |
| `:desc` | Sort descending (for `sort`) |
| `:chain` | Sort by chain position (for `sort`) |

**Note:** Depth is now controlled via quantifiers (`up{,3}`) rather than `:depth` modifier.

### Examples

```
# Simple: show parents up to 3 levels
group "Ancestors"
from up{,3}
display name

# All ancestors (unlimited)
group "All Ancestors"
from up+
display name

# Filtered: active high-priority tasks
group "Urgent Tasks"
from down+
where status = "active" and priority >= 4
sort priority :desc
display status, due

# Conditional: only show for project files
group "Project Team"
from same
when hasTag("project")

# Chain: grandparents
group "Grandparents"
from up{2}
display name, birth_year

# Complex with variables: aunts/uncles (parent's siblings, excluding parent)
group "Aunts and Uncles"
from $file >up> $parent >up> $gp >down> $aunt
select $aunt
where $aunt != $parent
display name

# Root nodes (files with no parent)
group "Roots"
from down+
where not exists(@($file >up> $_))

# Children of roots only
group "Top-Level Children"
from $file >up> $parent
select $file
where not exists(@($parent >up> $_))
```

---

## TRL: Trail Relation Language

TRL defines relation implication rules - how to automatically create edges.

### Syntax

```
rule <name>
[when <expression>]
from <pattern>
[where <expression>]
implies <edge-spec>
[allow pairwise]
```

Where `<edge-spec>` uses the same syntax as patterns:
```
implies <relation>                     # Shorthand for simple chains
implies $a >relation> $b               # Explicit directed edge
implies $a <relation> $b               # Bidirectional edge
implies <edge>, <edge>, ...            # Multiple edges
```

### Clauses

#### `rule` (required)
Names the rule.
```
rule grandparent
rule folder-index
rule siblings-via-parent
```

#### `when` (optional)
Condition on the anchor file - restricts which files this rule applies to.
```
when $file.name = folderName($file.folder) and index = true
```

#### `from` (required)
Pattern to match.

**Simple chain:**
```
from up >> up              # Two-hop chain
```

**Bound pattern:**
```
from $parent >down> $a, $parent >down> $b
```

**Special patterns:**
```
from folder_siblings              # Files in same folder
from folder_siblings as $sibling  # With explicit variable binding
from same_tag("project")          # Files sharing tag
from backlinks                    # Files linking to this one
```

**References with `@`:**
```
from @other_rule           # Apply another rule's pattern
from @(up+ >> down)        # Inline TRL pattern
```

#### `where` (optional)
Additional conditions on matched pattern.
```
where $a != $b
where $aunt != $parent
```

#### `implies` (required)
Specifies what edges to create using the same `>relation>` syntax as patterns.

**Shorthand (for simple chains):**
```
implies grandparent                    # Expands to: $file >grandparent> $result
```

When using simple patterns (without explicit variables), two implicit variables are available:
- `$file` - the starting file (anchor)
- `$result` - the end of the traversal chain

**Explicit edges:**
```
implies $file >grandparent> $gp        # Forward edge
implies $child >up> $file              # "Reverse" is just flipping variables
implies $a >same> $b, $b >same> $a     # Bidirectional (explicit)
implies $a <same> $b                   # Bidirectional (shorthand)
```

**Multiple edges from one rule:**
```
implies $file >grandparent> $gp,
        $file >ancestor> $parent,
        $file >ancestor> $gp
```

### Edge Syntax in `implies`

| Syntax | Meaning |
|--------|---------|
| `$a >rel> $b` | Single directed edge from $a to $b |
| `$a <rel> $b` | Bidirectional: both $a→$b and $b→$a |
| `edge, edge, ...` | Multiple edges |

### Special Patterns

| Pattern | Meaning | Use Case |
|---------|---------|----------|
| `folder_siblings` | Files in same folder (excluding self) | Folder-based grouping |
| `folder_children` | Files in subfolders | Hierarchical folders |
| `same_tag("tag")` | Files sharing specific tag | Tag-based relations |
| `same_property(key)` | Files with same property value | Property-based grouping |
| `backlinks` | Files that link to this file | Obsidian link graph |
| `outlinks` | Files this file links to | Obsidian link graph |

### Examples

```
# Chain: grandparent relation (shorthand)
rule grandparent
from up >> up
implies grandparent

# Same with explicit variables
rule grandparent
from $file >up> $parent >up> $gp
implies $file >grandparent> $gp

# Reverse: parent from child's perspective
rule parent-reverse
from $file >down> $child
implies $child >up> $file

# Sibling: files with same parent (bidirectional)
rule siblings
from $parent >down> $a, $parent >down> $b
where $a != $b
implies $a <same> $b

# Conditional: folder index creates down edges
rule folder-index
when $file.name = folderName($file.folder) and $file.index = true
from folder_siblings as $sibling
implies $file >down> $sibling

# Complex: cousins (children of parent's siblings, not own siblings)
rule cousins
from $file >up> $parent >up> $gp >down> $aunt >down> $cousin
where $aunt != $parent and $cousin != $file
implies $file <cousin> $cousin

# Uncle/aunt relation
rule uncle
from $file >up> $parent >same> $uncle
where $uncle != $parent
implies $file >uncle> $uncle

# Multiple edges from one pattern
rule family
from $file >up> $parent >up> $gp
implies $file >grandparent> $gp,
        $file >ancestor> $parent,
        $file >ancestor> $gp
```

### Efficiency Considerations

Rules are evaluated efficiently when they're **anchored** on existing structure:

**Efficient (iterate over edges):**
```
# Chain-based: O(edges × branching factor)
from up >> up

# Pairwise from same source: O(edges + pairs per source)
from $p >down> $a, $p >down> $b
```

**Potentially expensive (property-based):**
```
# Requires property index, O(files matching condition)
from folder_siblings
when $file.index = true
```

**Dangerous (O(n²) file pairs):**
```
# Avoid: all pairs of files with same status
rule EXPENSIVE
from $a where $a.status = "active",
     $b where $b.status = "active"
implies $a <related> $b
```

For property-only patterns that could generate many edges, use `allow pairwise`:
```
rule same-status
from $a where $a.status = "active",
     $b where $b.status = "active"
where $a != $b
implies $a <same-status> $b
allow pairwise  # Explicit opt-in for O(n²)
```

---

## Grammar Summary

```
# === Shared (TCL) ===

Expr        → OrExpr
OrExpr      → AndExpr ("or" AndExpr)*
AndExpr     → NotExpr ("and" NotExpr)*
NotExpr     → "not"? CompareExpr
CompareExpr → ArithExpr (CompareOp ArithExpr)?
ArithExpr   → Primary (("+"|"-") Primary)*
Primary     → Literal | Property | Function | Variable | "(" Expr ")" | Reference

Literal     → String | Number | Boolean | Null | Date | Duration
Property    → "$file" "." Path | "$traversal" "." Path | Path
Variable    → "$" Identifier
Function    → Identifier "(" [Expr ("," Expr)*] ")"
Reference   → "@" "(" ... ")" | "@" String | "@" Identifier

Pattern     → SimplePattern | BoundPattern
SimplePattern → RelationSpec ("," RelationSpec)* | Chain
Chain       → RelationSpec (">>" RelationSpec)*
BoundPattern → EdgeMatch ("," EdgeMatch)*
EdgeMatch   → Variable EdgeOp Relation Quantifier? EdgeOp Variable
            | Variable "where" Expr
EdgeOp      → ">" | "<"                          # > directed, < undirected

RelationSpec → Relation Quantifier?
Relation    → Identifier
Quantifier  → "?" | "+" | "*"
            | "{" Number "}"
            | "{" Number? "," Number? "}"


# === TQL ===

Query       → GroupClause FromClause Clauses*
GroupClause → "group" String
FromClause  → "from" (Pattern Modifiers? | Reference)
Clauses     → PruneClause | WhereClause | WhenClause
            | SortClause | DisplayClause | SelectClause

PruneClause → "prune" Expr
WhereClause → "where" Expr
WhenClause  → "when" Expr
SortClause  → "sort" SortKey ("," SortKey)*
DisplayClause → "display" (Property ("," Property)* | "all")
SelectClause → "select" Variable

Modifiers   → (":flatten" Number?)*
SortKey     → Property (":asc" | ":desc")? | ":chain"


# === TRL ===

Rule        → RuleClause WhenClause? FromClause WhereClause? ImpliesClause AllowClause?
RuleClause  → "rule" Identifier
WhenClause  → "when" Expr
FromClause  → "from" (Pattern | SpecialPattern | Reference) ("as" Variable)?
WhereClause → "where" Expr
ImpliesClause → "implies" EdgeSpec ("," EdgeSpec)*
AllowClause → "allow" "pairwise"

EdgeSpec    → Relation                                      # Shorthand: $file >rel> $result
            | Variable EdgeOp Relation EdgeOp Variable     # Explicit edge

SpecialPattern → "folder_siblings" | "folder_children"
              | "same_tag" "(" String ")"
              | "same_property" "(" String ")"
              | "backlinks" | "outlinks"
```

---

## Design Decisions Made

1. **Edge syntax**: `>relation>` - compact and visually distinctive

2. **Quantifiers**: Regex-style (`+`, `*`, `?`, `{n}`, `{n,m}`) replace `:depth` modifier

3. **Negation**: Achieved via `not exists(@(...))` using inline queries - no special syntax needed

4. **`@` operator**: Context-aware reference operator
   - TQL: references TQL groups and inline queries
   - TRL: references TRL rules and inline patterns

5. **`implies` clause**: Uses same edge syntax as `from` patterns
   - `implies relation` - shorthand for simple chains
   - `implies $a >rel> $b` - explicit directed edge
   - `implies $a <rel> $b` - bidirectional shorthand
   - Direction is explicit via variable ordering (no `:reverse` modifier needed)

6. **`<rel>` syntax**: Consistent meaning across contexts
   - In `from`: undirected traversal (either direction)
   - In `implies`: bidirectional edge creation (both directions)
   - Concept: `>rel>` = one direction, `<rel>` = both directions

7. **Implicit variables**: `$file` (anchor) and `$result` (end of chain) for simple patterns

---

## Open Questions

1. **Variable naming**: Should `$file` always refer to the "anchor" in TRL, or use a different name like `$self` or `$anchor`?

2. **Special patterns**: Are the proposed special patterns (`folder_siblings`, etc.) sufficient? What others might be needed?

3. **Cross-language references**: Should TQL be able to reference TRL rules, or vice versa? If so, syntax?

4. **Rule priority**: When multiple rules could create the same edge, which wins? First match? Most specific?

5. **Quantifiers in chains**: How do quantifiers interact with chains?
   ```
   from up+ >> down    # All ancestors, then their children
   from (up >> down)+  # Repeated chain - is this useful/needed?
   ```

6. **Self-inclusion with `*`**: Is `up*` (zero or more, includes self) useful, or confusing?

7. **Partial vs full pattern match**: In TQL, should bound patterns require matching all variables?
   ```
   from $file >up> $parent >up> $gp
   # What if $file has a parent but no grandparent?
   # Show parent with $gp unbound, or exclude entirely?
   ```
