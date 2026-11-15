/**
 * WordPress dependencies
 */
import { select as selectStore, useSelect } from '@wordpress/data';
import { PluginSidebar, PluginSidebarMoreMenuItem, store as editorStore } from '@wordpress/editor';
import { useEffect, useState } from '@wordpress/element';
import { __ } from '@wordpress/i18n';
import { cog, plus } from '@wordpress/icons';
import { IconButton } from '@wordpress/ui';

/**
 * Internal dependencies
 */
import { useAiChat } from './ai/use-ai-chat';
import { Chat } from './chat';
import { createBlockTarget } from './editor/block-target';
import icon from './icon';
import { createAutoPlatform } from './platform/select';
import { ModelSettings } from './settings';
import { getModelChoice } from './settings/model-choice';

const SIDEBAR_NAME = 'ai-assistant';

const ai = createAutoPlatform(
	() => selectStore( editorStore ).getCurrentPostId() as number,
	getModelChoice
);

export default function Sidebar() {
	const title = __( 'AI Assistant', 'ai-content-editing-assistant' );
	const isVisualEditor = useSelect(
		( select ) => select( editorStore ).getEditorMode() === 'visual',
		[]
	);
	const chat = useAiChat( { ai, createTarget: createBlockTarget } );
	const { stop, reset } = chat;
	const [ isSettingsOpen, setIsSettingsOpen ] = useState( false );

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
				className={
					isSettingsOpen
						? 'ai-content-editing-assistant-sidebar is-settings-open'
						: 'ai-content-editing-assistant-sidebar'
				}
				// @ts-expect-error `PluginSidebar` passes `header` on to `ComplementaryArea`, but its types leave it out.
				header={
					<>
						<h2 className="interface-complementary-area-header__title">{ title }</h2>
						<IconButton
							icon={ plus }
							label={ __( 'New conversation', 'ai-content-editing-assistant' ) }
							variant="minimal"
							tone="neutral"
							size="compact"
							onClick={ reset }
							disabled={ chat.conversation.messages.length === 0 }
						/>
						<IconButton
							icon={ cog }
							label={ __( 'Model settings', 'ai-content-editing-assistant' ) }
							variant="minimal"
							tone="neutral"
							size="compact"
							aria-pressed={ isSettingsOpen }
							onClick={ () => setIsSettingsOpen( ! isSettingsOpen ) }
						/>
					</>
				}
			>
				{ isSettingsOpen && <ModelSettings onClose={ () => setIsSettingsOpen( false ) } /> }
				{ /* The chat stays mounted under the settings, so the draft is kept. */ }
				<Chat chat={ chat } isAvailable={ isVisualEditor } />
			</PluginSidebar>
		</>
	);
}
