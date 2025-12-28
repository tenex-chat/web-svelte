/**
 * Central performance metrics store for tracking application performance.
 * Simplified after removing streaming event processing.
 */

import { untrack } from 'svelte';

export interface ConversationStateMetrics {
	eventsProcessed: number;
	displayMessagesComputations: number;
	displayMessagesComputeTime: number;
	avgComputeTime: number;
	lastComputeTime: number;
	slowComputationCount: number; // >50ms
}

export interface MessageRenderMetrics {
	renderCount: number;
	totalRenderTime: number;
	avgRenderTime: number;
	lastRenderTime: number;
	slowRenderCount: number; // >16ms (60fps threshold)
}

export interface AggregatedMetrics {
	conversationState: Map<string, ConversationStateMetrics>; // keyed by conversation ID
	messageRenders: MessageRenderMetrics;
	lastUpdateTime: number;
}

class PerformanceMetricsStore {
	private conversationStateMetrics = new Map<string, ConversationStateMetrics>();

	// Message render metrics (global)
	messageRenderMetrics = $state<MessageRenderMetrics>({
		renderCount: 0,
		totalRenderTime: 0,
		avgRenderTime: 0,
		lastRenderTime: 0,
		slowRenderCount: 0
	});

	// Reactive state for UI
	isEnabled = $state(false);
	lastUpdateTime = $state(Date.now());

	/**
	 * Update conversation state metrics
	 */
	updateConversationStateMetrics(conversationId: string, metrics: Partial<ConversationStateMetrics>): void {
		untrack(() => {
			const existing = this.conversationStateMetrics.get(conversationId) || {
				eventsProcessed: 0,
				displayMessagesComputations: 0,
				displayMessagesComputeTime: 0,
				avgComputeTime: 0,
				lastComputeTime: 0,
				slowComputationCount: 0
			};

			const updated = { ...existing, ...metrics };
			if (updated.displayMessagesComputations > 0) {
				updated.avgComputeTime = updated.displayMessagesComputeTime / updated.displayMessagesComputations;
			}

			this.conversationStateMetrics.set(conversationId, updated);
			this.lastUpdateTime = Date.now();
		});
	}

	/**
	 * Update message render metrics
	 */
	updateMessageRenderMetrics(metrics: Partial<MessageRenderMetrics>): void {
		untrack(() => {
			this.messageRenderMetrics = { ...this.messageRenderMetrics, ...metrics };

			if (this.messageRenderMetrics.renderCount > 0) {
				this.messageRenderMetrics.avgRenderTime =
					this.messageRenderMetrics.totalRenderTime / this.messageRenderMetrics.renderCount;
			}

			this.lastUpdateTime = Date.now();
		});
	}

	/**
	 * Get all aggregated metrics
	 */
	getAggregatedMetrics(): AggregatedMetrics {
		return {
			conversationState: new Map(this.conversationStateMetrics),
			messageRenders: { ...this.messageRenderMetrics },
			lastUpdateTime: this.lastUpdateTime
		};
	}

	/**
	 * Get summary statistics across all sessions
	 */
	getSummaryStats() {
		const conversationStats = {
			totalConversations: this.conversationStateMetrics.size,
			totalEventsProcessed: 0,
			totalComputations: 0,
			totalSlowComputations: 0,
			avgComputeTime: 0
		};

		let totalComputeTime = 0;
		let totalComputations = 0;

		for (const metrics of this.conversationStateMetrics.values()) {
			conversationStats.totalEventsProcessed += metrics.eventsProcessed;
			conversationStats.totalComputations += metrics.displayMessagesComputations;
			conversationStats.totalSlowComputations += metrics.slowComputationCount;
			totalComputeTime += metrics.displayMessagesComputeTime;
			totalComputations += metrics.displayMessagesComputations;
		}

		if (totalComputations > 0) {
			conversationStats.avgComputeTime = totalComputeTime / totalComputations;
		}

		return {
			conversationState: conversationStats,
			messageRenders: { ...this.messageRenderMetrics }
		};
	}

	/**
	 * Clear all metrics
	 */
	reset(): void {
		this.conversationStateMetrics.clear();
		this.messageRenderMetrics = {
			renderCount: 0,
			totalRenderTime: 0,
			avgRenderTime: 0,
			lastRenderTime: 0,
			slowRenderCount: 0
		};
		this.lastUpdateTime = Date.now();
	}

	/**
	 * Toggle metrics collection
	 */
	toggle(): void {
		this.isEnabled = !this.isEnabled;
	}

	/**
	 * Enable metrics collection
	 */
	enable(): void {
		this.isEnabled = true;
	}

	/**
	 * Disable metrics collection
	 */
	disable(): void {
		this.isEnabled = false;
	}
}

export const performanceMetrics = new PerformanceMetricsStore();

// Make available in console for debugging
if (typeof window !== 'undefined') {
	(window as any).__performanceMetrics = performanceMetrics;
}
