/**
 * WordPress dependencies
 */
import apiFetch from '@wordpress/api-fetch';

/**
 * Internal dependencies
 */
import type { AiPlatform } from '.';
import { ANTHROPIC_MODEL, createAnthropicPlatform } from './anthropic';
import { createFallbackPlatform } from './fallback';
import { GEMINI_MODEL, createGeminiPlatform } from './gemini';
import { OPENAI_MODEL, createOpenAiPlatform } from './openai';

/**
 * A provider the plugin streams answers from.
 */
type Provider = {
	/**
	 * The provider ID, as the AI Client and the relay name it.
	 */
	id: string;
	/**
	 * The models to use, best first.
	 */
	recommended: string[];
	/**
	 * Whether a model from the provider's list can chat, for when none of
	 * the recommended models is in it. Older models are left out, because
	 * they cannot write as many tokens as the adapters ask for.
	 */
	canChat: ( model: string ) => boolean;
	create: ( getPostId: () => number, model: string ) => AiPlatform;
};

/**
 * The providers in the order they are chosen in.
 */
export const PROVIDERS: Provider[] = [
	{
		id: 'anthropic',
		recommended: [ ANTHROPIC_MODEL, 'claude-opus-5', 'claude-sonnet-5-5' ],
		canChat: ( model ) => /^claude-(?:opus|sonnet)-(?:[4-9]|\d{2,})/.test( model ),
		create: createAnthropicPlatform,
	},
	{
		id: 'openai',
		recommended: [ OPENAI_MODEL, 'gpt-5' ],
		// OpenAI also lists models for images, audio, and search.
		canChat: ( model ) =>
			/^gpt-(?:[5-9]|\d{2,})/.test( model ) &&
			! /image|audio|realtime|tts|transcribe|search/.test( model ),
		create: createOpenAiPlatform,
	},
	{
		id: 'google',
		recommended: [ GEMINI_MODEL, 'gemini-2.5-pro' ],
		canChat: ( model ) =>
			/^gemini-(?:2\.5|[3-9]|\d{2,})/.test( model ) &&
			! /image|audio|tts|embedding|live/.test( model ),
		create: createGeminiPlatform,
	},
];

/**
 * A model from a provider's model list.
 */
export type Model = { id: string; name: string };

/**
 * Chooses the model of a provider: the first recommended model in its
 * list, or when they were all retired, the first other model in the list
 * that can chat.
 *
 * @param provider The provider.
 * @param models   The provider's models, or `null` when the list could not
 *                 be loaded.
 * @return The model ID.
 */
export function chooseModel( provider: Provider, models: Model[] | null ): string {
	if ( ! models ) {
		return provider.recommended[ 0 ];
	}
	const ids = models.map( ( model ) => model.id );
	return (
		provider.recommended.find( ( model ) => ids.includes( model ) ) ??
		ids.find( provider.canChat ) ??
		provider.recommended[ 0 ]
	);
}

/**
 * Loads a provider's models.
 *
 * @param  provider The provider ID.
 * @return The models; `null` when the provider could not list them, or
 *         `false` when the provider has no API key.
 * @throws {Error} When the request did not reach the plugin, so it is not known
 *                 whether the provider has a key.
 */
async function loadModels( provider: string ): Promise< Model[] | null | false > {
	try {
		return await apiFetch< Model[] >( {
			path: `/ai-content-editing-assistant/v1/models?provider=${ provider }`,
		} );
	} catch ( error ) {
		// The route answers this when the provider has no key in Connectors.
		const code = ( error as { code?: unknown } )?.code;
		if ( code === 'ai_content_editing_assistant_no_api_key' ) {
			return false;
		}
		// The plugin's other errors mean the provider has a key but did not answer.
		if ( typeof code === 'string' && code.startsWith( 'ai_content_editing_assistant_' ) ) {
			return null;
		}
		throw error;
	}
}

/**
 * Chooses how the assistant answers: from the first provider in
 * `PROVIDERS` that has an API key, with its model from `chooseModel()`.
 * Without any of them, the answer comes through the AI Client, which is
 * given the same order to choose from.
 *
 * @param getPostId Returns the ID of the post being edited.
 * @return The connection.
 */
export async function selectPlatform( getPostId: () => number ): Promise< AiPlatform > {
	for ( const provider of PROVIDERS ) {
		const models = await loadModels( provider.id );
		if ( models !== false ) {
			return provider.create( getPostId, chooseModel( provider, models ) );
		}
	}
	return createFallbackPlatform(
		getPostId,
		PROVIDERS.flatMap( ( provider ) =>
			provider.recommended.map( ( model ): [ string, string ] => [ provider.id, model ] )
		)
	);
}

/**
 * Connects the AI assistant to the provider and model `selectPlatform()`
 * chooses. The choice is made when the first message is sent, and kept.
 * When it could not be made, the next message tries again.
 *
 * @param getPostId Returns the ID of the post being edited.
 * @return The connection.
 */
export function createAutoPlatform( getPostId: () => number ): AiPlatform {
	let platform: Promise< AiPlatform > | undefined;
	return {
		// The sidebar only loads when the site can answer.
		hasApiKey: async () => true,
		async chat( request ) {
			platform ??= selectPlatform( getPostId ).catch( ( error ) => {
				platform = undefined;
				throw error;
			} );
			return ( await platform ).chat( request );
		},
	};
}
