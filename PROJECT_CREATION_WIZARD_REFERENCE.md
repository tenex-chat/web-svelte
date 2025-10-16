# Project Creation Wizard Reference Implementation

This document outlines the React implementation of the project creation wizard found in `TENEX-web-8bde0h` that needs to be replicated in Svelte for this project.

## Overview

The wizard is a multi-step dialog component that guides users through creating a new project with the following steps:
1. **Project Details** - Name, description, tags, image URL, repository URL
2. **Select Agents** - Choose individual agents or pre-configured agent packs
3. **MCP Tools** - Select optional MCP tools to enable
4. **Review & Create** - Review selections and create the project

## Core Components

### 1. CreateProjectDialog (Main Wizard)
**File**: `/Users/pablofernandez/projects/TENEX-web-8bde0h/src/components/dialogs/CreateProjectDialog.tsx`

**Key Features**:
- Multi-step form with 4 steps: "details", "agents", "tools", "review"
- Step indicators at top with icons and progress visualization
- Scrollable content area for each step
- Previous/Next/Create buttons in footer

**State Management**:
```
- currentStep: Step (tracks which step user is on)
- projectData: { name, description, tags, imageUrl, repoUrl }
- selectedAgents: Set<string> (agent IDs)
- selectedTools: Set<string> (tool IDs)
- selectedPackId: string | null (selected agent pack)
- availableAgents: NDKAgentDefinition[] (fetched agents)
- availableTools: NDKMCPTool[] (fetched MCP tools)
- isLoadingAgents: boolean
- isLoadingTools: boolean
- isCreating: boolean
```

**Data Fetching**:
- Agents (kind 4199): Fetches all agents, groups by slug, keeps only latest version
- Tools (kind 4200): Fetches all MCP tools
- Packs (kind 34199): Fetches all agent definition packs

**Step 1: Project Details**
```tsx
- Project Name input (required)
- Description textarea (required)
- Tags input with Enter to add (optional)
- Image URL input (optional)
- Repository URL input (optional)
```

**Step 2: Select Agents**
```tsx
- Pack Selection Section (if packs available)
  - Displays packs in a grid (2 columns on md, responsive)
  - PackCard component for each pack with visual selection indicator
  - Divider with "Or select individual agents" text
- Individual Agents Grid
  - Grid layout: 3 columns on lg, 2 on md
  - AgentDefinitionCard for each agent
  - Selection ring on selected items
  - Checkmark badge on selected items (top-right)
```

**Step 3: MCP Tools**
```tsx
- Tools displayed in a list (not grid)
- Each tool shows:
  - Avatar with Wrench icon fallback
  - Tool name, description, command
  - Check icon when selected
- List items have hover effect and selection highlighting
```

**Step 4: Review**
```tsx
- Display project details summary
- Show selected agents as badges
- Show selected tools as badges
- No edit capability at this stage
```

**Navigation Logic**:
```
- canProceed() validates step requirements (name & description required for details)
- handleNext() moves to next step
- handleBack() moves to previous step
- handleCreate() saves project and navigates to it
```

**Project Creation**:
```tsx
const project = new NDKProject(ndk);
project.title = projectData.name;
project.description = projectData.description;
project.hashtags = projectData.tags;
project.picture = projectData.imageUrl;
project.repoUrl = projectData.repoUrl;

// Add agents from pack
if (selectedPackId) {
  const pack = packs.find(p => p.id === selectedPackId);
  pack.agentEventIds.forEach(agentId => {
    project.addAgent(agentId);
    // Auto-add MCP servers required by agent
  });
}

// Add individual agents
selectedAgents.forEach(agentId => project.addAgent(agentId));

// Add tools as tags
selectedTools.forEach(toolId => project.tags.push(["mcp", toolId]));

await project.publish();
```

### 2. AddAgentsToProjectDialog
**File**: `/Users/pablofernandez/projects/TENEX-web-8bde0h/src/components/dialogs/AddAgentsToProjectDialog.tsx`

**Purpose**: Dialog for adding agents to an existing project

**Key Features**:
- Tabs: "Individual Agents" and "Agent Packs"
- Search functionality that filters by name, description, role (agents) or name, description (packs)
- Alert showing required tools and MCP servers for selected agents
- Filters out agents already in the project

**State**:
```
- selectedAgentIds: Set<string>
- selectedPackId: string | null
- packAgentSelection: Map<string, Set<string>>
- isAdding: boolean
- searchQuery: string
- activeTab: "agents" | "packs"
```

**Behavior**:
- When a pack is selected, all its agents are automatically selected
- Can select/deselect individual agents
- Shows alert with required tools and MCP servers
- Automatically adds MCP servers when agents are added
- Publishes project as replaceable event

### 3. AddToolsToProjectDialog
**File**: `/Users/pablofernandez/projects/TENEX-web-8bde0h/src/components/dialogs/AddToolsToProjectDialog.tsx`

**Purpose**: Dialog for adding MCP tools to an existing project

**Key Features**:
- Search by name, description, or server name
- Shows tool details: icon, name, server badge, description, parameter count
- Filters out tools already added to project

**State**:
```
- searchTerm: string
- selectedTools: string[]
- isAdding: boolean
```

**Tool Display**:
```tsx
- Icon (Terminal, Code2, or Wrench based on tool name)
- Name, description, server badge
- Parameter count from inputSchema
- Checkbox for selection
```

### 4. PackCard Component
**File**: `/Users/pablofernandez/projects/TENEX-web-8bde0h/src/components/agents/PackCard.tsx`

**Purpose**: Displays agent pack as a visually appealing card

**Features**:
- 264px x 320px fixed size card
- Full bleed image or generated color background (based on pack ID)
- Gradient overlay (black gradient from bottom)
- Agent count badge (top-right, primary color)
- Pack title and description
- Author avatar and name
- Selection indicator (checkmark in circle)

**Visual Design**:
```
- Hover effect: scale-105, shadow-2xl
- Selected state: ring-2 ring-primary
- Responsive text truncation and line clamping
```

### 5. AgentDefinitionCard Component
**File**: `/Users/pablofernandez/projects/TENEX-web-8bde0h/src/components/agents/AgentDefinitionCard.tsx`

**Purpose**: Displays agent definition as a card

**Features**:
- Card with header and content sections
- Agent avatar with color-based fallback (generated from agent name)
- Agent name (large, truncated)
- Description (clamped to 3 lines)
- Phase count badge (if phases exist)
- Author info with avatar and name
- Version badge

**Visual Design**:
```
- Hover effect: shadow-lg
- Cursor: pointer
- Compact but information-rich layout
```

## Data Models

### NDKProject
Methods used:
- `addAgent(agentId)` - Add agent to project
- `addMCPTool(toolId)` - Add MCP tool to project
- `publish()` - Publish project event
- `publishReplaceable()` - Publish as replaceable event
- `tags` - Array of tags (["mcp", toolId] format for tools)

### NDKAgentDefinition
Properties:
- `id` - Event ID
- `name` - Agent name
- `description` - Agent description
- `slug` / `dTag` - Unique identifier (d tag)
- `pubkey` - Author's public key
- `picture` - Agent avatar
- `phases` - Array of agent phases
- `version` - Version number
- `created_at` - Timestamp
- `mcpServers` - Array of MCP server event IDs
- `tools` - Array of tool names
- `role` - Agent role

### NDKAgentDefinitionPack
Properties:
- `id` - Pack ID
- `title` - Pack title
- `description` - Pack description
- `image` - Pack cover image
- `pubkey` - Author's public key
- `agentEventIds` - Array of agent event IDs in pack

### NDKMCPTool
Properties:
- `id` - Event ID
- `name` - Tool name
- `description` - Tool description
- `command` - Tool command/reference
- `serverName` - MCP server name
- `inputSchema` - JSON schema for tool parameters

## UI/UX Patterns

### Step Indicators
```
[Icon] ─── [Icon] ─── [Icon] ─── [Icon]
```
- Filled circles for completed/current steps
- Connected with lines showing progress
- Color-coded (primary for active/completed, muted for future)

### Selection Pattern
- Ring on card: `ring-2 ring-primary`
- Checkmark badge: top-right or top-left depending on card type
- Hover effects for better interactivity

### Loading States
- Spinner centered in content area during data fetch
- "No items" empty state messaging
- Disabled buttons during operations

### Validation
- Name and description required for creating project
- Can proceed through agents/tools steps without selection
- Review step shows what will be created
- Create button disabled during submission

## Nostr Event Kinds

- **4199**: Agent Definition
- **34199**: Agent Definition Pack
- **4200**: MCP Tool

## Key Technical Patterns

1. **Version Management**: Latest version of agents determined by:
   - Grouping by slug/d-tag/name
   - Sorting by created_at timestamp (newest first)
   - Then by version number (higher first)

2. **Filtering**: Already-added items filtered out from selection dialogs

3. **Auto-installation**: MCP servers required by agents automatically added to project

4. **Pack Behavior**: Selecting a pack pre-selects all agents in that pack

5. **Replaceable Events**: Projects use `publishReplaceable()` for updates to ensure only latest version is kept

## Navigation Flow

```
Details ──> Agents ──> Tools ──> Review ──> Create
  ↑            ↑         ↑         ↑
  └────────────┴─────────┴─────────┘
              Back button
```

## Import Structure

```typescript
// UI Components
import Dialog from "@/components/ui/dialog"
import Button from "@/components/ui/button"
import Input from "@/components/ui/input"
import Textarea from "@/components/ui/textarea"
import Badge from "@/components/ui/badge"
import Avatar from "@/components/ui/avatar"
import ScrollArea from "@/components/ui/scroll-area"

// Custom Components
import PackCard from "@/components/agents/PackCard"
import AgentDefinitionCard from "@/components/agents/AgentDefinitionCard"

// NDK
import { useNDK, useSubscribe, useUser, useProfileValue } from "@nostr-dev-kit/ndk-hooks"
import { NDKProject, NDKAgentDefinition, NDKAgentDefinitionPack, NDKMCPTool } from "@/lib/ndk-events/*"

// Icons
import { ChevronLeft, ChevronRight, Loader2, X, Wrench, FileText, Package, Bot, Check } from "lucide-react"

// Utilities
import { toast } from "sonner"
import { cn } from "@/lib/utils"
```

## Summary

The project creation wizard follows a clear step-by-step approach with:
- **Flexible project configuration** (optional agents/tools)
- **Pre-configured packs** for quick setup
- **Automatic dependency installation** (MCP servers)
- **Visual feedback** at every step
- **Review before creation** to ensure correctness

The implementation should focus on:
1. State management for multi-step form
2. Data fetching and caching
3. Selection UI with visual feedback
4. Validation and error handling
5. Integration with NDK for event publishing
