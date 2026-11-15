<?php
/**
 * Plugin Name: AI Content Editing Assistant
 * Description: Select blocks or text in the block editor and edit them by chatting with AI.
 * Requires at least: 7.1
 * Requires PHP: 8.3
 * Version: 0.1.0
 * Author: Aki Hamano
 * Author URI: https://github.com/t-hamano
 * License: GPL2 or later
 * License URI: https://www.gnu.org/licenses/gpl-2.0.html
 * Text Domain: ai-content-editing-assistant
 * Update URI: https://github.com/t-hamano/ai-content-editing-assistant
 *
 * @package AI_Content_Editing_Assistant
 * @author Aki Hamano
 * @license GPL-2.0+
 */

defined( 'ABSPATH' ) || exit;

define( 'ACEA_NAMESPACE', 'ai-content-editing-assistant' );
define( 'ACEA_PATH', untrailingslashit( plugin_dir_path( __FILE__ ) ) );
define( 'ACEA_URL', untrailingslashit( plugin_dir_url( __FILE__ ) ) );

require_once __DIR__ . '/classes/class-api-key.php';
require_once __DIR__ . '/classes/class-enqueue.php';
require_once __DIR__ . '/classes/class-relay.php';
require_once __DIR__ . '/classes/class-stream.php';

new AI_Content_Editing_Assistant\Enqueue();
new AI_Content_Editing_Assistant\Relay();
