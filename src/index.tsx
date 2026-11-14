/**
 * WordPress dependencies
 */
import { registerPlugin } from '@wordpress/plugins';

/**
 * Internal dependencies
 */
import Sidebar from './sidebar';

registerPlugin( 'ai-assistant-for-block-editor', {
	render: Sidebar,
} );
