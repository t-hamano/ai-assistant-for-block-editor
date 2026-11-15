<?php
/**
 * @package AI_Content_Editing_Assistant
 * @author Aki Hamano
 * @license GPL-2.0+
 */

namespace AI_Content_Editing_Assistant;

class Enqueue {

	/**
	 * Constructor
	 */
	public function __construct() {
		add_action( 'enqueue_block_editor_assets', array( $this, 'enqueue_editor_scripts' ) );
		add_action( 'enqueue_block_assets', array( $this, 'enqueue_canvas_styles' ) );
	}

	/**
	 * Enqueue block editor scripts
	 */
	public function enqueue_editor_scripts() {
		// Only administrators can use the assistant, because requests are sent with
		// the site's API keys. It needs an API key, so it is not shown without one.
		if ( ! current_user_can( 'manage_options' ) || ! Api_Key::has_any() ) {
			return;
		}

		// The widgets editor and the customizer have no editor sidebar.
		if ( wp_script_is( 'wp-edit-widgets' ) || wp_script_is( 'wp-customize-widgets' ) ) {
			return;
		}

		$asset_path = AI_CONTENT_EDITING_ASSISTANT_PATH . '/build/index.asset.php';

		if ( ! file_exists( $asset_path ) ) {
			return;
		}

		$asset_file = include $asset_path;

		wp_enqueue_script(
			AI_CONTENT_EDITING_ASSISTANT_NAMESPACE,
			AI_CONTENT_EDITING_ASSISTANT_URL . '/build/index.js',
			$asset_file['dependencies'],
			$asset_file['version'],
			array( 'in_footer' => true )
		);

		wp_set_script_translations( AI_CONTENT_EDITING_ASSISTANT_NAMESPACE, AI_CONTENT_EDITING_ASSISTANT_NAMESPACE );

		wp_enqueue_style(
			AI_CONTENT_EDITING_ASSISTANT_NAMESPACE,
			AI_CONTENT_EDITING_ASSISTANT_URL . '/build/style-index.css',
			array(),
			$asset_file['version']
		);
		wp_style_add_data( AI_CONTENT_EDITING_ASSISTANT_NAMESPACE, 'rtl', 'replace' );
	}

	/**
	 * Enqueue the styles for the blocks in the editor canvas
	 *
	 * They are loaded on `enqueue_block_assets` so that they reach the canvas
	 * iframe. That hook also runs on the front end, where they are not needed.
	 */
	public function enqueue_canvas_styles() {
		if ( ! is_admin() || ! current_user_can( 'manage_options' ) || ! Api_Key::has_any() ) {
			return;
		}

		$asset_path = AI_CONTENT_EDITING_ASSISTANT_PATH . '/build/index.asset.php';

		if ( ! file_exists( $asset_path ) || ! file_exists( AI_CONTENT_EDITING_ASSISTANT_PATH . '/build/index.css' ) ) {
			return;
		}

		$asset_file = include $asset_path;
		$handle     = AI_CONTENT_EDITING_ASSISTANT_NAMESPACE . '-canvas';

		wp_enqueue_style(
			$handle,
			AI_CONTENT_EDITING_ASSISTANT_URL . '/build/index.css',
			array(),
			$asset_file['version']
		);
		wp_style_add_data( $handle, 'rtl', 'replace' );
	}
}
