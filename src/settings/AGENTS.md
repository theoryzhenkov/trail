# Settings Module - Agent Instructions

## Module Overview

This module manages plugin configuration: relation definitions, TQL-based groups, and provides visual/query editors. Settings persist via Obsidian's `loadData()`/`saveData()` API.

## Key Invariants

1. **TQL is Authoritative**: The `query` field in `GroupDefinition` is the source of truth. Visual editor changes generate TQL, not the other way around.

2. **Migration on Load**: Legacy groups and old TQL syntax are auto-migrated in `buildSettings()`. Never assume saved data is in the latest format.

3. **Visual Editor is Optional**: Complex queries fall back to query editor. `isVisualEditable()` determines if visual editing is possible.

4. **Tab State Preservation**: Open/collapsed states are preserved across re-renders using `saveOpenState()` / `openSections` sets.

5. **Settings Save Flow**: Always call `plugin.saveSettings()` after modifying settings. This persists data AND updates the graph.

## File Responsibilities

| File | Responsibility | When to Modify |
|------|---------------|----------------|
| `index.ts` | Settings interface, buildSettings(), exports | Adding settings fields, migration logic |
| `defaults.ts` | Default values for new installs | Changing default relations/groups |
| `settings-tab.ts` | Main tab class, tab navigation | Adding new tabs |
| `validation.ts` | Input validation | Adding validation rules |
| `visual-editor.ts` | TQL ↔ form conversion | Expanding visual editor features |
| `tabs/relations-tab.ts` | Relations UI | Changing relation settings UI |
| `tabs/groups-tab.ts` | Groups UI, migration UI | Changing group settings UI |
| `components/*.ts` | Reusable UI pieces | Adding shared UI patterns |

## Common Tasks

### Adding a New Setting Field

1. **Add to TrailSettings interface** in `index.ts`:
```typescript
export interface TrailSettings {
  // ... existing fields
  myNewSetting: boolean;
}
```

2. **Add default value** in `index.ts`:
```typescript
export const DEFAULT_SETTINGS: TrailSettings = {
  // ... existing defaults
  myNewSetting: false,
};
```

3. **Handle in buildSettings()** in `index.ts`:
```typescript
return {
  // ... existing fields
  myNewSetting: data.myNewSetting ?? false,
};
```

4. **Add UI** in the appropriate tab renderer:
```typescript
new Setting(containerEl)
  .setName("My new setting")
  .setDesc("Description of what it does.")
  .addToggle((toggle) => {
    toggle
      .setValue(this.plugin.settings.myNewSetting)
      .onChange((value) => {
        this.plugin.settings.myNewSetting = value;
        void this.plugin.saveSettings();
      });
  });
```

### Adding a New Tab

1. **Create renderer** in `tabs/my-tab.ts`:
```typescript
export class MyTabRenderer {
  private plugin: TrailPlugin;
  private display: () => void;

  constructor(plugin: TrailPlugin, display: () => void) {
    this.plugin = plugin;
    this.display = display;
  }

  saveOpenState(containerEl: HTMLElement): Set<number> {
    // Return open section indices
  }

  render(containerEl: HTMLElement, openSections: Set<number>): void {
    // Render tab content
  }
}
```

2. **Export from** `tabs/index.ts`

3. **Add to TrailSettingTab** in `settings-tab.ts`:
```typescript
type SettingsTab = "relations" | "groups" | "mytab";

private myTabRenderer: MyTabRenderer;

constructor(...) {
  this.myTabRenderer = new MyTabRenderer(plugin, () => this.display());
}

private renderTabNavigation(...) {
  // Add tab button
}

private renderTabContent(...) {
  if (this.activeTab === "mytab") {
    this.myTabRenderer.render(content, this.openMyTabSections);
  }
}
```

### Expanding Visual Editor Features

To support more TQL features in visual editor:

1. **Check canVisualizeQuery()** in `visual-editor.ts`:
```typescript
function canVisualizeQuery(ast: QueryNode): boolean {
  // Add your feature check
  if (ast.myNewFeature && !isSimpleMyFeature(ast.myNewFeature)) return false;
  return true;
}
```

2. **Add to VisualQuery interface**:
```typescript
export interface VisualQuery {
  // ... existing fields
  myFeature?: MyFeatureVisual;
}
```

3. **Parse in parseToVisual()**:
```typescript
return {
  // ... existing fields
  myFeature: parseMyFeature(ast.myNewFeature),
};
```

4. **Generate in visualToQuery()**:
```typescript
if (visual.myFeature) {
  lines.push(`myfeature ${formatMyFeature(visual.myFeature)}`);
}
```

5. **Add UI** in `GroupsTabRenderer.renderVisualEditor()`

### Adding Migration Logic

For settings schema changes:

1. **Add migration check** in `savedDataNeedsMigration()`:
```typescript
export function savedDataNeedsMigration(savedData: Partial<TrailSettings> | null): boolean {
  if (!savedData) return false;
  
  // Check for old format
  if (savedData.oldField !== undefined) {
    return true;
  }
  
  return false;
}
```

2. **Add migration in buildSettings()**:
```typescript
export function buildSettings(savedData: Partial<TrailSettings> | null): TrailSettings {
  const data = savedData ?? {};
  
  // Migrate old format to new
  let newField = data.newField;
  if (data.oldField !== undefined && newField === undefined) {
    newField = migrateOldToNew(data.oldField);
  }
  
  return { ..., newField };
}
```

## Anti-Patterns to Avoid

1. **DO NOT** store derived state in settings. Compute from TQL query on demand.

2. **DO NOT** add settings UI without `void this.plugin.saveSettings()` on change.

3. **DO NOT** modify settings in `display()`. It causes infinite re-render loops.

4. **DO NOT** assume saved data matches current schema. Always handle missing fields.

5. **DO NOT** duplicate validation logic. Use shared validators in `validation.ts`.

6. **DO NOT** forget cleanup in tab renderers (editor views, event listeners).

## Testing

Settings have no automated tests. Test manually:

1. Fresh install: verify defaults
2. Legacy migration: create old-format data, verify conversion
3. Visual editor: verify round-trip (query → visual → query)
4. Settings persistence: change settings, reload plugin, verify preserved

## Data Flow

```
Plugin.loadData()
        │
        ▼
Partial<TrailSettings> (may be null, may be old format)
        │
        ▼ buildSettings()
TrailSettings (migrated, with defaults)
        │
        ├───────────────────────────────────┐
        ▼                                   ▼
GraphStore.updateSettings()          TrailSettingTab.display()
        │                                   │
        ▼                                   ▼
Graph rebuild                     Tab renderers
                                          │
                                          ▼ (user edits)
                                plugin.settings mutation
                                          │
                                          ▼ plugin.saveSettings()
                                ┌─────────┴─────────┐
                                ▼                   ▼
                          saveData()          GraphStore.updateSettings()
```

## UI Patterns

### Collapsible Sections

Use `createSectionDetails()` for expandable content:
```typescript
const {details, summary, summaryContent, content} = createSectionDetails(
  containerEl,
  "trail-my-section"
);
details.open = openSections.has(index);
// Add summary content
// Add main content to `content`
```

### Reordering

Use `renderReorderControls()` for array item reordering:
```typescript
renderReorderControls(summary, index, this.plugin.settings.myArray, () => {
  void this.plugin.saveSettings();
  this.display();
});
```

### Validation Feedback

Use `new Notice()` for validation errors:
```typescript
if (!isValidRelationName(normalized)) {
  new Notice("Relation names must use letters, numbers, underscore, or dash.");
  text.setValue(previousValue);
  return;
}
```

## Dependencies

- `obsidian`: Setting, SettingGroup, PluginSettingTab, Notice, setIcon
- `@codemirror/view`: EditorView for TQL code editor
- `../query`: parse(), TQLError, createTQLEditor()
- `../query/migration`: migrateGroup(), migrateAllGroups()
- `../query/syntax-migration`: migrateAllTqlSyntax(), needsSyntaxMigration()
- `../types`: RelationDefinition, GroupDefinition, etc.
