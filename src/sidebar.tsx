/**
 * WordPress dependencies
 */
import { select as selectStore, useSelect } from '@wordpress/data';
import { PluginSidebar, PluginSidebarMoreMenuItem, store as editorStore } from '@wordpress/editor';
import { createInterpolateElement, useEffect, useState } from '@wordpress/element';
import { __ } from '@wordpress/i18n';
import { cog, plus } from '@wordpress/icons';
import { store as preferencesStore } from '@wordpress/preferences';
import { IconButton, Notice } from '@wordpress/ui';

/**
 * Internal dependencies
 */
import { useAiChat } from './ai/use-ai-chat';
import { Chat } from './chat';
import { createSelectionTarget } from './editor/text-target';
import icon from './icon';
import { createAutoPlatform, type ModelChoice } from './platform/select';
import { ModelSettings } from './settings';

const SIDEBAR_NAME = 'ai-assistant';

const ai = createAutoPlatform(
	() => selectStore( editorStore ).getCurrentPostId() as number,
	() =>
		( selectStore( preferencesStore ).get(
			'ai-content-editing-assistant',
			'model'
		) as ModelChoice | null ) ?? null
);

const { hasApiKey, connectorsUrl } = window.aiContentEditingAssistant;

// Tells the user why the assistant cannot be used. Without an API key it
// links to the Connectors screen, where one is set up.
function UnavailableNotice() {
	return (
		<Notice.Root intent="info">
			<Notice.Description>
				{ hasApiKey
					? __(
							'Switch to the visual editor to use the AI Assistant.',
							'ai-content-editing-assistant'
						)
					: createInterpolateElement(
							__(
								'No connector is set up. Set up at least one connector on the <a>Connectors screen</a>.',
								'ai-content-editing-assistant'
							),
							// eslint-disable-next-line jsx-a11y/anchor-has-content -- The link text is filled in from the translation.
							{ a: <a href={ connectorsUrl } /> }
						) }
			</Notice.Description>
		</Notice.Root>
	);
}

export default function Sidebar() {
	const title = __( 'AI Assistant', 'ai-content-editing-assistant' );
	const isVisualEditor = useSelect(
		( select ) => select( editorStore ).getEditorMode() === 'visual',
		[]
	);
	const chat = useAiChat( { ai, createTarget: createSelectionTarget } );
	const { stop, reset } = chat;
	const [ isSettingsOpen, setIsSettingsOpen ] = useState( false );
	const [ draft, setDraft ] = useState( '' );

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
				className="ai-content-editing-assistant-sidebar"
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
							label={ __( 'Assistant settings', 'ai-content-editing-assistant' ) }
							variant="minimal"
							tone="neutral"
							size="compact"
							aria-pressed={ isSettingsOpen }
							onClick={ () => setIsSettingsOpen( ! isSettingsOpen ) }
						/>
					</>
				}
			>
				{ isSettingsOpen ? (
					<ModelSettings onClose={ () => setIsSettingsOpen( false ) } />
				) : (
					<Chat
						chat={ chat }
						isAvailable={ hasApiKey && isVisualEditor }
						unavailableNotice={ <UnavailableNotice /> }
						draft={ draft }
						onDraftChange={ setDraft }
					/>
				) }
			</PluginSidebar>
		</>
	);
}
