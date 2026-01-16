# Examples

Real-world examples showing how to set up Trail for different use cases. Each example includes complete configuration and sample notes.

---

## Available Examples

<div class="grid cards" markdown>

-   :material-family-tree:{ .lg .middle } **Family Tree**

    ---

    Track family relationships with parent/child relations, display birth years and other biographical data.

    [:octicons-arrow-right-24: Family tree setup](family-tree.md)

-   :material-clipboard-list-outline:{ .lg .middle } **Project Hierarchy**

    ---

    Organize projects, epics, tasks, and subtasks with filtering by status and priority sorting.

    [:octicons-arrow-right-24: Project hierarchy setup](project-hierarchy.md)

-   :material-book-open-page-variant:{ .lg .middle } **Sequential Notes**

    ---

    Navigate book chapters, daily notes, or any sequential content with next/prev relations.

    [:octicons-arrow-right-24: Sequential notes setup](sequential-notes.md)

</div>

---

## Building Your Own

These examples demonstrate patterns you can adapt:

| Pattern | Example | Your Use Case |
|---------|---------|---------------|
| Hierarchical | Family tree, Project hierarchy | Categories, taxonomies, org charts |
| Sequential | Book chapters | Course lessons, workflows, timelines |
| Bidirectional | All examples | Any relationship that works both ways |
| Filtered groups | Project hierarchy | Different views for different note types |
| Display properties | Family tree | Show metadata alongside links |

---

## Starting Points

### If You Want Hierarchy

Start with [Family Tree](family-tree.md) or [Project Hierarchy](project-hierarchy.md). They show:

- Parent/child relations
- Implied bidirectional links
- Unlimited depth traversal

### If You Want Sequences

Start with [Sequential Notes](sequential-notes.md). It shows:

- Next/prev relations
- Flat list display
- Chain sorting

### If You Want Both

Combine patterns. Many vaults need both hierarchy (categories) and sequence (timelines).

---

## Common Customizations

### Adding a New Relation Type

1. Go to **Settings → Trail**
2. Add a new relation
3. Name it, add aliases, set visual direction
4. Add implied relations for bidirectional linking
5. Add it to a group

### Creating a Filtered Group

1. Add a new group
2. Add members (relations + depth)
3. Add show conditions (when to display)
4. Add filters (which notes to include)
5. Configure sorting and display properties

### Changing Display Properties

1. Expand the group in settings
2. Find "Display properties"
3. Enter comma-separated property names
4. Properties appear as badges in the Trail pane
