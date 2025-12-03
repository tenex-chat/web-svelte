<!--
	Installed from @ndk/svelte@latest
-->

<script lang="ts">
  import type { NDKEvent } from '@nostr-dev-kit/ndk';
  import type { NDKSvelte } from '@nostr-dev-kit/svelte';
  import { EventCard } from '../event-card/index.js';
  import { cn } from '../../utils/cn';
  import type {
    UserClickCallback,
    EventClickCallback,
    HashtagClickCallback,
    LinkClickCallback,
    MediaClickCallback
  } from '../../ui/content-renderer/index.svelte.js';
    import { User } from '$lib/ndk/ui/user/index.js';

  interface Props {
    ndk: NDKSvelte;
    event: NDKEvent;
    onUserClick?: UserClickCallback;
    onEventClick?: EventClickCallback;
    onHashtagClick?: HashtagClickCallback;
    onLinkClick?: LinkClickCallback;
    onMediaClick?: MediaClickCallback;
    class?: string;
  }

  let {
    ndk,
    event,
    onUserClick,
    onEventClick,
    onHashtagClick,
    onLinkClick,
    onMediaClick,
    class: className = ''
  }: Props = $props();

  // Extract text content from event
  const content = $derived(event.content?.trim() || '');
</script>

<EventCard.Root
  data-event-card-inline=""
  {ndk}
  {event}
  {onUserClick}
  {onEventClick}
  {onHashtagClick}
  {onLinkClick}
  {onMediaClick}
  class={cn(
    'px-3 py-2 bg-muted/30 rounded-md border border-border/50',
    'hover:bg-muted/50 transition-colors',
    className
  )}
>
  <div class="flex items-center gap-2">
    <User.Root {ndk} pubkey={event.pubkey}>
      <User.Avatar class="w-5 h-5" />
    </User.Root>

    <!-- Content - truncated to one line -->
    {#if content}
      <div class="min-w-0 text-sm text-muted-foreground truncate break-word w-96">
        {content}
      </div>
    {/if}
  </div>
</EventCard.Root>
