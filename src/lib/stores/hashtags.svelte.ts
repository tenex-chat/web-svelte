import type { NDKSvelte } from '@nostr-dev-kit/svelte';
import type { NDKFilter, NDKEvent } from '@nostr-dev-kit/ndk';
import type { NDKProject } from '$lib/events/NDKProject';

/**
 * Store for tracking hashtags observed in kind:1 and kind:513 events
 * Provides a hot set of hashtags that have been seen in conversations
 */
export class HashtagStore {
	private hashtags = $state<Set<string>>(new Set());
	private ndk: NDKSvelte;
	private project: NDKProject | null = null;
	private subscription: any = null;

	// Reactive derived property for sorted hashtag array
	tags = $derived(Array.from(this.hashtags).sort());

	constructor(ndk: NDKSvelte) {
		this.ndk = ndk;
	}

	/**
	 * Initialize subscription for the given project
	 */
	init(project: NDKProject) {
		this.project = project;
		this.startSubscription();
	}

	/**
	 * Start subscribing to kind:1 and kind:513 events
	 */
	private startSubscription() {
		if (!this.project || this.subscription) return;

		const filters: NDKFilter[] = [
			{
				kinds: [1 as number, 513 as number], // kind:1 (messages) and kind:513 (ConversationMetadata)
				'#a': [this.project.tagId()]
			}
		];

		this.subscription = this.ndk.subscribe(filters, {
			closeOnEose: false,
			onEvents: (events: NDKEvent[]) => {
				this.extractHashtagsBulk(events);
			},
			onEvent: (event: NDKEvent) => {
				this.extractHashtags(event);
			}
		});
	}

	private extractHashtagsBulk(events: NDKEvent[]) {
		const newHashtags: string[] = [];
		for (const event of events) {
			for (const tag of event.tags) {
				if (tag[0] === 't' && tag[1]) {
					const hashtag = tag[1].toLowerCase();
					if (hashtag && !this.hashtags.has(hashtag) && !newHashtags.includes(hashtag)) {
						newHashtags.push(hashtag);
					}
				}
			}
		}
		if (newHashtags.length > 0) {
			this.hashtags = new Set([...this.hashtags, ...newHashtags]);
		}
	}

	private extractHashtags(event: NDKEvent) {
		const tTags = event.tags.filter((tag) => tag[0] === 't' && tag[1]);
		if (tTags.length === 0) return;

		const newHashtags: string[] = [];
		for (const tag of tTags) {
			const hashtag = tag[1].toLowerCase();
			if (hashtag && !this.hashtags.has(hashtag)) {
				newHashtags.push(hashtag);
			}
		}

		if (newHashtags.length > 0) {
			this.hashtags = new Set([...this.hashtags, ...newHashtags]);
		}
	}

	/**
	 * Clean up subscriptions
	 */
	destroy() {
		if (this.subscription) {
			this.subscription.stop();
			this.subscription = null;
		}
	}
}
