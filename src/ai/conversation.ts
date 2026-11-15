/**
 * External dependencies
 */
import { v4 as uuid } from 'uuid';

/**
 * Internal dependencies
 */
import type { AiActivity, AiEdit, AiMessage, AiUsage } from '../platform';

export type UserChatMessage = {
	id: string;
	role: 'user';
	text: string;
	/**
	 * What the model was told about the document with this message, fixed
	 * when it was sent. It is sent again as is with later messages, so the
	 * start of the conversation stays the same and the prompt cache covers
	 * it. Omitted when the document was not available.
	 */
	context?: string;
	/**
	 * The document when the message was sent. With the context, the model
	 * knows the whole document as it was then, so the next message tells
	 * the model only what changed since, also by the model's own edits.
	 * Omitted when the document was not available.
	 */
	document?: string;
};

export type AssistantChatMessage = {
	id: string;
	role: 'assistant';
	text: string;
	status: 'streaming' | 'done' | 'stopped' | 'error';
	/**
	 * What the model is doing while the answer streams and no text is
	 * arriving. `waiting` until the model starts, and again after an edit,
	 * while the model goes on to say what it changed.
	 */
	activity?: 'waiting' | AiActivity;
	/**
	 * The edits that changed the document, in order.
	 */
	edits?: AiEdit[];
	/**
	 * `applied` when an edit changed the document, and `dropped` when the
	 * selection the edits were for no longer exists, for example after
	 * switching editor modes.
	 */
	editStatus?: 'applied' | 'dropped';
	/**
	 * The tokens the answer used, added up over its requests. Omitted when
	 * the host did not report them.
	 */
	usage?: AiUsage;
	error?: string;
};

export type ChatMessage = UserChatMessage | AssistantChatMessage;

/**
 * A conversation with the AI assistant. It lives in memory only.
 */
export type Conversation = {
	id: string;
	messages: ChatMessage[];
};

export type ConversationAction =
	| { type: 'START'; text: string; context?: string; document?: string }
	| { type: 'APPEND_TEXT'; text: string }
	| { type: 'ACTIVITY'; activity: AiActivity }
	| { type: 'EDIT'; edit: AiEdit; applied: boolean }
	| { type: 'USAGE'; usage: AiUsage }
	| {
			type: 'FINISH';
			status: 'done' | 'stopped' | 'error';
			error?: string;
	  }
	| { type: 'RESET' };

export function createConversation(): Conversation {
	return { id: uuid(), messages: [] };
}

/**
 * Updates the answer being streamed, which is always the last message.
 *
 * @param conversation The conversation.
 * @param update       Changes to the answer.
 * @return The conversation with the answer updated.
 */
function updateAnswer(
	conversation: Conversation,
	update: ( message: AssistantChatMessage ) => AssistantChatMessage
): Conversation {
	const last = conversation.messages[ conversation.messages.length - 1 ];
	if ( last?.role !== 'assistant' || last.status !== 'streaming' ) {
		return conversation;
	}
	return {
		...conversation,
		messages: [ ...conversation.messages.slice( 0, -1 ), update( last ) ],
	};
}

export function conversationReducer(
	conversation: Conversation,
	action: ConversationAction
): Conversation {
	switch ( action.type ) {
		case 'START':
			return {
				...conversation,
				messages: [
					...conversation.messages,
					{
						id: uuid(),
						role: 'user',
						text: action.text,
						...( action.context === undefined ? {} : { context: action.context } ),
						...( action.document === undefined ? {} : { document: action.document } ),
					},
					{
						id: uuid(),
						role: 'assistant',
						text: '',
						status: 'streaming',
						activity: 'waiting',
					},
				],
			};
		case 'APPEND_TEXT':
			return updateAnswer( conversation, ( message ) => ( {
				...message,
				text: message.text + action.text,
				activity: undefined,
			} ) );
		case 'ACTIVITY':
			return updateAnswer( conversation, ( message ) => ( {
				...message,
				activity: action.activity,
			} ) );
		case 'EDIT':
			return updateAnswer( conversation, ( message ) => ( {
				...message,
				...( action.applied
					? { edits: [ ...( message.edits ?? [] ), action.edit ], editStatus: 'applied' }
					: { editStatus: message.editStatus ?? 'dropped' } ),
				activity: 'waiting',
			} ) );
		case 'USAGE':
			return updateAnswer( conversation, ( message ) => {
				const cached =
					message.usage?.cachedInputTokens === undefined &&
					action.usage.cachedInputTokens === undefined
						? undefined
						: ( message.usage?.cachedInputTokens ?? 0 ) + ( action.usage.cachedInputTokens ?? 0 );
				return {
					...message,
					usage: {
						inputTokens: ( message.usage?.inputTokens ?? 0 ) + action.usage.inputTokens,
						...( cached === undefined ? {} : { cachedInputTokens: cached } ),
						outputTokens: ( message.usage?.outputTokens ?? 0 ) + action.usage.outputTokens,
					},
				};
			} );
		case 'FINISH':
			return updateAnswer( conversation, ( message ) => ( {
				...message,
				status: action.status,
				activity: undefined,
				error: action.error,
			} ) );
		case 'RESET':
			return createConversation();
		default:
			return conversation;
	}
}

/**
 * Joins the context of the document and the user's message into the text
 * sent to the model.
 *
 * @param text    The user's message.
 * @param context The context of the document, when there is one.
 * @return The text for the model.
 */
export function toUserText( text: string, context?: string ): string {
	return context === undefined ? text : `${ context }\n\n${ text }`;
}

/**
 * Returns the document as the model last saw it: when the last message
 * still sent to the model was sent. `null` when the model has not seen the
 * document.
 *
 * @param messages The conversation's messages.
 * @return The document, or `null`.
 */
export function getLastSeenDocument( messages: ChatMessage[] ): string | null {
	for ( let index = messages.length - 1; index >= 0; index-- ) {
		const message = messages[ index ];
		if ( message.role !== 'user' ) {
			continue;
		}
		const answer = messages[ index + 1 ];
		// `toAiMessages` leaves out an exchange whose answer failed.
		if ( answer?.role === 'assistant' && answer.status === 'error' ) {
			continue;
		}
		return message.document ?? null;
	}
	return null;
}

/**
 * Converts the conversation into the messages sent to the model. An
 * exchange whose answer failed is left out, together with its question, and
 * only the edits that changed the document are sent.
 *
 * @param messages The conversation's messages.
 * @return The messages for the model.
 */
export function toAiMessages( messages: ChatMessage[] ): AiMessage[] {
	const result: AiMessage[] = [];
	messages.forEach( ( message, index ) => {
		if ( message.role === 'user' ) {
			const answer = messages[ index + 1 ];
			if ( answer?.role === 'assistant' && answer.status === 'error' ) {
				return;
			}
			result.push( {
				role: 'user',
				text: toUserText( message.text, message.context ),
			} );
		} else if ( message.status !== 'error' ) {
			const { edits } = message;
			// An answer stopped before it said anything has nothing to send.
			if ( ! message.text && ! edits ) {
				return;
			}
			result.push( {
				role: 'assistant',
				text: message.text,
				...( edits ? { edits } : {} ),
			} );
		}
	} );
	return result;
}
