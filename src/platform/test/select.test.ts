/**
 * External dependencies
 */
import { beforeEach, describe, expect, it, vi } from 'vitest';

/**
 * WordPress dependencies
 */
import apiFetch from '@wordpress/api-fetch';

/**
 * Internal dependencies
 */
import { createAnthropicPlatform } from '../anthropic';
import { createFallbackPlatform } from '../fallback';
import { createGeminiPlatform } from '../gemini';
import { createOpenAiPlatform } from '../openai';
import { PROVIDERS, chooseModel, createAutoPlatform, selectPlatform } from '../select';

vi.mock( '@wordpress/api-fetch', () => ( { default: vi.fn() } ) );
vi.mock( '../anthropic', async ( importOriginal ) => ( {
	...( await importOriginal< object >() ),
	createAnthropicPlatform: vi.fn( () => ( { name: 'anthropic' } ) ),
} ) );
vi.mock( '../openai', async ( importOriginal ) => ( {
	...( await importOriginal< object >() ),
	createOpenAiPlatform: vi.fn( () => ( { name: 'openai' } ) ),
} ) );
vi.mock( '../gemini', async ( importOriginal ) => ( {
	...( await importOriginal< object >() ),
	createGeminiPlatform: vi.fn( () => ( { name: 'google' } ) ),
} ) );
vi.mock( '../fallback', () => ( {
	createFallbackPlatform: vi.fn( () => ( { name: 'fallback' } ) ),
} ) );

const [ anthropic, openai, google ] = PROVIDERS;
const getPostId = () => 1;
const NO_KEY = { code: 'ai_content_editing_assistant_no_api_key', message: 'No key.' };

const list = ( ...ids: string[] ) => ids.map( ( id ) => ( { id, name: id } ) );

/**
 * Answers the models route with a list, or an error, for each provider.
 *
 * @param answers The answer for each provider ID. Providers left out have no key.
 */
function mockModels( answers: Record< string, unknown > ) {
	vi.mocked( apiFetch ).mockImplementation( ( async ( { path }: { path: string } ) => {
		const provider = new URL( path, 'https://example.com' ).searchParams.get( 'provider' )!;
		const answer = answers[ provider ] ?? NO_KEY;
		if ( answer instanceof Error || ! Array.isArray( answer ) ) {
			throw answer;
		}
		return answer;
	} ) as never );
}

beforeEach( () => {
	vi.clearAllMocks();
} );

describe( 'chooseModel', () => {
	it( 'chooses the first recommended model in the list', () => {
		expect( chooseModel( anthropic, list( 'claude-haiku-5-5', anthropic.recommended[ 1 ] ) ) ).toBe(
			anthropic.recommended[ 1 ]
		);
	} );

	it( 'chooses another model that can chat when the recommended ones were retired', () => {
		expect( chooseModel( openai, list( 'text-embedding-3-large', 'gpt-image-2', 'gpt-7' ) ) ).toBe(
			'gpt-7'
		);
		expect( chooseModel( google, list( 'gemini-embedding-001', 'gemini-4-pro' ) ) ).toBe(
			'gemini-4-pro'
		);
	} );

	it( 'chooses the first recommended model without a list', () => {
		expect( chooseModel( google, null ) ).toBe( google.recommended[ 0 ] );
		expect( chooseModel( google, list( 'gemini-embedding-001' ) ) ).toBe( google.recommended[ 0 ] );
	} );
} );

describe( 'selectPlatform', () => {
	it( 'chooses providers in order, skipping the ones without a key', async () => {
		mockModels( { openai: list( 'gpt-7' ), google: list( 'gemini-4-pro' ) } );

		expect( await selectPlatform( getPostId ) ).toEqual( { name: 'openai' } );
		expect( createOpenAiPlatform ).toHaveBeenCalledWith( getPostId, 'gpt-7' );
		expect( createAnthropicPlatform ).not.toHaveBeenCalled();
		expect( createGeminiPlatform ).not.toHaveBeenCalled();
	} );

	it( 'uses a provider with a key whose list could not be loaded', async () => {
		mockModels( { anthropic: { code: 'ai_content_editing_assistant_provider_unreachable' } } );

		expect( await selectPlatform( getPostId ) ).toEqual( { name: 'anthropic' } );
		expect( createAnthropicPlatform ).toHaveBeenCalledWith( getPostId, anthropic.recommended[ 0 ] );
	} );

	it( 'falls back to the AI Client with the same order without a key', async () => {
		mockModels( {} );

		expect( await selectPlatform( getPostId ) ).toEqual( { name: 'fallback' } );
		const models = vi.mocked( createFallbackPlatform ).mock.calls[ 0 ][ 1 ]!;
		expect( models[ 0 ] ).toEqual( [ 'anthropic', anthropic.recommended[ 0 ] ] );
		expect( models.map( ( [ provider ] ) => provider ) ).toEqual(
			PROVIDERS.flatMap( ( provider ) => provider.recommended.map( () => provider.id ) )
		);
	} );
} );

describe( 'createAutoPlatform', () => {
	it( 'chooses once, when the first message is sent', async () => {
		const chat = vi.fn();
		vi.mocked( createGeminiPlatform ).mockReturnValue( { hasApiKey: vi.fn(), chat } );
		mockModels( { google: list( 'gemini-4-pro' ) } );

		const ai = createAutoPlatform( getPostId );
		expect( apiFetch ).not.toHaveBeenCalled();

		const request = {} as Parameters< typeof chat >[ 0 ];
		await ai.chat( request );
		await ai.chat( request );

		expect( chat ).toHaveBeenCalledTimes( 2 );
		expect( chat ).toHaveBeenCalledWith( request );
		expect( createGeminiPlatform ).toHaveBeenCalledTimes( 1 );
		expect( apiFetch ).toHaveBeenCalledTimes( 3 );
	} );
} );
