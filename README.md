# TENEX-web Svelte 5

> **React → Svelte 5 Migration**
>
> This is a complete rewrite of TENEX-web from React (TanStack Router + Jotai + Zustand) to Svelte 5 using the new @nostr-dev-kit/svelte library with NDK's built-in reactive patterns.

## What is TENEX?

TENEX is a Nostr-based platform for coordinating AI agents and managing multi-agent workflows. It enables:

- **Project-based collaboration** - Organize work with AI agents in project spaces
- **Multi-agent orchestration** - Coordinate multiple AI agents (GPT-4, Claude, Gemini, etc.)
- **Real-time communication** - Chat with agents using Nostr protocol (NIP-22 threading)
- **Brainstorm mode** - Multiple agents respond, moderator selects best answers
- **MCP tools integration** - Give agents access to Model Context Protocol tools
- **Decentralized** - All data lives on Nostr relays, no central server

## Why Migrate to Svelte 5?

The React version had significant complexity:
- **State Management**: Zustand + Jotai + custom hooks
- **Subscriptions**: Manual cleanup everywhere
- **Performance**: Heavy re-renders with hooks
- **Code Duplication**: Lots of boilerplate

Svelte 5 + NDK Svelte provides:
- **Built-in Reactivity**: `ndk.$subscribe()` with automatic cleanup
- **Runes**: `$state`, `$derived`, `$effect` replace hooks
- **Smaller Bundle**: ~60% less JavaScript
- **Better DX**: Less boilerplate, clearer patterns
- **Native Features**: Sessions, sync, wallet built into NDK

## Architecture

### Tech Stack
- **SvelteKit** - Meta-framework with file-based routing
- **Svelte 5** - Reactive UI with runes
- **NDK Svelte** - Nostr Development Kit with reactive bindings
- **SQLite WASM Cache** - Fast local event caching
- **Tailwind CSS 4** - Utility-first styling
- **TypeScript** - Full type safety

### Key Patterns

#### Centralized Stores
Unlike React where each component subscribes individually, we use centralized stores:

```typescript
// Single subscription for all project status (kind:24010)
const projectStatusStore = new ProjectStatusStore();

// Components query reactively
const isOnline = $derived(projectStatusStore.isProjectOnline(projectId));
const agents = $derived(projectStatusStore.getOnlineAgents(projectId));
```

Benefits: Single network subscription, no duplicates, single source of truth.

#### Reactive Subscriptions
NDK's `$subscribe()` automatically manages cleanup:

```typescript
const messages = ndk.$subscribe(() => ({
  filters: [{
    kinds: [11, 1111], // Threads and replies
    '#a': [project.tagId()]
  }],
  closeOnEose: false
}));

// Messages are automatically reactive
// No manual cleanup needed!
```

#### Runes Replace Hooks
```typescript
// React
const [count, setCount] = useState(0);
const doubled = useMemo(() => count * 2, [count]);
useEffect(() => { /* ... */ }, [count]);

// Svelte 5
let count = $state(0);
const doubled = $derived(count * 2);
$effect(() => { /* ... */ });
```

## Project Structure

```
/TENEX-web-svelte5
├── src/
│   ├── lib/
│   │   ├── ndk.svelte.ts              # NDK initialization
│   │   ├── stores/
│   │   │   ├── openProjects.svelte.ts  # Which projects are open
│   │   │   └── projectStatus.svelte.ts # Centralized status (kind:24010)
│   │   ├── components/
│   │   │   ├── chat/                   # Chat system
│   │   │   ├── settings/               # Settings UI
│   │   │   ├── ProjectColumn.svelte
│   │   │   └── ProjectsSidebar.svelte
│   │   ├── events/                     # Custom NDK event classes
│   │   │   ├── NDKProject.ts           # kind 31933
│   │   │   ├── NDKProjectStatus.ts     # kind 24010
│   │   │   ├── NDKAgentDefinition.ts   # kind 4199
│   │   │   └── ...
│   │   └── utils/
│   │       ├── messageProcessor.ts     # Chat message processing
│   │       ├── threadBuilder.ts        # Threaded message trees
│   │       └── DeltaContentAccumulator.ts # Streaming support
│   ├── routes/
│   │   ├── +layout.svelte              # Root layout
│   │   ├── +layout.ts                  # SSR disabled
│   │   ├── login/
│   │   └── projects/
│   └── app.css
├── static/
│   ├── worker.js                       # SQLite worker
│   └── sql-wasm.wasm                   # SQLite WASM binary
└── docs/                               # Detailed documentation
    ├── CHAT_SYSTEM_ANALYSIS.md
    ├── THREADED_VIEW.md
    ├── PROJECT_STATUS_STORE.md
    └── ...
```

## Key Features Implemented

✅ **Authentication**
- Login with NIP-07 extensions (nos2x, Alby, etc.)
- nsec key support
- Session persistence with `ndk.$sessions`

✅ **Multi-Column Layout**
- Multiple projects open simultaneously
- Horizontal scrolling
- Per-project tabs (Chat, Docs, Agents, Tags, Feed, Settings)

✅ **Chat System**
- Thread creation (kind:11)
- Replies with proper NIP-22 tagging (kind:1111)
- @mention autocomplete for agents
- P-tag routing for agent communication
- Threaded/flattened view modes
- Streaming response support (kind:21111)
- Real-time subscriptions

✅ **Settings**
- General project settings
- Agent management (add/remove)
- MCP tools configuration
- Danger zone

✅ **Project Status**
- Centralized store for kind:24010 events
- Real-time online/offline indicators
- Available models and tools tracking
- Per-agent capabilities

## Nostr Event Kinds Used

| Kind | Name | Purpose |
|------|------|---------|
| 11 | Thread | Root conversation events |
| 1111 | GenericReply | Replies to threads |
| 4199 | AgentDefinition | AI agent definitions |
| 7 | Reaction | Brainstorm mode selections |
| 513 | ConversationMetadata | Thread titles/summaries |
| 21111 | StreamingResponse | Delta content from agents |
| 24010 | ProjectStatus | Real-time agent/model status |
| 24101 | LLMConfigChange | Model switching |
| 31933 | Project | Project metadata (parameterized replaceable) |

## Development

### Prerequisites
- Bun (recommended) or Node.js 18+
- Git

### Setup
```bash
# Clone the repository
git clone <repo-url>
cd TENEX-web-svelte5

# Install dependencies
bun install

# Start dev server
bun run dev
```

Server runs at http://localhost:5173/

### Key Commands
```bash
bun run dev          # Start dev server
bun run build        # Build for production
bun run preview      # Preview production build
bun run check        # Type checking
bun run check:watch  # Watch mode type checking
```

## Documentation

Comprehensive documentation is in the `/docs` folder:

- **[MIGRATION_PLAN.md](./MIGRATION_PLAN.md)** - Overall migration strategy from React
- **[STATUS.md](./STATUS.md)** - Current implementation status
- **[CHAT_SYSTEM_ANALYSIS.md](./CHAT_SYSTEM_ANALYSIS.md)** - Deep dive into chat system
- **[THREADED_VIEW.md](./docs/THREADED_VIEW.md)** - Threaded message display
- **[PROJECT_STATUS_STORE.md](./docs/PROJECT_STATUS_STORE.md)** - Centralized status pattern
- **[MENTION_AUTOCOMPLETE.md](./docs/MENTION_AUTOCOMPLETE.md)** - @mention feature
- **[SETTINGS_FEATURE.md](./docs/SETTINGS_FEATURE.md)** - Settings system

## Migration Progress

See [STATUS.md](./STATUS.md) for detailed progress tracking.

**Current Phase**: Core features complete ✅
- [x] NDK setup with cache and workers
- [x] Authentication system
- [x] Multi-column layout
- [x] Chat system with threading
- [x] Settings pages
- [x] Centralized project status store

**Next Phase**: Advanced features
- [ ] Brainstorm mode
- [ ] Documentation tab
- [ ] Image upload via Blossom
- [ ] Voice input/output

## Differences from React Version

### State Management
**React**: Zustand + Jotai + manual subscription cleanup
**Svelte**: NDK reactive subscriptions + runes (automatic cleanup)
**Result**: ~60% less code

### Subscriptions
**React**: Each component subscribes to kind:24010 individually
**Svelte**: Centralized `projectStatusStore` with single subscription
**Result**: Better performance, single source of truth

### Reactivity
**React**: `useMemo`, `useCallback`, `useEffect` with dependency arrays
**Svelte**: `$derived`, automatic reactivity
**Result**: Simpler, more readable code

### Component Patterns
**React**: Hooks everywhere, complex lifecycle
**Svelte**: Runes, clean reactive statements
**Result**: Less boilerplate, clearer intent

## Contributing

When contributing to this codebase:

1. **No backwards compatibility** - Clean, modern patterns only
2. **Use NDK directly** - Don't wrap NDK functionality unnecessarily
3. **Centralized patterns** - Use stores for shared state (like projectStatusStore)
4. **Document complex features** - Add docs to `/docs` folder
5. **Follow existing patterns** - Match the style already established

## Original React Codebase

The original React version (TENEX-web) used:
- TanStack Router for routing
- Jotai for atomic state
- Zustand for global stores
- Custom NDK hooks with manual cleanup
- ~3x more code than this version

This Svelte 5 rewrite maintains feature parity while being significantly simpler and more maintainable.

## License

[Add license information]

## Links

- [NDK Documentation](https://github.com/nostr-dev-kit/ndk)
- [NDK Svelte](https://github.com/nostr-dev-kit/ndk/tree/master/ndk-svelte)
- [Svelte 5 Documentation](https://svelte.dev/docs/svelte/overview)
- [SvelteKit Documentation](https://kit.svelte.dev/)
- [Nostr Protocol](https://github.com/nostr-protocol/nostr)

---

**Note**: This is an active migration project. Some features from the React version are still being implemented. See [STATUS.md](./STATUS.md) for current progress.
