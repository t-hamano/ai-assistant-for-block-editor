/**
 * WordPress dependencies
 */
import { select as selectStore, useSelect } from '@wordpress/data';
import { PluginSidebar, PluginSidebarMoreMenuItem, store as editorStore } from '@wordpress/editor';
import { useCallback, useEffect } from '@wordpress/element';
import { __ } from '@wordpress/i18n';
import { plus } from '@wordpress/icons';
import { IconButton } from '@wordpress/ui';

/**
 * Internal dependencies
 */
import { useAiChat } from './ai/use-ai-chat';
import { Chat } from './chat';
import icon from './icon';
import { createAnthropicPlatform } from './platform/anthropic';

const SIDEBAR_NAME = 'ai-assistant';

const ai = createAnthropicPlatform( () => selectStore( editorStore ).getCurrentPostId() as number );

export default function Sidebar() {
	const title = __( 'AI Assistant', 'ai-assistant-for-block-editor' );
	const isVisualEditor = useSelect(
		( select ) => select( editorStore ).getEditorMode() === 'visual',
		[]
	);
	// The edit target for the selected blocks comes with the edit tool.
	const createTarget = useCallback( () => null, [] );
	const chat = useAiChat( { ai, createTarget } );
	const { stop, reset } = chat;

	// The conversation is about the blocks, so it ends when the user
	// switches to the code editor.
	useEffect( () => {
		if ( ! isVisualEditor ) {
			stop();
			reset();
		}
	}, [ isVisualEditor, stop, reset ] );

	return (
		<>
			<PluginSidebarMoreMenuItem target={ SIDEBAR_NAME } icon={ icon }>
				{ title }
			</PluginSidebarMoreMenuItem>
			<PluginSidebar
				name={ SIDEBAR_NAME }
				title={ title }
				icon={ icon }
				className="aabe-sidebar"
				// @ts-expect-error `PluginSidebar` passes `header` on to `ComplementaryArea`, but its types leave it out.
				header={
					<>
						<h2 className="interface-complementary-area-header__title">{ title }</h2>
						<IconButton
							icon={ plus }
							label={ __( 'New conversation', 'ai-assistant-for-block-editor' ) }
							variant="minimal"
							tone="neutral"
							size="compact"
							onClick={ reset }
							disabled={ chat.conversation.messages.length === 0 }
						/>
					</>
				}
			>
				<Chat chat={ chat } isAvailable={ isVisualEditor } />
			</PluginSidebar>
		</>
	);
}
