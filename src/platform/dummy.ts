/**
 * Internal dependencies
 */
import type { AiPlatform } from '.';

/**
 * The fixed answer, with the Markdown elements the chat shows.
 */
export const DUMMY_ANSWER = [
	'This is a **sample answer**. The AI Assistant is not connected to a model yet, so every message gets this answer.',
	'',
	'### What the chat can show',
	'',
	'- *Emphasis*, **bold text**, and `inline code`',
	'- Lists and tables',
	'- Code blocks',
	'',
	'| Element | Shown |',
	'| --- | --- |',
	'| Table | Yes |',
	'',
	'```html',
	'<!-- wp:paragraph -->',
	'<p>Hello, world!</p>',
	'<!-- /wp:paragraph -->',
	'```',
].join( '\n' );

/**
 * How many characters each piece of the answer has, and how long to wait
 * between pieces, so the answer streams in like a real one.
 */
const CHUNK_SIZE = 8;
const CHUNK_DELAY = 20;

/**
 * Waits for the given time, or rejects with an `AbortError` when the signal
 * is aborted first.
 *
 * @param ms     The time to wait, in milliseconds.
 * @param signal Aborted when the user stops the answer.
 */
function wait( ms: number, signal: AbortSignal ): Promise< void > {
	return new Promise( ( resolve, reject ) => {
		if ( signal.aborted ) {
			reject( new DOMException( 'Aborted', 'AbortError' ) );
			return;
		}
		const timer = setTimeout( () => {
			signal.removeEventListener( 'abort', onAbort );
			resolve();
		}, ms );
		const onAbort = () => {
			clearTimeout( timer );
			reject( new DOMException( 'Aborted', 'AbortError' ) );
		};
		signal.addEventListener( 'abort', onAbort, { once: true } );
	} );
}

/**
 * Creates a stand-in for the connection to the model, so the chat works
 * before the real one exists. It streams a fixed answer and makes no
 * requests.
 *
 * @return The stand-in.
 */
export function createDummyPlatform(): AiPlatform {
	return {
		hasApiKey: async () => true,
		async chat( { signal, onEvent } ) {
			onEvent( { type: 'activity', activity: 'thinking' } );
			await wait( CHUNK_DELAY * 10, signal );
			for ( let start = 0; start < DUMMY_ANSWER.length; start += CHUNK_SIZE ) {
				await wait( CHUNK_DELAY, signal );
				onEvent( {
					type: 'text',
					text: DUMMY_ANSWER.slice( start, start + CHUNK_SIZE ),
				} );
			}
		},
	};
}
