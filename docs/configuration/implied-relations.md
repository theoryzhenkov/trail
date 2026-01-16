# Implied Relations

Implied relations are Trail's killer feature. Define a rule once, and Trail automatically creates bidirectional links without you having to add them manually.

---

## The Problem

Without implied relations, bidirectional linking requires double work:

**In Parent.md:**
```markdown
down::[[Child]]
```

**In Child.md:**
```markdown
up::[[Parent]]
```

If you forget one, your graph has gaps.

---

## The Solution

With an implied relation, you link once:

**In Child.md:**
```markdown
up::[[Parent]]
```

Trail automatically infers that `Parent -down-> Child` exists. You see it in the Trail pane without adding any link to Parent.md.

---

## Configuring Implied Relations

1. Open **Settings → Trail**
2. Expand the relation you want to add implications to
3. In **Implied relations**, click **Add implied relation**
4. Select the target relation and direction

---

## Direction Types

### Forward

Creates the implied relation in the same direction as the source.

```
Source: A -up-> B
Rule:   up → parent (forward)
Result: A -parent-> B
```

**Use case:** Creating aliases. If `up` implies `parent` forward, both mean the same thing.

### Reverse

Creates the implied relation in the opposite direction.

```
Source: A -up-> B
Rule:   up → down (reverse)
Result: B -down-> A
```

**Use case:** Bidirectional hierarchies. Every `up` link automatically creates a `down` link going back.

### Both

Creates implied relations in both directions.

```
Source: A -up-> B
Rules:  up → parent (both)
Result: A -parent-> B AND B -parent-> A
```

**Use case:** Symmetric relationships like "related-to" or "sibling".

---

## Default Implied Relations

Trail's default configuration includes these rules:

| Source | Target | Direction | Meaning |
|--------|--------|-----------|---------|
| `up` | `down` | Reverse | If A is up from B, B is down from A |
| `down` | `up` | Reverse | If A is down from B, B is up from A |
| `next` | `prev` | Reverse | If A is next after B, B is prev before A |
| `prev` | `next` | Reverse | If A is prev before B, B is next after A |

---

## Practical Examples

### Family Tree

**Relations:**

- `parent` (ascending)
- `child` (descending)

**Implied rules:**

- `parent` → `child` (reverse)
- `child` → `parent` (reverse)

**In Alice.md:**
```markdown
parent::[[Bob]]
```

**Result:** Bob's Trail pane shows `child: Alice` automatically.

---

### Citation Network

**Relations:**

- `cites` (descending)
- `cited-by` (descending)

**Implied rules:**

- `cites` → `cited-by` (reverse)

**In Paper A.md:**
```markdown
cites::[[Paper B]]
cites::[[Paper C]]
```

**Result:** Paper B and Paper C both show `cited-by: Paper A` in their Trail panes.

---

### Sequential Content

**Relations:**

- `next` (sequential)
- `prev` (sequential)

**Implied rules:**

- `next` → `prev` (reverse)
- `prev` → `next` (reverse)

**In Chapter 1.md:**
```markdown
next::[[Chapter 2]]
```

**Result:** Chapter 2's Trail pane shows `prev: Chapter 1`.

---

### Symmetric Relationships

**Relations:**

- `related` (descending)

**Implied rules:**

- `related` → `related` (reverse)

**In Topic A.md:**
```markdown
related::[[Topic B]]
```

**Result:** Topic B shows `related: Topic A`. The relationship is symmetric—adding it once links both ways with the same relation type.

---

## Implied vs Explicit

In the Trail pane, implied relations appear slightly muted compared to explicit ones. This helps you distinguish:

- **Explicit**: You added this link directly
- **Implied**: Trail inferred this from a rule

Both are fully functional for navigation and traversal.

See [Implied vs Explicit](../concepts/implied-vs-explicit.md) for more details.

---

## Chain Implications

Implied relations can chain through multiple levels.

**Example:**

- `A -up-> B` (explicit)
- Rule: `up` → `down` (reverse)
- Result: `B -down-> A` (implied)

If you have another rule:

- Rule: `down` → `contains` (forward)
- Result: `B -contains-> A` (implied from implied)

Trail computes the full transitive closure of implications.

---

## Best Practices

### Always Set Up Reverse Relations

For any hierarchical relation, define the reverse:

```
parent → child (reverse)
child → parent (reverse)
```

This ensures your graph is complete from any entry point.

### Use Forward for Aliases

If you want multiple names for the same concept:

```
up → parent (forward)
up → ancestor (forward)
```

Now `up`, `parent`, and `ancestor` all create the same connections.

### Be Careful with Both

The `both` direction creates symmetric relationships. Only use it when the relationship truly works both ways (like "related-to" or "sibling").

Don't use `both` for hierarchical relations—`parent` (both) would make every parent also a child of their children.

---

## Troubleshooting

### Implied Relations Not Appearing

1. **Check the rule exists**: Open the source relation's settings and verify the implied relation is configured
2. **Check direction**: Forward vs reverse makes a big difference
3. **Check relation names**: The target relation must exist
4. **Refresh**: Open the Trail pane's menu and click Refresh

### Too Many Implied Relations

If your Trail pane is cluttered:

1. Review your implied rules for unintended chains
2. Use the filter menu to hide specific relation types
3. Consider whether you need all the implications you've defined
