/* eslint-disable no-console -- A command line script reports through the console. */

/**
 * External dependencies
 */
import fs from 'node:fs';
import { createRequire } from 'node:module';
import path from 'node:path';
import { parseArgs } from 'node:util';

/**
 * Internal dependencies
 */
import { PROVIDERS } from '../../src/platform/select';
import cases from './cases.json';
import { setUpSite, type EvaluationCase } from './editor';
import { getKeyVariable, setUpRelay } from './relay';
import { formatReport, type Evaluation } from './report';
import { runCase, type CaseResult } from './run-case';

const ROOT = path.resolve( import.meta.dirname, '../..' );
const { readFrontmatter } = createRequire( import.meta.url )( '../lib/block-reference.cjs' );

const USAGE = `Usage: npm run evaluate:skill -- [options]

  --provider <id>   anthropic (default), openai, or google
  --model <id>      The model. Defaults to the provider's recommended model
  --case <ids>      Only these cases, separated by commas
  --runs <n>        Runs of each case (default 1)
  --dry-run         Build the requests without sending them; no API key needed
  --output <file>   Where to save the results (default artifacts/evaluation/)
  --compare <file>  Saved results to compare with, such as from before a skill change`;

/**
 * Runs the evaluation from the command line.
 *
 * @param argv The arguments.
 * @return The exit code.
 */
export async function main( argv: string[] ): Promise< number > {
	const { values } = parseArgs( {
		args: argv,
		options: {
			provider: { type: 'string', default: 'anthropic' },
			model: { type: 'string' },
			case: { type: 'string' },
			runs: { type: 'string', default: '1' },
			'dry-run': { type: 'boolean', default: false },
			output: { type: 'string' },
			compare: { type: 'string' },
			help: { type: 'boolean', default: false },
		},
	} );
	if ( values.help ) {
		console.log( USAGE );
		return 0;
	}

	const provider = PROVIDERS.find( ( item ) => item.id === values.provider );
	const keyVariable = getKeyVariable( values.provider );
	const dryRun = values[ 'dry-run' ];
	if ( ! provider ) {
		throw new Error( `Unknown provider "${ values.provider }".` );
	}
	if ( ! dryRun && ! process.env[ keyVariable ] ) {
		console.error( `Set ${ keyVariable }, or run with --dry-run.\n\n${ USAGE }` );
		return 1;
	}
	const ids = values.case?.split( ',' ).map( ( id ) => id.trim() );
	const selected = ( cases as EvaluationCase[] ).filter(
		( item ) => ! ids || ids.includes( item.id )
	);
	if ( ! selected.length ) {
		console.error( `No case matches "${ values.case }".` );
		return 1;
	}

	const model = values.model ?? provider.recommended[ 0 ];
	const runs = Math.max( 1, Number.parseInt( values.runs, 10 ) || 1 );
	setUpSite();
	let requestBytes = 0;
	setUpRelay( {
		dryRun,
		onDryRun: ( data ) => {
			requestBytes = JSON.stringify( data.body ).length;
		},
	} );
	const platform = provider.create( () => 1, model );

	const results: CaseResult[] = [];
	for ( const evaluationCase of selected ) {
		for ( let run = 1; run <= runs; run++ ) {
			const result = await runCase( evaluationCase, platform );
			results.push( result );
			const label = runs > 1 ? `${ result.id } #${ run }` : result.id;
			const details = dryRun
				? `request ${ requestBytes } bytes (system ${ result.requestSize.system }, message ${ result.requestSize.message } characters)`
				: `${ result.outcome }, ${ result.applied } applied, ${ result.failed } failed, ${ result.seconds.toFixed( 1 ) }s`;
			console.log( `${ result.firstTry ? '✓' : '·' } ${ label }: ${ details }` );
		}
	}
	if ( dryRun ) {
		console.log(
			`\nBuilt ${ results.length } requests for ${ provider.id } ${ model }. Nothing was sent.`
		);
		return 0;
	}

	const skill = readFrontmatter(
		fs.readFileSync( path.join( ROOT, 'skills/block-markup/SKILL.md' ), 'utf8' )
	);
	const evaluation: Evaluation = {
		provider: provider.id,
		model,
		skill,
		date: new Date().toISOString(),
		results,
	};
	const output =
		values.output ??
		path.join(
			ROOT,
			'artifacts/evaluation',
			`${ evaluation.date.replace( /[:.]/g, '-' ) }-${ provider.id }-${ model }.json`
		);
	fs.mkdirSync( path.dirname( output ), { recursive: true } );
	fs.writeFileSync( output, JSON.stringify( evaluation, null, '\t' ) + '\n' );

	const before = values.compare
		? ( JSON.parse( fs.readFileSync( values.compare, 'utf8' ) ) as Evaluation )
		: undefined;
	console.log(
		`\n${ formatReport( evaluation, before ) }\n\nSaved to ${ path.relative( process.cwd(), output ) }.`
	);
	return 0;
}
