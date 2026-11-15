/**
 * WordPress dependencies
 */
import apiFetch from '@wordpress/api-fetch';
import { __ } from '@wordpress/i18n';

/**
 * Internal dependencies
 */
import type { AiChatRequest, AiEdit, AiEditResult, AiMessage, AiPlatform, AiUsage } from '.';
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
 * How many failed edits the model may try again in one answer.
 */
const MAX_FAILED_EDITS = 3;

/**
 * The tool the model edits the document with.
 */
export const EDIT_TOOL = {
	name: 'edit_blocks',
	description:
		'Edits the document in the block editor. "replace" replaces the selected blocks with the markup, and "insert_after" inserts the markup after them, or at the end of the document when nothing is selected.',
	// Long markup arrives as it is written, instead of all at once at the end.
	eager_input_streaming: true,
	input_schema: {
		type: 'object',
		properties: {
			action: { type: 'string', enum: [ 'replace', 'insert_after' ] },
			markup: { type: 'string', description: 'The new content, as block markup.' },
		},
		required: [ 'action', 'markup' ],
	},
};

/**
 * A content block of a message, as Anthropic's Messages API has it.
 */
type ContentBlock = { type: string; [ key: string ]: unknown };

type AnthropicMessage = { role: 'user' | 'assistant'; content: ContentBlock[] };

const APPLIED = 'The edit was applied.';

/**
 * Converts the conversation into Anthropic's messages.
 *
 * Earlier answers are sent as their text and edits. The model's thinking is
 * not kept, and the API accepts a history without it.
 *
 * @param messages The conversation.
 * @return The messages.
 */
export function toAnthropicMessages( messages: AiMessage[] ): AnthropicMessage[] {
	const result: AnthropicMessage[] = [];
	const push = ( role: AnthropicMessage[ 'role' ], content: ContentBlock[] ) => {
		const last = result[ result.length - 1 ];
		if ( last?.role === role ) {
			last.content.push( ...content );
		} else {
			result.push( { role, content } );
		}
	};
	messages.forEach( ( message, index ) => {
		if ( message.role === 'user' ) {
			push( 'user', [ { type: 'text', text: message.text } ] );
			return;
		}
		const edits = message.edits ?? [];
		const ids = edits.map( ( _, number ) => `toolu_edit_${ index }_${ number }` );
		push( 'assistant', [
			...( message.text ? [ { type: 'text', text: message.text } ] : [] ),
			...edits.map( ( edit, number ) => ( {
				type: 'tool_use',
				id: ids[ number ],
				name: EDIT_TOOL.name,
				input: edit,
			} ) ),
		] );
		if ( ids.length ) {
			push(
				'user',
				ids.map( ( id ) => ( { type: 'tool_result', tool_use_id: id, content: APPLIED } ) )
			);
		}
	} );
	return result;
}

/**
 * Builds the body of a request to Anthropic's Messages API.
 *
 * @param system   The system prompt.
 * @param messages The messages.
 * @return The request body.
 */
export function buildAnthropicBody( system: string, messages: AnthropicMessage[] ) {
	return {
		model: ANTHROPIC_MODEL,
		max_tokens: MAX_TOKENS,
		system,
		tools: [ EDIT_TOOL ],
		messages,
	};
}

/**
 * Reads the edit from the input of an `edit_blocks` call.
 *
 * @param input The input.
 * @return The edit, or `null` when the input does not match the tool.
 */
function toEdit( input: unknown ): AiEdit | null {
	const { action, markup } = ( input ?? {} ) as Record< string, unknown >;
	if ( ( action === 'replace' || action === 'insert_after' ) && typeof markup === 'string' ) {
		return { action, markup };
	}
	return null;
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
 * What a request to Anthropic answered.
 */
type AnthropicAnswer = {
	/**
	 * The answer's content blocks, as they are sent back to the model.
	 */
	content: ContentBlock[];
	stopReason: string | null;
	/**
	 * The input of each tool call whose input is not valid JSON, by the
	 * call's ID.
	 */
	invalidInputs: Map< string, string >;
};

/**
 * Streams Anthropic's answer through `onEvent`, and collects its content.
 *
 * @param response The streamed response.
 * @param onEvent  Called for each event of the answer.
 * @return The answer.
 */
export async function readAnthropicStream(
	response: Response,
	onEvent: AiChatRequest[ 'onEvent' ]
): Promise< AnthropicAnswer > {
	if ( ! response.body ) {
		throw new Error( __( 'The answer could not be read.', 'ai-assistant-for-block-editor' ) );
	}

	let usage: AiUsage | undefined;
	let stopReason: string | null = null;
	const content: ContentBlock[] = [];
	const inputs: string[] = [];
	const invalidInputs = new Map< string, string >();

	for await ( const { event, data } of readSse( response.body ) ) {
		if ( event === 'ping' ) {
			continue;
		}
		const payload = JSON.parse( data );
		const block = content[ payload.index ];

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
			case 'content_block_start': {
				const started = { ...payload.content_block };
				content[ payload.index ] = started;
				if ( started.type === 'thinking' || started.type === 'redacted_thinking' ) {
					onEvent( { type: 'activity', activity: 'thinking' } );
				} else if ( started.type === 'tool_use' ) {
					inputs[ payload.index ] = '';
					onEvent( { type: 'activity', activity: 'editing' } );
				}
				break;
			}
			case 'content_block_delta': {
				const { delta } = payload;
				if ( delta?.type === 'text_delta' ) {
					if ( block ) {
						block.text = ( block.text ?? '' ) + delta.text;
					}
					onEvent( { type: 'text', text: delta.text } );
				} else if ( block && delta?.type === 'thinking_delta' ) {
					block.thinking = ( block.thinking ?? '' ) + delta.thinking;
				} else if ( block && delta?.type === 'signature_delta' ) {
					block.signature = delta.signature;
				} else if ( delta?.type === 'input_json_delta' ) {
					inputs[ payload.index ] = ( inputs[ payload.index ] ?? '' ) + delta.partial_json;
				}
				break;
			}
			case 'content_block_stop':
				if ( block?.type === 'tool_use' ) {
					const input = inputs[ payload.index ] ?? '';
					try {
						block.input = input ? JSON.parse( input ) : {};
					} catch {
						block.input = {};
						invalidInputs.set( block.id as string, input );
					}
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

	// Either can cut a tool call off, so its edit is not applied.
	if ( stopReason === 'refusal' ) {
		throw new Error( __( 'The model declined to answer.', 'ai-assistant-for-block-editor' ) );
	}
	if ( stopReason === 'max_tokens' ) {
		throw new Error(
			__( 'The answer was cut off because it was too long.', 'ai-assistant-for-block-editor' )
		);
	}

	return { content: content.filter( Boolean ), stopReason, invalidInputs };
}

/**
 * Applies the edits the model asked for, and builds the results to send
 * back.
 *
 * @param answer  The answer.
 * @param onEvent Applies each edit.
 * @return The results, and how many edits failed.
 */
function runTools( answer: AnthropicAnswer, onEvent: AiChatRequest[ 'onEvent' ] ) {
	let failures = 0;
	const results = answer.content
		.filter( ( block ) => block.type === 'tool_use' )
		.map( ( block ) => {
			const id = block.id as string;
			const invalid = answer.invalidInputs.get( id );
			const edit = block.name === EDIT_TOOL.name ? toEdit( block.input ) : null;
			let result: AiEditResult;
			if ( invalid !== undefined ) {
				result = { status: 'failed', reason: JSON.stringify( { INVALID_JSON: invalid } ) };
			} else if ( ! edit ) {
				result = {
					status: 'failed',
					reason: `Call ${ EDIT_TOOL.name } with "action" set to "replace" or "insert_after", and "markup" set to block markup.`,
				};
			} else {
				result = onEvent( { type: 'edit', edit } ) ?? { status: 'dropped' };
			}
			if ( result.status === 'failed' ) {
				failures++;
				return { type: 'tool_result', tool_use_id: id, is_error: true, content: result.reason };
			}
			return {
				type: 'tool_result',
				tool_use_id: id,
				content:
					result.status === 'applied'
						? APPLIED
						: 'The selected blocks no longer exist, so the edit was not applied.',
			};
		} );
	return { results, failures };
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
			const conversation = toAnthropicMessages( messages );
			let failures = 0;
			for (;;) {
				let response: Response;
				try {
					response = await apiFetch< Response, false >( {
						path: '/ai-assistant-for-block-editor/v1/chat',
						method: 'POST',
						data: {
							provider: 'anthropic',
							post_id: getPostId(),
							stream: true,
							body: buildAnthropicBody( system, conversation ),
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

				const answer = await readAnthropicStream( response, onEvent );
				if ( answer.stopReason !== 'tool_use' ) {
					return;
				}
				const tools = runTools( answer, onEvent );
				failures += tools.failures;
				if ( failures > MAX_FAILED_EDITS ) {
					throw new Error( __( 'The edit could not be made.', 'ai-assistant-for-block-editor' ) );
				}
				// The answer goes back unchanged, with its thinking, so the model
				// goes on from where it stopped.
				conversation.push(
					{ role: 'assistant', content: answer.content },
					{ role: 'user', content: tools.results }
				);
			}
		},
	};
}
