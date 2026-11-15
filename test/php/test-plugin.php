<?php
/**
 * @package AI_Content_Editing_Assistant
 */

/**
 * Tests for the main plugin file.
 */
class Test_Plugin extends WP_UnitTestCase {

	/**
	 * Tests that the plugin constants are defined.
	 */
	public function test_constants_are_defined() {
		$this->assertSame( 'ai-content-editing-assistant', AI_CONTENT_EDITING_ASSISTANT_NAMESPACE );
		$this->assertSame( untrailingslashit( dirname( __DIR__, 2 ) ), AI_CONTENT_EDITING_ASSISTANT_PATH );
		$this->assertStringEndsWith( '/ai-content-editing-assistant', AI_CONTENT_EDITING_ASSISTANT_URL );
	}
}
