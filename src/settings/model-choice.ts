/**
 * WordPress dependencies
 */
import { dispatch, select } from '@wordpress/data';
import { store as preferencesStore } from '@wordpress/preferences';

/**
 * Internal dependencies
 */
import type { ModelChoice } from '../platform/select';

// Preferences are kept for each user in the user's meta, so the choice
// follows the user to other posts and browsers.
const SCOPE = 'ai-content-editing-assistant';
const NAME = 'model';

/**
 * Reads the provider and model the user chose from the preferences store.
 *
 * @param get The store's `get` selector.
 * @return The choice, or `null` to choose automatically.
 */
export function readModelChoice(
	get: ( scope: string, name: string ) => unknown
): ModelChoice | null {
	const value = get( SCOPE, NAME ) as Partial< ModelChoice > | null | undefined;
	return typeof value?.provider === 'string' && typeof value?.model === 'string'
		? { provider: value.provider, model: value.model }
		: null;
}

/**
 * Returns the provider and model the user chose.
 *
 * @return The choice, or `null` to choose automatically.
 */
export function getModelChoice(): ModelChoice | null {
	return readModelChoice( select( preferencesStore ).get );
}

/**
 * Saves the provider and model the user chose.
 *
 * @param choice The choice, or `null` to choose automatically.
 */
export function setModelChoice( choice: ModelChoice | null ) {
	dispatch( preferencesStore ).set( SCOPE, NAME, choice );
}
