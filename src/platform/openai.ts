/**
 * WordPress dependencies
 */
import apiFetch from '@wordpress/api-fetch';
import { __ } from '@wordpress/i18n';

/**
 * Internal dependencies
 */
import type { AiChatRequest, AiEditResult, AiMessage, AiPlatform, AiUsage } from '.';
import { EDIT_TOOL, describeApplied, readErrorMessage, toEdit } from './anthropic';
import { readSse } from './sse';

/**
 * The model that answers when no other model is chosen.
 */
export const OPENAI_MODEL = 'gpt-6-astra';

/**
 * The most tokens one answer may use, including the model's reasoning.
 */
const MAX_OUTPUT_TOKENS = 64000;

/**
 * How many failed edits the model may try again in one answer.
 */
const MAX_FAILED_EDITS = 3;

/**
 * The edit tool, as a function of OpenAI's Responses API. It is made from
 * the Anthropic tool, so both providers always get the same tool.
 */
export const OPENAI_EDIT_TOOL = {
	type: 'function',
	name: EDIT_TOOL.name,
	description: EDIT_TOOL.description,
	parameters: EDIT_TOOL.input_schema,
	// Strict mode needs every property to be required, which the tool does not want.
	strict: false,
};

/**
 * An item of the input or output of OpenAI's Responses API: a message, a
 * function call, a function call's output, or the model's reasoning.
 */
type OpenAiItem = { type?: string; [ key: string ]: unknown };

const APPLIED = 'The edit was applied.';

/**
 * Converts the conversation into the input of OpenAI's Responses API.
 *
 * Earlier answers are sent as their text and edits. The model's reasoning
 * is not kept, and the API accepts a history without it.
 *
 * @param messages The conversation.
 * @return The input items.
 */
export function toOpenAiInput( messages: AiMessage[] ): OpenAiItem[] {
	return messages.flatMap( ( message, index ): OpenAiItem[] => {
		if ( message.role === 'user' ) {
			return [ { role: 'user', content: message.text } ];
		}
		const edits = message.edits ?? [];
		const ids = edits.map( ( _, number ) => `call_edit_${ index }_${ number }` );
		return [
			...( message.text ? [ { role: 'assistant', content: message.text } ] : [] ),
			...edits.map( ( edit, number ) => ( {
				type: 'function_call',
				call_id: ids[ number ],
				name: EDIT_TOOL.name,
				arguments: JSON.stringify( edit ),
			} ) ),
			...ids.map( ( id ) => ( { type: 'function_call_output', call_id: id, output: APPLIED } ) ),
		];
	} );
}

/**
 * Builds the body of a request to OpenAI's Responses API.
 *
 * Nothing is stored at OpenAI, so the reasoning comes back encrypted, to be
 * sent again while the model goes on with the same answer.
 *
 * @param system The system prompt.
 * @param input  The input items.
 * @param model  The model that answers.
 * @return The request body.
 */
export function buildOpenAiBody( system: string, input: OpenAiItem[], model = OPENAI_MODEL ) {
	return {
		model,
		max_output_tokens: MAX_OUTPUT_TOKENS,
		instructions: system,
		tools: [ OPENAI_EDIT_TOOL ],
		input,
		store: false,
		include: [ 'reasoning.encrypted_content' ],
	};
}

/**
 * What a request to OpenAI answered.
 */
type OpenAiAnswer = {
	/**
	 * The answer's output items, as they are sent back to the model.
	 */
	output: OpenAiItem[];
	/**
	 * The function calls among them.
	 */
	calls: OpenAiItem[];
};

/**
 * Streams OpenAI's answer through `onEvent`, and collects its output.
 *
 * @param response The streamed response.
 * @param onEvent  Called for each event of the answer.
 * @return The answer.
 */
export async function readOpenAiStream(
	response: Response,
	onEvent: AiChatRequest[ 'onEvent' ]
): Promise< OpenAiAnswer > {
	if ( ! response.body ) {
		throw new Error( __( 'The answer could not be read.', 'ai-content-editing-assistant' ) );
	}

	const declined = __( 'The model declined to answer.', 'ai-content-editing-assistant' );
	const output: OpenAiItem[] = [];
	let finished: { status?: string; incomplete_details?: { reason?: string } } | null = null;

	for await ( const { data } of readSse( response.body ) ) {
		const payload = JSON.parse( data );

		switch ( payload.type ) {
			case 'response.output_item.added':
				if ( payload.item?.type === 'reasoning' ) {
					onEvent( { type: 'activity', activity: 'thinking' } );
				} else if ( payload.item?.type === 'function_call' ) {
					onEvent( { type: 'activity', activity: 'editing' } );
				}
				break;
			case 'response.output_text.delta':
				onEvent( { type: 'text', text: payload.delta } );
				break;
			case 'response.refusal.done':
				throw new Error( declined );
			case 'response.output_item.done':
				output[ payload.output_index ] = payload.item;
				break;
			case 'response.completed':
			case 'response.incomplete': {
				finished = payload.response ?? {};
				const used = payload.response?.usage;
				if ( used ) {
					const usage: AiUsage = {
						// OpenAI counts cached tokens as part of `input_tokens`.
						inputTokens: used.input_tokens ?? 0,
						cachedInputTokens: used.input_tokens_details?.cached_tokens ?? 0,
						outputTokens: used.output_tokens ?? 0,
					};
					onEvent( { type: 'usage', usage } );
				}
				break;
			}
			case 'response.failed':
				throw new Error(
					payload.response?.error?.message ??
						__( 'The answer could not be loaded.', 'ai-content-editing-assistant' )
				);
			case 'error':
				throw new Error(
					payload.message ??
						payload.error?.message ??
						__( 'The answer could not be loaded.', 'ai-content-editing-assistant' )
				);
		}
	}

	// Either can cut a function call off, so its edit is not applied.
	if ( finished?.status === 'incomplete' ) {
		if ( finished.incomplete_details?.reason === 'content_filter' ) {
			throw new Error( declined );
		}
		throw new Error(
			__( 'The answer was cut off because it was too long.', 'ai-content-editing-assistant' )
		);
	}

	const items = output.filter( Boolean );
	return { output: items, calls: items.filter( ( item ) => item.type === 'function_call' ) };
}

/**
 * Applies the edits the model asked for, and builds the outputs to send
 * back.
 *
 * @param answer  The answer.
 * @param onEvent Applies each edit.
 * @return The outputs, and how many edits failed.
 */
function runTools( answer: OpenAiAnswer, onEvent: AiChatRequest[ 'onEvent' ] ) {
	let failures = 0;
	const results = answer.calls.map( ( call ) => {
		let input: unknown;
		let invalid = false;
		try {
			input = JSON.parse( call.arguments as string );
		} catch {
			invalid = true;
		}
		const edit = ! invalid && call.name === EDIT_TOOL.name ? toEdit( input ) : null;
		let result: AiEditResult;
		if ( invalid ) {
			result = { status: 'failed', reason: JSON.stringify( { INVALID_JSON: call.arguments } ) };
		} else if ( ! edit ) {
			result = {
				status: 'failed',
				reason: `Call ${ EDIT_TOOL.name } with arguments that match its parameters.`,
			};
		} else {
			result = onEvent( { type: 'edit', edit } ) ?? { status: 'dropped' };
		}
		let text: string;
		if ( result.status === 'failed' ) {
			failures++;
			text = result.reason;
		} else if ( result.status === 'applied' ) {
			text = describeApplied( result.refs, result.autoFix );
		} else {
			text = 'The selected blocks no longer exist, so the edit was not applied.';
		}
		return { type: 'function_call_output', call_id: call.call_id, output: text };
	} );
	return { results, failures };
}

/**
 * Connects the AI assistant to OpenAI through the plugin's relay, which adds
 * the site's API key on the server.
 *
 * @param getPostId Returns the ID of the post being edited.
 * @param model     The model that answers.
 * @return The connection.
 */
export function createOpenAiPlatform( getPostId: () => number, model = OPENAI_MODEL ): AiPlatform {
	return {
		// The sidebar only loads when the site has a key.
		hasApiKey: async () => true,
		async chat( { system, messages, onEvent, signal } ) {
			const input = toOpenAiInput( messages );
			let failures = 0;
			for (;;) {
				let response: Response;
				try {
					response = await apiFetch< Response, false >( {
						path: '/ai-content-editing-assistant/v1/chat',
						method: 'POST',
						data: {
							provider: 'openai',
							post_id: getPostId(),
							stream: true,
							body: buildOpenAiBody( system, input, model ),
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

				const answer = await readOpenAiStream( response, onEvent );
				if ( ! answer.calls.length ) {
					return;
				}
				const tools = runTools( answer, onEvent );
				failures += tools.failures;
				if ( failures > MAX_FAILED_EDITS ) {
					throw new Error( __( 'The edit could not be made.', 'ai-content-editing-assistant' ) );
				}
				// The output goes back unchanged, with its reasoning, so the model
				// goes on from where it stopped.
				input.push( ...answer.output, ...tools.results );
			}
		},
	};
}
