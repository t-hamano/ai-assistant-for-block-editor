/**
 * External dependencies
 */
import { describe, expect, it } from 'vitest';

/**
 * Internal dependencies
 */
import { buildSystemPrompt } from '../prompt';

describe( 'buildSystemPrompt', () => {
	it( 'leaves the document out, so the prompt stays the same as it changes', () => {
		const prompt = buildSystemPrompt( '# Title\n\nOne.\n' );
		expect( prompt ).not.toContain( 'One.' );
		expect( prompt ).toBe( buildSystemPrompt( '# Other\n' ) );
	} );

	it( 'explains the context that comes with the messages', () => {
		const prompt = buildSystemPrompt( '# Title\n' );
		expect( prompt ).toContain( '<document>' );
		expect( prompt ).toContain( '<selection>' );
	} );

	it( 'covers editing with and without a selection', () => {
		const prompt = buildSystemPrompt( '# Title\n' );
		expect( prompt ).toContain( 'When there is a selection, edit it' );
		expect( prompt ).toContain( 'When nothing is selected' );
	} );

	it( 'asks for answers only when the document is not available', () => {
		const prompt = buildSystemPrompt( null );
		expect( prompt ).toContain( 'you cannot edit it' );
		expect( prompt ).not.toContain( '<document' );
	} );
} );
