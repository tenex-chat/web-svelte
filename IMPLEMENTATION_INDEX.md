# Project Creation Wizard - Implementation Index

Complete reference guide for implementing the project creation wizard in Svelte.

## Quick Start

1. Read `PROJECT_CREATION_WIZARD_REFERENCE.md` - Understand what needs to be built
2. Review `WIZARD_ARCHITECTURE.md` - See how it all fits together
3. Study `SVELTE_IMPLEMENTATION_GUIDE.md` - Learn React-to-Svelte patterns
4. Reference `REFERENCE_IMPLEMENTATION_SUMMARY.md` - Check specific code locations
5. Implement step by step using this index as your guide

## Document Quick Links

| Document | Purpose | Read Time |
|----------|---------|-----------|
| [PROJECT_CREATION_WIZARD_REFERENCE.md](./PROJECT_CREATION_WIZARD_REFERENCE.md) | Complete feature overview and data models | 15 min |
| [WIZARD_ARCHITECTURE.md](./WIZARD_ARCHITECTURE.md) | Visual flows and component hierarchy | 10 min |
| [SVELTE_IMPLEMENTATION_GUIDE.md](./SVELTE_IMPLEMENTATION_GUIDE.md) | React-to-Svelte pattern conversion | 20 min |
| [REFERENCE_IMPLEMENTATION_SUMMARY.md](./REFERENCE_IMPLEMENTATION_SUMMARY.md) | Exact code locations in reference project | 5 min |

## Implementation Phases

### Phase 1: Core Structure (1-2 days)
**Goal**: Get the basic multi-step dialog working

Tasks:
- [ ] Create `CreateProjectDialog.svelte` component
- [ ] Implement step navigation (details → agents → tools → review)
- [ ] Set up state for currentStep, projectData, selections
- [ ] Create step indicator UI
- [ ] Implement prev/next button logic

Reference:
- `PROJECT_CREATION_WIZARD_REFERENCE.md` - Overview section
- `WIZARD_ARCHITECTURE.md` - Component hierarchy
- `SVELTE_IMPLEMENTATION_GUIDE.md` - State management patterns

### Phase 2: Project Details Step (1 day)
**Goal**: Implement form for entering project information

Tasks:
- [ ] Create text input for name (required)
- [ ] Create textarea for description (required)
- [ ] Implement tag input with badge display
- [ ] Add image URL input
- [ ] Add repository URL input
- [ ] Implement form validation

Reference:
- Line 296-394 of `CreateProjectDialog.tsx` (React reference)
- `SVELTE_IMPLEMENTATION_GUIDE.md` - Forms and validation section

### Phase 3: Agent Selection Step (2-3 days)
**Goal**: Implement agent and pack selection

Tasks:
- [ ] Fetch agents from Nostr (kind 4199)
- [ ] Implement version management (latest only)
- [ ] Create PackCard component
- [ ] Create AgentDefinitionCard component
- [ ] Implement pack selection UI
- [ ] Implement individual agent grid
- [ ] Add selection indicators (rings, checkmarks)
- [ ] Handle Set-based selection state

Reference:
- Line 397-507 of `CreateProjectDialog.tsx`
- `/Users/pablofernandez/projects/TENEX-web-8bde0h/src/components/agents/PackCard.tsx`
- `/Users/pablofernandez/projects/TENEX-web-8bde0h/src/components/agents/AgentDefinitionCard.tsx`
- `SVELTE_IMPLEMENTATION_GUIDE.md` - Set operations section

### Phase 4: Tools Selection Step (1 day)
**Goal**: Implement MCP tool selection

Tasks:
- [ ] Fetch MCP tools from Nostr (kind 4200)
- [ ] Create tool list item component
- [ ] Implement tool selection with checkboxes
- [ ] Show tool details (name, description, parameters)
- [ ] Display server badges

Reference:
- Line 509-573 of `CreateProjectDialog.tsx`
- `/Users/pablofernandez/projects/TENEX-web-8bde0h/src/components/dialogs/AddToolsToProjectDialog.tsx`

### Phase 5: Review & Creation Step (1 day)
**Goal**: Implement review page and project creation

Tasks:
- [ ] Display project details summary
- [ ] Show selected agents as badges
- [ ] Show selected tools as badges
- [ ] Implement project creation logic
- [ ] Handle NDKProject creation and publishing
- [ ] Auto-add required MCP servers
- [ ] Navigate to new project on success
- [ ] Add error handling

Reference:
- Line 575-634 of `CreateProjectDialog.tsx`
- Line 237-292 of `CreateProjectDialog.tsx` (creation logic)
- `REFERENCE_IMPLEMENTATION_SUMMARY.md` - Project creation section

### Phase 6: Polish & Testing (1-2 days)
**Goal**: Handle edge cases and improve UX

Tasks:
- [ ] Add loading states with spinners
- [ ] Implement empty state messages
- [ ] Add error handling and toast notifications
- [ ] Test form validation
- [ ] Test navigation between steps
- [ ] Test data persistence across steps
- [ ] Test selection clearing on dialog close
- [ ] Performance optimization

Reference:
- `WIZARD_ARCHITECTURE.md` - Error handling and edge cases sections

## State Management Checklist

Required state variables:

```
Navigation:
- [ ] currentStep: "details" | "agents" | "tools" | "review"

Project Data:
- [ ] projectData.name: string
- [ ] projectData.description: string
- [ ] projectData.tags: string[]
- [ ] projectData.imageUrl: string
- [ ] projectData.repoUrl: string

Selections:
- [ ] selectedAgents: Set<string>
- [ ] selectedTools: Set<string>
- [ ] selectedPackId: string | null

Loaded Data:
- [ ] availableAgents: NDKAgentDefinition[]
- [ ] availableTools: NDKMCPTool[]
- [ ] packs: NDKAgentDefinitionPack[]

Loading States:
- [ ] isLoadingAgents: boolean
- [ ] isLoadingTools: boolean
- [ ] isCreating: boolean

Computed/Reactive:
- [ ] $: currentStepIndex: number
- [ ] $: canProceed: boolean
```

## Component Structure

```
CreateProjectDialog.svelte (Main wizard)
├── DialogHeader
├── StepIndicators.svelte (or inline)
├── StepDetails.svelte
│   └── Form inputs for project info
├── StepAgents.svelte
│   ├── PackCard.svelte (multiple)
│   └── AgentDefinitionCard.svelte (multiple)
├── StepTools.svelte
│   └── Tool list items
├── StepReview.svelte
│   └── Summary display
└── DialogFooter with buttons
```

## Key Implementation Details

### Version Management
**Location**: `REFERENCE_IMPLEMENTATION_SUMMARY.md` - Version Management Algorithm section

Must implement agent version management:
1. Group agents by slug/name
2. For each group, keep only latest by created_at + version
3. Show deduplicated list

### Selection Pattern
Use Set for O(1) lookups:
```svelte
let selectedAgents: Set<string> = new Set();

function toggleAgent(id: string) {
  if (selectedAgents.has(id)) {
    selectedAgents.delete(id);
  } else {
    selectedAgents.add(id);
  }
  selectedAgents = selectedAgents;  // Trigger reactivity
}
```

### MCP Server Auto-Installation
When creating project:
1. For each selected agent, check agent.mcpServers array
2. Add all MCP server event IDs to project
3. Avoid duplicates

### Pack Selection Behavior
- Selecting a pack selects all agents in it
- User can deselect individual agents from pack
- Can add additional agents beyond pack

## Testing Checklist

Form Validation:
- [ ] Cannot proceed to step 2 without name and description
- [ ] Can proceed without agents/tools (optional)

Navigation:
- [ ] Back button disabled on step 1
- [ ] Next button disabled on step 1 if validation fails
- [ ] Create button only appears on step 4

Selection:
- [ ] Can select/deselect individual agents
- [ ] Pack selection selects all agents in pack
- [ ] Can deselect agents from pack
- [ ] Can add more agents beyond pack
- [ ] Tools selection independent

Data Persistence:
- [ ] Form data preserved when moving between steps
- [ ] Selections preserved between steps
- [ ] Data cleared when dialog closes

Loading:
- [ ] Shows spinner while fetching agents
- [ ] Shows spinner while fetching tools
- [ ] Shows "no items" when list is empty
- [ ] Buttons disabled during creation

Error Handling:
- [ ] Shows error toast on failed agent fetch
- [ ] Shows error toast on failed tool fetch
- [ ] Shows error toast on failed project creation
- [ ] Stays on review page if creation fails

## Performance Considerations

- [ ] Fetch agents/tools only when dialog opens
- [ ] Use Set for agent/tool selection (O(1) lookup)
- [ ] Memoize filtered agent/tool lists
- [ ] Lazy load component code if needed
- [ ] Virtual scrolling for large lists (if needed)

## Integration Requirements

NDK Usage:
- [ ] useNDK() hook for ndk instance
- [ ] useSubscribe() for fetching agents/tools/packs
- [ ] useUser() and useProfileValue() for author info
- [ ] useNavigate() for redirection after creation

Components Needed:
- [ ] Dialog component
- [ ] Button component
- [ ] Input component
- [ ] Textarea component
- [ ] Badge component
- [ ] Avatar component
- [ ] ScrollArea component
- [ ] Tabs component (for AddAgentsDialog)
- [ ] Checkbox component (for tools)

Icons:
- [ ] ChevronLeft, ChevronRight, Loader2, X
- [ ] FileText, Package, Bot, Check, Wrench
- [ ] AlertCircle, Server (for requirements alert)

## Common Gotchas to Avoid

1. Set mutations don't trigger reactivity automatically
   - Solution: `selectedAgents = selectedAgents` after mutations

2. Reactivity with imported stores
   - Solution: Use `$` prefix when accessing store values

3. Forgetting to reset state when dialog closes
   - Solution: Use reactive statement `$: if (!open) resetForm()`

4. Not handling pack agent auto-selection
   - Solution: Set `selectedPackId` AND pre-populate agents

5. Not filtering already-added items
   - Solution: FilteravailableAgents by existing agent IDs

## External References

React Components to Reference:
- `/Users/pablofernandez/projects/TENEX-web-8bde0h/src/components/dialogs/CreateProjectDialog.tsx`
- `/Users/pablofernandez/projects/TENEX-web-8bde0h/src/components/dialogs/AddAgentsToProjectDialog.tsx`
- `/Users/pablofernandez/projects/TENEX-web-8bde0h/src/components/dialogs/AddToolsToProjectDialog.tsx`
- `/Users/pablofernandez/projects/TENEX-web-8bde0h/src/components/agents/PackCard.tsx`
- `/Users/pablofernandez/projects/TENEX-web-8bde0h/src/components/agents/AgentDefinitionCard.tsx`

Current Svelte Project Structure:
- `/Users/pablofernandez/projects/TENEX-web-svelte5/src/lib/components/`
- `/Users/pablofernandez/projects/TENEX-web-svelte5/src/routes/`

## Progress Tracking

Phase 1: Core Structure
- [x] Documents created
- [ ] Component skeleton
- [ ] Step navigation
- [ ] Indicators UI

Phase 2: Project Details
- [ ] Input fields
- [ ] Tag management
- [ ] Form validation

Phase 3: Agent Selection
- [ ] Data fetching
- [ ] Version management
- [ ] PackCard component
- [ ] AgentCard component
- [ ] Selection UI

Phase 4: Tools Selection
- [ ] Data fetching
- [ ] Tool list
- [ ] Selection UI

Phase 5: Review & Creation
- [ ] Summary display
- [ ] Project creation logic
- [ ] Navigation
- [ ] Error handling

Phase 6: Polish
- [ ] Loading states
- [ ] Empty states
- [ ] Error messages
- [ ] Testing

## Questions or Issues?

Refer to:
1. `SVELTE_IMPLEMENTATION_GUIDE.md` - For React-to-Svelte pattern questions
2. `WIZARD_ARCHITECTURE.md` - For component structure/data flow questions
3. `PROJECT_CREATION_WIZARD_REFERENCE.md` - For feature/requirement questions
4. `REFERENCE_IMPLEMENTATION_SUMMARY.md` - For exact code location questions

---

Last Updated: 2025-10-16
Reference Project: TENEX-web-8bde0h
Target Project: TENEX-web-svelte5
