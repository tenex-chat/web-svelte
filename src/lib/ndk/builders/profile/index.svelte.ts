/*
	Installed from @ndk/svelte@latest
*/

import type { NDKUser, NDKUserProfile } from "@nostr-dev-kit/ndk";
import { SvelteMap } from "svelte/reactivity";
import type { NDKSvelte } from "@nostr-dev-kit/svelte";
import { getNDK } from "../../utils/ndk/index.svelte.js";

// Track in-flight profile fetch requests to prevent duplicate fetches
const inFlightRequests = new SvelteMap<
	string,
	Promise<NDKUserProfile | null>
>();

// Cache of already-fetched profiles to prevent re-fetching after in-flight completes
const fetchedProfiles = new SvelteMap<string, NDKUserProfile | null>();

export interface ProfileFetcherState {
	profile: NDKUserProfile | null;
	user: NDKUser | null;
	loading: boolean;
}

export interface ProfileFetcherConfig {
	user: NDKUser | string | null | undefined; // NDKUser instance or pubkey/npub, or falsy to skip fetching
}

/**
 * Create reactive state for fetching a user profile
 *
 * Handles fetching and caching user profiles with deduplication.
 * Accepts falsy values (null/undefined) and will skip fetching until a valid user is provided.
 *
 * @param config - Function returning configuration with user (or null/undefined to skip fetching)
 * @param ndk - Optional NDK instance (uses context if not provided)
 *
 * @example
 * ```ts
 * // NDK from context
 * const profileFetcher = createProfileFetcher(() => ({ user: 'npub1...' }));
 *
 * // Or with explicit NDK
 * const profileFetcher = createProfileFetcher(() => ({ user: 'npub1...' }), ndk);
 *
 * // Handles falsy values gracefully (useful with optional props)
 * const profileFetcher = createProfileFetcher(() => ({ user: user ?? pubkey ?? null }));
 *
 * // Access state
 * profileFetcher.profile // User profile
 * profileFetcher.user // NDKUser instance (available once loaded)
 * profileFetcher.loading // Loading state
 * ```
 */
export function createProfileFetcher(
	config: () => ProfileFetcherConfig,
	ndk?: NDKSvelte,
): ProfileFetcherState {
	const ndkInstance = getNDK(ndk);
	const state = $state<{
		profile: NDKUserProfile | null;
		user: NDKUser | null;
		loading: boolean;
	}>({
		profile: null,
		user: null,
		loading: false,
	});

	async function fetchProfile(payload: NDKUser | string) {
		state.loading = true;

		try {
			const ndkUser =
				typeof payload === "string"
					? await ndkInstance.fetchUser(payload)
					: payload;

			if (!ndkUser) {
				state.profile = null;
				state.user = null;
				state.loading = false;
				return;
			}

			const pubkey = ndkUser.pubkey;

			// Check if profile already cached on the NDKUser instance
			if (ndkUser.profile) {
				state.profile = ndkUser.profile;
				state.user = ndkUser;
				state.loading = false;
				return;
			}

			// Check if we already fetched this profile in this session
			if (fetchedProfiles.has(pubkey)) {
				const cachedProfile = fetchedProfiles.get(pubkey);
				state.profile = cachedProfile ?? null;
				state.user = ndkUser;
				// Also populate the NDKUser instance for consistency
				if (cachedProfile) {
					ndkUser.profile = cachedProfile;
				}
				state.loading = false;
				return;
			}

			// Check if there's already an in-flight request for this pubkey
			let fetchPromise = inFlightRequests.get(pubkey);

			if (!fetchPromise) {
				// No in-flight request, create a new one
				fetchPromise = ndkUser
					.fetchProfile(
						{
							closeOnEose: true,
							groupable: true,
							groupableDelay: 250,
							subId: `profile-${pubkey.substring(0, 8)}`,
						},
						true, // storeProfileEvent: save to cache for future lookups
					)
					.then((profile) => {
						// Store in our session cache
						fetchedProfiles.set(pubkey, profile);
						return profile;
					})
					.finally(() => {
						// Remove from in-flight requests when complete
						inFlightRequests.delete(pubkey);
					});

				inFlightRequests.set(pubkey, fetchPromise);
			}

			// Wait for profile
			const fetchedProfile = await fetchPromise;
			state.profile = fetchedProfile || null;
			state.user = ndkUser;
		} catch (err) {
			console.error("Failed to fetch profile:", err);
			state.profile = null;
			state.user = null;
		}

		state.loading = false;
	}

	$effect(() => {
		const { user } = config();
		if (user) {
			fetchProfile(user);
		} else {
			// Reset state when user becomes falsy
			state.profile = null;
			state.user = null;
			state.loading = false;
		}
	});

	return {
		get profile() {
			return state.profile;
		},
		get user() {
			return state.user;
		},
		get loading() {
			return state.loading;
		},
	};
}
