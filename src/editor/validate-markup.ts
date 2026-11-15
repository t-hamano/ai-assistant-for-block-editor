/**
 * WordPress dependencies
 */
import { parse as parseRaw } from '@wordpress/block-serialization-default-parser';
import {
	createBlock,
	getBlockAttributes,
	getBlockType,
	getFreeformContentHandlerName,
	getUnregisteredTypeHandlerName,
	parse,
	serialize,
	serializeRawBlock,
	validateBlock,
	type Block,
	type BlockType,
} from '@wordpress/blocks';

type RawBlock = ReturnType< typeof parseRaw >[ number ];

type AttributeSchema = { type?: string | string[]; enum?: unknown[]; source?: string };

/**
 * Whether the value has one of the types, as the parser checks them. A
 * value of the wrong type is dropped.
 *
 * @param value The value.
 * @param type  The attribute's type, or types.
 * @return Whether it does.
 */
function hasType( value: unknown, type: AttributeSchema[ 'type' ] ): boolean {
	if ( type === undefined ) {
		return true;
	}
	return ( Array.isArray( type ) ? type : [ type ] ).some( ( item ) => {
		switch ( item ) {
			case 'null':
				return value === null;
			case 'boolean':
			case 'string':
			case 'number':
				return typeof value === item;
			case 'integer':
				return Number.isInteger( value );
			case 'array':
				return Array.isArray( value );
			case 'object':
				return value !== null && typeof value === 'object' && ! Array.isArray( value );
			default:
				return true;
		}
	} );
}

/**
 * Whether the attribute takes the value.
 *
 * @param schema The attribute.
 * @param value  The value.
 * @return Whether it does.
 */
function accepts( schema: AttributeSchema, value: unknown ): boolean {
	return (
		hasType( value, schema.type ) &&
		( ! Array.isArray( schema.enum ) || schema.enum.includes( value ) )
	);
}

/**
 * What became of the markup the model wrote.
 */
export type MarkupValidation = {
	/**
	 * The parsed blocks. Blocks written in a deprecated form are in their
	 * migrated form.
	 */
	blocks: Block[];
	/**
	 * What is wrong with the markup, to tell the model. Empty when the
	 * blocks can be applied.
	 */
	problems: string[];
	/**
	 * What the automatic fix changed, to tell the model, when the markup
	 * was fixed. `blocks` are then the fixed blocks.
	 */
	autoFix?: string;
};

/**
 * Formats a validation message, which the parser logs like the console
 * does: a format string whose `%s`, `%o` placeholders take the arguments
 * that follow.
 *
 * @param args The logged arguments.
 * @return The message.
 */
function formatIssue( args: unknown[] ): string {
	const show = ( value: unknown ) =>
		typeof value === 'object' ? JSON.stringify( value ) : String( value );
	const rest = args.slice( 1 );
	return String( args[ 0 ] ?? '' ).replace( /%[sodif]/g, ( placeholder ) =>
		rest.length ? show( rest.shift() ) : placeholder
	);
}

/**
 * The block's markup as its `save` writes it from the attributes the parser
 * read, with its inner blocks written the same way.
 *
 * @param block The parsed block.
 * @return The markup.
 */
function toSavedMarkup( block: Block ): string {
	const asValid = ( item: Block ): Block => ( {
		...item,
		isValid: true,
		innerBlocks: item.innerBlocks.map( asValid ),
	} );
	return serialize( asValid( block ) );
}

/**
 * The keys of a deprecation that replace the block type's, as the parser
 * applies them.
 */
const DEPRECATION_KEYS = [
	'attributes',
	'supports',
	'save',
	'migrate',
	'isEligible',
	'apiVersion',
];

/**
 * Finds the attributes of the version the parser reads the block with: the
 * current one, or the first deprecated one whose `save` matches the HTML.
 *
 * @param raw       The block, from the default parser.
 * @param blockType The block type.
 * @return The version's attributes.
 */
function getParsingAttributes(
	raw: RawBlock,
	blockType: BlockType
): Record< string, AttributeSchema > {
	const current = ( blockType.attributes ?? {} ) as Record< string, AttributeSchema >;
	if ( ! blockType.deprecated?.length ) {
		return current;
	}
	const innerBlocks = parse(
		raw.innerBlocks
			// Both parsers give the same shape, typed apart.
			.map( ( inner ) => serializeRawBlock( inner as Parameters< typeof serializeRawBlock >[ 0 ] ) )
			.join( '' )
	);
	const matches = ( version: BlockType ) =>
		validateBlock(
			{
				clientId: '',
				name: blockType.name,
				isValid: true,
				attributes: getBlockAttributes( version, raw.innerHTML, raw.attrs ?? {} ),
				innerBlocks,
				originalContent: raw.innerHTML,
			},
			version
		)[ 0 ];
	if ( matches( blockType ) ) {
		return current;
	}
	const base = Object.fromEntries(
		Object.entries( blockType ).filter( ( [ key ] ) => ! DEPRECATION_KEYS.includes( key ) )
	);
	for ( const deprecation of blockType.deprecated ) {
		const version = { ...base, ...deprecation } as BlockType;
		if ( matches( version ) ) {
			return ( version.attributes ?? {} ) as Record< string, AttributeSchema >;
		}
	}
	// The HTML matches no version, which the parsed block reports.
	return current;
}

/**
 * Checks the attributes in a block's comment against the version the parser
 * reads it with, since the parser drops without a word what that version
 * does not take.
 *
 * @param raw The block, from the default parser.
 * @return The problems.
 */
function checkAttributes( raw: RawBlock ): string[] {
	const name = raw.blockName as string;
	const blockType = getBlockType( name );
	if ( ! blockType ) {
		return [];
	}
	const schemas = getParsingAttributes( raw, blockType );
	const problems: string[] = [];
	for ( const [ key, value ] of Object.entries( raw.attrs ?? {} ) ) {
		const schema = schemas[ key ];
		if ( ! schema ) {
			problems.push( `"${ key }" is not an attribute of the ${ name } block.` );
		} else if ( schema.source ) {
			problems.push(
				`The "${ key }" attribute of the ${ name } block is read from its HTML, so do not put it in the block comment. Write it in the HTML.`
			);
		} else if ( ! accepts( schema, value ) ) {
			const expected = Array.isArray( schema.enum )
				? `Use one of: ${ schema.enum.map( ( item ) => JSON.stringify( item ) ).join( ', ' ) }.`
				: `Use a value of type ${ [ schema.type ].flat().join( ' or ' ) }.`;
			problems.push(
				`${ JSON.stringify( value ) } is not a value of the "${ key }" attribute of the ${ name } block. ${ expected }`
			);
		}
	}
	if ( problems.length ) {
		const names = Object.entries( schemas )
			.filter( ( [ , schema ] ) => ! schema.source )
			.map( ( [ key ] ) => key );
		problems.push( `The ${ name } block has these attributes: ${ names.join( ', ' ) }.` );
	}
	return problems;
}

/**
 * Checks the blocks as the model wrote them: their names, their attributes,
 * HTML outside blocks, and what `core/html` holds.
 *
 * @param rawBlocks    The blocks, from the default parser.
 * @param existingHtml The content of the `core/html` blocks in the
 *                     document, which the model may keep.
 * @param isTopLevel   Whether the blocks are at the top of the markup.
 * @return The problems.
 */
function checkRawBlocks(
	rawBlocks: RawBlock[],
	existingHtml: Set< string >,
	isTopLevel: boolean
): string[] {
	return rawBlocks.flatMap( ( raw ) => {
		if ( ! raw.blockName ) {
			const html = raw.innerHTML.trim();
			// Only the top level has HTML outside blocks: inside a block, it
			// belongs to the block.
			return isTopLevel && html
				? [
						`This HTML is not in a block, so it would become a Classic block: ${ html.slice(
							0,
							200
						) }. Wrap the content in block comment delimiters.`,
					]
				: [];
		}
		const name = raw.blockName;
		if ( ! getBlockType( name ) ) {
			return [ `The ${ name } block is not registered on this site. Use a registered block.` ];
		}
		const problems = checkAttributes( raw );
		if ( name === 'core/html' ) {
			const html = raw.innerHTML.trim();
			// Only the user writes custom HTML, so that instructions in the
			// document cannot make the model add scripts to the site.
			if ( html && ! existingHtml.has( html ) ) {
				problems.push(
					'You cannot write core/html blocks, and core/html blocks in the document must be kept exactly as they are. Write the content as core blocks, such as core/paragraph, core/heading, core/list, core/image, and core/group. When the user needs custom HTML, tell them to add or edit it themselves.'
				);
			}
		}
		return [ ...problems, ...checkRawBlocks( raw.innerBlocks, existingHtml, false ) ];
	} );
}

/**
 * Checks that the blocks' HTML is what their `save` writes from their
 * attributes, and tells the model the markup that would be.
 *
 * @param blocks The parsed blocks.
 * @return The problems.
 */
function checkParsedBlocks( blocks: Block[] ): string[] {
	const fallbacks = [ getFreeformContentHandlerName(), getUnregisteredTypeHandlerName() ];
	return blocks.flatMap( ( block ) => {
		// The model's markup checks report these already.
		if ( fallbacks.includes( block.name ) ) {
			return [];
		}
		if ( block.isValid === false ) {
			const issues = ( block.validationIssues ?? [] )
				.map( ( issue: { args?: unknown[] } ) => formatIssue( issue.args ?? [] ) )
				.filter( ( issue: string ) => issue && ! issue.startsWith( 'Block validation failed' ) );
			return [
				[
					`The HTML of this ${ block.name } block does not match its attributes${
						issues.length ? `: ${ issues.join( ' ' ) }` : '.'
					}`,
					block.originalContent ?? '',
					'With the same attributes, the block is written as:',
					toSavedMarkup( block ),
				].join( '\n' ),
			];
		}
		return checkParsedBlocks( block.innerBlocks );
	} );
}

/**
 * Validates the block markup the model wrote, including nested blocks, as
 * the editor would read it.
 *
 * @param markup       The markup.
 * @param existingHtml The content of the `core/html` blocks in the
 *                     document, which the model may keep as it is.
 * @return The parsed blocks, and the problems to tell the model.
 */
export function validateMarkup(
	markup: string,
	existingHtml: Set< string > = new Set()
): MarkupValidation {
	const blocks = parse( markup );
	const rawProblems = checkRawBlocks( parseRaw( markup ), existingHtml, true );
	const problems = [ ...rawProblems, ...checkParsedBlocks( blocks ) ];
	// Only HTML that drifted from what the attributes write is fixed: an
	// unknown block or attribute, HTML outside blocks, or core/html is
	// always for the model to fix.
	if ( ! problems.length || rawProblems.length ) {
		return { blocks, problems };
	}
	return autoFix( markup, blocks, existingHtml ) ?? { blocks, problems };
}

/**
 * The text of the markup, without its tags, comments, and the whitespace
 * between them.
 *
 * @param markup The markup.
 * @return The text.
 */
function toText( markup: string ): string {
	return markup
		.replace( /<!--[\s\S]*?-->/g, ' ' )
		.replace( /<[^>]*>/g, ' ' )
		.replace( /\s+/g, ' ' )
		.trim();
}

/**
 * Rebuilds the blocks whose HTML does not match their attributes from the
 * attributes the parser read, as their `save` writes them.
 *
 * @param blocks  The parsed blocks.
 * @param changes Collects the rebuilt blocks, before and after.
 * @return The blocks, rebuilt where needed.
 */
function rebuild( blocks: Block[], changes: string[] ): Block[] {
	return blocks.map( ( block ) => {
		const innerBlocks = rebuild( block.innerBlocks, changes );
		if ( block.isValid !== false ) {
			return innerBlocks === block.innerBlocks ? block : { ...block, innerBlocks };
		}
		const fixed = createBlock( block.name, block.attributes, innerBlocks );
		changes.push(
			[ 'Before:', block.originalContent ?? '', 'After:', serialize( fixed ) ].join( '\n' )
		);
		return fixed;
	} );
}

/**
 * Fixes markup whose only problem is HTML that drifted from what the
 * blocks' attributes write. The fix is used only when it keeps the text and
 * the fixed markup passes every check.
 *
 * @param markup       The model's markup.
 * @param blocks       Its parsed blocks.
 * @param existingHtml The content of the `core/html` blocks in the document.
 * @return The fixed blocks, and what changed, or nothing.
 */
function autoFix(
	markup: string,
	blocks: Block[],
	existingHtml: Set< string >
): MarkupValidation | undefined {
	const changes: string[] = [];
	const fixedMarkup = serialize( rebuild( blocks, changes ) );
	if ( toText( fixedMarkup ) !== toText( markup ) ) {
		return undefined;
	}
	const fixed = parse( fixedMarkup );
	const problems = [
		...checkRawBlocks( parseRaw( fixedMarkup ), existingHtml, true ),
		...checkParsedBlocks( fixed ),
	];
	if ( problems.length ) {
		return undefined;
	}
	return {
		blocks: fixed,
		problems: [],
		autoFix: [
			'The HTML of some blocks did not match their attributes, so it was fixed automatically. Write blocks as the fixed markup does in later edits.',
			...changes,
		].join( '\n' ),
	};
}

/**
 * Collects the content of the `core/html` blocks among the blocks.
 *
 * @param blocks The blocks.
 * @return The content.
 */
export function collectHtml( blocks: Block[] ): Set< string > {
	const html = new Set< string >();
	const visit = ( items: Block[] ) =>
		items.forEach( ( block ) => {
			if ( block.name === 'core/html' && typeof block.attributes.content === 'string' ) {
				html.add( block.attributes.content.trim() );
			}
			visit( block.innerBlocks );
		} );
	visit( blocks );
	return html;
}
