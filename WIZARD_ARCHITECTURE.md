# Project Creation Wizard - Architecture & Visual Flow

## Component Hierarchy

```
CreateProjectDialog
├── DialogHeader
│   ├── DialogTitle
│   └── DialogDescription (Step indicator)
├── Step Indicators Bar
│   ├── Icon + Circle (for each step)
│   └── Connecting lines
├── Content Area (Scrollable)
│   ├── Step: Details
│   │   ├── Name Input
│   │   ├── Description Textarea
│   │   ├── Tags Input with Badge display
│   │   ├── Image URL Input
│   │   └── Repo URL Input
│   ├── Step: Agents
│   │   ├── Pack Selection Section
│   │   │   ├── Label + Description
│   │   │   ├── PackCard Grid
│   │   │   │   └── PackCard (with selection indicator)
│   │   │   └── Selected pack notification
│   │   ├── Divider "Or select individual agents"
│   │   └── Individual Agents
│   │       ├── Description text
│   │       └── AgentDefinitionCard Grid
│   │           └── AgentDefinitionCard (with selection indicator)
│   ├── Step: Tools
│   │   ├── Description text
│   │   └── Tools List
│   │       └── Tool Item (with checkbox and icon)
│   └── Step: Review
│       ├── Project Details Summary
│       ├── Selected Agents Section (badges)
│       └── Selected Tools Section (badges)
└── DialogFooter
    ├── Back Button (conditional)
    └── Next/Create Button
```

## State Management Flow

```
┌─────────────────────────────────────────────────────┐
│              CreateProjectDialog State              │
├─────────────────────────────────────────────────────┤
│ currentStep: "details" | "agents" | "tools" | ...  │
│ isCreating: boolean                                 │
├─────────────────────────────────────────────────────┤
│ PROJECT DATA                                        │
│ ├─ projectData.name                                 │
│ ├─ projectData.description                          │
│ ├─ projectData.tags[]                               │
│ ├─ projectData.imageUrl                             │
│ └─ projectData.repoUrl                              │
├─────────────────────────────────────────────────────┤
│ SELECTIONS                                          │
│ ├─ selectedAgents: Set<string>                      │
│ ├─ selectedTools: Set<string>                       │
│ └─ selectedPackId: string | null                    │
├─────────────────────────────────────────────────────┤
│ AVAILABLE ITEMS (from Nostr)                        │
│ ├─ availableAgents: NDKAgentDefinition[]            │
│ ├─ availableTools: NDKMCPTool[]                      │
│ ├─ packs: NDKAgentDefinitionPack[]                  │
│ ├─ isLoadingAgents: boolean                         │
│ └─ isLoadingTools: boolean                          │
└─────────────────────────────────────────────────────┘
```

## Data Flow Diagram

```
┌─────────────────────────────────────────────────────────────┐
│                    Nostr Network                             │
│  Kind 4199 (Agents) Kind 4200 (Tools) Kind 34199 (Packs)   │
└────────────┬──────────────────────────┬──────────────────────┘
             │                          │
             ▼                          ▼
┌────────────────────────┐  ┌──────────────────────┐
│  useSubscribe() Hook   │  │  useSubscribe() Hook │
│  fetchEvents()         │  │  fetchEvents()       │
└────────┬───────────────┘  └──────────┬───────────┘
         │                             │
         ▼                             ▼
┌────────────────────────┐  ┌──────────────────────┐
│  rawAgents Events[]    │  │  rawTools Events[]   │
└────────┬───────────────┘  └──────────┬───────────┘
         │                             │
    Transform & Filter                Transform
    (latest versions)                 │
         │                             │
         ▼                             ▼
┌────────────────────────┐  ┌──────────────────────┐
│ availableAgents[]      │  │ availableTools[]     │
│ NDKAgentDefinition[]   │  │ NDKMCPTool[]         │
└────────┬───────────────┘  └──────────┬───────────┘
         │                             │
         └────────────────┬────────────┘
                          │
                          ▼
                    ┌──────────────┐
                    │ User Select  │
                    │ Items        │
                    └──────┬───────┘
                           │
                    ┌──────▼───────┐
                    │ Create       │
                    │ NDKProject   │
                    │ publish()    │
                    └──────┬───────┘
                           │
                    ┌──────▼──────────┐
                    │ Navigate to     │
                    │ Project Detail  │
                    │ Page            │
                    └─────────────────┘
```

## User Interaction Flow

```
START
  │
  ▼
Step 1: DETAILS
  ├─ [User fills form]
  ├─ [canProceed() validation]
  └─ [Next button enabled if name & description filled]
  │
  ▼─ NEXT
  │
Step 2: AGENTS
  ├─ [Packs load]
  ├─ [Agents load]
  ├─ [User can select pack OR individual agents]
  │   ├─ Pack selection auto-selects all agents
  │   └─ Individual selection independent
  │
  ▼─ NEXT
  │
Step 3: TOOLS
  ├─ [Tools load]
  ├─ [User selects tools (optional)]
  │
  ▼─ NEXT
  │
Step 4: REVIEW
  ├─ [Display summary]
  ├─ [Create button enabled]
  │
  ▼─ CREATE
  │
PROCESSING
  ├─ [Create NDKProject]
  ├─ [Add agents and tools]
  ├─ [Publish event]
  │
  ▼
SUCCESS
  ├─ [Toast notification]
  ├─ [Close dialog]
  └─ [Navigate to project]
     │
     ▼
    END
```

## Validation Logic

```
canProceed(step) {
  switch(step) {
    case "details":
      return projectData.name.trim() !== "" AND
             projectData.description.trim() !== ""
    
    case "agents":
      return true  // Optional selection
    
    case "tools":
      return true  // Optional selection
    
    default:
      return true
  }
}
```

## Agent Selection Logic

```
Pack Selection:
  └─ selectedPackId = pack.id
     ├─ Pre-select all agents in pack
     └─ Display: "Pack selected. All agents from this pack..."

Individual Agent Selection:
  └─ Toggle agent in selectedAgents Set
     ├─ First click: add to set
     └─ Second click: remove from set

Multiple Selection Support:
  ├─ Select pack: selectedPackId filled
  ├─ Add individual agents: selectedAgents filled
  └─ Both can coexist

On Create:
  ├─ If pack selected: add all pack agents
  │   └─ Auto-add required MCP servers
  ├─ Add selected individual agents
  └─ Add selected tools
```

## Key Component Features

### PackCard
```
Dimensions: 264px × 320px
Content:
  ├─ Background Image or generated color
  ├─ Gradient Overlay (bottom to transparent)
  ├─ Agent Count Badge (top-right)
  ├─ Title (large, uppercase)
  ├─ Description (2-line clamp)
  ├─ Author Avatar + Name
  └─ Selection Indicator (checkmark circle)

States:
  ├─ Default: normal appearance
  ├─ Hover: scale-105, shadow-2xl
  └─ Selected: ring-2 ring-primary + checkmark
```

### AgentDefinitionCard
```
Sections:
  ├─ Header
  │   ├─ Avatar (colored fallback)
  │   └─ Name (large, truncated)
  ├─ Content
  │   ├─ Description (3-line clamp)
  │   ├─ Phase Count Badge (if has phases)
  │   ├─ Divider line
  │   ├─ Author Avatar + Name
  │   └─ Version Badge
  └─ Selection Ring (if selected)

States:
  ├─ Default: normal card
  ├─ Hover: shadow-lg
  └─ Selected: ring-2 ring-primary
```

### Tool Selection Item
```
Layout: List item (not grid)
Content:
  ├─ Checkbox (left)
  ├─ Avatar with tool icon
  ├─ Tool Details (flex: 1)
  │   ├─ Icon + Name
  │   ├─ Server Badge
  │   ├─ Description (2-line clamp)
  │   └─ Parameter Count
  └─ Check Icon (if selected, right)

States:
  ├─ Default: normal appearance
  ├─ Hover: bg-accent/50
  └─ Selected: bg-primary/10, border-primary
```

## NDK Integration Points

```
1. Fetch Agents
   └─ useSubscribe([{ kinds: [4199] }])
      └─ Group by slug, get latest versions

2. Fetch Tools
   └─ useSubscribe([{ kinds: [4200] }])

3. Fetch Packs
   └─ useSubscribe([{ kinds: [34199] }])

4. Create Project
   ├─ new NDKProject(ndk)
   ├─ project.addAgent(agentId)
   ├─ project.addMCPTool(toolId)
   └─ project.publish()
```

## Error Handling

```
Scenarios:
  ├─ Failed to load agents
  │   └─ Display error toast + loading state
  ├─ Failed to load tools
  │   └─ Display error toast + loading state
  ├─ Failed to create project
  │   └─ Display error toast, stay on review page
  └─ Network error
      └─ Generic error message to user
```

## Edge Cases

```
1. No agents available
   └─ Show "No agents available" message
   └─ Allow proceeding (agents optional)

2. No tools available
   └─ Show "No MCP tools available" message
   └─ Allow proceeding (tools optional)

3. No packs available
   └─ Skip pack section entirely
   └─ Show only individual agents

4. All agents already added to project (AddAgentsDialog)
   └─ Show "All available agents already added"
   └─ Disable Add button

5. Large number of items
   └─ Virtualize long lists
   └─ Search to filter
   └─ Pagination if needed
```

## Performance Considerations

```
1. Lazy Loading
   └─ Fetch agents/tools only when dialog opens
   └─ Cache results in component state

2. Filtering
   └─ useMemo for filtered agents/tools
   └─ Re-calculate only when source data changes

3. Selection Sets
   └─ Use Set for O(1) lookup vs Array includes()
   └─ Reduces re-render cycles

4. Virtual Lists (if many items)
   └─ For very large agent/tool lists
   └─ Consider windowing library
```
