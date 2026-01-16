# The Trail Pane

The Trail pane is your window into your note's relationships. It shows all configured groups with their relations, lets you navigate your vault by following connections, and updates automatically as you work.

---

## Opening the Trail Pane

### Via Command

1. Open the Command Palette (`Cmd/Ctrl + P`)
2. Search for **Trail: Open Trail pane**
3. Press Enter

The pane opens in your sidebar.

### Keeping It Open

The Trail pane stays where you put it. Drag it to your preferred sidebar location—left, right, or as a tab alongside other panes like Files or Backlinks.

---

## Pane Anatomy

```
┌─────────────────────────────────┐
│ 📄 Current Note Name        🔄 │  ← Header
├─────────────────────────────────┤
│ ▼ Ancestors                 (2) │  ← Group
│   up  Parent Note               │  ← Relation item
│     up  Grandparent Note        │  ← Nested item
├─────────────────────────────────┤
│ ▼ Children                  (3) │
│   down  Child A                 │
│   down  Child B                 │
│   down  Child C                 │
├─────────────────────────────────┤
│ ▼ Siblings                  (0) │
│   No relations found            │
└─────────────────────────────────┘
```

### Header

Shows the current note's name and action buttons:

- **Filter** (funnel icon): Open the filter menu
- **Refresh** (circular arrows): Manually refresh the view

### Groups

Collapsible sections based on your group configuration. Each shows:

- Group name
- Item count in parentheses
- Expand/collapse chevron

### Relation Items

Each item displays:

- **Relation tag**: The relation type (`up`, `down`, etc.)
- **File name**: Clickable link to the note
- **Property badges**: Configured display properties (if any)
- **Implied indicator**: Slightly muted style for implied relations

---

## Navigating

### Click to Open

Click any file name to open that note. The Trail pane updates to show the new note's relations.

### Explore Hierarchies

Follow `up` relations to explore parent notes. The Trail pane updates each time, letting you traverse your entire hierarchy.

### Context Menu

Right-click a file name for Obsidian's standard context menu:

- Open in new tab
- Open in new window
- Open to the right
- Reveal in navigation
- And more...

---

## Visual Indicators

### Relation Tags

Small colored tags show the relation type:

```
up  Parent Note
down  Child Note
```

### Implied Relations

Implied relations appear slightly muted:

```
up  Parent Note           ← explicit (you added this link)
up  Parent Note           ← implied (from a rule, more muted)
```

This helps you distinguish links you created from those Trail inferred.

### Nesting

Related notes are nested to show depth:

```
▼ Ancestors
  up  Parent
    up  Grandparent
      up  Great-Grandparent
```

Deeper nesting = further from the current note.

### Empty States

When a group has no results:

```
▼ Siblings                  (0)
  No relations found
```

---

## Automatic Updates

The Trail pane updates automatically when:

- You switch to a different note
- You edit the current note's relations
- You modify frontmatter
- You rename or delete related notes

No manual refresh needed in normal use.

### Manual Refresh

If something seems out of sync:

1. Click the **Refresh** button (circular arrows) in the header

This rebuilds the view from scratch.

---

## Group Behavior

### Collapsing

Click a group header to collapse/expand it. Collapse groups you don't need to reduce visual noise.

### Empty Groups

Groups with no matching relations show "No relations found". Groups hidden by show conditions don't appear at all.

### Group Order

Groups appear in the order configured in settings. Reorder them in **Settings → Trail → Groups**.

---

## Understanding the Tree

### Ascending Relations

For `up`-style relations (visual direction = ascending), the tree is inverted:

```
▼ Ancestors
  up  Grandparent       ← Deepest ancestor at root
    up  Parent          ← Closer ancestor nested below
```

This makes sense because you're looking "up"—the highest ancestor appears first.

### Descending Relations

For `down`-style relations (visual direction = descending), direct connections appear at root:

```
▼ Children
  down  Child A         ← Direct child at root
    down  Grandchild A1 ← Their children nested below
  down  Child B
```

### Sequential Relations

For `next`/`prev` relations (visual direction = sequential), items appear flat:

```
▼ Siblings
  prev  Previous Note
  next  Next Note
```

No nesting—just a sorted list.

---

## Performance

The Trail pane is designed to be fast:

- **Lazy loading**: Only computes what's visible
- **Caching**: Reuses computed results when possible
- **Debouncing**: Batches rapid changes to avoid flicker

For very large vaults (10,000+ notes), initial load may take a moment. Subsequent updates are instant.

---

## Tips

### Pin the Trail Pane

Keep it open in a sidebar for constant context as you navigate.

### Use with Graph View

Trail shows semantic relations. Obsidian's graph view shows all links. Use both for complete picture.

### Collapse Unused Groups

If you rarely use a group, collapse it to focus on what matters.

### Check Implied Relations

If a relation seems missing, check if it's implied. Implied relations work but appear muted.
