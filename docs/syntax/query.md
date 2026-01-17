# Trail Query Language (TQL)

TQL is a powerful query language for defining Trail groups. Instead of configuring groups through the visual editor, you can write declarative queries that specify exactly which relations to traverse, how to filter results, and what to display.

---

## Quick Example

```
group "Project Ancestors"
from up depth unlimited
prune status = "archived"
where priority >= 3
when type = "project"
sort by chain, date desc
display status, priority
```

This query:

1. Creates a group named "Project Ancestors"
2. Traverses `up` relations with no depth limit
3. Skips archived notes and their subtrees during traversal
4. Keeps only notes with priority 3 or higher
5. Shows the group only when viewing a project note
6. Sorts by chain order, then by date descending
7. Displays status and priority as badges

---

## Query Structure

Every TQL query follows this structure:

```
group "Name"              -- Required: group name
from <relations>          -- Required: what to traverse
prune <expression>        -- Optional: skip subtrees during traversal
where <expression>        -- Optional: filter results after traversal
when <expression>         -- Optional: show group only for matching notes
sort by <keys>            -- Optional: custom sort order
display <properties>      -- Optional: show property badges
```

!!! tip "Clause Order"
    Clauses must appear in this order: `group`, `from`, `prune`, `where`, `when`, `sort`, `display`.

---

## Clauses

### GROUP

Defines the display name for the group in the Trail pane.

```
group "Ancestors"
group "Related Projects"
group "Family Members"
```

---

### FROM

Specifies which relations to traverse and how.

```
from up                           -- traverse up, unlimited depth
from up depth 3                   -- traverse up, max 3 levels
from up, down depth 2             -- multiple relations
from up extend Children           -- extend with another group's config
```

#### Depth Modifier

Controls how many levels to traverse:

| Syntax | Behavior |
|--------|----------|
| `depth unlimited` | Follow the chain as far as it goes (default) |
| `depth 1` | Direct connections only |
| `depth 2` | Direct connections + one level deeper |
| `depth N` | Up to N levels |

```
from up depth unlimited           -- explicit unlimited
from down depth 3                 -- max 3 levels deep
```

#### Extend Modifier

Continue traversal using another group's configuration. Useful for showing context.

```
from next depth 1 extend Ancestors
```

This finds immediate `next` connections, then shows their ancestors.

!!! note "Modifier Order"
    `depth` and `extend` can appear in any order: `depth 5 extend Children` equals `extend Children depth 5`.

---

### PRUNE

Filters nodes **during traversal**. Matching nodes and their entire subtrees are skipped.

```
prune status = "archived"         -- skip archived notes and children
prune hasTag("private")           -- skip private notes and children
```

**Key behavior:** Pruned subtrees are never traversed—this improves performance for large graphs.

---

### WHERE

Filters nodes **after traversal**. Matching nodes are kept; others are hidden but their children remain visible.

```
where priority >= 3               -- keep high priority notes
where status != "archived"        -- keep non-archived notes
where hasTag("active")            -- keep notes with "active" tag
```

**Key difference from PRUNE:**

- `prune` skips entire subtrees (nodes + children)
- `where` hides individual nodes but keeps their children visible

When a node's parent is filtered by WHERE, the UI shows `...` to indicate hidden ancestry.

---

### WHEN

Controls whether the entire group is visible, based on the **active file's** properties.

```
when type = "project"             -- show only for project notes
when hasTag("daily")              -- show only for daily notes
when file.folder = "People"       -- show only in People folder
```

If the WHEN condition fails, the group doesn't appear in the Trail pane.

---

### SORT

Specifies sort order for siblings at each tree level.

```
sort by date desc                 -- sort by date, newest first
sort by chain, date desc          -- chain order primary, date secondary
sort by priority asc, file.name   -- priority first, then name
```

#### The `chain` Keyword

For sequential relations (`next`/`prev`), `chain` preserves the sequence order:

```
sort by chain                     -- keep sequence order
sort by chain, priority desc      -- sequence first, then priority
```

#### Sort Direction

| Direction | Behavior |
|-----------|----------|
| `asc` | Ascending (default) |
| `desc` | Descending |

---

### DISPLAY

Controls which properties appear as badges next to file names.

```
display status, priority          -- show specific properties
display all                       -- show all frontmatter properties
display all, file.modified        -- all frontmatter + file metadata
```

**`display all` includes:**

- All frontmatter properties from files

**`display all` excludes:**

- Relation-alias properties
- File metadata (add explicitly: `file.created`, `file.modified`)

---

## Expressions

TQL supports rich expressions for filtering and conditions.

### Comparison Operators

| Operator | Meaning |
|----------|---------|
| `=` | Equals |
| `!=` | Not equals |
| `<` | Less than |
| `>` | Greater than |
| `<=` | Less than or equal |
| `>=` | Greater than or equal |
| `=?` | Null-safe equals |
| `!=?` | Null-safe not equals |

#### Null-Safe Operators

Standard operators return null when comparing with null values. Null-safe operators handle missing properties gracefully:

```
status = "active"                 -- excludes notes without status property
status !=? "archived"             -- includes notes without status property
```

### Logical Operators

```
priority >= 3 and status = "active"
type = "project" or type = "epic"
not hasTag("private")
!exists(archived)                 -- ! is alias for not
```

### Arithmetic Operators

```
priority + 1 > 3
file.size / 1000 < 100
```

---

## Property Access

### Simple Properties

Access frontmatter properties directly:

```
status
priority
type
```

### Nested Properties

Use dot notation for nested or prefixed properties:

```
file.name                         -- filename without extension
file.created                      -- creation date
file.modified                     -- modification date
traversal.depth                   -- depth from active file
```

### Reserved Word Properties

Use `prop()` to access properties with reserved names:

```
prop("from")                      -- property named "from"
prop("chain")                     -- property named "chain"
prop("due-date")                  -- property with special characters
```

---

## Built-in Properties

### File Metadata (`file.*`)

| Property | Type | Description |
|----------|------|-------------|
| `file.name` | string | Filename without extension |
| `file.path` | string | Full vault path |
| `file.folder` | string | Parent folder path |
| `file.created` | Date | Creation date |
| `file.modified` | Date | Modification date |
| `file.size` | number | File size in bytes |
| `file.tags` | string[] | Array of tags |

### Traversal Context (`traversal.*`)

| Property | Type | Description |
|----------|------|-------------|
| `traversal.depth` | number | Depth from active file |
| `traversal.relation` | string | Relation name that led here |
| `traversal.isImplied` | boolean | Whether edge is implied |

---

## Built-in Functions

### String Functions

| Function | Description |
|----------|-------------|
| `contains(str, substr)` | Substring check |
| `startsWith(str, prefix)` | Prefix check |
| `endsWith(str, suffix)` | Suffix check |
| `length(str)` | String length |
| `lower(str)` | Lowercase |
| `upper(str)` | Uppercase |
| `trim(str)` | Remove whitespace |
| `matches(str, pattern)` | Regex match |
| `matches(str, pattern, flags)` | Regex with flags (`"i"`, `"m"`, `"s"`) |

```
where contains(title, "Project")
where matches(file.name, "^\\d{4}-\\d{2}-\\d{2}$")
where matches(title, "todo", "i")
```

### File Functions

| Function | Description |
|----------|-------------|
| `inFolder(path)` | Checks if file is in folder |
| `hasTag(tag)` | Checks if file has tag |
| `hasExtension(ext)` | Checks file extension |
| `hasLink(target)` | Checks outgoing links |
| `tags()` | Returns all tags |
| `backlinks()` | Returns backlink paths |
| `outlinks()` | Returns outlink paths |

```
where hasTag("project")
where inFolder("Projects")
when hasTag("daily")
```

### Array Functions

| Function | Description |
|----------|-------------|
| `len(array)` | Array length |
| `first(array)` | First element or null |
| `last(array)` | Last element or null |
| `isEmpty(value)` | True if null, empty string, or empty array |

```
where len(tags()) > 0
where !isEmpty(status)
```

### Existence Functions

| Function | Description |
|----------|-------------|
| `exists(property)` | True if defined and not null |
| `coalesce(a, b, ...)` | First non-null value |
| `ifnull(value, default)` | Value if not null, else default |

```
where exists(priority)
display coalesce(status, "none")
```

### Date Functions

| Function | Description |
|----------|-------------|
| `now()` | Current timestamp |
| `date(str)` | Parse date from string |
| `year(date)` | Extract year |
| `month(date)` | Extract month |
| `day(date)` | Extract day |

---

## Dates and Durations

### Date Literals

```
date = 2024-01-15                 -- ISO date
date = 2024-01-15T14:30:00        -- ISO datetime
```

### Relative Dates

| Keyword | Meaning |
|---------|---------|
| `today` | Current date |
| `yesterday` | One day ago |
| `tomorrow` | One day ahead |
| `startOfWeek` | Start of current week |
| `endOfWeek` | End of current week |

### Duration Arithmetic

| Unit | Meaning |
|------|---------|
| `d` | Days |
| `w` | Weeks |
| `m` | Months |
| `y` | Years |

```
where date > today - 7d           -- last 7 days
where date < file.created + 1m    -- within 1 month of creation
where modified > startOfWeek      -- modified this week
```

### Range Expressions

```
where date in 2024-01-01..2024-12-31
where priority in 1..5
where date in startOfWeek..today
```

---

## The `in` Operator

The `in` operator has different behaviors based on context:

| Expression | Right Type | Behavior |
|------------|------------|----------|
| `"tag" in tags` | Array | Membership check |
| `"sub" in title` | String | Substring check |
| `x in 1..10` | Range | Range check |

```
where "important" in tags()
where "project" in file.path
where priority in 1..3
```

---

## Complete Examples

### Project Hierarchy

```
group "Project Tree"
from up depth unlimited, down depth 3
prune status = "archived"
where priority >=? 3 and hasTag("active")
when type = "project"
sort by chain, priority desc
display status, priority, file.modified
```

### Daily Notes with Context

```
group "Related Notes"
from up depth 1, down depth 2
where file.folder != "Archive"
when matches(file.name, "^\\d{4}-\\d{2}-\\d{2}$")
sort by file.modified desc
display all
```

### Recent Changes

```
group "Recent Changes"
from up, down depth 2
where file.modified > today - 7d
sort by file.modified desc
display file.modified, status
```

### Family Tree

```
group "Family"
from parent depth unlimited
when type = "person"
sort by file.name
display birthdate, relation
```

---

## Syntax Reference

### Reserved Keywords

```
group, from, depth, unlimited, extend, prune, where, when,
sort, by, chain, asc, desc, display, all, and, or, not, in,
true, false, null, today, yesterday, tomorrow, startOfWeek, endOfWeek
```

!!! tip "Using Reserved Words as Property Names"
    Use `prop("keyword")` to access properties that share names with keywords.

### String Escapes

| Escape | Meaning |
|--------|---------|
| `\\` | Backslash |
| `\"` | Double quote |
| `\n` | Newline |
| `\t` | Tab |

```
where title = "Say \"Hello\""
where matches(file.name, "^\\d+$")
```

### Whitespace

TQL ignores whitespace and allows multiline queries:

```
group "Ancestors"
from up depth unlimited
where 
  priority >= 3 
  and status != "archived"
sort by chain, date desc
```

---

## PRUNE vs WHERE

Understanding when to use each:

| Aspect | PRUNE | WHERE |
|--------|-------|-------|
| **When applied** | During traversal | After traversal |
| **Matching nodes** | Skipped entirely | Hidden from display |
| **Children of matches** | Also skipped | Still visible |
| **Performance** | Better (skips subtrees) | Normal |
| **Use for** | Excluding branches | Filtering leaves |

**Example:**

```
-- PRUNE: Skip archived projects and all their children
prune type = "project" and status = "archived"

-- WHERE: Hide archived items but show their non-archived children
where status !=? "archived"
```

---

## Visual vs Query Editor

Trail offers two ways to configure groups:

**Visual Editor** (default):

- Point-and-click configuration
- Limited to simple queries
- Good for getting started

**Query Editor** (TQL):

- Full expression power
- Complex boolean logic
- Date arithmetic and ranges
- Better for power users

Switch between modes in **Settings → Trail → Groups**.
