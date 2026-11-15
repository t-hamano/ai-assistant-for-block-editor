/**
 * WordPress dependencies
 */
import { useCallback, useEffect, useLayoutEffect, useReducer, useRef } from '@wordpress/element';

/**
 * Internal dependencies
 */
import {
	conversationReducer,
	createConversation,
	getLastSeenDocument,
	toAiMessages,
	toUserText,
	type Conversation,
} from './conversation';
import { buildMessageContext } from './document-context';
import type { EditTarget } from './edit-target';
import { buildSystemPrompt } from './prompt';
import { highlightChanges, takeBlockSnapshot } from '../editor/highlight';
import type { AiEditResult, AiPlatform } from '../platform';

type UseAiChatArgs = {
	ai: AiPlatform | undefined;
	/**
	 * Creates the edit target from the current selection, or returns `null` when the editor cannot provide one.
	 */
	createTarget: () => EditTarget | null;
};

export type AiChat = {
	conversation: Conversation;
	isResponding: boolean;
	send: ( text: string ) => void;
	stop: () => void;
	reset: () => void;
};

/**
 * Runs a conversation with the AI assistant. The selection is captured when
 * a message is sent, and the model's edits are applied to it as they arrive.
 *
 * The first message carries the whole document, and later ones carry only
 * the blocks that changed since the last message, so the conversation
 * grows at its end only and the prompt cache covers what came before.
 *
 * @param args              Arguments.
 * @param args.ai           The host's connection to the model.
 * @param args.createTarget Creates the edit target.
 * @return The conversation and the actions on it.
 */
export function useAiChat( { ai, createTarget }: UseAiChatArgs ): AiChat {
	const [ conversation, dispatch ] = useReducer(
		conversationReducer,
		undefined,
		createConversation
	);
	const messagesRef = useRef( conversation.messages );
	// Keep the latest messages for the callbacks, which run after rendering.
	useLayoutEffect( () => {
		messagesRef.current = conversation.messages;
	} );
	const controllerRef = useRef< AbortController | null >( null );

	const send = useCallback(
		( text: string ) => {
			const message = text.trim();
			if ( ! ai || ! message || controllerRef.current ) {
				return;
			}
			const target = createTarget();
			const context = target?.getContext() ?? null;
			const messageContext = context
				? buildMessageContext( context, getLastSeenDocument( messagesRef.current ) )
				: undefined;
			const messages = [
				...toAiMessages( messagesRef.current ),
				{
					role: 'user' as const,
					text: toUserText( message, messageContext ),
				},
			];
			const controller = new AbortController();
			controllerRef.current = controller;
			dispatch( {
				type: 'START',
				text: message,
				context: messageContext,
				document: context?.document,
			} );

			// Once the user stops the answer or starts a new conversation, the
			// request's late events and result are ignored.
			const isCurrent = () => controllerRef.current === controller && ! controller.signal.aborted;

			ai.chat( {
				system: buildSystemPrompt( context?.document ?? null ),
				messages,
				signal: controller.signal,
				onEvent( event ) {
					if ( ! isCurrent() ) {
						return;
					}
					if ( event.type === 'text' ) {
						dispatch( { type: 'APPEND_TEXT', text: event.text } );
						return;
					}
					if ( event.type === 'usage' ) {
						dispatch( { type: 'USAGE', usage: event.usage } );
						return;
					}
					if ( event.type === 'activity' ) {
						dispatch( {
							type: 'ACTIVITY',
							activity: event.activity,
						} );
						return;
					}
					const blocksBefore = takeBlockSnapshot();
					const result: AiEditResult = target ? target.apply( event.edit ) : { status: 'dropped' };
					if ( target && result.status === 'applied' ) {
						highlightChanges( blocksBefore );
					}
					// The model tries again after a failed edit, so the
					// answer shows only the edit that changed the document,
					// or that was dropped.
					if ( result.status !== 'failed' ) {
						dispatch( {
							type: 'EDIT',
							edit: event.edit,
							applied: result.status === 'applied',
						} );
					}
					return result;
				},
			} )
				.then(
					() => {
						if ( isCurrent() ) {
							dispatch( {
								type: 'FINISH',
								status: 'done',
							} );
						}
					},
					( error: unknown ) => {
						if ( isCurrent() ) {
							dispatch( {
								type: 'FINISH',
								status: 'error',
								error: error instanceof Error ? error.message : String( error ),
							} );
						}
					}
				)
				.finally( () => {
					if ( controllerRef.current === controller ) {
						controllerRef.current = null;
					}
				} );
		},
		[ ai, createTarget ]
	);

	const stop = useCallback( () => {
		const controller = controllerRef.current;
		if ( ! controller ) {
			return;
		}
		controllerRef.current = null;
		controller.abort();
		dispatch( {
			type: 'FINISH',
			status: 'stopped',
		} );
	}, [] );

	const reset = useCallback( () => {
		const controller = controllerRef.current;
		controllerRef.current = null;
		controller?.abort();
		dispatch( { type: 'RESET' } );
	}, [] );

	// Abandon the answer when the editor closes, so its late edits do not
	// reach a document that is gone.
	useEffect(
		() => () => {
			const controller = controllerRef.current;
			controllerRef.current = null;
			controller?.abort();
		},
		[]
	);

	const last = conversation.messages[ conversation.messages.length - 1 ];
	const isResponding = last?.role === 'assistant' && last.status === 'streaming';

	return { conversation, isResponding, send, stop, reset };
}
