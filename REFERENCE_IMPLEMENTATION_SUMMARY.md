# Reference Implementation Summary

This document summarizes all the reference files and their locations for the project creation wizard.

## Reference Implementation Location

All reference files are located in: `/Users/pablofernandez/projects/TENEX-web-8bde0h/src/`

### Core Components to Reference

#### 1. **CreateProjectDialog.tsx** - Main Wizard Component
**Path**: `/Users/pablofernandez/projects/TENEX-web-8bde0h/src/components/dialogs/CreateProjectDialog.tsx`

**Lines**: 1-750

**Key Sections**:
- Lines 1-43: Imports and interface definitions
- Lines 47-108: State initialization and reset logic
- Lines 111-178: Agent fetching and version management
- Lines 181-206: Tool fetching logic
- Lines 208-235: Navigation logic (next/back)
- Lines 237-292: Project creation logic
- Lines 294-636: Step rendering functions
- Lines 638-749: UI rendering

**Critical Patterns**:
- Multi-step form with Set-based selections
- Agent version management (latest by timestamp and version number)
- Auto-installation of required MCP servers
- Pack pre-selection of all agents

#### 2. **AddAgentsToProjectDialog.tsx** - Agent Addition Dialog
**Path**: `/Users/pablofernandez/projects/TENEX-web-8bde0h/src/components/dialogs/AddAgentsToProjectDialog.tsx`

**Lines**: 1-487

**Key Sections**:
- Lines 41-128: Data fetching with tabs (Agents vs Packs)
- Lines 155-229: Add agents handler
- Lines 231-281: Selection management and requirements calculation
- Lines 320-363: Alert for required tools/MCP servers

**Critical Patterns**:
- Tabs for switching between agent types
- Search filtering across multiple fields
- Automatic MCP server collection
- Pack agent selection behavior

#### 3. **AddToolsToProjectDialog.tsx** - Tool Addition Dialog
**Path**: `/Users/pablofernandez/projects/TENEX-web-8bde0h/src/components/dialogs/AddToolsToProjectDialog.tsx`

**Lines**: 1-236

**Key Sections**:
- Lines 40-65: Tool filtering and searching
- Lines 83-108: Tool addition handler
- Lines 110-123: Dynamic icon selection based on tool name

**Critical Patterns**:
- Tool deduplication (filters existing tools)
- Dynamic icon assignment
- Parameter count display

#### 4. **PackCard.tsx** - Pack Display Component
**Path**: `/Users/pablofernandez/projects/TENEX-web-8bde0h/src/components/agents/PackCard.tsx`

**Lines**: 1-124

**Key Sections**:
- Lines 37-102: Card layout with image/color background
- Lines 64-65: Gradient overlay
- Lines 68-72: Agent count badge
- Lines 103-120: Selection indicator

**Visual Design**:
- 264px × 320px fixed dimensions
- Hover scale effect (scale-105)
- Gradient overlay from bottom
- Dynamic background color generation

#### 5. **AgentDefinitionCard.tsx** - Agent Display Component
**Path**: `/Users/pablofernandez/projects/TENEX-web-8bde0h/src/components/agents/AgentDefinitionCard.tsx`

**Lines**: 1-99

**Key Sections**:
- Lines 28-54: Header with avatar and name
- Lines 56-68: Description and phase badge
- Lines 72-94: Author info and version badge

**Visual Design**:
- Hover shadow effect
- Colored avatar fallback (generated from name)
- Clamped description (3 lines)
- Version badge

## Documentation Files Created for Svelte Implementation

### 1. **PROJECT_CREATION_WIZARD_REFERENCE.md**
**Path**: `/Users/pablofernandez/projects/TENEX-web-svelte5/PROJECT_CREATION_WIZARD_REFERENCE.md`

**Contents**:
- Overview of 4-step wizard
- Detailed component descriptions
- State management structure
- Data models (NDKProject, NDKAgentDefinition, etc.)
- UI/UX patterns
- Nostr event kinds
- Key technical patterns
- Navigation flow
- Import structure

### 2. **WIZARD_ARCHITECTURE.md**
**Path**: `/Users/pablofernandez/projects/TENEX-web-svelte5/WIZARD_ARCHITECTURE.md`

**Contents**:
- Component hierarchy tree
- State management flow diagram
- Data flow diagram
- User interaction flow
- Validation logic
- Agent selection logic
- Component features (PackCard, AgentCard, Tool items)
- NDK integration points
- Error handling
- Edge cases
- Performance considerations

### 3. **SVELTE_IMPLEMENTATION_GUIDE.md**
**Path**: `/Users/pablofernandez/projects/TENEX-web-svelte5/SVELTE_IMPLEMENTATION_GUIDE.md`

**Contents**:
- React to Svelte pattern conversion
- State management examples
- Effects/lifecycle patterns
- Conditional rendering
- Set operations
- Event handling
- Computed values (useMemo equivalent)
- Class binding (Tailwind)
- Form validation
- Component structure templates
- Store vs local state guidance
- Common pitfalls
- Testing considerations
- Migration checklist

## Key Data Flow

```
Nostr Events (kind 4199, 4200, 34199)
        ↓
   useSubscribe() / fetchEvents()
        ↓
Transform & Filter (latest versions, dedup)
        ↓
availableAgents[], availableTools[], packs[]
        ↓
User Selection (selectedAgents Set, selectedTools Set, selectedPackId)
        ↓
Create NDKProject
        ↓
Add agents/tools via project.addAgent() and project.tags
        ↓
project.publish()
        ↓
Navigate to project detail page
```

## State Structure

```typescript
Interface CreateProjectDialogState {
  currentStep: "details" | "agents" | "tools" | "review"
  isCreating: boolean
  
  projectData: {
    name: string
    description: string
    tags: string[]
    imageUrl: string
    repoUrl: string
  }
  
  selectedAgents: Set<string>
  selectedTools: Set<string>
  selectedPackId: string | null
  
  availableAgents: NDKAgentDefinition[]
  availableTools: NDKMCPTool[]
  packs: NDKAgentDefinitionPack[]
  
  isLoadingAgents: boolean
  isLoadingTools: boolean
}
```

## Version Management Algorithm

From lines 127-166 of CreateProjectDialog.tsx:

```
1. Group all agents by slug/dTag/name
2. For each group:
   - If only 1 agent: keep it
   - If multiple agents:
     a. Sort by created_at DESC (newest first)
     b. If created_at equal, sort by version DESC (higher first)
     c. Keep only first (latest)
3. Result: One agent per unique identifier
```

## Error Handling Patterns

**From reference implementation**:
- Failed to fetch agents: console.error + toast.error
- Failed to fetch tools: console.error + toast.error
- Failed to create project: console.error + toast.error + stay on review page

**Expected messages**:
- "Failed to load agents"
- "Failed to load MCP tools"
- "Failed to create project"

## Testing Scenarios to Cover

1. **Form Validation**
   - Name/description required for proceeding from step 1
   - Optional agents and tools

2. **Navigation**
   - Next/back buttons work correctly
   - Back button disabled on first step
   - Create button only on last step

3. **Selection**
   - Single agent selection
   - Multiple agent selection
   - Pack selection pre-selects all agents
   - Can mix pack + individual selections
   - Tool selection independent

4. **Data Persistence**
   - Form data preserved across steps
   - Selections preserved across steps
   - Reset when dialog closes/reopens

5. **Loading States**
   - Show spinners while fetching
   - Handle empty states
   - Handle errors

## Performance Notes

From reference implementation:
- Agents/tools fetched only when dialog opens
- Latest version filtering reduces displayed items
- Set-based selections for O(1) lookup
- useMemo for filtered lists
- ScrollArea for potential large lists

## Integration Points

1. **NDK Usage**
   - useNDK() for accessing ndk instance
   - useSubscribe() for reactive event subscriptions
   - useUser() for fetching user profiles
   - useProfileValue() for user metadata

2. **Navigation**
   - useNavigate() to redirect after creation
   - Navigate to `/projects/$projectId` with new project ID

3. **Notifications**
   - sonner toast for success/error messages
   - Toast shown on successful creation

## Component Dependencies

**UI Library**: shadcn/ui components
- Dialog
- Button
- Input
- Textarea
- Badge
- Avatar
- ScrollArea
- Tabs

**Icons**: lucide-react
- ChevronLeft, ChevronRight
- Loader2
- X (for removing tags)
- Wrench, FileText, Package, Bot, Check (step icons)
- Server, AlertCircle (in AddAgentsDialog)

**Utilities**:
- cn() utility from @/lib/utils
- toast from 'sonner'

## Migration Priority

1. **High Priority** (Core functionality)
   - CreateProjectDialog main component
   - State management for wizard
   - Step navigation
   - Form handling

2. **Medium Priority** (Enhanced features)
   - PackCard visual design
   - AgentDefinitionCard layout
   - Selection indicators
   - Loading states

3. **Low Priority** (Polish)
   - Animations (hover effects)
   - Color generation for cards
   - Advanced filtering
   - Error boundary handling

## References for NDK Classes

**Ensure these are properly implemented in Svelte version**:
- NDKProject class with addAgent(), addMCPTool(), publish(), publishReplaceable()
- NDKAgentDefinition with properties: id, name, description, slug, pubkey, picture, phases, version, created_at, mcpServers, tools, role
- NDKAgentDefinitionPack with properties: id, title, description, image, pubkey, agentEventIds
- NDKMCPTool with properties: id, name, description, command, serverName, inputSchema

## Common Implementation Questions

**Q: Why use Set for selectedAgents instead of array?**
A: O(1) lookup time for checking if agent is selected, cleaner toggle logic

**Q: Why fetch agents/tools in useEffect instead of store?**
A: Dialog-specific data, only needed when dialog opens, automatically cleaned up

**Q: How are MCP servers auto-added?**
A: Each agent has mcpServers array; when agent added, all its required MCP servers also added

**Q: Can user select both pack and individual agents?**
A: Yes! Pack provides default selection, user can add more individual agents

**Q: What happens if agent is added twice?**
A: Handled by NDKProject.addAgent() which uses tags with unique event IDs
