export const DEFAULT_RELAYS = ['wss://tenex.chat'];

export const TEST_CREDENTIALS = {
	NSEC: 'nsec1q9kaf583ud7f9jm4xtmj8052uvym9jasy502xnvwxqmsq8lxtmfsvgqa8v',
	NPUB: 'npub1mru8hcgw9nhlyaj0v3asx8jfz4t8tytfrcvh2wlk456s9t7yy6qse9wqzj'
} as const;

export const UPLOAD_STATUS = {
	PENDING: 'pending',
	UPLOADING: 'uploading',
	COMPLETED: 'completed',
	FAILED: 'failed'
} as const;

export type UploadStatus = (typeof UPLOAD_STATUS)[keyof typeof UPLOAD_STATUS];

// Timing constants
export const TIMING = {
	TYPING_INDICATOR_TIMEOUT: 5000,
	HEALTH_CHECK_INTERVAL: 60000,
	LATENCY_CHECK_TIMEOUT: 5000,
	PROJECT_STATUS_FILTER_SECONDS: 600,
	DRAFT_CLEANUP_DURATION: 7 * 24 * 60 * 60 * 1000,
	NIP07_CHECK_DELAY: 1000,
	COPY_FEEDBACK_DURATION: 2000,
	RESIZE_DEBOUNCE_DELAY: 300
} as const;

// Upload limits
export const UPLOAD_LIMITS = {
	MAX_FILE_SIZE_MB: 100,
	MAX_CONCURRENT_UPLOADS: 3,
	MAX_RETRY_COUNT: 3
} as const;

// Virtual list thresholds
export const VIRTUAL_LIST_THRESHOLDS = {
	THREAD_LIST: 10,
	CHAT_MESSAGES: 50,
	TASKS: 20
} as const;

// Subscription limits
export const SUBSCRIPTION_LIMITS = {
	DEFAULT_LIMIT: 50,
	PROJECT_STATUS_MINUTES: 10
} as const;

// Custom event kinds (not already defined in NDKKind or our custom classes)
export const EVENT_KINDS = {
	AGENT_REQUEST: 3199,
	AGENT_REQUEST_LIST: 13199,
	PROJECT_START: 24000,
	LLM_CONFIG_CHANGE: 24101,
	TYPING_INDICATOR: 24111,
	TYPING_INDICATOR_STOP: 24112,
	STREAMING_RESPONSE: 21111,
	CONVERSATION_METADATA: 513
} as const;
