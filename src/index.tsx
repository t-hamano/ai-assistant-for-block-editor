/**
 * WordPress dependencies
 */
import { registerPlugin } from '@wordpress/plugins';

/**
 * Internal dependencies
 */
import Sidebar from './sidebar';

registerPlugin( 'ai-content-editing-assistant', {
	render: Sidebar,
} );
