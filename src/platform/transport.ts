/**
 * WordPress dependencies
 */
import apiFetch from '@wordpress/api-fetch';
import { __ } from '@wordpress/i18n';

/**
 * Internal dependencies
 */
import { readSse } from './sse';

/**
 * How long to wait for the next piece of an answer, in milliseconds. The
 * relay waits up to 300 seconds for the provider, so this only ends
 * connections that stopped without closing.
 */
export const IDLE_TIMEOUT = 330_000;

/**
 * The event the relay adds when the provider's answer stopped partway.
 * Its data is `{ message }`.
 */
export const RELAY_ERROR_EVENT = 'ai_content_editing_assistant_error';

/**
 * An event of a provider's answer, with its data read from JSON.
 */
export type AnswerEvent = {
	event: string;
	data: any;
};

/**
 * The error for an answer that stopped before it was finished.
 *
 * @return The error.
 */
export function connectionLost(): Error {
	return new Error(
		__( 'The connection was lost before the answer was finished.', 'ai-content-editing-assistant' )
	);
}

/**
 * The error for an answer that stopped arriving.
 *
 * @return The error.
 */
function tookTooLong(): Error {
	return new Error(
		__( 'The answer took too long, so it was stopped.', 'ai-content-editing-assistant' )
	);
}

/**
 * Reads the events of a provider's answer, with their data read from JSON.
 *
 * An event that is not JSON was cut off, so the answer ends there, with the
 * relay's message when it says why.
 *
 * @param body   The response body.
 * @param signal Stops reading when aborted.
 */
export async function* readEvents(
	body: ReadableStream< Uint8Array >,
	signal?: AbortSignal
): AsyncGenerator< AnswerEvent > {
	let cutOff = false;
	for await ( const { event, data } of readSse( body, signal ) ) {
		if ( event === RELAY_ERROR_EVENT ) {
			let message: unknown;
			try {
				message = JSON.parse( data )?.message;
			} catch {
				// Fall back to the general message below.
			}
			throw typeof message === 'string' && message ? new Error( message ) : connectionLost();
		}
		if ( cutOff ) {
			break;
		}
		let payload: unknown;
		try {
			payload = JSON.parse( data );
		} catch {
			// Wait for the next event, which may be the relay's message.
			cutOff = true;
			continue;
		}
		yield { event, data: payload };
	}
	if ( cutOff ) {
		throw connectionLost();
	}
}

/**
 * A request for the plugin's relay to send to a provider.
 */
export type RelayRequest = {
	/**
	 * The provider ID.
	 */
	provider: string;
	postId: number;
	/**
	 * The request body for the provider.
	 */
	body: unknown;
	signal: AbortSignal;
	/**
	 * Reads the message of an error response.
	 */
	readError: ( response: Response ) => Promise< string >;
};

/**
 * Sends a request through the plugin's relay, and reads the provider's
 * streamed answer as it arrives.
 *
 * When nothing arrives for `IDLE_TIMEOUT`, the answer is stopped. A lost
 * connection rejects with a message that says so. When `signal` is aborted,
 * rejects with an `AbortError`.
 *
 * @param request The request.
 */
export async function* streamFromRelay( request: RelayRequest ): AsyncGenerator< AnswerEvent > {
	const { provider, postId, body, signal, readError } = request;
	const watch = new AbortController();
	let timedOut = false;
	let timer: ReturnType< typeof setTimeout > | undefined;
	const wait = () => {
		clearTimeout( timer );
		timer = setTimeout( () => {
			timedOut = true;
			watch.abort();
		}, IDLE_TIMEOUT );
	};
	const stop = () => watch.abort();
	signal.addEventListener( 'abort', stop );
	// Why the answer stopped, when the user or the timer stopped it.
	const stopped = () => {
		if ( signal.aborted ) {
			return new DOMException( 'The answer was stopped.', 'AbortError' );
		}
		return timedOut ? tookTooLong() : null;
	};

	try {
		wait();
		let response: Response;
		try {
			response = await apiFetch< Response, false >( {
				path: '/ai-content-editing-assistant/v1/chat',
				method: 'POST',
				data: { provider, post_id: postId, stream: true, body },
				parse: false,
				signal: watch.signal,
			} );
		} catch ( error ) {
			// With `parse: false`, an error status rejects with the response itself.
			if ( error instanceof Response ) {
				throw new Error( await readError( error ) );
			}
			// apiFetch rejects with `{ code, message }` when the request fails.
			const message = ( error as { message?: unknown } )?.message;
			throw (
				stopped() ??
				new Error(
					typeof message === 'string' && message
						? message
						: __( 'The answer could not be loaded.', 'ai-content-editing-assistant' )
				)
			);
		}

		if ( ! response.body ) {
			throw new Error( __( 'The answer could not be read.', 'ai-content-editing-assistant' ) );
		}
		try {
			for await ( const event of readEvents( response.body, watch.signal ) ) {
				wait();
				yield event;
			}
		} catch ( error ) {
			// Reading fails with a `TypeError` when the connection drops.
			throw stopped() ?? ( error instanceof TypeError ? connectionLost() : error );
		}
		// Reading also ends without an error when it was stopped.
		const reason = stopped();
		if ( reason ) {
			throw reason;
		}
	} finally {
		clearTimeout( timer );
		signal.removeEventListener( 'abort', stop );
	}
}
