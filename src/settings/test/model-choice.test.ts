/**
 * External dependencies
 */
import { describe, expect, it } from 'vitest';

/**
 * Internal dependencies
 */
import { readModelChoice } from '../model-choice';

describe( 'readModelChoice', () => {
	it( 'reads the saved provider and model', () => {
		const get = ( scope: string, name: string ) =>
			scope === 'ai-content-editing-assistant' && name === 'model'
				? { provider: 'openai', model: 'gpt-7' }
				: undefined;
		expect( readModelChoice( get ) ).toEqual( { provider: 'openai', model: 'gpt-7' } );
	} );

	it( 'chooses automatically without a valid saved choice', () => {
		expect( readModelChoice( () => undefined ) ).toBeNull();
		expect( readModelChoice( () => null ) ).toBeNull();
		expect( readModelChoice( () => ( { provider: 'openai' } ) ) ).toBeNull();
	} );
} );
