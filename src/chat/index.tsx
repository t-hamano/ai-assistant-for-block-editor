/**
 * WordPress dependencies
 */
import { useEffect, useRef, useState } from '@wordpress/element';
import { __ } from '@wordpress/i18n';
import { arrowUp } from '@wordpress/icons';
import { isKeyboardEvent } from '@wordpress/keycodes';
import { IconButton, Notice, Spinner, Stack, Text, TextareaControl } from '@wordpress/ui';

/**
 * Internal dependencies
 */
import type { AssistantChatMessage } from '../ai/conversation';
import type { AiChat } from '../ai/use-ai-chat';
import { AnswerMarkdown } from './answer-markdown';
import './style.scss';

const stopIcon = (
	<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24">
		<path d="M7 7h10v10H7z" fill="currentColor" />
	</svg>
);

function getActivityLabel( activity: NonNullable< AssistantChatMessage[ 'activity' ] > ) {
	switch ( activity ) {
		case 'thinking':
			return __( 'Thinking…', 'ai-assistant-for-block-editor' );
		case 'editing':
			return __( 'Editing the content…', 'ai-assistant-for-block-editor' );
		default:
			return __( 'Waiting for the answer…', 'ai-assistant-for-block-editor' );
	}
}

function AssistantMessage( { message }: { message: AssistantChatMessage } ) {
	const activity = message.status === 'streaming' ? message.activity : undefined;

	return (
		<Stack className="aabe-chat__message is-assistant" direction="column" gap="sm">
			{ message.text && <AnswerMarkdown>{ message.text }</AnswerMarkdown> }
			{ message.editStatus === 'applied' && (
				<Text variant="body-sm" className="aabe-chat__note">
					{ __( 'Edited the content.', 'ai-assistant-for-block-editor' ) }
				</Text>
			) }
			{ message.editStatus === 'dropped' && (
				<Text variant="body-sm" className="aabe-chat__note">
					{ __(
						'The edit was not applied because the selected blocks no longer exist.',
						'ai-assistant-for-block-editor'
					) }
				</Text>
			) }
			{ activity && (
				<Stack className="aabe-chat__note" direction="row" align="center" gap="sm" role="status">
					<Spinner aria-hidden />
					<Text variant="body-sm">{ getActivityLabel( activity ) }</Text>
				</Stack>
			) }
			{ message.status === 'stopped' && (
				<Text variant="body-sm" className="aabe-chat__note">
					{ __( 'Stopped.', 'ai-assistant-for-block-editor' ) }
				</Text>
			) }
			{ message.status === 'error' && (
				<Notice.Root intent="error">
					<Notice.Description>
						{ message.error ||
							__( 'The answer could not be loaded.', 'ai-assistant-for-block-editor' ) }
					</Notice.Description>
				</Notice.Root>
			) }
		</Stack>
	);
}

type Props = {
	chat: AiChat;
	/**
	 * Whether the user can send messages. The assistant edits blocks, so it
	 * is not available in the code editor.
	 */
	isAvailable: boolean;
};

export function Chat( { chat, isAvailable }: Props ) {
	const { conversation, isResponding, send, stop } = chat;
	const [ draft, setDraft ] = useState( '' );
	const messagesRef = useRef< HTMLDivElement >( null );

	// Keep the latest message in view while the answer streams in.
	useEffect( () => {
		const element = messagesRef.current;
		if ( element ) {
			element.scrollTop = element.scrollHeight;
		}
	}, [ conversation ] );

	const canSend = isAvailable && !! draft.trim() && ! isResponding;

	const submit = () => {
		if ( canSend ) {
			send( draft );
			setDraft( '' );
		}
	};

	// Enter sends, and Shift+Enter adds a line. Enter that confirms an IME
	// conversion does neither.
	const onKeyDown = ( event: React.KeyboardEvent< HTMLTextAreaElement > ) => {
		// Undo and redo act on the draft, not on the post.
		if (
			isKeyboardEvent.primary( event.nativeEvent, 'z' ) ||
			isKeyboardEvent.primaryShift( event.nativeEvent, 'z' ) ||
			isKeyboardEvent.primary( event.nativeEvent, 'y' )
		) {
			event.stopPropagation();
			return;
		}
		if ( event.key === 'Enter' && ! event.shiftKey && ! event.nativeEvent.isComposing ) {
			event.preventDefault();
			submit();
		}
	};

	return (
		<Stack className="aabe-chat" direction="column">
			<Stack className="aabe-chat__messages" direction="column" gap="lg" ref={ messagesRef }>
				{ ! isAvailable && (
					<Notice.Root intent="info">
						<Notice.Description>
							{ __(
								'Switch to the visual editor to use the AI Assistant.',
								'ai-assistant-for-block-editor'
							) }
						</Notice.Description>
					</Notice.Root>
				) }
				{ isAvailable && conversation.messages.length === 0 && (
					<Text variant="body-sm" className="aabe-chat__note">
						{ __(
							'Ask the AI Assistant to write or edit. The selected blocks are sent with your message.',
							'ai-assistant-for-block-editor'
						) }
					</Text>
				) }
				{ conversation.messages.map( ( message ) =>
					message.role === 'assistant' ? (
						<AssistantMessage key={ message.id } message={ message } />
					) : (
						<Text key={ message.id } className="aabe-chat__message is-user" render={ <div /> }>
							{ message.text }
						</Text>
					)
				) }
			</Stack>
			<Stack
				render={
					<form
						onSubmit={ ( event ) => {
							event.preventDefault();
							submit();
						} }
					/>
				}
				className="aabe-chat__composer"
				direction="row"
				align="flex-end"
				gap="sm"
			>
				<TextareaControl
					className="aabe-chat__input"
					label={ __( 'Message', 'ai-assistant-for-block-editor' ) }
					hideLabelFromVision
					placeholder={ __( 'Ask the AI Assistant', 'ai-assistant-for-block-editor' ) }
					value={ draft }
					onValueChange={ setDraft }
					onKeyDown={ onKeyDown }
					disabled={ ! isAvailable }
				/>
				{ isResponding ? (
					<IconButton
						icon={ stopIcon }
						label={ __( 'Stop', 'ai-assistant-for-block-editor' ) }
						tone="neutral"
						size="compact"
						onClick={ stop }
					/>
				) : (
					<IconButton
						type="submit"
						icon={ arrowUp }
						label={ __( 'Send', 'ai-assistant-for-block-editor' ) }
						size="compact"
						disabled={ ! canSend }
					/>
				) }
			</Stack>
		</Stack>
	);
}
