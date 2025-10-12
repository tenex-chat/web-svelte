# @mention Autocomplete Feature

## Overview
The @mention autocomplete feature allows users to easily mention online agents in their messages. When you type `@` in the chat input, a dropdown appears showing all online agents that can be mentioned.

## How It Works

### User Flow
1. Type `@` in the chat textarea
2. Autocomplete dropdown appears showing online agents
3. Start typing to filter agents by name
4. Use ↑↓ arrow keys to navigate
5. Press Enter or Tab to select
6. Agent name is inserted with a space
7. Agent is automatically added to p-tags for message routing

### Technical Implementation

#### State Management
```typescript
let showMentionAutocomplete = $state(false);
let mentionQuery = $state('');
let mentionStartPos = $state(0);
let selectedMentionIndex = $state(0);
let mentionedAgents = $state<string[]>([]);
```

#### Detection Logic
- Detects `@` at word boundaries (start or after whitespace)
- Tracks cursor position to extract query after `@`
- Filters agents in real-time as user types
- Hides autocomplete when space is detected after `@`

#### Keyboard Navigation
- **↑↓ Arrow Keys**: Navigate through filtered agents
- **Enter/Tab**: Select highlighted agent
- **Escape**: Dismiss autocomplete
- **Normal typing**: Filter agents by name

#### P-Tag Routing Priority
The @mention feature integrates with the existing p-tag routing system:

```
PRIORITY ORDER:
1. @mentions (highest) - Multiple agents can be mentioned
2. selectedAgent - Single agent from dropdown
3. Default PM - First online agent (agents[0])
```

When sending a message:
```typescript
if (mentionedAgents.length > 0) {
  // Add all mentioned agents as p-tags
  for (const pubkey of mentionedAgents) {
    thread.tags.push(['p', pubkey]);
  }
} else if (selectedAgent) {
  thread.tags.push(['p', selectedAgent]);
} else if (onlineAgents.length > 0) {
  thread.tags.push(['p', onlineAgents[0].pubkey]);
}
```

## UI Components

### Autocomplete Dropdown
- Positioned above the textarea
- Shows agent name and model
- Highlights selected agent (blue background)
- Keyboard hints at bottom
- Max height with scroll for many agents

### Mentioned Agents Indicator
Shows all currently mentioned agents as badges:
- Blue pill-shaped badges
- Agent name with @ prefix
- Remove button (×) to unmention
- Appears below textarea when agents are mentioned

### Helper Text
Updated to include: "Type @ to mention agents"

## Code Structure

### ChatInput.svelte
All @mention functionality is in this component:

1. **handleInput()** - Detects @ and updates autocomplete state
2. **selectMention(agent)** - Inserts mention text and adds to p-tags
3. **handleKeyDown(e)** - Keyboard navigation for autocomplete
4. **filteredAgents** - Derived state filtering online agents by query

### Integration with Message Sending
Both thread creation and reply sending check `mentionedAgents` first:
- Adds all mentioned pubkeys as p-tags
- Falls back to agent selector if no mentions
- Resets mentionedAgents array after sending

## Example Usage

### Mentioning Single Agent
```
User types: "@pm help me with this bug"
Result: Message sent with p-tag to Project Manager
```

### Mentioning Multiple Agents
```
User types: "@claude @gpt4 what do you think?"
Result: Message sent with p-tags to both Claude and GPT-4
```

### Filtering
```
User types: "@gp"
Dropdown shows: GPT-4, GPT-3.5 (filters out Claude, PM)
```

### Removing Mentions
Click the × button on any mentioned agent badge to remove them from p-tags before sending.

## Future Enhancements
- [ ] @all to mention all online agents
- [ ] Mention history/recent mentions
- [ ] Mention user profiles (not just agents)
- [ ] Inline mention highlighting in message content
- [ ] Notification system for mentioned agents
