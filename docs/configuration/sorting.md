# Sorting

Trail offers flexible sorting within groups: sort by frontmatter properties, maintain sequential chains, or combine both approaches.

---

## Sort Keys

Sort keys define how items are ordered within a group, based on frontmatter properties.

### Setting Up Sort Keys

1. Open **Settings → Trail**
2. Expand the group you want to sort
3. In the **Sorting** section, click **Add sort key**
4. Enter the property name and direction

### Sort Key Settings

#### Property

The frontmatter property to sort by. Case-insensitive.

**Examples:** `order`, `date`, `priority`, `title`

#### Direction

| Direction | Behavior |
|-----------|----------|
| **Ascending (a→z)** | Smallest/earliest first |
| **Descending (z→a)** | Largest/latest first |

### Multiple Sort Keys

Add multiple sort keys for tie-breaking. Items are sorted by the first key, then by the second for items with equal first values, and so on.

**Example:** Sort by priority, then by date

| Property | Direction |
|----------|-----------|
| `priority` | Ascending |
| `date` | Descending |

Notes with the same priority are sorted by date (newest first).

### Default Sort Order

When no sort keys are defined, items are sorted alphabetically by file name.

---

## Chain Sort

Chain sort is designed for sequential relations like `next`/`prev`. It keeps chains of connected notes together instead of scattering them alphabetically.

### What's a Chain?

When notes form a sequence via sequential relations:

```
Note A -next-> Note B -next-> Note C
```

This is a chain: A → B → C.

### Chain Sort Priority

The **Chain sort priority** setting controls how chains interact with property sorting:

| Mode | Behavior |
|------|----------|
| **Primary** | Chains stay intact, sorted by head's properties |
| **Secondary** | Property sort first, chains within same property groups |
| **Disabled** | No chain sorting, pure property/alphabetical sort |

---

## Chain Sort: Primary Mode

Chains are the primary organizing principle.

**How it works:**

1. Identify chains of connected notes
2. Sort chains by the head note's properties
3. Within each chain, maintain sequence order

**Example:**

Notes with dates:

- `Day 1` (date: 2024-01-01) → `Day 2` (date: 2024-01-02) → `Day 3` (date: 2024-01-03)
- `Meeting A` (date: 2024-01-02) → `Meeting B` (date: 2024-01-05)

With **Chain sort: Primary** and sort by date ascending:

```
Day 1
  Day 2
    Day 3
Meeting A
  Meeting B
```

Chains stay intact. The Day chain starts on 01-01, Meeting chain on 01-02, so Day comes first.

---

## Chain Sort: Secondary Mode

Properties are the primary organizing principle, but chains within the same property group stay together.

**How it works:**

1. Sort all items by properties
2. Within items that have the same property values, keep chains together

**Example:**

Notes with status:

- `Task A` (status: active) → `Task B` (status: active)
- `Task C` (status: active)
- `Task D` (status: done)

With **Chain sort: Secondary** and sort by status:

```
▼ Active
  Task A
    Task B
  Task C
▼ Done
  Task D
```

Property grouping first, chain integrity second.

---

## Chain Sort: Disabled

Pure property/alphabetical sorting. Chain connections are ignored for ordering.

**When to use:**

- When you don't have sequential relations in the group
- When you want strict property ordering regardless of connections
- For simple hierarchies where chains don't matter

---

## Sorting Examples

### Task Priority

**Sort keys:**

| Property | Direction |
|----------|-----------|
| `priority` | Ascending |
| `due` | Ascending |

**Chain sort:** Disabled

Sorts tasks by priority (1 before 2 before 3), then by due date.

---

### Chronological Notes

**Sort keys:**

| Property | Direction |
|----------|-----------|
| `date` | Ascending |

**Chain sort:** Primary

Chains of connected notes stay together, ordered by when the chain starts.

---

### Alphabetical with Chains

**Sort keys:** None (alphabetical default)

**Chain sort:** Primary

Chains stay together, sorted alphabetically by the head note's name.

---

### Research Papers by Year

**Sort keys:**

| Property | Direction |
|----------|-----------|
| `year` | Descending |
| `author` | Ascending |

**Chain sort:** Disabled

Newest papers first, alphabetically by author within each year.

---

## Sequential Relations

For chain sort to work, your relations need **Visual direction: Sequential**.

The default `next` and `prev` relations have this set. For custom sequential relations, set the visual direction in the relation settings.

**Sequential relations are:**

- Treated as chains when chain sort is enabled
- Rendered as flat lists (not nested trees)
- Sorted within their chain by the order of connections

---

## Sort Order Reordering

Multiple sort keys can be reordered using the arrow buttons. Earlier keys take precedence.

**Order matters:**

1. `priority` → `date`: Group by priority, then sort by date within
2. `date` → `priority`: Group by date, then sort by priority within

---

## Missing Property Values

Notes without a sort property are placed:

- **At the end** for ascending sort
- **At the beginning** for descending sort

This keeps sorted items together, with unsorted items grouped separately.

---

## Best Practices

### Match Sort to Purpose

| Purpose | Recommended Setup |
|---------|-------------------|
| Sequential content (chapters, days) | Chain sort: Primary, sort by date/order |
| Hierarchies (projects, categories) | Chain sort: Disabled, sort by name/priority |
| Mixed content | Chain sort: Secondary, sort by type/status |

### Use Explicit Order Properties

Instead of relying on file names or dates, consider an explicit `order` property:

```yaml
---
order: 1
---
```

This gives you full control over sort order.

### Keep It Simple

Complex multi-key sorting can be confusing. Start with one sort key and add more only if needed.
