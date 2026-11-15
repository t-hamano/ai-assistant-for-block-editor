<?php
/**
 * @package AI_Content_Editing_Assistant
 */

/**
 * Tests for uninstall.php.
 */
class Test_Uninstall extends WP_UnitTestCase {

	/**
	 * Runs uninstall.php.
	 */
	private function uninstall() {
		if ( ! defined( 'WP_UNINSTALL_PLUGIN' ) ) {
			define( 'WP_UNINSTALL_PLUGIN', 'ai-content-editing-assistant/ai-content-editing-assistant.php' );
		}

		if ( function_exists( 'ai_content_editing_assistant_uninstall_site' ) ) {
			ai_content_editing_assistant_uninstall_site();
		} else {
			require dirname( __DIR__, 2 ) . '/uninstall.php';
		}
	}

	/**
	 * Tests that the cached model lists are removed, and other transients kept.
	 */
	public function test_removes_cached_models() {
		set_transient( 'ai-content-editing-assistant_models_abc', array( 'model-a' ), HOUR_IN_SECONDS );
		set_transient( 'other_plugin_models', array( 'model-b' ), HOUR_IN_SECONDS );

		$this->uninstall();
		wp_cache_flush();

		$this->assertFalse( get_option( '_transient_ai-content-editing-assistant_models_abc' ) );
		$this->assertFalse( get_option( '_transient_timeout_ai-content-editing-assistant_models_abc' ) );
		$this->assertSame( array( 'model-b' ), get_transient( 'other_plugin_models' ) );
	}

	/**
	 * Tests that only the plugin's scope of the preferences is removed.
	 */
	public function test_removes_only_the_plugin_preferences() {
		global $wpdb;

		$meta_key = $wpdb->get_blog_prefix() . 'persisted_preferences';
		$user_id  = self::factory()->user->create();

		update_user_meta(
			$user_id,
			$meta_key,
			array(
				'core'                         => array( 'fixedToolbar' => true ),
				'ai-content-editing-assistant' => array( 'model' => 'anthropic/claude' ),
				'_modified'                    => '2026-11-15T00:00:00.000Z',
			)
		);

		$this->uninstall();

		$this->assertSame(
			array(
				'core'      => array( 'fixedToolbar' => true ),
				'_modified' => '2026-11-15T00:00:00.000Z',
			),
			get_user_meta( $user_id, $meta_key, true )
		);
	}

	/**
	 * Tests that the meta is removed when nothing else is left in it.
	 */
	public function test_removes_empty_preferences() {
		global $wpdb;

		$meta_key = $wpdb->get_blog_prefix() . 'persisted_preferences';
		$user_id  = self::factory()->user->create();

		update_user_meta(
			$user_id,
			$meta_key,
			array(
				'ai-content-editing-assistant' => array( 'model' => 'anthropic/claude' ),
				'_modified'                    => '2026-11-15T00:00:00.000Z',
			)
		);

		$this->uninstall();

		$this->assertSame( array(), get_user_meta( $user_id, $meta_key ) );
	}
}
