# Architecture Improvements - February 2026

## Summary

Fixed four critical architectural issues that were creating implicit coupling, module-level global state, and poor separation of concerns. All changes are backwards compatible at the API level.

## Changes Made

### 1. Split QueryResultNode into Core Graph Data + Display Metadata

**Problem**: `QueryResultNode` mixed graph structure (path, relation, depth) with UI concerns (displayProperties, visualDirection) and filter state (hasFilteredAncestor). The unused `sortInfo` field mentioned in docs would have worsened this.

**Solution**: Created `TraversalNode` interface for core graph data, with `QueryResultNode` extending it to add display metadata only when needed.

```typescript
// Before: Everything in one type
interface QueryResultNode {
  path: string;
  relation: string;
  depth: number;
  // ... graph structure
  displayProperties: DisplayProperty[];  // UI concern
  visualDirection: VisualDirection;      // UI concern
  hasFilteredAncestor: boolean;          // filter state
  // sortInfo would have been here
}

// After: Separated concerns
interface TraversalNode {
  path: string;
  relation: string;
  depth: number;
  implied: boolean;
  impliedFrom?: string;
  parent: string | null;
  traversalPath: string[];
  properties: FileProperties;
  hasFilteredAncestor: boolean;
  children: TraversalNode[];
}

interface QueryResultNode extends TraversalNode {
  displayProperties: DisplayProperty[];
  visualDirection: VisualDirection;
  children: QueryResultNode[];
}
```

**Files Changed**:
- `src/query/nodes/types.ts` - Added TraversalNode, made QueryResultNode extend it
- `src/query/index.ts` - Exported both types

**Benefits**:
- Clear separation between traversal phase and display phase
- Can add sort metadata at sort phase without polluting core type
- Easier to test traversal without UI concerns

### 2. Replaced Global Cache Singleton with Plugin-Owned Instance

**Problem**: `getCache()` returned a module-level global singleton that persisted across plugin reloads and wasn't testable without `resetCache()` calls.

**Solution**: Made `QueryCache` an instance owned by the plugin, passed explicitly where needed.

```typescript
// Before: Global singleton
let globalCache: QueryCache | null = null;
export function getCache(): QueryCache {
  if (!globalCache) globalCache = new QueryCache();
  return globalCache;
}

// After: Plugin-owned
export default class TrailPlugin extends Plugin {
  queryCache: QueryCache;
  
  async onload() {
    this.queryCache = new QueryCache();
    // ...
  }
}
```

**Files Changed**:
- `src/query/cache.ts` - Deprecated global functions with error messages
- `src/main.ts` - Own cache instance, pass to invalidation points
- `src/ui/trail-view.ts` - Use `this.plugin.queryCache` instead of `getCache()`

**Benefits**:
- Explicit lifecycle - cache lives and dies with plugin
- Testable without global state
- No stale cache on hot reload
- Clear ownership and dependencies

### 3. Removed Side-Effect Imports from tree-converter

**Problem**: `tree-converter.ts` depended on import side effects to register node classes:

```typescript
// These imports MUST run for functions to work
import "./functions";
import "./builtins";
```

If tree-converter was imported through a different path or tree-shaken, functions would silently disappear.

**Solution**: Created explicit initialization with lazy loading.

```typescript
let initialized = false;

export function initializeConverter(): void {
  if (initialized) return;
  initialized = true;
  
  // Explicit async imports
  void import("./functions");
  void import("./builtins");
  // ... other node classes
  
  registerStructuralConverters();
}

function getConverterMap(): Map<number, ExprConverterFn> {
  initializeConverter(); // Ensure registration before use
  // ...
}
```

**Files Changed**:
- `src/query/nodes/tree-converter.ts` - Added `initializeConverter()`, call it lazily

**Benefits**:
- No silent failures from missing imports
- Explicit dependency initialization
- Still lazy - only runs on first parse
- Can be tested/debugged easily

### 4. Extracted Migration Logic into Dedicated Module

**Problem**: `settings/index.ts` was 60% migration code (~150 lines), making the "what are the current settings?" question hard to answer. Migration logic was interleaved with settings construction.

**Solution**: Created `settings/migrations.ts` to contain all migration logic.

```typescript
// Before: Migration logic scattered in settings/index.ts
function buildSettings(savedData) {
  // 50 lines of data preparation
  if (legacyGroups.length > 0) { /* migrate */ }
  migrateAllTqlSyntax(tqlGroups);
  migrateRelationAliases(relations);
  migrateRelationIds(relations);
  // 100+ lines of migration helper functions
  return settings;
}

// After: Clean separation
// settings/migrations.ts
export function applyMigrations(data: Partial<SavedSettingsData>): {
  tqlGroups: GroupDefinition[];
  legacyGroups: RelationGroup[];
  relations: RelationDefinition[];
}

// settings/index.ts  
function buildSettings(savedData) {
  const migrated = applyMigrations({tqlGroups, groups, relations});
  return { ...migrated, hideEmptyGroups, editorMode };
}
```

**Files Changed**:
- `src/settings/migrations.ts` - New module with all migration logic
- `src/settings/index.ts` - Slim 100-line file focused on current settings

**Benefits**:
- Settings file is now 100 lines (was 245)
- Migration runs as single pass
- Easy to understand current settings structure
- Migration tests can be isolated

## Migration Guide

### For Plugin Users
No changes required - all migrations are backwards compatible.

### For Developers Extending the Code

**If you access the query cache**:
```typescript
// Before
import {getCache} from "./query/cache";
const cache = getCache();

// After
class MyClass {
  constructor(private plugin: TrailPlugin) {}
  
  doSomething() {
    this.plugin.queryCache.getResult(query, file);
  }
}
```

**If you add new node types**:
Node registration still works via `@register` decorator. No changes needed. The tree-converter will auto-initialize on first use.

**If you work with query results**:
```typescript
// Both types are exported, use as needed
import type {TraversalNode, QueryResultNode} from "./query";

// Use TraversalNode for pure graph operations
function analyze(node: TraversalNode) { /* ... */ }

// Use QueryResultNode when display metadata is present
function render(node: QueryResultNode) { /* ... */ }
```

## Future Improvements

1. **Sort metadata attachment**: When adding sort-based grouping, attach sort metadata as a separate phase rather than on QueryResultNode.

2. **Cache per-file invalidation**: Currently invalidates entire result when any related file changes. Could track dependencies more precisely.

3. **Migration versioning**: Add version field to settings to make migration logic even more explicit.

## Testing

All 272 tests pass:
- Unit tests for traversal, parsing, filtering
- Integration tests for query execution
- UI transform tests
- Migration tests

No regressions introduced.
