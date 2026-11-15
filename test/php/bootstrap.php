<?php
/**
 * PHPUnit bootstrap file.
 *
 * @package AI_Assistant_For_Block_Editor
 */

// `WP_TESTS_DIR` is provided by wp-env and points to the WordPress PHPUnit
// test library matching the installed WordPress version.
$aabe_tests_dir = getenv( 'WP_TESTS_DIR' );

if ( ! $aabe_tests_dir || ! file_exists( $aabe_tests_dir . '/includes/functions.php' ) ) {
	echo 'Could not find the WordPress test library. Run the tests with `npm run test:php`.' . PHP_EOL; // phpcs:ignore WordPress.Security.EscapeOutput.OutputNotEscaped
	exit( 1 );
}

define( 'WP_TESTS_PHPUNIT_POLYFILLS_PATH', dirname( __DIR__, 2 ) . '/vendor/yoast/phpunit-polyfills' );

require_once $aabe_tests_dir . '/includes/functions.php';

tests_add_filter(
	'muplugins_loaded',
	static function () {
		require dirname( __DIR__, 2 ) . '/ai-assistant-for-block-editor.php';
	}
);

require $aabe_tests_dir . '/includes/bootstrap.php';

require __DIR__ . '/fixtures/class-aabe-fake-provider.php';
require __DIR__ . '/fixtures/trait-fake-api-key.php';
