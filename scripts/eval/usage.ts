/**
 * The tokens and requests one case used, as Anthropic counted them.
 */
export type Usage = {
	/**
	 * The input tokens read at the full price: neither read from the prompt
	 * cache nor written to it.
	 */
	inputTokens: number;
	cacheReadTokens: number;
	cacheWriteTokens: number;
	/**
	 * The tokens the model wrote, including its thinking.
	 */
	outputTokens: number;
	/**
	 * The requests sent to the model: one for each turn of the
	 * conversation, and one more each time the model called a tool.
	 */
	requests: number;
};

export function createUsage(): Usage {
	return {
		inputTokens: 0,
		cacheReadTokens: 0,
		cacheWriteTokens: 0,
		outputTokens: 0,
		requests: 0,
	};
}

/**
 * Reads the usage of one streamed answer of Anthropic's Messages API:
 * `message_start` has the input tokens, and the last `message_delta` the
 * output tokens.
 *
 * @param stream The answer's server-sent events, as text.
 * @return The usage, with `requests` set to 1.
 */
export function readStreamUsage( stream: string ): Usage {
	const usage = { ...createUsage(), requests: 1 };
	for ( const line of stream.split( /\r?\n/ ) ) {
		if ( ! line.startsWith( 'data:' ) ) {
			continue;
		}
		let data: any;
		try {
			data = JSON.parse( line.slice( 5 ) );
		} catch {
			continue;
		}
		if ( data?.type === 'message_start' ) {
			const start = data.message?.usage ?? {};
			usage.inputTokens = start.input_tokens ?? 0;
			usage.cacheReadTokens = start.cache_read_input_tokens ?? 0;
			usage.cacheWriteTokens = start.cache_creation_input_tokens ?? 0;
			usage.outputTokens = start.output_tokens ?? 0;
		} else if ( data?.type === 'message_delta' && typeof data.usage?.output_tokens === 'number' ) {
			usage.outputTokens = data.usage.output_tokens;
		}
	}
	return usage;
}

/**
 * Reads the usage of one answer of Anthropic's Messages API that was not
 * streamed, as the platform asks for when streaming does not work.
 *
 * @param answer The answer, a message.
 * @return The usage, with `requests` set to 1.
 */
export function readAnswerUsage( answer: any ): Usage {
	const usage = answer?.usage ?? {};
	return {
		inputTokens: usage.input_tokens ?? 0,
		cacheReadTokens: usage.cache_read_input_tokens ?? 0,
		cacheWriteTokens: usage.cache_creation_input_tokens ?? 0,
		outputTokens: usage.output_tokens ?? 0,
		requests: 1,
	};
}

/**
 * Adds one usage to another.
 *
 * @param total The usage to add to, which is changed.
 * @param more  The usage to add.
 */
export function addUsage( total: Usage, more: Usage ) {
	total.inputTokens += more.inputTokens;
	total.cacheReadTokens += more.cacheReadTokens;
	total.cacheWriteTokens += more.cacheWriteTokens;
	total.outputTokens += more.outputTokens;
	total.requests += more.requests;
}

/**
 * Counts the failed tool calls whose results a request sends back to the
 * model, so it tries again: the `tool_result` blocks with `is_error` in
 * the request's last message. Earlier messages were counted with the
 * requests that first sent them.
 *
 * @param body          The body of a request to Anthropic's Messages API.
 * @param body.messages The messages of the conversation.
 * @return The failed calls.
 */
export function countRetries( body: { messages?: unknown } ): number {
	const messages = Array.isArray( body.messages ) ? body.messages : [];
	const last = messages[ messages.length - 1 ];
	if ( last?.role !== 'user' || ! Array.isArray( last.content ) ) {
		return 0;
	}
	return last.content.filter(
		( block: { type?: string; is_error?: boolean } ) =>
			block?.type === 'tool_result' && block.is_error === true
	).length;
}
