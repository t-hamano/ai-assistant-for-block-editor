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
	}

	/**
	 * Whether the current user can use the AI assistant
	 *
	 * Only administrators can use it, because requests are sent with the site's API keys.
	 *
	 * @return bool
	 */
	public static function can_use() {
		return current_user_can( 'manage_options' );
	}

	/**
	 * Enqueue block editor scripts
	 */
	public function enqueue_editor_scripts() {
		if ( ! self::can_use() ) {
			return;
		}

		// The assistant needs an API key, so it is not shown at all without one.
		if ( ! Api_Key::has_any() ) {
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
}
