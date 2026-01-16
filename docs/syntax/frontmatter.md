# Frontmatter Syntax

Frontmatter syntax defines relations in your note's YAML header. This keeps relations organized and separate from your content—ideal for templates and structured note systems.

---

## Three Formats

Trail supports three frontmatter formats. All create identical relations.

### Property Format

The simplest format—use the relation name directly as a property key:

```yaml
---
up: "[[Parent Note]]"
down:
  - "[[Child 1]]"
  - "[[Child 2]]"
---
```

!!! info "Alias Required"
    Property format only works if you've configured an alias of type **Property** for the relation. The default relations (`up`, `down`, `next`, `prev`) include this alias.

### Dot Property Format

Namespace relations under `relations.`:

```yaml
---
relations.up: "[[Parent Note]]"
relations.down: "[[Child Note]]"
---
```

This avoids conflicts with other frontmatter properties.

### Map Format

Group all relations under a `relations` key:

```yaml
---
relations:
  up: "[[Parent Note]]"
  down:
    - "[[Child 1]]"
    - "[[Child 2]]"
  next: "[[Following Note]]"
---
```

This is the most organized format for notes with many relations.

---

## Single vs Multiple Values

### Single Target

All three formats accept a single value:

```yaml
up: "[[Parent]]"
relations.up: "[[Parent]]"
relations:
  up: "[[Parent]]"
```

### Multiple Targets

Use YAML arrays for multiple targets:

```yaml
up:
  - "[[Parent 1]]"
  - "[[Parent 2]]"

relations:
  down:
    - "[[Child A]]"
    - "[[Child B]]"
    - "[[Child C]]"
```

Inline arrays also work:

```yaml
up: ["[[Parent 1]]", "[[Parent 2]]"]
```

---

## Link Formats

Frontmatter accepts flexible link formats:

### Wiki Links

```yaml
up: "[[My Note]]"
up: "[[Folder/Nested Note]]"
up: "[[Note|With Alias]]"
```

### Plain Text

```yaml
up: "My Note"
up: "Folder/Nested Note"
```

Trail resolves plain text to the matching note in your vault.

!!! tip "Quotes Required"
    Always quote your values. Unquoted wiki links cause YAML parsing errors:
    
    ```yaml
    # ✗ Invalid YAML
    up: [[Parent]]
    
    # ✓ Valid
    up: "[[Parent]]"
    ```

---

## Mixing Formats

You can use multiple formats in the same note:

```yaml
---
up: "[[Category]]"
relations.next: "[[Part 2]]"
relations:
  down:
    - "[[Section A]]"
    - "[[Section B]]"
---
```

Trail processes all formats and combines the relations.

---

## Configuring Aliases

Each format requires a corresponding alias in your relation settings.

### Default Aliases

The default relations include all three alias types:

| Relation | Property | Dot Property | Map |
|----------|----------|--------------|-----|
| `up` | `up` | `relations.up` | `relations: { up: }` |
| `down` | `down` | `relations.down` | `relations: { down: }` |
| `next` | `next` | `relations.next` | `relations: { next: }` |
| `prev` | `prev` | `relations.prev` | `relations: { prev: }` |

### Custom Aliases

For custom relations, add aliases in **Settings → Trail**:

1. Create or select a relation
2. Expand the **Aliases** section
3. Add an alias with the desired type:
   - **Property**: Direct key like `parent`
   - **Dot property**: Namespaced like `relations.parent`
   - **Map**: Key within `relations: { parent: }`

You can have multiple aliases per relation:

| Relation | Aliases |
|----------|---------|
| `parent` | `parent`, `relations.parent`, `up` (Property type) |

This lets `up: "[[Note]]"` and `parent: "[[Note]]"` both create `parent` relations.

---

## Examples

### Academic Paper

```yaml
---
relations:
  up: "[[Research Projects]]"
  cites:
    - "[[Smith 2020]]"
    - "[[Jones 2019]]"
    - "[[Lee 2021]]"
  continues: "[[Draft v1]]"
---
```

### Book Chapter

```yaml
---
relations:
  up: "[[Book Title]]"
  prev: "[[Chapter 4]]"
  next: "[[Chapter 6]]"
---
```

### Person in Family Tree

```yaml
---
relations:
  parent:
    - "[[Alice Smith]]"
    - "[[Bob Smith]]"
  spouse: "[[Carol Smith]]"
  child:
    - "[[David Smith]]"
    - "[[Eve Smith]]"
---
```

---

## Troubleshooting

### Relations Not Detected

1. **Check aliases**: Ensure your relation has an alias matching the format you're using
2. **Check quotes**: All values must be quoted
3. **Check YAML validity**: Use Obsidian's Properties view to verify frontmatter parses correctly

### Property Conflicts

If another plugin uses the same property name:

- Use **dot property** format: `relations.up` instead of `up`
- Use **map format**: `relations: { up: }` to namespace everything

### Case Sensitivity

Property names are case-insensitive for Trail:

```yaml
UP: "[[Note]]"      # Creates 'up' relation
Up: "[[Note]]"      # Creates 'up' relation
up: "[[Note]]"      # Creates 'up' relation
```
