<?php
/**
 * PHPUnit bootstrap file.
 *
 * @package AI_Content_Editing_Assistant
 */

// `WP_TESTS_DIR` is provided by wp-env and points to the WordPress PHPUnit
// test library matching the installed WordPress version.
$ai_content_editing_assistant_tests_dir = getenv( 'WP_TESTS_DIR' );

if ( ! $ai_content_editing_assistant_tests_dir || ! file_exists( $ai_content_editing_assistant_tests_dir . '/includes/functions.php' ) ) {
	echo 'Could not find the WordPress test library. Run the tests with `npm run test:php`.' . PHP_EOL; // phpcs:ignore WordPress.Security.EscapeOutput.OutputNotEscaped
	exit( 1 );
}

define( 'WP_TESTS_PHPUNIT_POLYFILLS_PATH', dirname( __DIR__, 2 ) . '/vendor/yoast/phpunit-polyfills' );

require_once $ai_content_editing_assistant_tests_dir . '/includes/functions.php';

tests_add_filter(
	'muplugins_loaded',
	static function () {
		require dirname( __DIR__, 2 ) . '/ai-content-editing-assistant.php';
	}
);

require $ai_content_editing_assistant_tests_dir . '/includes/bootstrap.php';

require __DIR__ . '/fixtures/class-ai-content-editing-assistant-fake-provider.php';
require __DIR__ . '/fixtures/class-ai-content-editing-assistant-fallback-provider.php';
require __DIR__ . '/fixtures/trait-fake-api-key.php';
require __DIR__ . '/fixtures/class-ai-content-editing-assistant-test-stream.php';
