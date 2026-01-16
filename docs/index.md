# Trail

**Add typed relations to your notes and traverse them via a powerful hierarchy view.**

Trail is an Obsidian plugin that lets you create meaningful connections between your notes using named relations like `up`, `down`, `next`, and `prev`—or any custom relations you define. Instead of relying on generic backlinks, Trail gives you semantic relationships that you can visualize and navigate through a dedicated pane.

---

## Why Trail?

Obsidian's built-in backlinks show you *that* notes are connected, but not *how* they're connected. Trail changes that:

- **Semantic relationships**: Define what each link means—is it a parent? A child? The next chapter?
- **Automatic inference**: Set up implied relations so `A -up-> B` automatically creates `B -down-> A`
- **Flexible syntax**: Add relations inline with `::` syntax or in frontmatter
- **Powerful visualization**: Browse hierarchies, filter by relation type, and see the full context of any note

---

## Quick Example

Say you're building a family tree. With Trail, you can write:

```markdown
---
relations:
  parent:
    - "[[Alice]]"
    - "[[Bob]]"
---

# Charlie

up::[[Alice]]
```

Open the Trail pane, and you'll see Charlie's full ancestry—Alice and Bob as parents, and their parents above them.

---

## Key Features

<div class="grid cards" markdown>

-   :material-link-variant:{ .lg .middle } **Named Relations**

    ---

    Create semantic links with custom relation types. Go beyond generic backlinks to capture *how* notes relate.

    [:octicons-arrow-right-24: Learn syntax](syntax/index.md)

-   :material-family-tree:{ .lg .middle } **Implied Relations**

    ---

    Define rules like "up implies down in reverse" so you only need to link once. Trail infers the rest.

    [:octicons-arrow-right-24: Configure implied relations](configuration/implied-relations.md)

-   :material-layers-outline:{ .lg .middle } **Relation Groups**

    ---

    Organize relations into visual groups like "Ancestors" or "Siblings" with custom filtering and sorting.

    [:octicons-arrow-right-24: Set up groups](configuration/groups.md)

-   :material-filter-variant:{ .lg .middle } **Smart Filtering**

    ---

    Filter relations by properties. Show different groups based on the active note's type.

    [:octicons-arrow-right-24: Explore filtering](configuration/filtering.md)

</div>

---

## Getting Started

Ready to add structure to your vault? Start with the [Getting Started guide](getting-started.md) to install Trail and create your first relations in under 5 minutes.

---

## Support

If you find Trail useful, consider [buying me a coffee](https://buymeacoffee.com/theoryzhenkov) :material-coffee:{ .heart }

---

## Documentation Overview

| Section | Description |
|---------|-------------|
| [Getting Started](getting-started.md) | Install and create your first relation |
| [Syntax](syntax/index.md) | Inline and frontmatter syntax reference |
| [Configuration](configuration/index.md) | Relations, groups, filters, and sorting |
| [Usage](usage/trail-pane.md) | Using the Trail pane |
| [Concepts](concepts/index.md) | How Trail works under the hood |
| [Examples](examples/index.md) | Real-world use cases |
| [Reference](reference/default-config.md) | Default configuration and relation types |
