# Settings Module

Plugin configuration management with visual and query-based editors. This module handles relation definitions, TQL-based groups, and provides both form-based and code-based editing interfaces.

## Architecture

The settings system separates four concerns:

```
┌─────────────────────────────────────────────────────────────────┐
│                         TrailPlugin                              │
│  Loads/saves settings, passes to GraphStore and views           │
└─────────────────────────────────────────────────────────────────┘
                                │
                                ▼
┌─────────────────────────────────────────────────────────────────┐
│                     TrailSettingTab                              │
│  Main settings tab - manages tabs and delegates to renderers    │
└─────────────────────────────────────────────────────────────────┘
        │                                       │
        ▼                                       ▼
┌───────────────────┐               ┌───────────────────────────┐
│ RelationsTabRenderer│             │  GroupsTabRenderer        │
│ (relation config)   │             │ (TQL groups, visual editor)│
└───────────────────┘               └───────────────────────────┘
                                              │
                                              ▼
                                    ┌───────────────────┐
                                    │  VisualEditor     │
                                    │ (AST ↔ form UI)   │
                                    └───────────────────┘
```

## Data Structure

### TrailSettings

```typescript
interface TrailSettings {
  relations: RelationDefinition[];   // Relation types and aliases
  tqlGroups: GroupDefinition[];      // TQL-based groups (authoritative)
  groups: RelationGroup[];           // @deprecated - legacy groups for migration
  hideEmptyGroups: boolean;          // UI preference
  editorMode: EditorMode;            // "visual" | "query" | "auto"
}
```

### RelationDefinition

Defines a relation type (e.g., "up", "down", "next"):

```typescript
interface RelationDefinition {
  name: string;                      // Unique identifier
  aliases: RelationAlias[];          // Frontmatter key mappings
  impliedRelations: ImpliedRelation[]; // Auto-created relations
  visualDirection?: VisualDirection; // Display style (ascending/descending/sequential)
  icon?: string;                     // Optional Lucide icon
}

interface RelationAlias {
  key: string;  // Alias key with syntax-based interpretation
}
```

Alias keys use syntax-based interpretation:
- `up` → direct property lookup (`up: [[Note]]`)
- `relations.up` → nested object lookup (`relations: { up: [[Note]] }`)
- `"relations.up"` → literal property with dot (`relations.up: [[Note]]`)

### GroupDefinition

A TQL query that defines a display group:

```typescript
interface GroupDefinition {
  query: string;       // TQL query (authoritative source)
  name?: string;       // Optional override
  enabled?: boolean;   // Whether group is shown
}
```

### EditorMode

Controls how TQL groups are edited:

- `"visual"`: Always show visual editor (falls back to query for complex queries)
- `"query"`: Always show raw TQL query editor
- `"auto"`: Show visual editor if query is simple enough

## Visual Editor

The visual editor (`visual-editor.ts`) provides a form-based UI for simple TQL queries. It converts between AST and form fields.

### Supported Query Features

The visual editor supports queries with:
- GROUP clause with name
- FROM clause with multiple relations and depth
- WHEN clause (single property condition)
- WHERE clause (single property condition)
- SORT clause (single key)
- DISPLAY clause (property list)

Complex queries fall back to the query editor:
- Multiple WHERE/WHEN conditions (AND/OR)
- PRUNE clause
- Chain traversal (`>>`)
- Function calls in conditions
- Multiple sort keys

### Data Flow

```
TQL Query String
       │
       ▼ parse()
   QueryNode AST
       │
       ▼ parseToVisual()
   VisualQuery
       │
       ▼ (form edits)
   VisualQuery (modified)
       │
       ▼ visualToQuery()
TQL Query String (saved)
```

## Tab Organization

### Relations Tab

Configures relation types:
- Name and visual direction
- Icon selection (with autocomplete)
- Aliases (frontmatter key mappings)
- Implied relations (auto-created bidirectional links)

### Groups Tab

Configures display groups:
- Options: hide empty groups, editor mode
- TQL groups with visual or query editor
- Legacy groups migration UI (if present)

## Components

Reusable UI components for settings:

| Component | Purpose |
|-----------|---------|
| `section-details.ts` | Collapsible section with summary/content |
| `reorder-controls.ts` | Up/down buttons for array reordering |
| `icon-suggest.ts` | Lucide icon autocomplete |
| `property-filter-row.ts` | Property condition row UI |
| `sort-key-row.ts` | Sort key row UI |

## Migration

### Legacy Groups → TQL

Settings automatically migrate legacy `RelationGroup` format to TQL on load:

1. `buildSettings()` checks for legacy groups
2. `migrateAllGroups()` converts each group to TQL query
3. Legacy groups are cleared after migration
4. Settings are saved to persist migration

### TQL Syntax Migration (3.x → 4.x)

TQL syntax auto-migrates on load:
- `migrateAllTqlSyntax()` updates query syntax
- `needsSyntaxMigration()` detects old syntax
- Changes are saved automatically

## Files

| File | Purpose |
|------|---------|
| `index.ts` | Settings interface, defaults, buildSettings(), exports |
| `defaults.ts` | Default relations and TQL groups |
| `settings-tab.ts` | Main PluginSettingTab class |
| `validation.ts` | Relation name validation |
| `visual-editor.ts` | AST ↔ visual form conversion |
| `tabs/relations-tab.ts` | Relations tab renderer |
| `tabs/groups-tab.ts` | Groups tab renderer |
| `components/*.ts` | Reusable UI components |

## Usage

### Loading Settings

```typescript
// In main.ts
const savedData = await this.loadData();
this.settings = buildSettings(savedData);
```

### Saving Settings

```typescript
await this.saveData(this.settings);
this.graph.updateSettings(this.settings);
```

### Checking for Migration

```typescript
import { savedDataNeedsMigration } from "./settings";

if (savedDataNeedsMigration(savedData)) {
  await this.saveData(this.settings);
}
```
