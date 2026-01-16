# Implied vs Explicit Relations

Trail distinguishes between relations you create directly and those it infers from rules. Understanding this distinction helps you build complete graphs with minimal effort.

---

## Definitions

### Explicit Relations

Relations you add directly in your notes:

```markdown
up::[[Parent Note]]
```

or

```yaml
---
relations:
  up: "[[Parent Note]]"
---
```

You typed it. It's explicit.

### Implied Relations

Relations Trail creates automatically based on rules:

If you configure `up → down (reverse)`, then:

- **Explicit**: Child has `up::[[Parent]]`
- **Implied**: Parent has `down::Child` (you never typed this)

The implied relation exists in the graph but not in any file.

---

## Visual Distinction

In the Trail pane, implied relations appear slightly muted:

```
▼ Ancestors
  up  Parent Note         ← Brighter (explicit)
  
▼ Children  
  down  Child Note        ← Slightly muted (implied)
```

This visual difference helps you understand:

- What you linked
- What Trail inferred

---

## Why It Matters

### Knowing the Source

When debugging or modifying your graph:

- **Explicit**: Edit the source note to change it
- **Implied**: Change the rule or the source relation

If `Parent -down→ Child` is implied from `Child -up→ Parent`, you can't remove it by editing Parent. You must edit Child or the implied relation rule.

### Completeness Check

Implied relations show your graph is complete:

- See `down` relations without manually adding them
- Every `up` creates a corresponding `down`

If you expected a relation but don't see it, check if the source relation exists for implication.

### Intentionality

Sometimes you want to know: "Did I mean to link these, or did Trail infer it?"

- **Explicit**: Intentional connection you made
- **Implied**: Automatic consequence of rules

---

## How Implication Works

### Forward Direction

Creates the same edge from source to target:

```
Rule: up → parent (forward)

Explicit: A -up→ B
Implied:  A -parent→ B
```

Both point the same direction. Use for aliases.

### Reverse Direction

Creates an edge in the opposite direction:

```
Rule: up → down (reverse)

Explicit: A -up→ B
Implied:  B -down→ A
```

Source becomes target, target becomes source. Use for bidirectional hierarchies.

### Both Directions

Creates edges in both directions:

```
Rule: related → related (both)

Explicit: A -related→ B
Implied:  A -related→ B (forward, same as explicit)
          B -related→ A (reverse)
```

Use for symmetric relationships.

---

## Implication Chains

Implied relations can trigger other implications:

```
Rules:
  up → down (reverse)
  down → child (forward)

Explicit: A -up→ B
Implied:  B -down→ A (from rule 1)
          B -child→ A (from rule 2, applied to the implied down)
```

Trail computes the full transitive closure. This is powerful but can create unexpected edges—keep your rules simple.

---

## Common Patterns

### Bidirectional Hierarchy

```
up → down (reverse)
down → up (reverse)
```

Every hierarchy link works both ways.

### Citation Network

```
cites → cited-by (reverse)
```

Papers you cite show you in their "cited by" list.

### Symmetric Relation

```
related → related (reverse)
```

or

```
sibling → sibling (both)
```

If A relates to B, B relates to A.

### Alias Relations

```
up → parent (forward)
up → ancestor (forward)
```

Multiple names for the same concept.

---

## When to Use Each

### Use Explicit When

- The relationship has special significance
- You want to document why notes are connected
- The connection is one-way only
- You're establishing the primary source of truth

### Use Implied When

- Bidirectional links should be automatic
- You want to avoid duplicate maintenance
- The relationship is logically derivable
- Consistency matters (no forgotten reverse links)

---

## Best Practices

### Start Explicit

When building your vault, add explicit relations. You can always add implications later.

### Add Implications for Consistency

Once you have a pattern (always adding `up` and `down` manually), create an implied rule and remove the manual `down` links.

### Don't Over-Imply

Too many implication rules create a tangled graph. Keep rules minimal and intentional.

### Document Your Rules

If your implications are complex, document them somewhere you'll remember. Future you will thank present you.

---

## Debugging

### "Why does this relation exist?"

1. Check if it's explicit (look in the source note)
2. If not, check implied rules
3. Trace backward: what explicit relation could have created it?

### "Why isn't this relation showing?"

1. Check the source relation exists
2. Check the implied rule is configured correctly
3. Check direction (forward vs reverse)
4. Check the target relation type is defined

### "Implied relation is wrong"

1. Review your implication rules
2. Check for unintended chains
3. Consider simplifying your rules
