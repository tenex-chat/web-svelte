# StorageService Design

**Date:** 2025-12-03
**Status:** Approved
**Scope:** Centralize localStorage usage with reactive, type-safe StorageService

## Overview

Replace 57 direct localStorage calls across 19 files with a centralized, reactive StorageService. This eliminates key sprawl, adds type safety, improves error handling, and provides cross-tab synchronization.

## Goals

1. **Type Safety:** Compile-time enforcement of storage keys and value types
2. **Reactivity:** Automatic UI updates when storage changes (Svelte 5 $state)
3. **Error Handling:** Graceful degradation with user notifications via toasts
4. **Consistency:** Single source of truth for all localStorage keys
5. **Developer Experience:** Autocomplete for keys, impossible to use wrong types

## Architecture

### Reactive Storage with Type Registry

StorageService maintains reactive `$state` for each registered key, syncing bidirectionally with localStorage.

```typescript
// lib/utils/storage.ts
import { toast } from '$lib/stores/toast.svelte';

type StorageSchema = {
  // UI Settings
  theme: 'light' | 'dark' | 'system';
  sidebarCollapsed: boolean;
  projectFilters: { status?: string; tags?: string[] };

  // Settings objects
  relaySettings: RelaySettings;
  aiConfig: AIConfig;
  blossomSettings: BlossomSettings;
  callSettings: CallSettings;
  uiSettings: UISettings;

  // Complex data
  drafts: Record<string, string>; // { [conversationId]: content }
  openProjects: string[];
  nudgeSelections: Record<string, string[]>;
  windowManagerState: WindowManagerState;
};

class StorageService {
  private state = $state<Partial<StorageSchema>>({});

  // Getters/setters for direct reactive access
  get theme() { return this.state.theme ?? 'system'; }
  set theme(value) {
    this.state.theme = value;
    this.persist('theme', value);
  }

  // Generic methods
  get<K extends keyof StorageSchema>(key: K): StorageSchema[K] | undefined {
    return this.state[key];
  }

  set<K extends keyof StorageSchema>(key: K, value: StorageSchema[K]): void {
    this.state[key] = value;
    this.persist(key, value);
  }

  // Helper methods for nested data
  getDraft(conversationId: string): string | undefined {
    return this.state.drafts?.[conversationId];
  }

  setDraft(conversationId: string, content: string): void {
    this.state.drafts = { ...(this.state.drafts ?? {}), [conversationId]: content };
    this.persist('drafts', this.state.drafts);
  }

  clearDraft(conversationId: string): void {
    const { [conversationId]: _, ...rest } = this.state.drafts ?? {};
    this.state.drafts = rest;
    this.persist('drafts', rest);
  }
}

export const storage = new StorageService();
```

### Usage Examples

**Reactive binding in components:**
```typescript
import { storage } from '$lib/utils/storage';

// Automatic reactivity
$effect(() => {
  console.log('Theme changed:', storage.theme);
});

// Direct usage in templates
<button onclick={() => storage.theme = 'dark'}>Toggle Dark Mode</button>
```

**Replacing store files:**
```typescript
// Before: import { theme } from '$lib/stores/theme.svelte';
// After: import { storage } from '$lib/utils/storage';
// Use storage.theme directly - no wrapper needed
```

## Error Handling

**Strategy:** Graceful degradation with user notification.

```typescript
class StorageService {
  private persist<K extends keyof StorageSchema>(
    key: K,
    value: StorageSchema[K]
  ): void {
    try {
      localStorage.setItem(key as string, JSON.stringify(value));
    } catch (error) {
      console.error(`[StorageService] Failed to persist ${key as string}:`, error);

      if (error instanceof Error) {
        if (error.name === 'QuotaExceededError') {
          toast.error('Storage limit reached. Some settings may not be saved.');
        } else {
          toast.error('Failed to save settings. Check browser storage permissions.');
        }
      }
      // Continue gracefully - state remains in memory
    }
  }

  private loadAll(): void {
    for (const key of Object.keys(this.state)) {
      try {
        const item = localStorage.getItem(key);
        if (item) {
          this.state[key as keyof StorageSchema] = JSON.parse(item);
        }
      } catch (error) {
        console.error(`[StorageService] Failed to load ${key}:`, error);
        // Use default value, don't break initialization
      }
    }
  }

  private handleStorageEvent = (e: StorageEvent): void => {
    // Sync changes from other tabs
    if (e.key && e.newValue) {
      try {
        this.state[e.key as keyof StorageSchema] = JSON.parse(e.newValue);
      } catch {
        // Ignore invalid data
      }
    }
  };
}
```

**Error Guarantees:**
- Never throws exceptions
- Shows user-friendly toasts on save failures
- Logs to console for debugging
- Works in memory-only mode if localStorage unavailable
- Handles cross-tab sync gracefully

## Migration Strategy

**Total Scope:** 20 tasks (1 creation + 19 file migrations)

### Three Migration Patterns

**Pattern A - Simple Stores (eliminate):**
Files that only wrap localStorage can be deleted:
- `stores/theme.svelte.ts`
- `stores/sidebarCollapsed.svelte.ts`

Replace all imports with direct storage access:
```typescript
// Before
import { theme } from '$lib/stores/theme.svelte';

// After
import { storage } from '$lib/utils/storage';
// Use storage.theme
```

**Pattern B - Store Files (migrate):**
Keep stores with additional logic, but use StorageService internally:
```typescript
// drafts.svelte.ts - AFTER
import { storage } from '$lib/utils/storage';

class DraftStore {
  getDraft(id: string) {
    return storage.getDraft(id);
  }

  setDraft(id: string, content: string) {
    storage.setDraft(id, content);
  }
}
```

**Pattern C - Component Files (update):**
Replace direct localStorage calls:
```typescript
// Before
localStorage.setItem('nudges_' + id, JSON.stringify(nudges));

// After
storage.setNudgeSelection(id, nudges);
```

### Files to Migrate (19)

1. routes/nudges/+page.svelte
2. stores/relaySettings.svelte.ts
3. components/agents/AgentSettingsTab.svelte
4. utils/projectGroups.ts
5. stores/aiConfig.svelte.ts
6. stores/theme.svelte.ts (eliminate)
7. stores/drafts.svelte.ts
8. stores/inbox.svelte.ts
9. stores/blossomSettings.svelte.ts
10. stores/call-settings.svelte.ts
11. stores/windowManager.svelte.ts
12. stores/openProjects.svelte.ts
13. stores/sidebarCollapsed.svelte.ts (eliminate)
14. stores/projectFilters.svelte.ts
15. stores/uiSettings.svelte.ts
16. components/window-manager/Drawer.svelte
17. components/docs/DocumentCreateDialog.svelte
18. components/chat/ChatInput.svelte
19. stores/nudges.svelte.ts

## Testing Strategy

1. **Unit test StorageService:** Mock localStorage, test error handling
2. **One file at a time:** Migrate, test in browser, verify functionality
3. **Cross-tab sync:** Open multiple tabs, verify changes propagate
4. **Error scenarios:** Test with disabled localStorage, quota exceeded
5. **Type safety:** Verify TypeScript catches invalid keys/types

## Benefits

**Before:**
- 57 direct localStorage calls across 19 files
- No type safety
- Inconsistent error handling
- Key sprawl and potential conflicts
- No cross-tab sync

**After:**
- Single source of truth
- Compile-time type safety
- Consistent error handling with user feedback
- Centralized key registry prevents conflicts
- Automatic cross-tab synchronization
- Reactive state management built-in
- Can eliminate simple store wrapper files

## Non-Goals

- Time-to-live (TTL) for cached data
- Namespacing/prefixes (handled by type registry)
- Compression for large data
- Fallback to other storage mechanisms
- Migration of old key names (clean cutover)

## Future Enhancements

- Add encryption for sensitive data
- Implement storage quotas per key
- Add debug mode to visualize all stored data
- Create admin panel to clear/reset storage
