/**
 * WordPress dependencies
 */
import { store as blockEditorStore } from '@wordpress/block-editor';
import { getBlockTypes, store as blocksStore, type BlockType } from '@wordpress/blocks';
import { select } from '@wordpress/data';

type BlockMetadata = BlockType & {
	parent?: string[];
	ancestor?: string[];
	allowedBlocks?: string[];
};

/**
 * Describes a block from a plugin the way its `block.json` does. Local
 * attributes, such as the `blob` of an upload, are never saved, so they
 * are left out.
 *
 * @param blockType The block type.
 * @return The description.
 */
function describeBlock( blockType: BlockMetadata ) {
	const attributes = Object.fromEntries(
		Object.entries( blockType.attributes ?? {} ).filter(
			( [ , schema ] ) => ( schema as { role?: string } ).role !== 'local'
		)
	);
	return {
		name: blockType.name,
		title: blockType.title,
		parent: blockType.parent,
		ancestor: blockType.ancestor,
		allowedBlocks: blockType.allowedBlocks,
		attributes,
		supports: blockType.supports,
	};
}

/**
 * Describes the site for the model: the blocks users can insert, their
 * block styles, and the `theme.json` settings as the editor has them.
 * Core blocks are the same on every site and known to the model, so they
 * are listed by name. The skill explains how to read the rest.
 *
 * @return The site information.
 */
export function getSiteInfo(): string {
	const settings = select( blockEditorStore ).getSettings() as Record< string, unknown >;
	const allowedBlockTypes = settings.allowedBlockTypes;
	const blockTypes = ( getBlockTypes() as BlockMetadata[] )
		.filter( ( blockType ) => blockType.supports?.inserter !== false )
		.filter(
			( blockType ) =>
				allowedBlockTypes !== false &&
				( ! Array.isArray( allowedBlockTypes ) || allowedBlockTypes.includes( blockType.name ) )
		)
		.sort( ( a, b ) => a.name.localeCompare( b.name ) );

	const isCore = ( blockType: BlockType ) => blockType.name.startsWith( 'core/' );
	const { getBlockStyles } = select( blocksStore );
	const styles = Object.fromEntries(
		blockTypes.flatMap( ( { name } ) => {
			const names = ( ( getBlockStyles( name ) ?? [] ) as { name: string }[] ).map(
				( style ) => style.name
			);
			return names.length ? [ [ name, names ] ] : [];
		} )
	);
	const core = blockTypes.filter( isCore ).map( ( { name } ) => name.slice( 'core/'.length ) );
	const plugins = blockTypes.filter( ( blockType ) => ! isCore( blockType ) ).map( describeBlock );

	return [
		'## Core blocks',
		'',
		core.join( ', ' ),
		'',
		'## Blocks from plugins',
		'',
		JSON.stringify( plugins ),
		'',
		'## Block styles',
		'',
		JSON.stringify( styles ),
		'',
		'## theme.json settings',
		'',
		JSON.stringify( settings.__experimentalFeatures ?? {} ),
	].join( '\n' );
}
