# Settings Feature

## Overview
The Settings feature provides a comprehensive interface for managing all aspects of a TENEX project. Accessible from the ⚙️ tab in ProjectColumn, it offers a clean, organized way to configure projects, agents, tools, and more.

## Structure

### SettingsTab.svelte
Main orchestrator component that provides:
- Left sidebar navigation with 5 sections
- Right content area for each section
- Clean, consistent UI across all settings

### Sections

#### 1. General Settings ⚙️
**Purpose**: Edit basic project information

**Features**:
- Edit project title
- Edit project description
- View read-only project ID (d-tag)
- View creation date
- Save/Reset buttons
- Success/error feedback

**Implementation**: `GeneralSettings.svelte`

**How it works**:
```typescript
// Updates project properties
project.title = title;
project.description = description;

// Signs and publishes to Nostr
await project.sign();
await project.publish();
```

**UI States**:
- Tracks changes with `hasChanges` derived state
- Shows save button only when changes exist
- Displays success message for 3 seconds
- Restores message on error

#### 2. Agents Management 🤖
**Purpose**: Add, remove, and view project agents

**Features**:
- Add new agents with name and pubkey
- View all configured project agents
- Remove agents from project
- View currently online agents (from kind:24010)
- View agent definitions (kind:4199)
- Global agent indicator

**Implementation**: `AgentsSettings.svelte`

**How it works**:
```typescript
// Add agent to project
project.addAgent(pubkey, name);
await project.sign();
await project.publish();

// Remove agent
project.tags = project.tags.filter(tag =>
  !(tag[0] === 'agent' && tag[1] === pubkey)
);
await project.sign();
await project.publish();
```

**Data Sources**:
1. **Project Tags** - Agent references in project event
   ```
   ["agent", pubkey, name, "global"?]
   ```

2. **Project Status** (kind:24010) - Currently online agents
   - Shows green indicator
   - Displays model and tools
   - Updated every < 5 minutes

3. **Agent Definitions** (kind:4199) - Full agent specs
   - Subscribed via `ndk.$subscribe()`
   - Shows name and description

#### 3. MCP Tools Management 🔧
**Purpose**: Configure Model Context Protocol tools

**Features**:
- Add new MCP tools
- Specify tool name, description, and JSON schema
- View all configured project tools
- Remove tools from project
- View tool definitions (kind:4200)
- Expandable schema viewer

**Implementation**: `ToolsSettings.svelte`

**How it works**:
```typescript
// Add tool to project
project.addMCPTool(toolName);
await project.sign();
await project.publish();

// Remove tool
project.tags = project.tags.filter(tag =>
  !(tag[0] === 'tool' && tag[1] === toolName)
);
await project.sign();
await project.publish();
```

**Tool Structure**:
- Tool tags: `["tool", toolName]`
- Tool definitions (kind:4200) contain full schema
- JSON schema validation before adding

#### 4. Advanced Settings 🔬
**Purpose**: Configure relays and advanced options

**Status**: Coming soon (placeholder)

**Planned Features**:
- Custom relay configuration
- Cache settings
- Performance tuning
- Debug options

#### 5. Danger Zone ⚠️
**Purpose**: Destructive actions

**Features**:
- Delete project (publishes deletion event)
- Red warning styling
- Clear consequences explanation

**Status**: UI complete, deletion logic to be implemented

## UI/UX Patterns

### Navigation
- Left sidebar (192px width)
- Icon + title + description per section
- Active section highlighted in blue
- Smooth transitions

### Forms
- Consistent input styling
- Clear labels and placeholders
- Helper text below inputs
- Validation feedback
- Save/Cancel pattern

### Feedback
- Success messages (green, 3s auto-dismiss)
- Error messages (red, persistent)
- Loading states on buttons
- Disabled states when invalid

### Lists
- Card-based layout
- Consistent spacing (space-y-2)
- Hover effects
- Remove buttons (trash icon)
- Empty states with helpful text

## Integration with NDK

### Event Publishing
All settings changes follow the same pattern:
1. Modify project object properties or tags
2. Sign event: `await project.sign()`
3. Publish event: `await project.publish()`
4. Nostr network broadcasts change
5. Other clients receive update via subscriptions

### Subscriptions
Settings components use `ndk.$subscribe()` for real-time data:

```typescript
const toolsSubscription = ndk.$subscribe(() => ({
  filters: [{
    kinds: [4200],
    '#a': [project.tagId()]
  }],
  closeOnEose: false
}));

const mcpTools = $derived(toolsSubscription.events);
```

**Benefits**:
- Automatic reactivity
- Auto-cleanup on component unmount
- Multi-user sync (if multiple clients editing)
- Instant updates when agents come online

## Tag Management

### Agent Tags
```
["agent", <pubkey>, <name>, "global"?]
```

### Tool Tags
```
["tool", <toolName>]
```

### Project Reference Tags
```
["a", "31933:<pubkey>:<dtag>"]
```

## Future Enhancements

### General Settings
- [ ] Custom project avatar/icon
- [ ] Project tags/categories
- [ ] Project visibility (public/private)
- [ ] Export project data

### Agents Settings
- [ ] Agent permissions/roles
- [ ] Default agent selection
- [ ] Agent testing interface
- [ ] Import agents from other projects

### Tools Settings
- [ ] Tool testing interface
- [ ] Import tools from marketplace
- [ ] Tool permissions per agent
- [ ] Tool usage statistics

### Advanced Settings
- [ ] Custom relay configuration
- [ ] Cache management
- [ ] Backup/restore
- [ ] Import/export settings

### Danger Zone
- [ ] Archive project (soft delete)
- [ ] Transfer ownership
- [ ] Duplicate project
- [ ] Export all data before delete

## Code Organization

```
src/lib/components/settings/
├── SettingsTab.svelte       # Main container with navigation
├── GeneralSettings.svelte   # Project info editing
├── AgentsSettings.svelte    # Agent management
└── ToolsSettings.svelte     # MCP tools management
```

Each component is self-contained:
- Handles its own subscriptions
- Manages its own state
- Publishes its own updates
- Shows its own feedback

## Usage

### Opening Settings
1. Navigate to any project column
2. Click the ⚙️ Settings tab
3. Select section from left sidebar
4. Make changes
5. Click "Save Changes"

### Example: Adding an Agent
1. Go to Settings → Agents
2. Click "Add Agent"
3. Enter agent name (e.g., "GPT-4")
4. Enter pubkey (npub or hex)
5. Click "Add Agent"
6. Agent appears in project list immediately
7. When agent comes online, appears in "Currently Online" section

### Example: Editing Project Info
1. Go to Settings → General
2. Update title or description
3. Click "Save Changes"
4. Success message appears
5. Changes visible immediately across all clients

## Best Practices

### Performance
- Use `$derived` for computed values
- Lazy load settings tab with dynamic import
- Minimize re-renders with proper reactivity

### User Experience
- Always show feedback for actions
- Validate input before allowing save
- Provide clear error messages
- Show empty states with guidance
- Disable actions when invalid

### Data Integrity
- Validate JSON schemas before saving
- Handle pubkey format conversion (npub/hex)
- Prevent duplicate agents/tools
- Confirm destructive actions

### Accessibility
- Proper labels for all inputs
- Keyboard navigation support
- Clear focus indicators
- Descriptive button text
- ARIA attributes where needed
