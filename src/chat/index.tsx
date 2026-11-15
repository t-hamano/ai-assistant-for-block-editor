/**
 * WordPress dependencies
 */
import { useEffect, useLayoutEffect, useRef, useState } from '@wordpress/element';
import { __ } from '@wordpress/i18n';
import { arrowUp } from '@wordpress/icons';
import { isKeyboardEvent } from '@wordpress/keycodes';
import { IconButton, Notice, Spinner, Stack, Text, TextareaControl } from '@wordpress/ui';

/**
 * Internal dependencies
 */
import type { AssistantChatMessage, ChatMessage } from '../ai/conversation';
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

function Note( { children }: { children: string } ) {
	return (
		<Text variant="body-sm" className="aabe-chat__note">
			{ children }
		</Text>
	);
}

function AssistantMessage( { message }: { message: AssistantChatMessage } ) {
	const activity = message.status === 'streaming' ? message.activity : undefined;

	return (
		<Stack className="aabe-chat__message is-assistant" direction="column" gap="sm">
			{ message.text && <AnswerMarkdown>{ message.text }</AnswerMarkdown> }
			{ message.editStatus === 'applied' && (
				<Note>{ __( 'Edited the content.', 'ai-assistant-for-block-editor' ) }</Note>
			) }
			{ message.editStatus === 'dropped' && (
				<Note>
					{ __(
						'The edit was not applied because the selected blocks no longer exist.',
						'ai-assistant-for-block-editor'
					) }
				</Note>
			) }
			{ activity && (
				<Stack className="aabe-chat__note" direction="row" align="center" gap="sm" role="status">
					<Spinner aria-hidden />
					<Text variant="body-sm">{ getActivityLabel( activity ) }</Text>
				</Stack>
			) }
			{ message.status === 'stopped' && (
				<Note>{ __( 'Stopped.', 'ai-assistant-for-block-editor' ) }</Note>
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

function Message( { message }: { message: ChatMessage } ) {
	if ( message.role === 'assistant' ) {
		return <AssistantMessage message={ message } />;
	}
	return (
		<div className="aabe-chat__message is-user">
			<Text>{ message.text }</Text>
		</div>
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
	const inputRef = useRef< HTMLTextAreaElement >( null );

	// Keep the latest message in view while the answer streams in.
	useEffect( () => {
		const element = messagesRef.current;
		if ( element ) {
			element.scrollTop = element.scrollHeight;
		}
	}, [ conversation ] );

	// Grow the message box with its text, up to the height the stylesheet
	// allows.
	useLayoutEffect( () => {
		const input = inputRef.current;
		if ( input ) {
			input.style.height = 'auto';
			input.style.height = `${ input.scrollHeight }px`;
		}
	}, [ draft ] );

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
			<div className="aabe-chat__messages" ref={ messagesRef }>
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
					<Note>
						{ __(
							'Ask the AI Assistant to write or edit. The selected blocks are sent with your message.',
							'ai-assistant-for-block-editor'
						) }
					</Note>
				) }
				{ conversation.messages.map( ( message ) => (
					<Message key={ message.id } message={ message } />
				) ) }
			</div>
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
					ref={ inputRef }
					className="aabe-chat__input"
					label={ __( 'Message', 'ai-assistant-for-block-editor' ) }
					hideLabelFromVision
					placeholder={ __( 'Ask the AI Assistant', 'ai-assistant-for-block-editor' ) }
					rows={ 1 }
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
