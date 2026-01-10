/**
 * Scroll management action for chat-like interfaces
 * Handles auto-scrolling, unread counts, and scroll-to-bottom functionality
 */

export interface ScrollManagerOptions {
	/**
	 * Callback when scroll position changes
	 */
	onScrollChange?: (isAtBottom: boolean, unreadCount: number) => void;

	/**
	 * Number of items currently displayed
	 */
	itemCount?: number;

	/**
	 * Threshold in pixels from bottom to consider "at bottom"
	 */
	scrollThreshold?: number;

	/**
	 * Debounce time in ms for scroll event handling
	 */
	scrollDebounceMs?: number;
}

export interface ScrollManagerReturn {
	/**
	 * Programmatically scroll to bottom
	 */
	scrollToBottom: (smooth?: boolean) => void;

	/**
	 * Check if user is at bottom
	 */
	isAtBottom: () => boolean;

	/**
	 * Get current unread count
	 */
	getUnreadCount: () => number;
}

export function scrollManager(
	node: HTMLElement,
	options: ScrollManagerOptions = {}
): { destroy: () => void; update: (newOptions: ScrollManagerOptions) => void; scrollToBottom: (smooth?: boolean) => void } {
	const {
		scrollThreshold = 150,
		scrollDebounceMs = 150
	} = options;

	let isUserAtBottom = true;
	let unreadMessageCount = 0;
	let isUserScrolling = false;
	let isProgrammaticScroll = false;
	let scrollDebounceTimer: number | undefined;
	let previousItemCount = 0;
	let isInitialLoad = true;

	// Check if user is at bottom of scroll container
	function checkScrollPosition() {
		if (!node) return;

		const { scrollTop, scrollHeight, clientHeight } = node;
		const distanceFromBottom = scrollHeight - scrollTop - clientHeight;

		const wasAtBottom = isUserAtBottom;
		isUserAtBottom = distanceFromBottom < scrollThreshold;

		// Reset unread count when user scrolls to bottom
		if (isUserAtBottom && !wasAtBottom) {
			unreadMessageCount = 0;
		}

		// Detect user-initiated scrolling (not programmatic)
		if (!isProgrammaticScroll) {
			isUserScrolling = true;

			// Clear existing timer
			if (scrollDebounceTimer) {
				clearTimeout(scrollDebounceTimer);
			}

			// Set timer to detect when user stops scrolling
			scrollDebounceTimer = window.setTimeout(() => {
				isUserScrolling = false;
			}, scrollDebounceMs);
		}

		// Notify callback
		options.onScrollChange?.(isUserAtBottom, unreadMessageCount);
	}

	// Scroll to bottom smoothly
	function scrollToBottom(smooth = true) {
		if (!node) return;

		// Mark this as a programmatic scroll
		isProgrammaticScroll = true;

		node.scrollTo({
			top: node.scrollHeight,
			behavior: smooth ? 'smooth' : 'instant'
		});

		unreadMessageCount = 0;
		isUserAtBottom = true;

		// Notify callback
		options.onScrollChange?.(isUserAtBottom, unreadMessageCount);

		// Reset the flag after a brief delay
		setTimeout(() => {
			isProgrammaticScroll = false;
		}, 100);
	}

	// Handle item count changes (new messages)
	function handleItemCountChange(newCount: number) {
		// Initial load: scroll to bottom instantly when first messages arrive
		if (previousItemCount === 0 && newCount > 0) {
			requestAnimationFrame(() => scrollToBottom(false));
			previousItemCount = newCount;
			// End initial load phase after a brief delay to handle batched message loading
			setTimeout(() => {
				isInitialLoad = false;
			}, 500);
			return;
		}

		// Subsequent updates: only scroll if user is at bottom
		if (newCount > previousItemCount) {
			const newItemsCount = newCount - previousItemCount;

			// Only auto-scroll if user is at bottom AND not actively scrolling
			if (isUserAtBottom && !isUserScrolling) {
				// Use instant scroll during initial load (opening conversation),
				// smooth scroll for new messages during active conversation
				const useSmooth = !isInitialLoad;
				requestAnimationFrame(() => scrollToBottom(false));
			} else {
				// User is scrolled up OR actively scrolling, increment unread count
				unreadMessageCount += newItemsCount;
				options.onScrollChange?.(isUserAtBottom, unreadMessageCount);
			}
		}

		previousItemCount = newCount;
	}

	// Attach scroll listener
	node.addEventListener('scroll', checkScrollPosition);

	return {
		update(newOptions: ScrollManagerOptions) {
			Object.assign(options, newOptions);

			// Handle item count changes
			if (newOptions.itemCount !== undefined) {
				handleItemCountChange(newOptions.itemCount);
			}
		},

		destroy() {
			if (scrollDebounceTimer) {
				clearTimeout(scrollDebounceTimer);
			}
			node.removeEventListener('scroll', checkScrollPosition);
		},

		scrollToBottom
	};
}
