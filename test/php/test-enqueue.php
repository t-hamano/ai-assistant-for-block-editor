<?php
/**
 * @package AI_Assistant_For_Block_Editor
 */

use AI_Assistant_For_Block_Editor\Enqueue;

/**
 * Tests for the Enqueue class.
 */
class Test_Enqueue extends WP_UnitTestCase {

	use AABE_Fake_Api_Key;

	/**
	 * Removes the script and style enqueued by a test.
	 */
	public function tear_down() {
		$this->set_fake_api_key( '' );
		wp_dequeue_script( AABE_NAMESPACE );
		wp_deregister_script( AABE_NAMESPACE );
		wp_dequeue_style( AABE_NAMESPACE );
		wp_deregister_style( AABE_NAMESPACE );

		parent::tear_down();
	}

	/**
	 * Tests that administrators can use the AI assistant.
	 */
	public function test_administrator_can_use() {
		wp_set_current_user( self::factory()->user->create( array( 'role' => 'administrator' ) ) );

		$this->assertTrue( Enqueue::can_use() );
	}

	/**
	 * Tests that editors cannot use the AI assistant.
	 */
	public function test_editor_cannot_use() {
		wp_set_current_user( self::factory()->user->create( array( 'role' => 'editor' ) ) );

		$this->assertFalse( Enqueue::can_use() );
	}

	/**
	 * Tests that the script and style are not enqueued for editors.
	 */
	public function test_script_is_not_enqueued_for_editor() {
		wp_set_current_user( self::factory()->user->create( array( 'role' => 'editor' ) ) );

		( new Enqueue() )->enqueue_editor_scripts();

		$this->assertFalse( wp_script_is( AABE_NAMESPACE ) );
		$this->assertFalse( wp_style_is( AABE_NAMESPACE ) );
	}

	/**
	 * Tests that the script and style are enqueued for administrators.
	 */
	public function test_script_is_enqueued_for_administrator() {
		if ( ! file_exists( AABE_PATH . '/build/index.asset.php' ) ) {
			$this->markTestSkipped( 'The script is only enqueued when the plugin is built.' );
		}

		$this->set_fake_api_key( 'test-key' );
		wp_set_current_user( self::factory()->user->create( array( 'role' => 'administrator' ) ) );

		( new Enqueue() )->enqueue_editor_scripts();

		$this->assertTrue( wp_script_is( AABE_NAMESPACE ) );
		$this->assertTrue( wp_style_is( AABE_NAMESPACE ) );
	}

	/**
	 * Tests that the script and style are not enqueued when no provider has an API key.
	 */
	public function test_script_is_not_enqueued_without_api_key() {
		wp_set_current_user( self::factory()->user->create( array( 'role' => 'administrator' ) ) );

		( new Enqueue() )->enqueue_editor_scripts();

		$this->assertFalse( wp_script_is( AABE_NAMESPACE ) );
		$this->assertFalse( wp_style_is( AABE_NAMESPACE ) );
	}
}
