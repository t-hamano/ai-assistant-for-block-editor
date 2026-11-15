/**
 * WordPress dependencies
 */
import apiFetch from '@wordpress/api-fetch';
import { __ } from '@wordpress/i18n';

/**
 * Internal dependencies
 */
import type { AiChatRequest, AiPlatform, AiUsage } from '.';
import { readSse } from './sse';

/**
 * The model that answers. It becomes selectable with the model list.
 */
export const ANTHROPIC_MODEL = 'claude-opus-5-5';

/**
 * The most tokens one answer may use, including the model's thinking.
 */
const MAX_TOKENS = 64000;

/**
 * Builds the body of a request to Anthropic's Messages API.
 *
 * Earlier answers are sent as their text only. The model's thinking is
 * not kept, and the API accepts a history without it.
 *
 * @param request The chat request.
 * @return The request body.
 */
export function buildAnthropicBody( request: Pick< AiChatRequest, 'system' | 'messages' > ) {
	return {
		model: ANTHROPIC_MODEL,
		max_tokens: MAX_TOKENS,
		system: request.system,
		messages: request.messages.map( ( message ) => ( {
			role: message.role,
			content: message.text,
		} ) ),
	};
}

/**
 * Finds a readable message in an error response from the relay or from
 * Anthropic.
 *
 * @param response The error response.
 * @return The message.
 */
async function readErrorMessage( response: Response ): Promise< string > {
	try {
		const body = await response.json();
		// Anthropic: `{ type: 'error', error: { message } }`. WordPress: `{ code, message }`.
		const message = body?.error?.message ?? body?.message;
		if ( typeof message === 'string' && message ) {
			return message;
		}
	} catch {
		// Not JSON, so fall through to the status.
	}
	return `${ response.status } ${ response.statusText }`.trim();
}

/**
 * Streams Anthropic's answer through `onEvent`.
 *
 * @param response The streamed response.
 * @param onEvent  Called for each event of the answer.
 */
export async function readAnthropicStream(
	response: Response,
	onEvent: AiChatRequest[ 'onEvent' ]
): Promise< void > {
	if ( ! response.body ) {
		throw new Error( __( 'The answer could not be read.', 'ai-assistant-for-block-editor' ) );
	}

	let usage: AiUsage | undefined;
	let stopReason: string | null = null;

	for await ( const { event, data } of readSse( response.body ) ) {
		if ( event === 'ping' ) {
			continue;
		}
		const payload = JSON.parse( data );

		switch ( event ) {
			case 'message_start': {
				const start = payload.message?.usage ?? {};
				const cached = start.cache_read_input_tokens ?? 0;
				usage = {
					// Anthropic counts cached and newly cached tokens apart from `input_tokens`.
					inputTokens:
						( start.input_tokens ?? 0 ) + cached + ( start.cache_creation_input_tokens ?? 0 ),
					cachedInputTokens: cached,
					outputTokens: start.output_tokens ?? 0,
				};
				break;
			}
			case 'content_block_start':
				if (
					payload.content_block?.type === 'thinking' ||
					payload.content_block?.type === 'redacted_thinking'
				) {
					onEvent( { type: 'activity', activity: 'thinking' } );
				}
				break;
			case 'content_block_delta':
				if ( payload.delta?.type === 'text_delta' ) {
					onEvent( { type: 'text', text: payload.delta.text } );
				}
				break;
			case 'message_delta':
				stopReason = payload.delta?.stop_reason ?? stopReason;
				if ( usage && typeof payload.usage?.output_tokens === 'number' ) {
					usage.outputTokens = payload.usage.output_tokens;
				}
				break;
			case 'error':
				throw new Error(
					payload.error?.message ??
						__( 'The answer could not be loaded.', 'ai-assistant-for-block-editor' )
				);
		}
	}

	if ( usage ) {
		onEvent( { type: 'usage', usage } );
	}

	if ( stopReason === 'refusal' ) {
		throw new Error( __( 'The model declined to answer.', 'ai-assistant-for-block-editor' ) );
	}
	if ( stopReason === 'max_tokens' ) {
		throw new Error(
			__( 'The answer was cut off because it was too long.', 'ai-assistant-for-block-editor' )
		);
	}
}

/**
 * Connects the AI assistant to Anthropic through the plugin's relay, which
 * adds the site's API key on the server.
 *
 * @param getPostId Returns the ID of the post being edited.
 * @return The connection.
 */
export function createAnthropicPlatform( getPostId: () => number ): AiPlatform {
	return {
		// The sidebar only loads when the site has a key.
		hasApiKey: async () => true,
		async chat( { system, messages, onEvent, signal } ) {
			let response: Response;
			try {
				response = await apiFetch< Response, false >( {
					path: '/ai-assistant-for-block-editor/v1/chat',
					method: 'POST',
					data: {
						provider: 'anthropic',
						post_id: getPostId(),
						stream: true,
						body: buildAnthropicBody( { system, messages } ),
					},
					parse: false,
					signal,
				} );
			} catch ( error ) {
				// With `parse: false`, an error status rejects with the response itself.
				if ( error instanceof Response ) {
					throw new Error( await readErrorMessage( error ) );
				}
				throw error;
			}

			await readAnthropicStream( response, onEvent );
		},
	};
}
