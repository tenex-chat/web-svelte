# TENEX-web to Svelte 5 Migration Plan

## Executive Summary

This document outlines the comprehensive migration strategy for transitioning TENEX-web from React (TanStack Router + Jotai + Zustand) to Svelte 5 using the new @nostr-dev-kit/svelte library. This migration will leverage NDK's built-in reactive patterns, sessions, sync, and wallet features to significantly reduce code complexity while improving performance and developer experience.

## Key Migration Principles

1. **Leverage NDK Svelte 5's Built-in Features**: Use `ndk.$subscribe()`, `ndk.$sessions`, `ndk.$sync`, and `ndk.$wallet` instead of reimplementing
2. **Reactive-First Architecture**: Replace hooks/stores with Svelte 5 runes (`$state`, `$derived`, `$effect`)
3. **Component-by-Component Migration**: Port one feature at a time, testing thoroughly
4. **No Backwards Compatibility**: Clean, modern patterns only
5. **Direct NDK Usage**: No unnecessary wrappers around NDK functionality

## Architecture Differences

### State Management

**Current (React)**:
- Zustand stores for projects, agents, activity
- Jotai atoms for UI state
- Custom hooks for data fetching
- Manual subscription management

**Target (Svelte 5)**:
- NDK Svelte's reactive subscriptions
- Svelte 5 runes for local state
- Built-in session management
- Automatic cleanup

### Event Subscriptions

**Current**:
```typescript
// React with manual cleanup
const { events } = useSubscribe(filters, options);
useEffect(() => {
  return () => subscription.stop();
}, []);
```

**Target**:
```typescript
// Svelte 5 - automatic cleanup
const subscription = ndk.$subscribe(filters, options);
// No manual cleanup needed!
```

### Session Management

**Current**: Custom authentication flow with NDKNip07Signer
**Target**: Built-in `ndk.$sessions` with automatic persistence

## Phase 1: Project Setup & Core Infrastructure

### 1.1 Initialize Project Structure
```bash
/TENEX-web-svelte5
├── src/
│   ├── lib/
│   │   ├── ndk.svelte.ts          # NDK initialization
│   │   ├── stores/                # Svelte stores (minimal)
│   │   ├── components/            # UI components
│   │   ├── events/               # Custom event classes (NDKProject, etc)
│   │   └── utils/                # Utilities
│   ├── routes/
│   └── app.html
```

### 1.2 NDK Configuration
```typescript
// src/lib/ndk.svelte.ts
import { NDKSvelte } from '@nostr-dev-kit/svelte';
import NDKCacheSqliteWasm from '@nostr-dev-kit/cache-sqlite-wasm';
import { LocalStorage } from '@nostr-dev-kit/sessions';

export const ndk = new NDKSvelte({
  explicitRelayUrls: ['wss://tenex.chat'],
  cacheAdapter: new NDKCacheSqliteWasm({
    dbName: 'tenex-cache',
    useWorker: true,
    workerUrl: '/worker.js',
    wasmUrl: '/sql-wasm.wasm'
  }),
  session: {
    storage: new LocalStorage(),
    fetches: {
      follows: true,
      mutes: true,
      wallet: true,
      relayList: true
    }
  }
});
```

### 1.3 Register Custom Event Classes
- Port NDKProject (kind 31933)
- Port NDKAgentDefinition (kind 4199)
- Port NDKProjectStatus (kind 24010)
- Port NDKTask, NDKMCPTool, NDKAgentLesson

## Phase 2: Core Components Migration

### 2.1 Layout & Navigation
- [ ] AppShell → +layout.svelte
- [ ] ProjectsSidebar → Sidebar.svelte
- [ ] Navigation routing (TanStack → SvelteKit)
- [ ] WindowManager (desktop mode)

### 2.2 Authentication
- [ ] LoginForm → LoginModal.svelte (using ndk.$sessions)
- [ ] User profile management
- [ ] NIP-07 extension support

### 2.3 Project Management
- [ ] ProjectCard → ProjectCard.svelte
- [ ] CreateProjectDialog → CreateProjectModal.svelte
- [ ] Project settings components
- [ ] Project status monitoring (24010 events)

## Phase 3: Chat System Migration

### 3.1 Message Flow Architecture
The chat system is the most complex part requiring careful migration:

#### Core Components
- [ ] ChatInterface → ChatView.svelte
- [ ] ChatInputArea → ChatInput.svelte
- [ ] ChatMessages → MessageList.svelte
- [ ] ThreadedMessage → MessageThread.svelte

#### Message Processing
```typescript
// Reactive message subscription
const messages = ndk.$subscribe(() => {
  if (!rootEvent) return undefined;
  return {
    filters: [
      { kinds: [11, 1111, 7, 21111, 513], ...rootEvent.filter() },
      rootEvent.nip22Filter()
    ],
    closeOnEose: false,
    bufferMs: 30
  };
});

// Process streaming responses (kind 21111)
const streamingSessions = new Map();
$effect(() => {
  messages.events.forEach(event => {
    if (event.kind === 21111) {
      processStreamingEvent(event, streamingSessions);
    }
  });
});
```

#### 24xxx Event Coordination
- PROJECT_START (24000): Project activation
- PROJECT_STATUS (24010): Real-time agent/model status
- LLM_CONFIG_CHANGE (24101): Model switching
- TYPING_INDICATOR (24111/24112): Typing status
- STREAMING_RESPONSE (21111): Delta content reconstruction

### 3.2 Reply & Thread Management
```typescript
// Thread creation with proper tagging
async function createThread(content: string, agents: Agent[]) {
  const thread = new NDKThread(ndk);
  thread.content = content;

  if (project) thread.tag(project.tagReference());

  // P-tag logic for agent routing
  agents.forEach(agent => {
    thread.tags.push(['p', agent.pubkey]);
  });

  // Brainstorm mode encoding
  if (brainstormMode) {
    thread.tags.push(['mode', 'brainstorm']);
    thread.tags.push(['participant', ...participantPubkeys]);
  }

  await thread.sign();
  thread.publish();
}
```

### 3.3 Streaming & Real-time Features
- [ ] DeltaContentAccumulator for streaming responses
- [ ] Voice input/output integration
- [ ] Image upload via Blossom
- [ ] Typing indicators

## Phase 4: Agent System

### 4.1 Agent Management
- [ ] AgentDefinitionsPage → agent list
- [ ] Agent instances vs definitions
- [ ] Agent ownership (kind 14199)
- [ ] Agent lessons (kind 4129)

### 4.2 Agent Coordination
- [ ] Project-agent association
- [ ] Agent status monitoring
- [ ] MCP tool integration
- [ ] Brainstorm mode implementation

## Phase 5: Advanced Features

### 5.1 Documentation System
- [ ] Article creation/editing
- [ ] Documentation viewer
- [ ] Comment system

### 5.2 Voice & Media
- [ ] TTS/STT integration
- [ ] Voice call interface
- [ ] Media upload/preview

### 5.3 Settings & Configuration
- [ ] User settings
- [ ] Project settings
- [ ] AI model configuration
- [ ] Relay management

## Migration Patterns

### Pattern 1: Hook to Rune Migration
```typescript
// React Hook
function useProject(id: string) {
  const [project, setProject] = useState(null);
  useEffect(() => {
    fetchProject(id).then(setProject);
  }, [id]);
  return project;
}

// Svelte 5 Rune
const project = $derived.by(() => {
  return ndk.$fetchOne({ kinds: [31933], '#d': [id] });
});
```

### Pattern 2: Store Migration
```typescript
// Zustand Store
const useProjectsStore = create((set) => ({
  projects: new Map(),
  addProject: (project) => set(state => ({
    projects: new Map(state.projects).set(project.id, project)
  }))
}));

// Svelte Store
const projects = ndk.$subscribe({
  kinds: [31933],
  authors: [currentUser.pubkey]
});
// Projects are automatically reactive!
```

### Pattern 3: Component Migration
```tsx
// React Component
function ProjectCard({ project }) {
  const status = useProjectStatus(project.id);
  return <div>{project.title} - {status}</div>;
}

// Svelte Component
<script lang="ts">
  let { project } = $props();
  const status = ndk.$subscribe({
    kinds: [24010],
    '#a': [project.tagId()]
  });
</script>

<div>{project.title} - {status.events[0]?.content}</div>
```

## Testing Strategy

### Unit Tests
- Test each migrated component in isolation
- Verify event creation/parsing
- Test subscription reactivity

### Integration Tests
- Test complete user flows
- Verify 24xxx event coordination
- Test agent communication

### E2E Tests
- Full application flows
- Multi-user scenarios
- Agent interaction testing

## Performance Considerations

1. **SQLite WASM Cache**: Enable worker mode for better performance
2. **Signature Verification Worker**: Offload crypto operations
3. **Buffered Updates**: Use `bufferMs` for high-frequency subscriptions
4. **Virtual Scrolling**: For large message lists
5. **Lazy Loading**: Load components as needed

## Risk Mitigation

1. **Gradual Migration**: Keep React app running while building Svelte version
2. **Feature Parity Testing**: Ensure each feature works identically
3. **Data Migration**: Test with production data copies
4. **Rollback Plan**: Maintain React version until Svelte is stable

## Timeline Estimate

- **Phase 1**: 1 week - Setup and infrastructure
- **Phase 2**: 1 week - Core components
- **Phase 3**: 2 weeks - Chat system (most complex)
- **Phase 4**: 1 week - Agent system
- **Phase 5**: 1 week - Advanced features
- **Testing & Polish**: 1 week

**Total: 7 weeks**

## Success Metrics

- [ ] All features from React app working in Svelte
- [ ] 50% reduction in code complexity
- [ ] Improved performance (measured via Lighthouse)
- [ ] Better developer experience
- [ ] Reduced bundle size

## Next Steps

1. Create new SvelteKit project in `/TENEX-web-svelte5`
2. Set up NDK configuration with cache and workers
3. Port custom event classes
4. Begin with simplest components first
5. Incrementally add complexity

## Important Notes

- **No fetchEvents()**: NDKSwift doesn't have this method
- **GenericReply is kind 1111**: Not kind 1
- **Direct NDK usage**: Don't wrap NDK functionality unnecessarily
- **Use ndk.$subscribe() everywhere**: Automatic cleanup and reactivity
- **Component isolation**: Each component should be self-contained
- **Ask when unclear**: Complex features need discussion before implementation

This migration represents a significant architectural shift but will result in a cleaner, more maintainable, and more performant application that fully leverages the Nostr protocol's capabilities through NDK's modern Svelte 5 integration.