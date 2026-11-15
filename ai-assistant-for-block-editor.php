<?php
/**
 * Plugin Name: AI Assistant for Block Editor
 * Description: Select blocks or text in the block editor and edit them by chatting with AI.
 * Requires at least: 7.1
 * Requires PHP: 8.3
 * Version: 0.1.0
 * Author: Aki Hamano
 * Author URI: https://github.com/t-hamano
 * License: GPL2 or later
 * License URI: https://www.gnu.org/licenses/gpl-2.0.html
 * Text Domain: ai-assistant-for-block-editor
 * Update URI: https://github.com/t-hamano/ai-assistant-for-block-editor
 *
 * @package AI_Assistant_For_Block_Editor
 * @author Aki Hamano
 * @license GPL-2.0+
 */

defined( 'ABSPATH' ) || exit;

define( 'AABE_NAMESPACE', 'ai-assistant-for-block-editor' );
define( 'AABE_PATH', untrailingslashit( plugin_dir_path( __FILE__ ) ) );
define( 'AABE_URL', untrailingslashit( plugin_dir_url( __FILE__ ) ) );

require_once __DIR__ . '/classes/class-api-key.php';
require_once __DIR__ . '/classes/class-enqueue.php';
require_once __DIR__ . '/classes/class-relay.php';

new AI_Assistant_For_Block_Editor\Enqueue();
new AI_Assistant_For_Block_Editor\Relay();
