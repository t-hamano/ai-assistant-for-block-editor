/**
 * WordPress dependencies
 */
import { PluginSidebar, PluginSidebarMoreMenuItem } from '@wordpress/editor';
import { __ } from '@wordpress/i18n';

/**
 * Internal dependencies
 */
import icon from './icon';

const SIDEBAR_NAME = 'ai-assistant';

export default function Sidebar() {
	const title = __( 'AI Assistant', 'ai-assistant-for-block-editor' );

	return (
		<>
			<PluginSidebarMoreMenuItem target={ SIDEBAR_NAME } icon={ icon }>
				{ title }
			</PluginSidebarMoreMenuItem>
			<PluginSidebar name={ SIDEBAR_NAME } title={ title } icon={ icon } />
		</>
	);
}
