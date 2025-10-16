# Svelte Implementation Guide for Project Creation Wizard

This guide provides examples of how to translate the React patterns into Svelte.

## Key Svelte Patterns

### State Management

React:
```tsx
const [currentStep, setCurrentStep] = useState<Step>("details");
const [selectedAgents, setSelectedAgents] = useState<Set<string>>(new Set());
```

Svelte:
```svelte
<script lang="ts">
  let currentStep: Step = "details";
  let selectedAgents: Set<string> = new Set();
  
  // Reactive declaration
  $: canProceed = validateStep(currentStep);
  
  // Reactive statement
  $: if (open) {
    resetForm();
  }
</script>
```

### Effects/Lifecycle

React:
```tsx
useEffect(() => {
  if (!ndk || !open) return;
  
  const fetchAgents = async () => {
    const events = await ndk.fetchEvents({ kinds: [4199] });
    // process...
  };
  
  fetchAgents();
}, [ndk, open]);
```

Svelte:
```svelte
<script lang="ts">
  import { onMount } from 'svelte';
  
  onMount(() => {
    if (!ndk || !open) return;
    
    const fetchAgents = async () => {
      const events = await ndk.fetchEvents({ kinds: [4199] });
      // process...
    };
    
    fetchAgents();
  });
</script>
```

Or with derived stores:

```svelte
<script lang="ts">
  import { derived } from 'svelte/store';
  
  const agents = derived(
    [ndk, dialogOpen],
    ([$ndk, $open], set) => {
      if (!$ndk || !$open) {
        set([]);
        return;
      }
      
      $ndk.fetchEvents({ kinds: [4199] }).then(events => {
        set(processAgents(events));
      });
    }
  );
</script>
```

### Conditional Rendering

React:
```tsx
{isLoadingAgents ? (
  <div className="flex items-center justify-center py-8">
    <Loader2 className="h-6 w-6 animate-spin" />
  </div>
) : availableAgents.length === 0 ? (
  <p className="text-center text-muted-foreground py-8">
    No agents available
  </p>
) : (
  <div className="grid gap-4">
    {availableAgents.map(agent => (...))}
  </div>
)}
```

Svelte:
```svelte
{#if isLoadingAgents}
  <div class="flex items-center justify-center py-8">
    <Loader2 class="h-6 w-6 animate-spin" />
  </div>
{:else if availableAgents.length === 0}
  <p class="text-center text-muted-foreground py-8">
    No agents available
  </p>
{:else}
  <div class="grid gap-4">
    {#each availableAgents as agent (agent.id)}
      <!-- Agent card -->
    {/each}
  </div>
{/if}
```

### Set Operations

React:
```tsx
const newSelected = new Set(selectedAgents);
if (newSelected.has(agent.id)) {
  newSelected.delete(agent.id);
} else {
  newSelected.add(agent.id);
}
setSelectedAgents(newSelected);
```

Svelte:
```svelte
<script lang="ts">
  function toggleAgent(agentId: string) {
    if (selectedAgents.has(agentId)) {
      selectedAgents.delete(agentId);
    } else {
      selectedAgents.add(agentId);
    }
    // Trigger reactivity
    selectedAgents = selectedAgents;
  }
</script>

<!-- Or with spread operator -->
<script lang="ts">
  function toggleAgent(agentId: string) {
    const newSet = new Set(selectedAgents);
    if (newSet.has(agentId)) {
      newSet.delete(agentId);
    } else {
      newSet.add(agentId);
    }
    selectedAgents = newSet;
  }
</script>
```

### Event Handling

React:
```tsx
<Button onClick={handleCreate} disabled={isCreating}>
  Create Project
</Button>

<Input
  value={projectData.name}
  onChange={(e) =>
    setProjectData({ ...projectData, name: e.target.value })
  }
/>
```

Svelte:
```svelte
<Button on:click={handleCreate} disabled={isCreating}>
  Create Project
</Button>

<Input
  bind:value={projectData.name}
/>

<!-- Or with event handler -->
<Input
  value={projectData.name}
  on:change={(e) => {
    projectData.name = e.target.value;
  }}
/>
```

### Computed Values / useMemo

React:
```tsx
const currentStepIndex = steps.indexOf(currentStep);

const filteredAgents = useMemo(() => {
  if (!searchQuery) return agents;
  const query = searchQuery.toLowerCase();
  return agents.filter(agent =>
    agent.name?.toLowerCase().includes(query)
  );
}, [agents, searchQuery]);
```

Svelte:
```svelte
<script lang="ts">
  // Simple derived value
  $: currentStepIndex = steps.indexOf(currentStep);
  
  // Derived with filter logic
  $: filteredAgents = (() => {
    if (!searchQuery) return agents;
    const query = searchQuery.toLowerCase();
    return agents.filter(agent =>
      agent.name?.toLowerCase().includes(query)
    );
  })();
</script>
```

Or with derived store:
```svelte
<script lang="ts">
  import { derived } from 'svelte/store';
  
  const filteredAgents = derived(
    [agents, searchQuery],
    ([$agents, $query]) => {
      if (!$query) return $agents;
      const q = $query.toLowerCase();
      return $agents.filter(a =>
        a.name?.toLowerCase().includes(q)
      );
    }
  );
</script>

{#each $filteredAgents as agent (agent.id)}
  ...
{/each}
```

### Class Binding (Tailwind)

React:
```tsx
className={cn(
  "flex items-center gap-3 p-3 rounded-lg border cursor-pointer",
  selectedTools.has(tool.id)
    ? "bg-primary/10 border-primary"
    : "hover:bg-accent",
)}
```

Svelte:
```svelte
<script lang="ts">
  import { cn } from '@/lib/utils';
</script>

<div
  class={cn(
    "flex items-center gap-3 p-3 rounded-lg border cursor-pointer",
    selectedTools.has(tool.id)
      ? "bg-primary/10 border-primary"
      : "hover:bg-accent"
  )}
>
</div>
```

Or inline:
```svelte
<div
  class="flex items-center gap-3 p-3 rounded-lg border cursor-pointer"
  class:bg-primary/10={selectedTools.has(tool.id)}
  class:border-primary={selectedTools.has(tool.id)}
  class:hover:bg-accent={!selectedTools.has(tool.id)}
>
</div>
```

### Forms and Validation

React:
```tsx
<Input
  id="tags"
  placeholder="Type a tag and press Enter"
  onKeyDown={(e) => {
    if (e.key === "Enter") {
      e.preventDefault();
      const input = e.currentTarget;
      const tag = input.value.trim();
      if (tag && !projectData.tags.includes(tag)) {
        setProjectData({
          ...projectData,
          tags: [...projectData.tags, tag],
        });
        input.value = "";
      }
    }
  }}
/>
```

Svelte:
```svelte
<script lang="ts">
  let tagInput = "";
  
  function handleAddTag(e: KeyboardEvent) {
    if (e.key === "Enter") {
      e.preventDefault();
      const tag = tagInput.trim();
      if (tag && !projectData.tags.includes(tag)) {
        projectData.tags = [...projectData.tags, tag];
        tagInput = "";
      }
    }
  }
</script>

<Input
  bind:value={tagInput}
  placeholder="Type a tag and press Enter"
  on:keydown={handleAddTag}
/>
```

## Component Structure

### Main Dialog Component

```svelte
<!-- CreateProjectDialog.svelte -->
<script lang="ts">
  import { onMount } from 'svelte';
  import Dialog from '@/components/ui/dialog/Dialog.svelte';
  import Button from '@/components/ui/button/Button.svelte';
  // ... other imports
  
  export let open = false;
  export let onOpenChange: (open: boolean) => void;
  
  let currentStep: Step = "details";
  let projectData = { name: "", description: "", tags: [], ... };
  let selectedAgents: Set<string> = new Set();
  let selectedTools: Set<string> = new Set();
  let selectedPackId: string | null = null;
  
  // Reactivity
  $: currentStepIndex = steps.indexOf(currentStep);
  $: canProceed = validateStep(currentStep);
  
  onMount(() => {
    if (open) {
      resetForm();
      loadData();
    }
  });
  
  function resetForm() {
    currentStep = "details";
    projectData = { ... };
    selectedAgents = new Set();
    selectedTools = new Set();
    selectedPackId = null;
  }
  
  function loadData() {
    loadAgents();
    loadTools();
    loadPacks();
  }
  
  async function handleCreate() {
    // Implementation
  }
</script>

<Dialog bind:open {onOpenChange}>
  <!-- Header -->
  <slot name="header">
    <DialogHeader>
      <DialogTitle>Create New Project</DialogTitle>
      <DialogDescription>
        Step {currentStepIndex + 1} of {steps.length}
      </DialogDescription>
    </DialogHeader>
  </slot>
  
  <!-- Step Indicators -->
  <div class="flex items-center justify-center gap-2 py-2">
    {#each steps as step, index}
      <div class="flex items-center gap-2">
        <div class="flex h-8 w-8 items-center justify-center rounded-full border-2">
          <svelte:component this={getStepIcon(step)} />
        </div>
        {#if index < steps.length - 1}
          <div class="h-0.5 w-8" />
        {/if}
      </div>
    {/each}
  </div>
  
  <!-- Content -->
  <div class="flex-1 overflow-y-auto px-1">
    {#if currentStep === 'details'}
      <StepDetails bind:projectData />
    {:else if currentStep === 'agents'}
      <StepAgents bind:selectedAgents bind:selectedPackId />
    {:else if currentStep === 'tools'}
      <StepTools bind:selectedTools />
    {:else if currentStep === 'review'}
      <StepReview {projectData} {selectedAgents} {selectedTools} />
    {/if}
  </div>
  
  <!-- Footer -->
  <slot name="footer">
    <DialogFooter>
      {#if currentStepIndex > 0}
        <Button variant="outline" on:click={handleBack}>
          Back
        </Button>
      {/if}
      {#if currentStep === 'review'}
        <Button on:click={handleCreate} disabled={isCreating}>
          {#if isCreating}
            Creating...
          {:else}
            Create Project
          {/if}
        </Button>
      {:else}
        <Button on:click={handleNext} disabled={!canProceed}>
          Next
        </Button>
      {/if}
    </DialogFooter>
  </slot>
</Dialog>
```

### Step Component Example

```svelte
<!-- StepAgents.svelte -->
<script lang="ts">
  import { onMount } from 'svelte';
  
  export let selectedAgents: Set<string>;
  export let selectedPackId: string | null;
  
  let availableAgents: NDKAgentDefinition[] = [];
  let packs: NDKAgentDefinitionPack[] = [];
  let isLoading = false;
  
  onMount(async () => {
    isLoading = true;
    try {
      await loadAgents();
      await loadPacks();
    } finally {
      isLoading = false;
    }
  });
  
  function toggleAgent(agentId: string) {
    if (selectedAgents.has(agentId)) {
      selectedAgents.delete(agentId);
    } else {
      selectedAgents.add(agentId);
    }
    selectedAgents = selectedAgents;
  }
  
  function togglePack(packId: string) {
    if (selectedPackId === packId) {
      selectedPackId = null;
    } else {
      selectedPackId = packId;
    }
  }
</script>

<div class="space-y-4">
  {#if packs.length > 0}
    <div class="space-y-3">
      <div>
        <label>Start from a Pack (optional)</label>
      </div>
      <div class="grid grid-cols-1 md:grid-cols-2 gap-4">
        {#each packs as pack (pack.id)}
          <PackCard
            {pack}
            selected={selectedPackId === pack.id}
            on:click={() => togglePack(pack.id || "")}
          />
        {/each}
      </div>
    </div>
  {/if}
  
  {#if isLoading}
    <div class="flex items-center justify-center py-8">
      <Loader2 class="h-6 w-6 animate-spin" />
    </div>
  {:else if availableAgents.length === 0}
    <p class="text-center text-muted-foreground py-8">
      No agents available
    </p>
  {:else}
    <div class="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
      {#each availableAgents as agent (agent.id)}
        <div
          class="relative rounded-lg transition-all"
          class:ring-2={selectedAgents.has(agent.id || "")}
          class:ring-primary={selectedAgents.has(agent.id || "")}
        >
          <AgentDefinitionCard
            {agent}
            on:click={() => toggleAgent(agent.id || "")}
          />
          {#if selectedAgents.has(agent.id || "")}
            <div class="absolute top-2 right-2 w-6 h-6 bg-primary rounded-full flex items-center justify-center">
              <svg class="w-4 h-4 text-primary-foreground">
                <!-- Checkmark -->
              </svg>
            </div>
          {/if}
        </div>
      {/each}
    </div>
  {/if}
</div>
```

## Store vs Local State

### When to Use Stores
- Shared state across multiple components
- Persisted state (localStorage)
- Global UI state (theme, sidebar collapse, etc.)

### When to Use Local State
- Dialog-specific state (wizard steps, form data)
- Component-specific selections
- Temporary UI states

For the wizard, most state should be **local** since:
- Form data only relevant to this dialog
- Selections only used during creation
- Reset when dialog closes

## Common Pitfalls to Avoid

1. **Forgetting reactivity on Set mutations**
   ```svelte
   ❌ selectedAgents.add(id);  // Won't trigger update
   ✓ selectedAgents = new Set([...selectedAgents, id]);
   ✓ selectedAgents.add(id); selectedAgents = selectedAgents;
   ```

2. **Not binding form inputs properly**
   ```svelte
   ❌ value={name} on:change={(e) => name = e.target.value}
   ✓ bind:value={name}
   ```

3. **Incorrect event binding**
   ```svelte
   ❌ on:Click={handleClick}  // React-style
   ✓ on:click={handleClick}   // Svelte-style
   ```

4. **Performance issues with derived stores**
   ```svelte
   ❌ $: filtered = items.filter(...);  // Runs on every state change
   ✓ const filtered = derived([items], ...);  // Memoized
   ```

5. **Not handling open prop correctly**
   ```svelte
   ❌ open is passed but not reactive
   ✓ $: if (open) { resetForm(); }
   ```

## Testing Considerations

```svelte
<!-- Example test structure -->
<script lang="ts" context="module">
  import { render, screen } from '@testing-library/svelte';
  import userEvent from '@testing-library/user-event';
  import CreateProjectDialog from './CreateProjectDialog.svelte';
  
  describe('CreateProjectDialog', () => {
    it('should move to next step when valid', async () => {
      const { component } = render(CreateProjectDialog, {
        props: { open: true, onOpenChange: () => {} }
      });
      
      const nameInput = screen.getByLabel('Project Name');
      await userEvent.type(nameInput, 'Test Project');
      
      const descInput = screen.getByLabel('Description');
      await userEvent.type(descInput, 'Test Description');
      
      const nextBtn = screen.getByRole('button', { name: /next/i });
      await userEvent.click(nextBtn);
      
      expect(component.currentStep).toBe('agents');
    });
  });
</script>
```

## Migration Checklist

- [x] Convert state to reactive variables
- [x] Convert useEffect to onMount/reactive statements
- [x] Convert JSX conditionals to {#if}/{:else}
- [x] Convert .map() to {#each}
- [x] Convert className/cn() to class directives
- [x] Convert event handlers (on:click, on:change)
- [x] Convert form bindings (bind:value)
- [x] Ensure Set mutations trigger reactivity
- [x] Convert imports to .svelte files
- [x] Update Tailwind class syntax if needed
- [x] Test form validation
- [x] Test navigation between steps
- [x] Test data persistence across steps
