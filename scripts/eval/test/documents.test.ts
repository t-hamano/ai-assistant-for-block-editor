// @vitest-environment jsdom

/**
 * External dependencies
 */
import fs from 'node:fs';
import path from 'node:path';
import { beforeAll, describe, expect, it, vi } from 'vitest';

/**
 * WordPress dependencies
 */
import { registerCoreBlocks } from '@wordpress/block-library';

/**
 * Internal dependencies
 */
import { findDocumentProblems } from '../runner';
import { LONG_DOCUMENT } from '../../../src/ai/document-outline';

const DIRECTORY = path.join( import.meta.dirname, '../documents' );
const documents = fs.readdirSync( DIRECTORY ).filter( ( file ) => file.endsWith( '.html' ) );

beforeAll( () => {
	// The block library complains about editor parts the tests do not use.
	vi.spyOn( console, 'warn' ).mockImplementation( () => {} );
	vi.spyOn( console, 'error' ).mockImplementation( () => {} );
	registerCoreBlocks();
	vi.restoreAllMocks();
} );

describe( 'evaluation documents', () => {
	it.each( documents )( '%s is valid block markup', ( file ) => {
		const document = fs.readFileSync( path.join( DIRECTORY, file ), 'utf8' );
		expect( findDocumentProblems( document ) ).toEqual( [] );
	} );

	it( 'has a document long enough to be sent as an outline', () => {
		const document = fs.readFileSync( path.join( DIRECTORY, 'kitchen-garden.html' ), 'utf8' );
		expect( document.length ).toBeGreaterThan( LONG_DOCUMENT );
	} );
} );
