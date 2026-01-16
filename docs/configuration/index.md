# Configuration Overview

Trail's power comes from its flexible configuration. Define custom relations, set up automatic inference rules, organize relations into groups, and control how they're displayed.

---

## Settings Location

Access Trail settings at **Settings → Trail** (under Community plugins).

---

## Configuration Sections

### Relations

Relations are the building blocks—named connection types like `up`, `down`, `parent`, or any custom type you define.

Each relation has:

- **Name**: Unique identifier (`up`, `parent`, `contains`)
- **Aliases**: Frontmatter keys that map to this relation
- **Implied relations**: Automatic inferences when this relation exists
- **Visual direction**: How the relation displays in the Trail pane

[:octicons-arrow-right-24: Configure relations](relations.md)

### Implied Relations

Implied relations let you define once, link everywhere. When `A -up-> B` exists, Trail can automatically create `B -down-> A`.

[:octicons-arrow-right-24: Set up implied relations](implied-relations.md)

### Groups

Groups organize relations in the Trail pane. Instead of a flat list, see "Ancestors", "Children", and "Siblings" as separate sections.

Each group can:

- Include multiple relation types
- Traverse to a specific depth
- Extend from other groups
- Filter which files appear
- Sort items by properties

[:octicons-arrow-right-24: Configure groups](groups.md)

### Filtering

Control which notes appear in groups using property-based filters:

- **Filters**: Only show files matching certain criteria
- **Show conditions**: Only show the group when the active note matches

[:octicons-arrow-right-24: Set up filtering](filtering.md)

### Sorting

Customize how items are ordered within groups:

- **Property sorting**: Sort by frontmatter values
- **Chain sorting**: Keep sequential relations (next/prev) in order

[:octicons-arrow-right-24: Configure sorting](sorting.md)

### Display Properties

Show frontmatter values as badges next to file names in the Trail pane.

[:octicons-arrow-right-24: Configure display properties](display-properties.md)

---

## Configuration Philosophy

### Start Simple

Trail's defaults work out of the box:

- `up`/`down` for hierarchies
- `next`/`prev` for sequences
- Automatic bidirectional linking
- Sensible groups for ancestors, children, and siblings

### Customize Incrementally

Add complexity only when you need it:

1. **First**: Use default relations, learn the syntax
2. **Then**: Add custom relations for your domain
3. **Later**: Set up groups with filtering for specific note types
4. **Finally**: Fine-tune sorting and display properties

### Relation Names Are Stable

Once you start using a relation name, treat it as permanent. Changing names requires updating all notes that use them. Choose meaningful names from the start:

| Less Clear | More Clear |
|------------|------------|
| `r1`, `r2` | `parent`, `child` |
| `link` | `cites`, `references` |
| `conn` | `precedes`, `follows` |

---

## Quick Reference

| Feature | Where | Key Settings |
|---------|-------|--------------|
| Add relation | Relations section | Name, aliases |
| Bidirectional links | Each relation | Implied relations |
| Visual hierarchy | Each relation | Visual direction |
| Pane organization | Groups section | Name, members |
| Depth limit | Each group member | Depth (0 = unlimited) |
| Filter items | Each group | Filters, match mode |
| Context visibility | Each group | Show conditions |
| Sort order | Each group | Sort keys, chain sort |
| Property badges | Each group | Display properties |
