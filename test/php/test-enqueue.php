<?php
/**
 * @package AI_Content_Editing_Assistant
 */

use AI_Content_Editing_Assistant\Enqueue;

/**
 * Tests for the Enqueue class.
 */
class Test_Enqueue extends WP_UnitTestCase {

	use AI_Content_Editing_Assistant_Fake_Api_Key;

	/**
	 * Removes the script and style enqueued by a test.
	 */
	public function tear_down() {
		$this->set_fake_api_key( '' );
		wp_dequeue_script( AI_CONTENT_EDITING_ASSISTANT_NAMESPACE );
		wp_deregister_script( AI_CONTENT_EDITING_ASSISTANT_NAMESPACE );
		wp_dequeue_style( AI_CONTENT_EDITING_ASSISTANT_NAMESPACE );
		wp_deregister_style( AI_CONTENT_EDITING_ASSISTANT_NAMESPACE );

		parent::tear_down();
	}

	/**
	 * Tests that the script and style are not enqueued for editors.
	 */
	public function test_script_is_not_enqueued_for_editor() {
		wp_set_current_user( self::factory()->user->create( array( 'role' => 'editor' ) ) );

		( new Enqueue() )->enqueue_editor_scripts();

		$this->assertFalse( wp_script_is( AI_CONTENT_EDITING_ASSISTANT_NAMESPACE ) );
		$this->assertFalse( wp_style_is( AI_CONTENT_EDITING_ASSISTANT_NAMESPACE ) );
	}

	/**
	 * Tests that the script and style are enqueued for administrators.
	 */
	public function test_script_is_enqueued_for_administrator() {
		if ( ! file_exists( AI_CONTENT_EDITING_ASSISTANT_PATH . '/build/index.asset.php' ) ) {
			$this->markTestSkipped( 'The script is only enqueued when the plugin is built.' );
		}

		$this->set_fake_api_key( 'test-key' );
		wp_set_current_user( self::factory()->user->create( array( 'role' => 'administrator' ) ) );

		( new Enqueue() )->enqueue_editor_scripts();

		$this->assertTrue( wp_script_is( AI_CONTENT_EDITING_ASSISTANT_NAMESPACE ) );
		$this->assertTrue( wp_style_is( AI_CONTENT_EDITING_ASSISTANT_NAMESPACE ) );
	}

	/**
	 * Tests that the script and style are not enqueued when no provider has an API key.
	 */
	public function test_script_is_not_enqueued_without_api_key() {
		wp_set_current_user( self::factory()->user->create( array( 'role' => 'administrator' ) ) );

		( new Enqueue() )->enqueue_editor_scripts();

		$this->assertFalse( wp_script_is( AI_CONTENT_EDITING_ASSISTANT_NAMESPACE ) );
		$this->assertFalse( wp_style_is( AI_CONTENT_EDITING_ASSISTANT_NAMESPACE ) );
	}
}
