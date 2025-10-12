import { ndk } from '$lib/ndk.svelte';
import { NDKKind, type NDKEvent } from '@nostr-dev-kit/ndk';
import { browser } from '$app/environment';

class InboxStore {
	unreadCount = $state<number>(0);
	items = $state<NDKEvent[]>([]);
	private subscription: any = null;

	init() {
		if (!browser) return;

		const currentUser = ndk.$sessions?.[0];
		if (!currentUser) return;

		// Subscribe to mentions and DMs (kind 1, kind 4)
		const filters = [
			{ kinds: [NDKKind.Text], '#p': [currentUser.pubkey], limit: 50 },
			{ kinds: [NDKKind.EncryptedDirectMessage], '#p': [currentUser.pubkey], limit: 50 }
		];

		this.subscription = ndk.$subscribe(
			{ filters, closeOnEose: false },
			{ wrap: true }
		);

		// Count unread items (in a real app, you'd track read/unread status)
		$effect(() => {
			if (this.subscription?.events) {
				this.items = Array.from(this.subscription.events);
				// For now, just show count of recent items
				// In production, you'd filter by read/unread status
				this.unreadCount = this.items.length;
			}
		});
	}

	markAllRead() {
		this.unreadCount = 0;
	}

	destroy() {
		this.subscription?.unsubscribe();
	}
}

export const inboxStore = new InboxStore();
