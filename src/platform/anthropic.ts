/**
 * WordPress dependencies
 */
import apiFetch from '@wordpress/api-fetch';
import { __ } from '@wordpress/i18n';

/**
 * Internal dependencies
 */
import type { AiChatRequest, AiEdit, AiEditResult, AiMessage, AiPlatform, AiUsage } from '.';
import { READ_TOOLS, getToolActivity, runRead } from './read-tools';
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
	description: [
		'Edits the document in the block editor. Call it once for each change.',
		'"replace" replaces the selected blocks with the markup. "insert_after" without "ref" inserts the markup after the selected blocks, or at the end of the document when nothing is selected.',
		'With "ref", the reference ID of a block in the document, "replace_block" replaces that block, inner blocks included, "insert_before" and "insert_after" insert the markup before or after it, and "delete_block" removes it. "append" adds the markup to the end of the document.',
		'"replace_text" replaces the "find" text, which must appear only once in the document, with the markup, for small changes such as a word or a sentence.',
	].join( ' ' ),
	// Long markup arrives as it is written, instead of all at once at the end.
	eager_input_streaming: true,
	input_schema: {
		type: 'object',
		properties: {
			action: {
				type: 'string',
				enum: [
					'replace',
					'insert_after',
					'replace_block',
					'insert_before',
					'delete_block',
					'append',
					'replace_text',
				],
			},
			ref: {
				type: 'string',
				description:
					'The reference ID of the block to edit, such as "b12", from the <!-- ref:b12 --> before it.',
			},
			find: {
				type: 'string',
				description:
					'For "replace_text", the markup to replace, copied exactly from the document. It may be text inside a block, or whole blocks.',
			},
			markup: {
				type: 'string',
				description:
					'The new content, as block markup. For "replace_text", what replaces "find". Empty for "delete_block".',
			},
		},
		required: [ 'action' ],
	},
};

/**
 * A content block of a message, as Anthropic's Messages API has it.
 */
type ContentBlock = { type: string; [ key: string ]: unknown };

type AnthropicMessage = { role: 'user' | 'assistant'; content: ContentBlock[] };

const APPLIED = 'The edit was applied.';

/**
 * Tells the model its edit was applied, and the reference IDs of the blocks
 * it added, so it can edit them again.
 *
 * @param refs The reference IDs of the added blocks.
 * @return The result.
 */
export function describeApplied( refs: string[] | undefined ): string {
	if ( ! refs?.length ) {
		return APPLIED;
	}
	return `${ APPLIED } The reference IDs of the new blocks are ${ refs.join( ', ' ) }.`;
}

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
 * Marks where Anthropic caches the prompt up to, for five minutes.
 */
const CACHE_CONTROL = { type: 'ephemeral' } as const;

/**
 * Builds the body of a request to Anthropic's Messages API.
 *
 * The prompt is cached at two points. The marker on the system prompt
 * caches the tool and the system prompt, which stay the same in every
 * request, so they are read from the cache even when the conversation
 * changes. The marker on the body caches the whole conversation, so the
 * next message or tool call only pays in full for what it adds.
 *
 * @param system   The system prompt.
 * @param messages The messages.
 * @return The request body.
 */
export function buildAnthropicBody( system: string, messages: AnthropicMessage[] ) {
	return {
		model: ANTHROPIC_MODEL,
		max_tokens: MAX_TOKENS,
		cache_control: CACHE_CONTROL,
		system: [ { type: 'text', text: system, cache_control: CACHE_CONTROL } ],
		tools: [ EDIT_TOOL, ...READ_TOOLS ],
		messages,
	};
}

/**
 * Reads the edit from the input of an `edit_blocks` call.
 *
 * @param input The input.
 * @return The edit, or `null` when the input does not match the tool.
 */
export function toEdit( input: unknown ): AiEdit | null {
	const { action, markup = '', ref, find } = ( input ?? {} ) as Record< string, unknown >;
	if ( typeof markup !== 'string' || ( ref !== undefined && typeof ref !== 'string' ) ) {
		return null;
	}
	switch ( action ) {
		case 'replace':
		case 'append':
			return markup ? { action, markup } : null;
		case 'insert_after':
			if ( ! markup ) {
				return null;
			}
			return ref ? { action, ref, markup } : { action, markup };
		case 'replace_block':
		case 'insert_before':
			return ref && markup ? { action, ref, markup } : null;
		case 'delete_block':
			return ref ? { action, ref, markup: '' } : null;
		case 'replace_text':
			// An empty markup removes the text.
			return typeof find === 'string' && find ? { action, find, markup } : null;
	}
	return null;
}

/**
 * Finds a readable message in an error response from the relay or from
 * Anthropic, or from OpenAI, which answers errors in the same shape.
 *
 * @param response The error response.
 * @return The message.
 */
export async function readErrorMessage( response: Response ): Promise< string > {
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
		throw new Error( __( 'The answer could not be read.', 'ai-content-editing-assistant' ) );
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
					onEvent( { type: 'activity', activity: getToolActivity( started.name ) } );
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
						__( 'The answer could not be loaded.', 'ai-content-editing-assistant' )
				);
		}
	}

	if ( usage ) {
		onEvent( { type: 'usage', usage } );
	}

	// Either can cut a tool call off, so its edit is not applied.
	if ( stopReason === 'refusal' ) {
		throw new Error( __( 'The model declined to answer.', 'ai-content-editing-assistant' ) );
	}
	if ( stopReason === 'max_tokens' ) {
		throw new Error(
			__( 'The answer was cut off because it was too long.', 'ai-content-editing-assistant' )
		);
	}

	return { content: content.filter( Boolean ), stopReason, invalidInputs };
}

/**
 * Applies the edits the model asked for, runs its reads, and builds the
 * results to send back.
 *
 * @param answer  The answer.
 * @param onEvent Applies each edit.
 * @param read    Reads the document.
 * @return The results, and how many calls failed.
 */
function runTools(
	answer: AnthropicAnswer,
	onEvent: AiChatRequest[ 'onEvent' ],
	read: AiChatRequest[ 'read' ]
) {
	let failures = 0;
	const results = answer.content
		.filter( ( block ) => block.type === 'tool_use' )
		.map( ( block ) => {
			const id = block.id as string;
			const invalid = answer.invalidInputs.get( id );
			const found = invalid === undefined ? runRead( block.name, block.input, read ) : null;
			if ( found ) {
				if ( found.status === 'failed' ) {
					failures++;
					return { type: 'tool_result', tool_use_id: id, is_error: true, content: found.reason };
				}
				return { type: 'tool_result', tool_use_id: id, content: found.content };
			}
			const edit = block.name === EDIT_TOOL.name ? toEdit( block.input ) : null;
			let result: AiEditResult;
			if ( invalid !== undefined ) {
				result = { status: 'failed', reason: JSON.stringify( { INVALID_JSON: invalid } ) };
			} else if ( ! edit ) {
				result = {
					status: 'failed',
					reason: `Call ${ EDIT_TOOL.name } with "action" set to one of ${ EDIT_TOOL.input_schema.properties.action.enum.join( ', ' ) }, "markup" set to block markup, for "replace_block", "insert_before", and "delete_block", "ref" set to the reference ID of a block, and for "replace_text", "find" set to the text to replace.`,
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
						? describeApplied( result.refs )
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
		async chat( { system, messages, onEvent, read, signal } ) {
			const conversation = toAnthropicMessages( messages );
			let failures = 0;
			for (;;) {
				let response: Response;
				try {
					response = await apiFetch< Response, false >( {
						path: '/ai-content-editing-assistant/v1/chat',
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
				const tools = runTools( answer, onEvent, read );
				failures += tools.failures;
				if ( failures > MAX_FAILED_EDITS ) {
					throw new Error( __( 'The edit could not be made.', 'ai-content-editing-assistant' ) );
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
