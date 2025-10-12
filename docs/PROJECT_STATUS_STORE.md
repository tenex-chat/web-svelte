# Centralized Project Status Store

## Overview
The `projectStatusStore` is a centralized, reactive store that manages all project status events (kind:24010) across the entire application. Instead of each component subscribing individually to status events, we subscribe once and provide reactive accessors for all status information.

## Architecture

### Single Subscription Pattern
```typescript
// ❌ BAD: Multiple subscriptions (old approach)
// Each ProjectColumn subscribes to kind:24010 for its project
const statusSub1 = ndk.$subscribe({ kinds: [24010], '#a': [project1.tagId()] });
const statusSub2 = ndk.$subscribe({ kinds: [24010], '#a': [project2.tagId()] });
const statusSub3 = ndk.$subscribe({ kinds: [24010], '#a': [project3.tagId()] });

// ✅ GOOD: Single subscription (centralized store)
// Store subscribes once to ALL kind:24010 events
const subscription = ndk.$subscribe({ kinds: [24010] });
// Components query the store reactively
```

### Benefits
1. **Single Network Subscription** - Only one Nostr subscription for all projects
2. **Reduced Bandwidth** - No duplicate event fetching
3. **Centralized State** - Single source of truth for all status data
4. **Better Performance** - Less memory, fewer subscriptions to manage
5. **Easier Debugging** - All status logic in one place
6. **Reactive Everywhere** - All components get updates automatically

## Store API

### Initialization
The store must be initialized from within a component context (because it uses `$effect` internally):

```typescript
// In root +layout.svelte
import { projectStatusStore } from '$lib/stores/projectStatus.svelte';

$effect(() => {
  if (ready && browser) {
    projectStatusStore.init();
  }
});
```

**Why?** The store uses `ndk.$subscribe()` which internally uses Svelte's `$effect`. Effects can only be created during component initialization, not at module level.

The store is a singleton - calling `init()` multiple times is safe (it only initializes once).

### Core Methods

#### `getStatus(projectId: string): NDKProjectStatus | undefined`
Get the latest status event for a project.

```typescript
const status = projectStatusStore.getStatus('31933:pubkey:my-project');
if (status) {
  console.log('Last seen:', status.lastSeen);
  console.log('Agents:', status.agents);
}
```

#### `isProjectOnline(projectId: string): boolean`
Check if a project is online (status < 5 minutes old).

```typescript
const isOnline = projectStatusStore.isProjectOnline(projectId);
// Returns true if status event was created < 5 minutes ago
```

#### `getOnlineAgents(projectId: string): ProjectAgent[]`
Get all online agents for a project.

```typescript
const agents = projectStatusStore.getOnlineAgents(projectId);
// Returns: [
//   { pubkey: '...', name: 'PM', model: 'gpt-4', tools: ['file_read'] },
//   { pubkey: '...', name: 'Claude', model: 'claude-3-5-sonnet', tools: [] }
// ]
```

#### `getModels(projectId: string): string[]`
Get all available models for a project.

```typescript
const models = projectStatusStore.getModels(projectId);
// Returns: ['gpt-4', 'claude-3-5-sonnet', 'gemini-pro']
```

#### `getTools(projectId: string): string[]`
Get all available tools for a project.

```typescript
const tools = projectStatusStore.getTools(projectId);
// Returns: ['file_read', 'web_search', 'code_interpreter']
```

#### `getAgent(projectId: string, agentPubkey: string): ProjectAgent | undefined`
Get specific agent by pubkey.

```typescript
const agent = projectStatusStore.getAgent(projectId, agentPubkey);
if (agent) {
  console.log('Agent:', agent.name);
  console.log('Model:', agent.model);
  console.log('Tools:', agent.tools);
}
```

#### `getAgentModel(projectId: string, agentName: string): string | undefined`
Get which model a specific agent is using.

```typescript
const model = projectStatusStore.getAgentModel(projectId, 'Claude');
// Returns: 'claude-3-5-sonnet'
```

#### `getAgentTools(projectId: string, agentName: string): string[]`
Get which tools a specific agent has.

```typescript
const tools = projectStatusStore.getAgentTools(projectId, 'PM');
// Returns: ['file_read', 'web_search']
```

### Global Accessors

#### `onlineProjects: string[]`
Get all online project IDs.

```typescript
const onlineProjectIds = projectStatusStore.onlineProjects;
// Returns: ['31933:pubkey:project1', '31933:pubkey:project2']
```

#### `totalOnlineAgents: number`
Get count of online agents across all projects.

```typescript
const count = projectStatusStore.totalOnlineAgents;
// Returns: 15 (total agents across all online projects)
```

#### `allModels: string[]`
Get all unique models across all projects.

```typescript
const models = projectStatusStore.allModels;
// Returns: ['gpt-4', 'claude-3-5-sonnet', 'gemini-pro', ...]
```

#### `allTools: string[]`
Get all unique tools across all projects.

```typescript
const tools = projectStatusStore.allTools;
// Returns: ['file_read', 'web_search', 'code_interpreter', ...]
```

#### `allStatus: Map<string, NDKProjectStatus>`
Get the full status map (for debugging or advanced use).

```typescript
const statusMap = projectStatusStore.allStatus;
for (const [projectId, status] of statusMap) {
  console.log(`Project ${projectId} has ${status.agents.length} agents`);
}
```

## Usage in Components

### Basic Status Check
```svelte
<script lang="ts">
  import { projectStatusStore } from '$lib/stores/projectStatus.svelte';

  const projectId = '31933:pubkey:my-project';
  const isOnline = $derived(projectStatusStore.isProjectOnline(projectId));
</script>

{#if isOnline}
  <div class="status-online">Project is online!</div>
{:else}
  <div class="status-offline">Project is offline</div>
{/if}
```

### Get Online Agents
```svelte
<script lang="ts">
  import { projectStatusStore } from '$lib/stores/projectStatus.svelte';

  const projectId = $derived(project.tagId());
  const onlineAgents = $derived(projectStatusStore.getOnlineAgents(projectId));
</script>

<div class="agents-list">
  {#each onlineAgents as agent}
    <div class="agent">
      {agent.name} - {agent.model}
      {#if agent.tools && agent.tools.length > 0}
        <span class="tools">({agent.tools.join(', ')})</span>
      {/if}
    </div>
  {/each}
</div>
```

### ProjectColumn Example
```svelte
<script lang="ts">
  import type { NDKProject } from '$lib/events/NDKProject';
  import { projectStatusStore } from '$lib/stores/projectStatus.svelte';

  interface Props {
    project: NDKProject;
  }

  let { project }: Props = $props();

  // Get all status info from centralized store
  const projectId = $derived(project.tagId());
  const isOnline = $derived(projectStatusStore.isProjectOnline(projectId));
  const onlineAgents = $derived(projectStatusStore.getOnlineAgents(projectId));
  const models = $derived(projectStatusStore.getModels(projectId));
  const tools = $derived(projectStatusStore.getTools(projectId));
</script>

<div class="project-column">
  <div class="header">
    <h3>{project.title}</h3>
    <div class="status" class:online={isOnline}></div>
  </div>

  <!-- All reactive, no individual subscriptions needed -->
</div>
```

### ProjectsSidebar Example
```svelte
<script lang="ts">
  import { projectStatusStore } from '$lib/stores/projectStatus.svelte';

  {#each projects as project}
    {@const projectId = project.tagId()}
    {@const isOnline = projectStatusStore.isProjectOnline(projectId)}
    {@const agentCount = projectStatusStore.getOnlineAgents(projectId).length}

    <button class="project-button">
      {project.title}
      {#if isOnline}
        <span class="online-indicator"></span>
        <span class="agent-count">{agentCount} online</span>
      {/if}
    </button>
  {/each}
</script>
```

## How It Works

### Initialization
```typescript
constructor() {
  if (browser) {
    this.initialize();
  }
}

private initialize() {
  // Subscribe to ALL kind:24010 events
  const subscription = ndk.$subscribe(() => ({
    filters: [{ kinds: [24010] }],  // No project filter!
    closeOnEose: false,
    eventClass: NDKProjectStatus
  }), { bufferMs: 100 });

  // Update map reactively
  $effect(() => {
    const events = subscription.events as NDKProjectStatus[];
    // Keep only latest per project
    const latestByProject = new Map<string, NDKProjectStatus>();

    for (const event of events) {
      const projectId = event.projectId;
      if (!projectId) continue;

      const existing = latestByProject.get(projectId);
      if (!existing || event.created_at! > existing.created_at!) {
        latestByProject.set(projectId, event);
      }
    }

    this.statusMap = latestByProject;
  });
}
```

### Reactivity
The store uses Svelte 5 runes:
- `$state` for the status map (reactive)
- `$derived` for computed values in components
- `$effect` to update map when new events arrive

When new kind:24010 events arrive:
1. `$effect` runs automatically
2. Status map is updated with latest events
3. All components using the store re-render
4. No manual subscription management needed

### Event Deduplication
The store keeps only the **latest** status event per project:
```typescript
const existing = latestByProject.get(projectId);
if (!existing || event.created_at! > existing.created_at!) {
  latestByProject.set(projectId, event);
}
```

This ensures:
- No stale data
- Minimal memory usage
- Always current status

## Status Event Structure (kind:24010)

### Tags
```
["a", "31933:pubkey:project-id"]      // Project reference
["agent", <pubkey>, <name>, "global"?] // Agent definition
["model", <model-slug>, ...agentNames] // Model assignments
["tool", <tool-name>, ...agentNames]   // Tool assignments
```

### Example Event
```json
{
  "kind": 24010,
  "content": "",
  "tags": [
    ["a", "31933:abc123:my-project"],
    ["agent", "def456", "PM", "global"],
    ["agent", "ghi789", "Claude"],
    ["model", "gpt-4", "PM"],
    ["model", "claude-3-5-sonnet", "Claude"],
    ["tool", "file_read", "PM", "Claude"],
    ["tool", "web_search", "PM"]
  ],
  "created_at": 1735858800
}
```

### Parsing Logic
The `NDKProjectStatus` class provides getters:
- `projectId` - Extracts from 'a' or 'e' tag
- `isOnline` - Checks if created_at < 5 minutes ago
- `agents` - Builds ProjectAgent array with models and tools
- `models` - Extracts unique model list

## Online Status Logic

A project is considered **online** if its latest status event was created within the last **5 minutes**:

```typescript
get isOnline(): boolean {
  if (!this.created_at) return false;
  const fiveMinutesAgo = Math.floor(Date.now() / 1000) - 300;
  return this.created_at > fiveMinutesAgo;
}
```

This means:
- Agents must publish status every ~1-2 minutes to stay online
- Status older than 5 minutes = offline
- Automatic stale detection
- No manual online/offline management

## Performance Characteristics

### Time Complexity
- `getStatus(projectId)` - O(1) map lookup
- `isProjectOnline(projectId)` - O(1) lookup + timestamp check
- `getOnlineAgents(projectId)` - O(1) lookup + O(a) agent parsing (a = agent count)
- `onlineProjects` getter - O(p) where p = project count
- `totalOnlineAgents` getter - O(p * a)

### Space Complexity
- O(p) where p = number of projects with status
- One NDKProjectStatus object per project
- No duplicate events stored

### Network Efficiency
**Before (individual subscriptions):**
- N projects open = N subscriptions
- Duplicate events fetched
- More relay connections

**After (centralized store):**
- Always 1 subscription
- No duplicate events
- Single relay connection for status

## Migration Guide

### Old Pattern (Don't Use)
```svelte
<script lang="ts">
  import { ndk } from '$lib/ndk.svelte';
  import { NDKProjectStatus } from '$lib/events/NDKProjectStatus';

  // ❌ BAD: Individual subscription per component
  const statusSubscription = ndk.$subscribe(() => ({
    filters: [{
      kinds: [24010],
      '#a': [project.tagId()]
    }],
    closeOnEose: false,
    eventClass: NDKProjectStatus
  }));

  const status = $derived(statusSubscription.events[0]);
  const isOnline = $derived(status?.isOnline ?? false);
  const agents = $derived(status?.agents ?? []);
</script>
```

### New Pattern (Use This)
```svelte
<script lang="ts">
  import { projectStatusStore } from '$lib/stores/projectStatus.svelte';

  // ✅ GOOD: Query centralized store
  const projectId = $derived(project.tagId());
  const isOnline = $derived(projectStatusStore.isProjectOnline(projectId));
  const agents = $derived(projectStatusStore.getOnlineAgents(projectId));
</script>
```

### Migration Steps
1. Remove individual `ndk.$subscribe` calls for kind:24010
2. Import `projectStatusStore` from `$lib/stores/projectStatus.svelte`
3. Replace `statusSubscription.events[0]` with `projectStatusStore.getStatus(projectId)`
4. Replace `status?.agents` with `projectStatusStore.getOnlineAgents(projectId)`
5. Replace `status?.isOnline` with `projectStatusStore.isProjectOnline(projectId)`

## Related Documentation
- [NDKProjectStatus.ts](../src/lib/events/NDKProjectStatus.ts) - Event class definition
- [projectStatus.svelte.ts](../src/lib/stores/projectStatus.svelte.ts) - Store implementation
- [ProjectColumn.svelte](../src/lib/components/ProjectColumn.svelte) - Usage example

## Future Enhancements

### Status History
- [ ] Track status history over time
- [ ] Show when projects went online/offline
- [ ] Agent uptime statistics

### Advanced Queries
- [ ] Filter agents by model
- [ ] Filter agents by tool capability
- [ ] Search agents across all projects

### Notifications
- [ ] Subscribe to status changes
- [ ] Callback when project goes online/offline
- [ ] Event hooks for agent changes

### Performance
- [ ] Pagination for large project lists
- [ ] Virtual scrolling integration
- [ ] Status event caching strategy

## Best Practices

1. **Always use the store** - Never subscribe to kind:24010 directly in components
2. **Use derived state** - Wrap store calls in `$derived()` for reactivity
3. **Cache projectId** - Calculate once and reuse: `const projectId = $derived(project.tagId())`
4. **Check for undefined** - Store methods may return undefined if no status available
5. **Trust the store** - Don't duplicate status logic in components
6. **Single source of truth** - The store is authoritative for all status data
