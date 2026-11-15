/**
 * WordPress dependencies
 */
import apiFetch from '@wordpress/api-fetch';

/**
 * Internal dependencies
 */
import { DryRun } from './run-case';

/**
 * Where the plugin's relay sends each provider's streamed requests, and the
 * header with the key, as in `classes/class-relay.php`.
 */
const PROVIDERS: Record<
	string,
	{ url: string; env: string; headers: ( key: string ) => Record< string, string > }
> = {
	anthropic: {
		url: 'https://api.anthropic.com/v1/messages',
		env: 'ANTHROPIC_API_KEY',
		headers: ( key ) => ( { 'x-api-key': key, 'anthropic-version': '2023-06-01' } ),
	},
	openai: {
		url: 'https://api.openai.com/v1/responses',
		env: 'OPENAI_API_KEY',
		headers: ( key ) => ( { authorization: `Bearer ${ key }` } ),
	},
	google: {
		url: 'https://generativelanguage.googleapis.com/v1beta/models/{model}:streamGenerateContent?alt=sse',
		env: 'GEMINI_API_KEY',
		headers: ( key ) => ( { 'x-goog-api-key': key } ),
	},
};

/**
 * The environment variable with the API key of a provider.
 *
 * @param provider The provider ID.
 * @return The variable's name.
 */
export function getKeyVariable( provider: string ): string {
	const found = PROVIDERS[ provider ];
	if ( ! found ) {
		throw new Error(
			`Unknown provider "${ provider }". Use one of ${ Object.keys( PROVIDERS ).join( ', ' ) }.`
		);
	}
	return found.env;
}

type ChatData = { provider: string; stream: boolean; body: Record< string, unknown > };

/**
 * Answers the platforms' requests to the plugin's relay the way the relay
 * does, with the key from the environment, so the evaluation runs the
 * platforms as the editor does, without WordPress.
 *
 * In a dry run, nothing is sent: each request is passed to `onDryRun`, and
 * the answer fails with `DryRun`.
 *
 * @param options          Options.
 * @param options.dryRun   Whether to send nothing.
 * @param options.onDryRun Receives each request that would be sent.
 */
export function setUpRelay( {
	dryRun,
	onDryRun,
}: {
	dryRun: boolean;
	onDryRun?: ( data: ChatData ) => void;
} ) {
	apiFetch.setFetchHandler( async ( options ) => {
		const data = options.data as ChatData;
		if ( dryRun ) {
			onDryRun?.( data );
			throw new DryRun( 'The request was not sent.' );
		}
		const provider = PROVIDERS[ data.provider ];
		const key = process.env[ getKeyVariable( data.provider ) ];
		if ( ! key ) {
			throw new Error( `Set ${ provider.env } to send requests to ${ data.provider }.` );
		}

		const { model, ...rest } = data.body;
		const isGoogle = data.provider === 'google';
		const body = isGoogle ? rest : { ...data.body, stream: data.stream };
		const response = await fetch( provider.url.replace( '{model}', String( model ) ), {
			method: 'POST',
			headers: { 'content-type': 'application/json', ...provider.headers( key ) },
			body: JSON.stringify( body ),
			signal: options.signal,
		} );
		// The platforms read an error status from the response apiFetch rejects with.
		if ( ! response.ok ) {
			throw response;
		}
		return response;
	} );
}
