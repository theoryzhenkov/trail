# Filtering Relations

The Trail pane's filter menu lets you temporarily hide specific relation types. This helps you focus on what matters without changing your configuration.

---

## Opening the Filter Menu

Click the **Filter** button (funnel icon) in the Trail pane header.

The menu shows all defined relation types with checkboxes.

---

## Using Filters

### Toggle Relations

Click a relation name to toggle its visibility:

- **Checked** (✓): Relation appears in the Trail pane
- **Unchecked**: Relation is hidden

Changes apply immediately—no need to confirm.

### Select All / Select None

Quick actions at the top of the menu:

- **Select all**: Show all relation types
- **Select none**: Hide all relation types (useful as a starting point)

---

## Filter Badge

When not all relations are visible, a badge appears in the header:

```
📄 Current Note  [2/4]
```

This shows "2 of 4 relation types are visible". It's a quick reminder that filtering is active.

---

## What Filtering Affects

### What's Filtered

- Relation items in all groups
- Group item counts
- Empty state detection

### What's NOT Filtered

- Group visibility (controlled by show conditions, not the filter menu)
- Configuration settings
- The actual data in your notes

---

## Filter Persistence

Filters persist during your session:

- Switching notes: Filters stay
- Closing/reopening the pane: Filters stay
- Restarting Obsidian: Filters reset to "all visible"

Filters are a temporary view preference, not a saved setting.

---

## Use Cases

### Focus on Hierarchy

When exploring a hierarchical structure, hide sequential relations:

1. Open filter menu
2. Uncheck `next` and `prev`
3. Only `up` and `down` appear

Now the Trail pane shows pure hierarchy without sibling noise.

### Focus on Sequence

When navigating sequential content like book chapters:

1. Open filter menu
2. Click **Select none**
3. Check only `next` and `prev`

See only the reading order, not the category hierarchy.

### Debugging Relations

To see all relations of a specific type:

1. Open filter menu
2. Click **Select none**
3. Check only the relation you're investigating

Isolate one relation type to verify it's working as expected.

### Simplify Complex Graphs

If you have many relation types:

1. Open filter menu
2. Uncheck rarely-used relations
3. Keep only the most relevant ones visible

Reduce clutter while exploring.

---

## Filtering vs Configuration

| Feature | Filter Menu | Configuration |
|---------|-------------|---------------|
| **Scope** | Current session | Permanent |
| **Speed** | Instant toggle | Requires save |
| **Purpose** | Temporary focus | Define structure |
| **Persists** | Until restart | Always |

Use filters for quick, temporary changes. Use configuration for your permanent setup.

---

## Filtering vs Group Filters

The filter menu is different from group filters in settings:

| Feature | Filter Menu | Group Filters |
|---------|-------------|---------------|
| **What it filters** | Relation types | Files by properties |
| **Scope** | All groups | One group |
| **Where configured** | Trail pane | Settings |

They can work together:

1. Group filters hide notes without `type: task`
2. Filter menu hides `prev` relations
3. You see only `up`/`down`/`next` relations to task notes

---

## Tips

### Start with All

Begin with all relations visible to see the full picture, then filter down.

### Use for Learning

When learning Trail, toggle relations on/off to understand what each type shows.

### Reset When Stuck

If the Trail pane seems empty but shouldn't be, check if filtering is hiding everything. Click **Select all** to reset.

### Combine with Navigation

Filter to one relation type, then click through notes to follow that specific path through your vault.
