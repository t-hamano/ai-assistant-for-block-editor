<?php
/**
 * @package AI_Assistant_For_Block_Editor
 */

/**
 * Tests for the main plugin file.
 */
class Test_Plugin extends WP_UnitTestCase {

	/**
	 * Tests that the plugin constants are defined.
	 */
	public function test_constants_are_defined() {
		$this->assertSame( 'ai-assistant-for-block-editor', AABE_NAMESPACE );
		$this->assertSame( untrailingslashit( dirname( __DIR__, 2 ) ), AABE_PATH );
		$this->assertStringEndsWith( '/ai-assistant-for-block-editor', AABE_URL );
	}
}
