# Getting Started

Get Trail up and running in under 5 minutes. By the end of this guide, you'll have created your first relation and explored it in the Trail pane.

---

## Installation

### Install via BRAT (Recommended)

[BRAT](https://github.com/TfTHacker/obsidian42-brat) (Beta Reviewers Auto-update Tester) is the easiest way to install Trail while it's in beta.

1. Install the **BRAT** plugin from **Settings → Community plugins → Browse**
2. Enable BRAT
3. Open BRAT settings and select **Add Beta plugin**
4. Enter `https://github.com/theoryzhenkov/trail` and select **Add Plugin**
5. Enable Trail in **Settings → Community plugins**

### Manual Installation

1. Download `main.js`, `styles.css`, and `manifest.json` from the [latest release](https://github.com/theoryzhenkov/trail/releases)
2. Create a folder at `<YourVault>/.obsidian/plugins/trail/`
3. Copy the downloaded files into that folder
4. Restart Obsidian
5. Enable Trail in **Settings → Community plugins**

---

## Your First Relation

Let's create a simple parent-child relationship between two notes.

### Step 1: Create a Parent Note

Create a new note called `Projects.md`:

```markdown
# Projects

This note contains all my projects.
```

### Step 2: Create a Child Note with a Relation

Create another note called `Website Redesign.md` with an `up` relation pointing to Projects:

=== "Inline Syntax"

    ```markdown
    # Website Redesign

    up::[[Projects]]

    This is my website redesign project.
    ```

=== "Frontmatter Syntax"

    ```markdown
    ---
    relations:
      up: "[[Projects]]"
    ---

    # Website Redesign

    This is my website redesign project.
    ```

Both syntaxes create the same relation. Use whichever feels more natural to you.

### Step 3: Open the Trail Pane

1. Open the Command Palette (`Cmd/Ctrl + P`)
2. Search for **Trail: Open Trail pane**
3. Press Enter

The Trail pane appears in your sidebar. With `Website Redesign` open, you'll see:

```
📄 Website Redesign

▼ Ancestors
  up  Projects
```

### Step 4: See Implied Relations in Action

Trail's default configuration includes implied relations. Because `Website Redesign` has an `up` relation to `Projects`, Trail automatically creates a `down` relation in the reverse direction.

Open `Projects.md` and look at the Trail pane:

```
📄 Projects

▼ Children
  down  Website Redesign
```

You didn't have to add a link in `Projects.md` — Trail inferred it automatically.

---

## Understanding the Default Setup

Trail comes preconfigured with four relations and three groups:

### Default Relations

| Relation | Visual Direction | Implied Relation |
|----------|------------------|------------------|
| `up` | Ascending | Creates `down` in reverse |
| `down` | Descending | Creates `up` in reverse |
| `next` | Sequential | Creates `prev` in reverse |
| `prev` | Sequential | Creates `next` in reverse |

### Default Groups

| Group | Shows | Use Case |
|-------|-------|----------|
| **Ancestors** | `up` relations (unlimited depth) | Parent notes, categories |
| **Children** | `down` relations (unlimited depth) | Child notes, contents |
| **Siblings** | `next` and `prev` (depth 1) | Sequential navigation |

---

## What's Next?

Now that you've created your first relation, explore these topics:

<div class="grid cards" markdown>

-   **Learn the syntax options**

    ---

    Master inline and frontmatter syntax for creating relations.

    [:octicons-arrow-right-24: Syntax guide](syntax/index.md)

-   **Customize your relations**

    ---

    Create custom relation types with your own semantics.

    [:octicons-arrow-right-24: Configure relations](configuration/relations.md)

-   **Set up implied relations**

    ---

    Define rules so Trail automatically creates bidirectional links.

    [:octicons-arrow-right-24: Implied relations](configuration/implied-relations.md)

-   **Explore real examples**

    ---

    See how to build family trees, project hierarchies, and more.

    [:octicons-arrow-right-24: Examples](examples/index.md)

</div>
