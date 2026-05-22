<?php
/**
 * Plugin Name:  Live Comments — Webinário
 * Description:  Widget Elementor de comentários ao vivo com painel de controle integrado ao WordPress.
 * Version:      2.6.1
 * Requires PHP: 7.4
 * Author:
 * Text Domain:  wlc
 */

if (!defined('ABSPATH'))
    exit;

define('WLC_VER', '2.6.1');
define('WLC_PATH', plugin_dir_path(__FILE__));
define('WLC_URL', plugin_dir_url(__FILE__));

/* ══════════════════════════════════════════
   DEFAULTS
══════════════════════════════════════════ */
function wlc_defaults()
{
    return [
        'supabase_url' => '',
        'supabase_anon_key' => '',
        'supabase_service_key' => '',
        /* NOTA: senha padrão em texto puro — usada apenas antes do 1º salvamento.
                 Após salvar pelo painel, ela será armazenada com wp_hash_password(). */
        'staff_password' => 'Power@1805',
        'show_user_comments' => '1',
        'cta_visible' => '0',
        'cta_text' => '🔥 Vagas abertas! Garanta sua vaga agora',
        'cta_url' => '',
        'fake_comments_json' => '',
        'timestamp_json' => '',
        'fake_min_interval' => 12,
        'fake_max_interval' => 35,
        'base_viewers' => 247,
    ];
}

function wlc_get($key)
{
    $defaults = wlc_defaults();
    return get_option('wlc_' . $key, $defaults[$key] ?? '');
}

function wlc_set($key, $value)
{
    update_option('wlc_' . $key, $value);
}

/* ══════════════════════════════════════════
   ELEMENTOR WIDGET
══════════════════════════════════════════ */
add_action('plugins_loaded', function () {
    if (!did_action('elementor/loaded')) {
        add_action('admin_notices', function () {
            echo '<div class="notice notice-warning is-dismissible"><p>'
                . '<strong>Live Comments</strong> requer o <strong>Elementor</strong> instalado e ativo.</p></div>';
        });
        return;
    }
    add_action('elementor/widgets/register', function ($manager) {
        require_once WLC_PATH . 'includes/class-widget.php';
        $manager->register(new \WLC\Widget_Live_Comments());
    });
});

/* ══════════════════════════════════════════
   ASSETS FRONTEND
══════════════════════════════════════════ */
add_action('wp_enqueue_scripts', 'wlc_register_assets');
add_action('elementor/editor/before_enqueue_scripts', 'wlc_register_assets');

function wlc_register_assets()
{
    wp_register_script(
        'wlc-supabase',
        'https://cdn.jsdelivr.net/npm/@supabase/supabase-js@2/dist/umd/supabase.js',
        [],
        '2',
        true
    );
    wp_register_script(
        'wlc-widget',
        WLC_URL . 'assets/js/widget.js',
        ['wlc-supabase'],
        WLC_VER,
        true
    );
    wp_register_style(
        'wlc-widget',
        WLC_URL . 'assets/css/widget.css',
        [],
        WLC_VER
    );
    wp_register_style(
        'wlc-montserrat',
        'https://fonts.googleapis.com/css2?family=Montserrat:wght@400;600;700&display=swap',
        [],
        null
    );
}

/* ══════════════════════════════════════════
   REST API — verifica senha staff
══════════════════════════════════════════ */
add_action('rest_api_init', function () {
    register_rest_route('wlc/v1', '/staff-auth', [
        'methods' => 'POST',
        'callback' => 'wlc_rest_staff_auth',
        'permission_callback' => '__return_true',
    ]);
    register_rest_route('wlc/v1', '/settings', [
        'methods' => 'GET',
        'callback' => 'wlc_rest_get_settings',
        'permission_callback' => '__return_true',
    ]);
    register_rest_route('wlc/v1', '/save-comment', [
        'methods' => 'POST',
        'callback' => 'wlc_rest_save_comment',
        'permission_callback' => '__return_true',
    ]);
    register_rest_route('wlc/v1', '/heartbeat', [
        'methods' => 'POST',
        'callback' => 'wlc_rest_heartbeat',
        'permission_callback' => '__return_true',
    ]);
    register_rest_route('wlc/v1', '/metrics', [
        'methods' => 'GET',
        'callback' => 'wlc_rest_get_metrics',
        'permission_callback' => '__return_true',
    ]);
});

function wlc_rest_staff_auth(WP_REST_Request $request)
{
    $pw = sanitize_text_field($request->get_param('password'));
    $stored = wlc_get('staff_password');
    if (empty($pw) || empty($stored)) {
        return new WP_Error('unauthorized', 'Senha incorreta.', ['status' => 401]);
    }

    $is_auth = false;
    $is_hashed = (strpos($stored, '$P$') === 0 || strpos($stored, '$2y$') === 0 || strpos($stored, '$argon2') === 0);

    if ($is_hashed) {
        if (wp_check_password($pw, $stored)) {
            $is_auth = true;
        }
    } else {
        // Caso a senha padrão ou salva esteja em texto plano
        if (hash_equals($stored, $pw)) {
            $is_auth = true;
            // Upgrade automático para hash seguro para as próximas checagens
            $hashed = wp_hash_password($pw);
            wlc_set('staff_password', $hashed);
            $stored = $hashed; // atualiza para gerar o token com o hash correto
        }
    }

    if ($is_auth) {
        $salt = wp_salt();
        $token = hash_hmac('sha256', $stored . date('Y-m-d'), $salt);
        return rest_ensure_response([
            'ok' => true,
            'token' => $token
        ]);
    }
    return new WP_Error('unauthorized', 'Senha incorreta.', ['status' => 401]);
}

function wlc_rest_get_settings(WP_REST_Request $request)
{
    return rest_ensure_response([
        'show_user_comments' => (bool) wlc_get('show_user_comments'),
        'cta_visible' => (bool) wlc_get('cta_visible'),
        'cta_text' => wlc_get('cta_text'),
        'cta_url' => wlc_get('cta_url'),
        'fake_comments' => wlc_parse_fake_comments(),
        'timestamp_comments' => wlc_parse_timestamp_comments(),
        'fake_min_interval' => (int) wlc_get('fake_min_interval'),
        'fake_max_interval' => (int) wlc_get('fake_max_interval'),
        'base_viewers' => (int) wlc_get('base_viewers'),
    ]);
}

function wlc_parse_fake_comments()
{
    $json = wlc_get('fake_comments_json');
    if (!$json)
        return [];
    $arr = json_decode($json, true);
    return is_array($arr) ? $arr : [];
}

function wlc_parse_timestamp_comments()
{
    $json = wlc_get('timestamp_json');
    if (!$json)
        return [];
    $arr = json_decode($json, true);
    return is_array($arr) ? $arr : [];
}

/* ══════════════════════════════════════════
   PAINEL ADMIN WORDPRESS
══════════════════════════════════════════ */
add_action('admin_menu', function () {
    add_menu_page(
        'Live Comments',
        'Live Comments',
        'manage_options',
        'wlc-admin',
        'wlc_admin_page',
        'dashicons-format-chat',
        58
    );
});

add_action('admin_enqueue_scripts', function ($hook) {
    if ($hook !== 'toplevel_page_wlc-admin')
        return;
    wp_enqueue_style('wlc-admin', WLC_URL . 'assets/css/admin.css', [], WLC_VER);
    wp_enqueue_script('wlc-admin', WLC_URL . 'assets/js/admin.js', ['jquery'], WLC_VER, true);
    wp_localize_script('wlc-admin', 'WLC_ADMIN', [
        'nonce' => wp_create_nonce('wlc_admin_nonce'),
        'ajaxUrl' => admin_url('admin-ajax.php'),
        'restUrl' => esc_url_raw(rest_url('wlc/v1/')),
        'restNonce' => wp_create_nonce('wp_rest'),
    ]);
});

/* ── AJAX handlers (salvar cada seção) ── */
add_action('wp_ajax_wlc_save_connection', 'wlc_ajax_save_connection');
add_action('wp_ajax_wlc_save_general', 'wlc_ajax_save_general');
add_action('wp_ajax_wlc_save_fake', 'wlc_ajax_save_fake');
add_action('wp_ajax_wlc_save_timestamps', 'wlc_ajax_save_timestamps');
add_action('wp_ajax_wlc_save_visibility', 'wlc_ajax_save_visibility');
add_action('wp_ajax_wlc_save_cta', 'wlc_ajax_save_cta');
add_action('wp_ajax_wlc_save_password', 'wlc_ajax_save_password');
add_action('wp_ajax_wlc_sync_supabase', 'wlc_ajax_sync_supabase');

function wlc_check_nonce()
{
    if (!check_ajax_referer('wlc_admin_nonce', 'nonce', false) || !current_user_can('manage_options')) {
        wp_send_json_error('Sem permissão.');
    }
}

function wlc_ajax_save_connection()
{
    wlc_check_nonce();
    wlc_set('supabase_url', sanitize_text_field($_POST['supabase_url'] ?? ''));
    wlc_set('supabase_anon_key', sanitize_text_field($_POST['supabase_anon_key'] ?? ''));
    wlc_set('supabase_service_key', sanitize_text_field($_POST['supabase_service_key'] ?? ''));
    wp_send_json_success();
}

function wlc_ajax_save_general()
{
    wlc_check_nonce();
    $min = max(1, (int) ($_POST['fake_min_interval'] ?? 12));
    $max = max($min + 1, (int) ($_POST['fake_max_interval'] ?? 35));
    wlc_set('fake_min_interval', $min);
    wlc_set('fake_max_interval', $max);
    wlc_set('base_viewers', max(0, (int) ($_POST['base_viewers'] ?? 247)));
    wp_send_json_success(['fake_min_interval' => $min, 'fake_max_interval' => $max]);
}

function wlc_ajax_save_fake()
{
    wlc_check_nonce();
    $json = stripslashes($_POST['fake_comments_json'] ?? '');
    $parsed = json_decode($json, true);
    if (!is_array($parsed)) {
        wp_send_json_error('JSON inválido.');
    }
    $clean = json_encode($parsed);
    wlc_set('fake_comments_json', $clean);
    wlc_push_supabase_setting('fake_comments_json', $clean);
    wp_send_json_success(['count' => count($parsed)]);
}

function wlc_ajax_save_timestamps()
{
    wlc_check_nonce();
    $json = stripslashes($_POST['timestamp_json'] ?? '');
    $parsed = json_decode($json, true);
    if (!is_array($parsed)) {
        wp_send_json_error('JSON inválido.');
    }
    $clean = json_encode($parsed);
    wlc_set('timestamp_json', $clean);
    wlc_push_supabase_setting('timestamp_json', $clean);
    wp_send_json_success(['count' => count($parsed)]);
}

function wlc_ajax_save_visibility()
{
    wlc_check_nonce();
    $val = (($_POST['show_user_comments'] ?? '') === '1') ? '1' : '0';
    wlc_set('show_user_comments', $val);
    wlc_push_supabase_setting('show_user_comments', $val === '1' ? 'true' : 'false');
    wp_send_json_success();
}

function wlc_ajax_save_cta()
{
    wlc_check_nonce();
    $visible = (($_POST['cta_visible'] ?? '') === '1') ? '1' : '0';
    wlc_set('cta_visible', $visible);
    wlc_set('cta_text', sanitize_text_field($_POST['cta_text'] ?? ''));
    wlc_set('cta_url', esc_url_raw($_POST['cta_url'] ?? ''));
    wlc_push_supabase_setting('cta_visible', $visible === '1' ? 'true' : 'false');
    wlc_push_supabase_setting('cta_text', wlc_get('cta_text'));
    wlc_push_supabase_setting('cta_url', wlc_get('cta_url'));
    wp_send_json_success();
}

function wlc_ajax_save_password()
{
    wlc_check_nonce();
    $pw = sanitize_text_field($_POST['staff_password'] ?? '');
    if (strlen($pw) < 6) {
        wp_send_json_error('Senha muito curta (mín. 6 caracteres).');
    }
    wlc_set('staff_password', wp_hash_password($pw));
    wp_send_json_success();
}

function wlc_ajax_sync_supabase()
{
    wlc_check_nonce();
    $settings = [
        'show_user_comments' => wlc_get('show_user_comments') === '1' ? 'true' : 'false',
        'cta_visible' => wlc_get('cta_visible') === '1' ? 'true' : 'false',
        'cta_text' => wlc_get('cta_text'),
        'cta_url' => wlc_get('cta_url'),
        'fake_comments_json' => wlc_get('fake_comments_json'),
        'timestamp_json' => wlc_get('timestamp_json'),
    ];
    $errors = [];
    foreach ($settings as $key => $value) {
        $result = wlc_push_supabase_setting($key, $value);
        if (is_wp_error($result))
            $errors[] = $key;
    }
    if ($errors)
        wp_send_json_error('Falha em: ' . implode(', ', $errors));
    wp_send_json_success();
}

/* ── Envia uma configuração para o Supabase via REST (server-side) ── */
function wlc_push_supabase_setting($key, $value)
{
    $url = wlc_get('supabase_url');
    $service = wlc_get('supabase_service_key');
    if (!$url || !$service)
        return; /* silencioso se não configurado */

    return wp_remote_request(
        trailingslashit($url) . 'rest/v1/settings',
        [
            'method' => 'POST',
            'headers' => [
                'apikey' => $service,
                'Authorization' => 'Bearer ' . $service,
                'Content-Type' => 'application/json',
                'Prefer' => 'resolution=merge-duplicates',
            ],
            'body' => wp_json_encode(['key' => $key, 'value' => $value]),
            'timeout' => 8,
        ]
    );
}

/* ══════════════════════════════════════════
   PÁGINA ADMIN HTML
══════════════════════════════════════════ */
function wlc_admin_page()
{
    $sb_url = esc_attr(wlc_get('supabase_url'));
    $sb_anon = esc_attr(wlc_get('supabase_anon_key'));
    $sb_service = esc_attr(wlc_get('supabase_service_key'));
    $show_users = wlc_get('show_user_comments') === '1';
    $cta_vis = wlc_get('cta_visible') === '1';
    $cta_text = esc_attr(wlc_get('cta_text'));
    $cta_url = esc_attr(wlc_get('cta_url'));
    $fake_json = esc_textarea(wlc_get('fake_comments_json'));
    $ts_json = esc_textarea(wlc_get('timestamp_json'));
    $min_int = (int) wlc_get('fake_min_interval');
    $max_int = (int) wlc_get('fake_max_interval');
    $viewers = (int) wlc_get('base_viewers');
    ?>
    <div class="wlc-admin-wrap">

        <!-- ═══ HEADER ═══ -->
        <div class="wlc-admin-header">
            <div class="wlc-admin-logo">
                <div class="wlc-admin-logo-icon">
                    <svg viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg">
                        <path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z" />
                    </svg>
                </div>
                <div class="wlc-admin-logo-text">
                    <div class="wlc-admin-logo-title">Live Comments</div>
                    <div class="wlc-admin-logo-sub">Painel de Controle — Webinário</div>
                </div>
                <div class="wlc-live-badge">
                    <span class="wlc-dot"></span> Ao Vivo
                </div>
            </div>
            <button class="wlc-btn wlc-btn-sync" id="wlc-sync-all">
                <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5"
                    stroke-linecap="round" stroke-linejoin="round">
                    <polyline points="1 4 1 10 7 10" />
                    <polyline points="23 20 23 14 17 14" />
                    <path d="M20.49 9A9 9 0 0 0 5.64 5.64L1 10m22 4-4.64 4.36A9 9 0 0 1 3.51 15" />
                </svg>
                Sincronizar com Supabase
            </button>
        </div>

        <!-- ═══ BODY ═══ -->
        <div class="wlc-admin-body">

            <!-- ── Coluna esquerda ── -->
            <div class="wlc-col">

                <!-- Conexão Supabase -->
                <div class="wlc-card">
                    <div class="wlc-card-title">
                        <div class="wlc-card-title-icon">🔌</div>
                        Conexão Supabase
                    </div>
                    <label class="wlc-label">Project URL</label>
                    <input class="wlc-input" id="wlc-sb-url" type="text" value="<?php echo $sb_url; ?>"
                        placeholder="https://xxxx.supabase.co">
                    <label class="wlc-label">Anon Key <span class="wlc-muted">— usada no widget (frontend)</span></label>
                    <textarea class="wlc-input wlc-textarea-sm" id="wlc-sb-anon"
                        placeholder="eyJhbGci..."><?php echo $sb_anon; ?></textarea>
                    <label class="wlc-label">Service Role Key <span class="wlc-muted">— servidor, nunca vai ao
                            frontend</span></label>
                    <textarea class="wlc-input wlc-textarea-sm" id="wlc-sb-service"
                        placeholder="eyJhbGci..."><?php echo $sb_service; ?></textarea>
                    <div class="wlc-btn-row">
                        <button class="wlc-btn" data-action="wlc_save_connection">Salvar conexão</button>
                        <div class="wlc-feedback" id="fb-connection"></div>
                    </div>
                </div>

                <!-- Comportamento -->
                <div class="wlc-card">
                    <div class="wlc-card-title">
                        <div class="wlc-card-title-icon">⚙️</div>
                        Comportamento dos Comentários
                    </div>
                    <p class="wlc-desc">Controla a cadência dos comentários simulados e o contador de espectadores.</p>
                    <div class="wlc-input-group">
                        <div>
                            <label class="wlc-label">Intervalo mínimo <span class="wlc-muted">(seg)</span></label>
                            <input class="wlc-input wlc-input-sm" id="wlc-min-int" type="number" min="3"
                                value="<?php echo $min_int; ?>">
                        </div>
                        <div>
                            <label class="wlc-label">Intervalo máximo <span class="wlc-muted">(seg)</span></label>
                            <input class="wlc-input wlc-input-sm" id="wlc-max-int" type="number" min="10"
                                value="<?php echo $max_int; ?>">
                        </div>
                        <div>
                            <label class="wlc-label">Espectadores base</label>
                            <input class="wlc-input wlc-input-sm" id="wlc-viewers" type="number" min="0"
                                value="<?php echo $viewers; ?>">
                        </div>
                    </div>
                    <div class="wlc-btn-row">
                        <button class="wlc-btn" data-action="wlc_save_general">Salvar</button>
                        <div class="wlc-feedback" id="fb-general"></div>
                    </div>
                </div>

                <!-- Senha staff -->
                <div class="wlc-card">
                    <div class="wlc-card-title">
                        <div class="wlc-card-title-icon">🔐</div>
                        Senha da Equipe
                    </div>
                    <p class="wlc-desc">Membros da equipe usam essa senha para acessar o modo <strong>Staff</strong> no
                        widget ao vivo.</p>
                    <div class="wlc-pw-row">
                        <div>
                            <label class="wlc-label">Nova senha</label>
                            <input class="wlc-input" id="wlc-pw-new" type="password" placeholder="Mínimo 6 caracteres"
                                autocomplete="new-password">
                        </div>
                        <div>
                            <label class="wlc-label">Confirmar senha</label>
                            <input class="wlc-input" id="wlc-pw-confirm" type="password" placeholder="Repita a senha"
                                autocomplete="new-password">
                        </div>
                    </div>
                    <div class="wlc-btn-row">
                        <button class="wlc-btn" data-action="wlc_save_password">Salvar senha</button>
                        <div class="wlc-feedback" id="fb-password"></div>
                    </div>
                </div>

                <!-- Comentários simulados -->
                <div class="wlc-card">
                    <div class="wlc-card-title">
                        <div class="wlc-card-title-icon">🤖</div>
                        Comentários Simulados
                        <span id="wlc-fake-count"></span>
                    </div>
                    <p class="wlc-desc">Array JSON. Cada item precisa ter <code>name</code> e <code>text</code>.</p>
                    <div class="wlc-code-example">[{"name":"Ana Beatriz","text":"Incrível! 🔥"},
                        {"name":"Carlos M.","text":"Que conteúdo!"}]</div>
                    <label class="wlc-label">JSON dos comentários</label>
                    <textarea class="wlc-input wlc-textarea-lg" id="wlc-fake-json"><?php echo $fake_json; ?></textarea>
                    <div class="wlc-btn-row">
                        <button class="wlc-btn wlc-btn-sm" id="wlc-fake-validate">✓ Validar JSON</button>
                        <button class="wlc-btn" data-action="wlc_save_fake">Salvar</button>
                        <div class="wlc-feedback" id="fb-fake"></div>
                    </div>
                </div>

                <!-- Diagnósticos do Backend -->
                <div class="wlc-card">
                    <div class="wlc-card-title">
                        <div class="wlc-card-title-icon">⚙️</div>
                        Integridade & Diagnósticos do Backend
                    </div>
                    <p class="wlc-desc">Execute testes automatizados para verificar banco de dados local, criptografia de credenciais e integridade das conexões REST e Supabase.</p>
                    
                    <div class="wlc-btn-row" style="margin-top: 15px;">
                        <button class="wlc-btn" id="wlc-btn-run-diagnostics" style="background: rgba(255,255,255,0.08); border-color: rgba(255,255,255,0.15); color: #fff;">⚡ Executar Testes de Integridade</button>
                    </div>
                    
                    <div id="wlc-diagnostics-results" style="display: none; margin-top: 15px; flex-direction: column; gap: 8px;">
                        <!-- Resultados injetados via JS -->
                    </div>
                </div>

            </div><!-- /col esquerda -->

            <!-- ── Coluna direita ── -->
            <div class="wlc-col">

                <!-- Visibilidade ao vivo -->
                <div class="wlc-card">
                    <div class="wlc-card-title">
                        <div class="wlc-card-title-icon">👁</div>
                        Visibilidade em Tempo Real
                    </div>
                    <p class="wlc-desc">Alterações aplicam-se <strong>imediatamente</strong> para todos os usuários
                        assistindo agora.</p>
                    <div class="wlc-toggle-row">
                        <div class="wlc-toggle-info">
                            <div class="wlc-toggle-label">Mostrar comentários de outros usuários</div>
                            <div class="wlc-toggle-sub">Desligado = cada pessoa vê só seus comentários e respostas da equipe
                            </div>
                        </div>
                        <label class="wlc-switch">
                            <input type="checkbox" id="wlc-show-users" <?php checked($show_users); ?>>
                            <span class="wlc-slider"></span>
                        </label>
                    </div>
                    <div class="wlc-btn-row">
                        <button class="wlc-btn" data-action="wlc_save_visibility">Aplicar agora</button>
                        <div class="wlc-feedback" id="fb-visibility"></div>
                    </div>
                </div>

                <!-- CTA -->
                <div class="wlc-card">
                    <div class="wlc-card-title">
                        <div class="wlc-card-title-icon">🛒</div>
                        CTA — Botão do Pitch
                    </div>
                    <p class="wlc-desc">Ative para exibir o banner de venda para todos os espectadores
                        <strong>agora</strong>.
                    </p>
                    <div class="wlc-toggle-row">
                        <div class="wlc-toggle-info">
                            <div class="wlc-toggle-label">Mostrar CTA agora</div>
                            <div class="wlc-toggle-sub">Exibe o banner de oferta em tempo real para todos</div>
                        </div>
                        <label class="wlc-switch">
                            <input type="checkbox" id="wlc-cta-vis" <?php checked($cta_vis); ?>>
                            <span class="wlc-slider"></span>
                        </label>
                    </div>
                    <label class="wlc-label">Texto do botão</label>
                    <input class="wlc-input" id="wlc-cta-text" type="text" value="<?php echo $cta_text; ?>"
                        placeholder="🔥 Vagas abertas!">
                    <label class="wlc-label">URL de destino</label>
                    <input class="wlc-input" id="wlc-cta-url" type="url" value="<?php echo $cta_url; ?>"
                        placeholder="https://checkout.seusite.com">
                    <div class="wlc-btn-row">
                        <button class="wlc-btn" data-action="wlc_save_cta">Salvar e aplicar</button>
                        <div class="wlc-feedback" id="fb-cta"></div>
                    </div>
                </div>


                <!-- Timestamps -->
                <div class="wlc-card">
                    <div class="wlc-card-title">
                        <div class="wlc-card-title-icon">🎬</div>
                        Comentários por Timestamp
                        <span id="wlc-ts-count"></span>
                    </div>
                    <p class="wlc-desc">Sincronizados com o vídeo. <code>time</code> em segundos. <code>reply</code> é
                        opcional.</p>
                    <div class="wlc-code-example">[{"time":120,"name":"João","text":"Que insight!","reply":"Obrigado! 😊"},
                        {"time":600,"name":"Maria","text":"Incrível!"}]</div>

                    <!-- Bloco de Importação CSV -->
                    <div class="wlc-csv-import-box" style="margin: 15px 0 15px; padding: 12px; background: rgba(255,255,255,0.02); border: 1px dashed rgba(255,255,255,0.08); border-radius: 8px;">
                        <div style="font-size: 11px; font-weight: 600; color: var(--wlc-accent); text-transform: uppercase; letter-spacing: 0.05em; margin-bottom: 4px;">📂 Importar via CSV</div>
                        <p class="wlc-desc" style="margin-bottom: 8px; font-size: 11.5px;">Suba um arquivo CSV com as colunas <code>Hour,Minute,Second,Name,Message,Role</code> para preencher o JSON automaticamente.</p>
                        <label class="wlc-btn wlc-btn-sm" style="cursor: pointer; display: inline-flex; align-items: center; gap: 6px; font-size: 12px; padding: 6px 12px; background: rgba(85,160,238,0.1); border: 1px solid rgba(85,160,238,0.25);">
                            <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round" style="display: block;">
                                <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/>
                                <polyline points="17 8 12 3 7 8"/>
                                <line x1="12" y1="3" x2="12" y2="15"/>
                            </svg>
                            Carregar arquivo CSV
                            <input type="file" id="wlc-csv-file" accept=".csv" style="display: none;">
                        </label>
                        <span id="wlc-csv-status" style="font-size: 11.5px; margin-left: 10px; color: var(--wlc-green); font-weight: 500;"></span>
                    </div>

                    <label class="wlc-label">JSON dos timestamps</label>
                    <textarea class="wlc-input wlc-textarea-lg" id="wlc-ts-json"><?php echo $ts_json; ?></textarea>
                    <div class="wlc-btn-row">
                        <button class="wlc-btn wlc-btn-sm" id="wlc-ts-validate">✓ Validar JSON</button>
                        <button class="wlc-btn" data-action="wlc_save_timestamps">Salvar</button>
                        <div class="wlc-feedback" id="fb-timestamps"></div>
                    </div>
                </div>

                <!-- Relatório de Webinários -->
                <div class="wlc-card">
                    <div class="wlc-card-title">
                        <div class="wlc-card-title-icon">📊</div>
                        Comentários Capturados
                        <span style="font-size:12px; font-weight:normal; opacity:0.6; margin-left: 5px;">(Separados por Webinário)</span>
                    </div>
                    <p class="wlc-desc">Todos os comentários reais enviados por usuários e respostas da equipe durante as transmissões ao vivo.</p>
                    
                    <!-- Painel de Métricas Real-Time -->
                    <div style="display: flex; gap: 12px; margin: 15px 0 20px;">
                        <div style="flex: 1; padding: 14px; background: rgba(59,130,246,0.06); border: 1px solid rgba(59,130,246,0.15); border-radius: 8px; text-align: center; box-shadow: inset 0 1px 0 rgba(255,255,255,0.02);">
                            <div style="font-size: 24px; font-weight: 700; color: #3b82f6; letter-spacing: -0.02em;" id="wlc-admin-metrics-online">0</div>
                            <div style="font-size: 10px; color: var(--wlc-muted); margin-top: 4px; font-weight: 600; text-transform: uppercase; letter-spacing: 0.05em;">🟢 Online Agora</div>
                        </div>
                        <div style="flex: 1; padding: 14px; background: rgba(224,160,48,0.06); border: 1px solid rgba(224,160,48,0.15); border-radius: 8px; text-align: center; box-shadow: inset 0 1px 0 rgba(255,255,255,0.02);">
                            <div style="font-size: 24px; font-weight: 700; color: var(--wlc-accent); letter-spacing: -0.02em;" id="wlc-admin-metrics-cta">0</div>
                            <div style="font-size: 10px; color: var(--wlc-muted); margin-top: 4px; font-weight: 600; text-transform: uppercase; letter-spacing: 0.05em;">🛒 Cliques CTA</div>
                        </div>
                        <div style="flex: 1; padding: 14px; background: rgba(255,255,255,0.02); border: 1px solid rgba(255,255,255,0.06); border-radius: 8px; text-align: center; box-shadow: inset 0 1px 0 rgba(255,255,255,0.02);">
                            <div style="font-size: 24px; font-weight: 700; color: #fff; letter-spacing: -0.02em;" id="wlc-admin-metrics-views">0</div>
                            <div style="font-size: 10px; color: var(--wlc-muted); margin-top: 4px; font-weight: 600; text-transform: uppercase; letter-spacing: 0.05em;">👥 Acessos Totais</div>
                        </div>
                    </div>
                    
                    <?php
                    global $wpdb;
                    wlc_ensure_comments_table();
                    $table_name = $wpdb->prefix . 'wlc_comments';
                    $webinars = $wpdb->get_results("
                        SELECT webinar_id, webinar_title, COUNT(*) as count, MIN(created_at) as first_comment 
                        FROM $table_name 
                        GROUP BY webinar_id, webinar_title 
                        ORDER BY first_comment DESC
                    ");
                    if (empty($webinars)):
                    ?>
                        <div class="wlc-feedback ok" style="display: block; margin: 15px 0 0; background: rgba(255,255,255,0.01); text-align: center; border: 1px dashed rgba(255,255,255,0.08); padding: 25px; color: var(--wlc-muted); border-radius: 8px;">
                            Nenhum comentário real capturado ainda no banco de dados local. Eles aparecerão aqui quando os webinários começarem!
                            
                            <hr style="border: 0; border-top: 1px dashed rgba(255,255,255,0.08); margin: 20px 0;">
                            
                            <div style="font-size: 12.5px; color: #fff; font-weight: 600; margin-bottom: 8px; text-align: center;">☁️ Limpar Comentários do Supabase Cloud (Mesmo sem registros locais)</div>
                            <p style="font-size: 11.5px; color: var(--wlc-muted); margin-bottom: 12px; line-height: 1.4; text-align: center;">Caso queira apagar comentários de teste na nuvem do Supabase, digite o ID do webinário abaixo e clique em Zerar Supabase.</p>
                            
                            <form method="GET" action="<?php echo esc_url(admin_url('admin.php')); ?>" style="display: inline-flex; gap: 8px; justify-content: center; align-items: center; max-width: 450px; width: 100%; margin: 0 auto;" onsubmit="return confirm('Tem certeza que deseja apagar permanentemente todos os comentários deste webinário no Supabase e banco local?');">
                                <input type="hidden" name="page" value="wlc-admin">
                                <input type="hidden" name="_wpnonce" value="<?php echo esc_attr(wp_create_nonce('wlc_delete_webinar')); ?>">
                                <input type="text" name="delete_webinar_comments" value="aovivo-nf10k" placeholder="ID do Webinário (ex: aovivo-nf10k)" required style="padding: 6px 12px; background: rgba(0,0,0,0.25); border: 1px solid rgba(255,255,255,0.1); color: #fff; border-radius: 4px; font-size: 12px; flex: 1; min-height: 30px; box-sizing: border-box;">
                                <button type="submit" class="wlc-btn wlc-btn-sm" style="font-size: 12px; display: inline-flex; align-items: center; padding: 6px 14px; background: rgba(248,113,113,0.1); border: 1px solid rgba(248,113,113,0.3); color: var(--wlc-red); text-decoration: none; border-radius: 4px; font-weight:600; cursor: pointer; min-height: 30px;">
                                    Zerar Supabase
                                </button>
                            </form>
                        </div>
                    <?php else: ?>
                        <div style="display: flex; flex-direction: column; gap: 10px; margin-top: 15px;">
                            <?php foreach ($webinars as $w): ?>
                                <div style="display: flex; align-items: center; justify-content: space-between; padding: 12px 16px; background: rgba(255,255,255,0.02); border: 1px solid rgba(255,255,255,0.06); border-radius: 8px;">
                                    <div>
                                        <div style="font-weight: 600; color: #fff; font-size: 13.5px;"><?php echo esc_html($w->webinar_title); ?></div>
                                        <div style="font-size: 11.5px; color: var(--wlc-muted); margin-top: 2px;">
                                            ID: <code><?php echo esc_html($w->webinar_id); ?></code> &nbsp;•&nbsp; 
                                            <strong><?php echo esc_html($w->count); ?></strong> comentários
                                        </div>
                                    </div>
                                    <div style="display: flex; gap: 8px;">
                                        <a href="<?php echo esc_url(wp_nonce_url(admin_url('admin.php?page=wlc-admin&download_webinar_csv=' . urlencode($w->webinar_id)), 'wlc_download_csv_' . $w->webinar_id)); ?>"
                                           class="wlc-btn wlc-btn-sm"
                                           style="font-size: 12px; display: inline-flex; align-items: center; gap: 6px; padding: 6px 12px; background: var(--wlc-accent); border-color: var(--wlc-accent); text-decoration: none; color: #fff; border-radius: 4px; font-weight:600;">
                                            <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round" style="display:block;">
                                                <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/>
                                                <polyline points="7 10 12 15 17 10"/>
                                                <line x1="12" y1="15" x2="12" y2="3"/>
                                            </svg>
                                            Exportar CSV
                                        </a>
                                        <a href="<?php echo esc_url(wp_nonce_url(admin_url('admin.php?page=wlc-admin&delete_webinar_comments=' . urlencode($w->webinar_id)), 'wlc_delete_webinar')); ?>" 
                                           class="wlc-btn wlc-btn-sm" 
                                           onclick="return confirm('Tem certeza que deseja apagar permanentemente todos os comentários deste webinário?');"
                                           style="font-size: 12px; display: inline-flex; align-items: center; padding: 6px 12px; background: rgba(248,113,113,0.06); border: 1px solid rgba(248,113,113,0.2); color: var(--wlc-red); text-decoration: none; border-radius: 4px;">
                                            Limpar
                                        </a>
                                    </div>
                                </div>
                            <?php endforeach; ?>
                        </div>
                    <?php endif; ?>
                    
                    <div style="margin-top: 20px; padding: 15px; background: rgba(85,160,238,0.06); border: 1px dashed rgba(85,160,238,0.25); border-radius: 6px; font-size: 13px; line-height: 1.5; color: var(--wlc-text);">
                        <strong style="color: var(--wlc-accent); display: flex; align-items: center; gap: 6px; margin-bottom: 6px;">
                            💡 Dica de Testes em Tempo Real
                        </strong>
                        Ao clicar em <strong>"Limpar"</strong>, as mensagens deste webinário são apagadas permanentemente <strong>tanto do banco de dados local (MySQL) quanto do Supabase (Cloud)</strong> simultaneamente.
                        <br><br>
                        Se você quiser <strong>simular um participante do zero</strong> (limpando o seu nome de teste e ID de sessão no seu navegador), basta acessar a sua página de transmissão adicionando <code>?wlc_clear=1</code> no final da URL (Exemplo: <code>https://mentoriapower.com.br/aovivo-nf10k/?wlc_clear=1</code>). O plugin limpará seu cache de testes automaticamente!
                    </div>
                </div>


            </div><!-- /col direita -->

        </div><!-- /body -->

        <!-- ═══ FOOTER ═══ -->
        <div class="wlc-admin-footer">
            <div class="wlc-version-tag">
                Live Comments — Webinário &nbsp;<span>v<?php echo WLC_VER; ?></span>
            </div>
            <div class="wlc-footer-hint">
                Após salvar, o cache do browser atualiza automaticamente via versionamento (<?php echo WLC_VER; ?>).
            </div>
        </div>

    </div>
    <?php
}

/* ══════════════════════════════════════════
   SISTEMA DE ARMAZENAMENTO E EXPORTAÇÃO
   DE COMENTÁRIOS E DIAGNÓSTICOS DE BACKEND
══════════════════════════════════════════ */

// Criação da tabela de comentários no banco de dados local
function wlc_create_comments_table() {
    global $wpdb;
    $table_name = $wpdb->prefix . 'wlc_comments';
    $charset_collate = $wpdb->get_charset_collate();
    
    $sql = "CREATE TABLE $table_name (
        id BIGINT(20) UNSIGNED NOT NULL AUTO_INCREMENT,
        webinar_id VARCHAR(100) NOT NULL,
        webinar_title VARCHAR(255) NOT NULL,
        time_offset INT(11) NOT NULL DEFAULT 0,
        name VARCHAR(255) NOT NULL,
        role VARCHAR(50) NOT NULL DEFAULT 'Attendee',
        message TEXT NOT NULL,
        mode VARCHAR(50) NOT NULL DEFAULT 'Chat',
        created_at DATETIME NOT NULL,
        PRIMARY KEY (id),
        KEY webinar_id (webinar_id),
        KEY webinar_time (webinar_id, time_offset)
    ) $charset_collate;";
    
    require_once(ABSPATH . 'wp-admin/includes/upgrade.php');
    dbDelta($sql);
}

register_activation_hook(__FILE__, 'wlc_create_comments_table');

// Limpeza de agendamento ao desativar o plugin
register_deactivation_hook(__FILE__, 'wlc_clear_cron_schedules');
function wlc_clear_cron_schedules() {
    wp_clear_scheduled_hook('wlc_weekly_supabase_clear_event');
}

// Garante que a tabela local exista (fail-safe) e atualiza índices se necessário
function wlc_ensure_comments_table() {
    global $wpdb;
    $table_name = $wpdb->prefix . 'wlc_comments';
    if ($wpdb->get_var("SHOW TABLES LIKE '$table_name'") !== $table_name) {
        wlc_create_comments_table();
    } else {
        // Validação dinâmica para criar o índice se a tabela já existir no cliente
        $index_exists = $wpdb->get_results("SHOW INDEX FROM $table_name WHERE Key_name = 'webinar_time'");
        if (empty($index_exists)) {
            $wpdb->query("ALTER TABLE $table_name ADD INDEX webinar_time (webinar_id, time_offset)");
        }
    }
}

// Callback para salvar um comentário enviado via REST API
function wlc_rest_save_comment(WP_REST_Request $request) {
    global $wpdb;
    wlc_ensure_comments_table();
    
    $webinar_id = sanitize_text_field($request->get_param('webinar_id') ?? 'default');
    $webinar_title = sanitize_text_field($request->get_param('webinar_title') ?? 'Webinário');
    $time_offset = intval($request->get_param('time_offset') ?? 0);
    $name = sanitize_text_field($request->get_param('name') ?? 'Anon');
    $message = sanitize_textarea_field($request->get_param('message') ?? '');
    $mode = sanitize_text_field($request->get_param('mode') ?? 'Chat');
    $reply_to = sanitize_text_field($request->get_param('reply_to') ?? '');

    if (empty($name) || empty($message)) {
        return new WP_Error('bad_request', 'Campos name e message são obrigatórios.', ['status' => 400]);
    }

    // Valida tamanho máximo para prevenir spam
    if (mb_strlen($name) > 100 || mb_strlen($message) > 1000) {
        return new WP_Error('bad_request', 'Dados excedem o tamanho permitido.', ['status' => 400]);
    }
    
    // Verifica se a requisição é de um staff autenticado
    $is_staff_req = false;
    if (current_user_can('manage_options')) {
        $is_staff_req = true;
    } else {
        $token = sanitize_text_field($request->get_param('staff_token') ?? '');
        if (!empty($token)) {
            $stored = wlc_get('staff_password');
            $salt = wp_salt();
            $expected_token = hash_hmac('sha256', $stored . date('Y-m-d'), $salt);
            $expected_token_yesterday = hash_hmac('sha256', $stored . date('Y-m-d', strtotime('-1 day')), $salt);

            if (hash_equals($expected_token, $token) || hash_equals($expected_token_yesterday, $token)) {
                $is_staff_req = true;
            }
        }
    }

    // Role é confiável apenas para staff; visitantes comuns ficam sempre como Attendee
    $role = $is_staff_req
        ? sanitize_text_field($request->get_param('role') ?? 'Attendee')
        : 'Attendee';
    
    $supabase_id = null;
    
    // Se for uma resposta (reply_to preenchido), verifica permissões e atualiza o Supabase
    if (!empty($reply_to)) {
        if (!$is_staff_req) {
            return new WP_Error('forbidden', 'Acesso negado para responder comentários.', ['status' => 403]);
        }
        
        // Atualiza a tabela pública do Supabase usando a Service Key (ignora políticas RLS)
        $url = wlc_get('supabase_url');
        $service = wlc_get('supabase_service_key');
        if ($url && $service && strpos($url, 'XXXX') === false) {
            $sb_res = wp_remote_request(
                trailingslashit($url) . 'rest/v1/comments?id=eq.' . urlencode($reply_to),
                [
                    'method' => 'PATCH',
                    'headers' => [
                        'apikey' => $service,
                        'Authorization' => 'Bearer ' . $service,
                        'Content-Type' => 'application/json',
                        'Prefer' => 'return=representation'
                    ],
                    'body' => wp_json_encode(['reply' => $message]),
                    'timeout' => 8,
                ]
            );
            
            if (is_wp_error($sb_res)) {
                // Resiliência contra quedas/erros do Supabase: loga o erro mas não impede salvamento local MySQL
                error_log('Live Comments - Erro Supabase no Reply: ' . $sb_res->get_error_message());
            }
        }
    }
    // Insere no Supabase via servidor para TODOS os comentários novos (staff ou usuário comum).
    // Motivo: ao usar a Service Key server-side, o `supabase_id` real é SEMPRE retornado na
    // resposta REST. Isso garante que `el.dataset.id` no frontend seja definido de forma
    // síncrona, sem depender do evento INSERT assíncrono do Supabase (que pode ser bloqueado
    // por RLS do anon key ou chegar depois da resposta do staff). Sem o ID real, respostas
    // do staff ficam invisíveis para o usuário comum.
    else {
        $url = wlc_get('supabase_url');
        $service = wlc_get('supabase_service_key');
        if ($url && $service && strpos($url, 'XXXX') === false) {
            $session_id = sanitize_text_field($request->get_param('session_id') ?? '');
            $comment_type = $is_staff_req ? 'host' : 'user';
            $sb_res = wp_remote_request(
                trailingslashit($url) . 'rest/v1/comments',
                [
                    'method' => 'POST',
                    'headers' => [
                        'apikey'        => $service,
                        'Authorization' => 'Bearer ' . $service,
                        'Content-Type'  => 'application/json',
                        'Prefer'        => 'return=representation',
                    ],
                    'body' => wp_json_encode([
                        'name'       => $name,
                        'text'       => $message,
                        'type'       => $comment_type,
                        'session_id' => $session_id,
                        'webinar_id' => $webinar_id,
                    ]),
                    'timeout' => 8,
                ]
            );
            if (!is_wp_error($sb_res)) {
                $code = wp_remote_retrieve_response_code($sb_res);
                if ($code === 201 || $code === 200) {
                    $body = json_decode(wp_remote_retrieve_body($sb_res), true);
                    if (is_array($body) && isset($body[0]['id'])) {
                        $supabase_id = $body[0]['id'];
                    }
                }
            } else {
                error_log('Live Comments - Erro Supabase ao salvar comentário: ' . $sb_res->get_error_message());
            }
        }
    }
    
    // Respostas são classificadas como 'Reply' para distinguir nas exportações CSV
    if (!empty($reply_to)) {
        $mode = 'Reply';
    }

    $table_name = $wpdb->prefix . 'wlc_comments';
    $result = $wpdb->insert(
        $table_name,
        [
            'webinar_id' => $webinar_id,
            'webinar_title' => $webinar_title,
            'time_offset' => $time_offset,
            'name' => $name,
            'role' => $role,
            'message' => $message,
            'mode' => $mode,
            'created_at' => current_time('mysql'),
        ],
        ['%s', '%s', '%d', '%s', '%s', '%s', '%s', '%s']
    );
    
    if ($result) {
        $response = ['success' => true];
        if ($supabase_id !== null) {
            $response['supabase_id'] = $supabase_id;
        }
        return rest_ensure_response($response);
    }
    
    return new WP_Error('db_error', 'Falha ao salvar comentário no banco local.', ['status' => 500]);
}

// Criação da tabela de rastreamento de tráfego
function wlc_create_tracking_table() {
    global $wpdb;
    $table_name = $wpdb->prefix . 'wlc_tracking';
    $charset_collate = $wpdb->get_charset_collate();
    
    $sql = "CREATE TABLE $table_name (
        id BIGINT(20) UNSIGNED NOT NULL AUTO_INCREMENT,
        session_id VARCHAR(100) NOT NULL,
        webinar_id VARCHAR(100) NOT NULL,
        last_active DATETIME NOT NULL,
        cta_clicked TINYINT(1) NOT NULL DEFAULT 0,
        status VARCHAR(20) NOT NULL DEFAULT 'online',
        PRIMARY KEY (id),
        UNIQUE KEY session_webinar (session_id, webinar_id),
        KEY last_active (last_active)
    ) $charset_collate;";
    
    require_once(ABSPATH . 'wp-admin/includes/upgrade.php');
    dbDelta($sql);
}

// Garante que a tabela de rastreamento exista
function wlc_ensure_tracking_table() {
    global $wpdb;
    $table_name = $wpdb->prefix . 'wlc_tracking';
    if ($wpdb->get_var("SHOW TABLES LIKE '$table_name'") !== $table_name) {
        wlc_create_tracking_table();
    }
}

// Limpeza automática da tabela do Supabase após as 23:59 de terça-feira (Executado de forma assíncrona pelo WP-Cron)
function wlc_maybe_clear_supabase_comments() {
    $sb_url = wlc_get('supabase_url');
    $sb_service_key = wlc_get('supabase_service_key');
    if (!$sb_url || !$sb_service_key || strpos($sb_url, 'XXXX') !== false) {
        return;
    }
    
    $now = current_time('timestamp');
    $day_of_week = intval(date('w', $now)); // 0 = Sunday, 1 = Monday, 2 = Tuesday, 3 = Wednesday, etc.
    
    // Só limpa de Quarta-feira (3) a Segunda-feira (1). Nunca na Terça (2) para evitar limpar enquanto roda.
    if ($day_of_week === 2) {
        return;
    }
    
    $current_week = date('Y-W', $now);
    $last_clear = get_option('wlc_last_supabase_clear_week');
    
    if ($current_week !== $last_clear) {
        // PostgREST requer ao menos um filtro para DELETE em massa.
        // id=gte.0 corresponde a todos os registros (IDs são sempre >= 0).
        $response = wp_remote_request(rtrim($sb_url, '/') . '/rest/v1/comments?id=gte.0', [
            'method' => 'DELETE',
            'headers' => [
                'apikey' => $sb_service_key,
                'Authorization' => 'Bearer ' . $sb_service_key,
                'Content-Type' => 'application/json',
                'Prefer' => 'return=minimal',
            ],
            'timeout' => 15,
        ]);

        $code = is_wp_error($response) ? 0 : wp_remote_retrieve_response_code($response);
        if ($code === 200 || $code === 204) {
            update_option('wlc_last_supabase_clear_week', $current_week);
        } elseif (!is_wp_error($response)) {
            error_log('Live Comments - Falha na limpeza semanal Supabase. HTTP ' . $code . ': ' . wp_remote_retrieve_body($response));
        }
    }
}

// Agenda o cron assíncrono para a limpeza semanal em background (previne travamento síncrono no admin_init)
add_action('wp', 'wlc_schedule_weekly_cleanup');
function wlc_schedule_weekly_cleanup() {
    if (!wp_next_scheduled('wlc_weekly_supabase_clear_event')) {
        wp_schedule_event(time(), 'daily', 'wlc_weekly_supabase_clear_event');
    }
}
add_action('wlc_weekly_supabase_clear_event', 'wlc_maybe_clear_supabase_comments');

// Callback para salvar status de tráfego/heartbeat via REST API
function wlc_rest_heartbeat(WP_REST_Request $request) {
    global $wpdb;
    wlc_ensure_tracking_table();
    
    $params = $request->get_json_params();
    if (empty($params)) {
        $params = $request->get_params();
    }
    
    $session_id = sanitize_text_field($params['session_id'] ?? '');
    $webinar_id = sanitize_text_field($params['webinar_id'] ?? 'default');
    $event = sanitize_text_field($params['event'] ?? 'heartbeat');
    
    if (empty($session_id)) {
        return new WP_Error('bad_request', 'Session ID obrigatório.', ['status' => 400]);
    }
    
    $table_name = $wpdb->prefix . 'wlc_tracking';
    $status = ($event === 'leave') ? 'left' : 'online';
    $cta_clicked = ($event === 'cta_click') ? 1 : 0;
    
    $row = $wpdb->get_row($wpdb->prepare("SELECT id, cta_clicked FROM $table_name WHERE session_id = %s AND webinar_id = %s", $session_id, $webinar_id));
    
    if ($row) {
        $wpdb->update(
            $table_name,
            [
                'last_active' => current_time('mysql'),
                'status' => $status,
                'cta_clicked' => $cta_clicked ? 1 : $row->cta_clicked
            ],
            ['id' => $row->id],
            ['%s', '%s', '%d'],
            ['%d']
        );
    } else {
        $wpdb->insert(
            $table_name,
            [
                'session_id' => $session_id,
                'webinar_id' => $webinar_id,
                'last_active' => current_time('mysql'),
                'cta_clicked' => $cta_clicked,
                'status' => $status
            ],
            ['%s', '%s', '%s', '%d', '%s']
        );
    }
    
    return rest_ensure_response(['success' => true]);
}

// Callback para obter métricas real-time de tráfego/heartbeat via REST API
function wlc_rest_get_metrics(WP_REST_Request $request) {
    global $wpdb;
    wlc_ensure_tracking_table();
    
    $webinar_id = sanitize_text_field($request->get_param('webinar_id') ?? 'all');
    $table_name = $wpdb->prefix . 'wlc_tracking';
    
    $time_limit = date('Y-m-d H:i:s', current_time('timestamp') - 45);
    
    if ($webinar_id === 'all') {
        $online_count = intval($wpdb->get_var($wpdb->prepare("
            SELECT COUNT(DISTINCT session_id) 
            FROM $table_name 
            WHERE status = 'online' AND last_active >= %s
        ", $time_limit)));
        
        $cta_clicks = intval($wpdb->get_var("
            SELECT COUNT(DISTINCT session_id) 
            FROM $table_name 
            WHERE cta_clicked = 1
        "));
        
        $total_views = intval($wpdb->get_var("
            SELECT COUNT(DISTINCT session_id) 
            FROM $table_name
        "));
    } else {
        $online_count = intval($wpdb->get_var($wpdb->prepare("
            SELECT COUNT(DISTINCT session_id) 
            FROM $table_name 
            WHERE webinar_id = %s AND status = 'online' AND last_active >= %s
        ", $webinar_id, $time_limit)));
        
        $cta_clicks = intval($wpdb->get_var($wpdb->prepare("
            SELECT COUNT(DISTINCT session_id) 
            FROM $table_name 
            WHERE webinar_id = %s AND cta_clicked = 1
        ", $webinar_id)));
        
        $total_views = intval($wpdb->get_var($wpdb->prepare("
            SELECT COUNT(DISTINCT session_id) 
            FROM $table_name 
            WHERE webinar_id = %s
        ", $webinar_id)));
    }
    
    return rest_ensure_response([
        'online' => $online_count,
        'cta_clicks' => $cta_clicks,
        'total_views' => $total_views
    ]);
}


// Ganchos para gerenciar download e deleção de relatórios CSV na inicialização
add_action('admin_init', function() {
    // 1. Download de CSV por webinário
    if (isset($_GET['page']) && $_GET['page'] === 'wlc-admin' && isset($_GET['download_webinar_csv'])) {
        if (!current_user_can('manage_options')) {
            wp_die('Acesso negado.');
        }
        $webinar_id = sanitize_text_field($_GET['download_webinar_csv']);
        check_admin_referer('wlc_download_csv_' . $webinar_id);
        global $wpdb;
        $table_name = $wpdb->prefix . 'wlc_comments';
        
        $comments = $wpdb->get_results($wpdb->prepare("
            SELECT time_offset, name, role, message, mode 
            FROM $table_name 
            WHERE webinar_id = %s 
            ORDER BY time_offset ASC, id ASC
        ", $webinar_id));
        
        // Limpa o buffer de saída
        if (ob_get_length()) ob_clean();
        
        header('Content-Type: text/csv; charset=utf-8');
        header('Content-Disposition: attachment; filename="comentarios-webinario-' . sanitize_title($webinar_id) . '.csv"');
        
        // Adiciona BOM para UTF-8 no Excel abrir acentos corretamente
        echo "\xEF\xBB\xBF";
        
        $output = fopen('php://output', 'w');
        fputcsv($output, ['Hour', 'Minute', 'Second', 'Name', 'Role', 'Message', 'Mode']);
        
        foreach ($comments as $c) {
            $sec_total = max(0, intval($c->time_offset));
            $hour = floor($sec_total / 3600);
            $minute = floor(($sec_total % 3600) / 60);
            $second = $sec_total % 60;
            
            fputcsv($output, [
                $hour,
                $minute,
                $second,
                $c->name,
                $c->role,
                $c->message,
                $c->mode
            ]);
        }
        
        fclose($output);
        exit;
    }
    
    // 2. Limpeza de comentários de um webinário
    if (isset($_GET['page']) && $_GET['page'] === 'wlc-admin' && isset($_GET['delete_webinar_comments'])) {
        check_admin_referer('wlc_delete_webinar');
        if (!current_user_can('manage_options')) {
            wp_die('Acesso negado.');
        }
        global $wpdb;
        $webinar_id = sanitize_text_field($_GET['delete_webinar_comments']);
        $table_name = $wpdb->prefix . 'wlc_comments';
        $wpdb->delete($table_name, ['webinar_id' => $webinar_id], ['%s']);
        
        // Deleta também os comentários da tabela pública do Supabase usando a Service Key
        $url = wlc_get('supabase_url');
        $service = wlc_get('supabase_service_key');
        if ($url && $service && strpos($url, 'XXXX') === false) {
            wp_remote_request(
                trailingslashit($url) . 'rest/v1/comments?webinar_id=eq.' . urlencode($webinar_id),
                [
                    'method' => 'DELETE',
                    'headers' => [
                        'apikey' => $service,
                        'Authorization' => 'Bearer ' . $service,
                    ],
                    'timeout' => 15,
                ]
            );
        }

        wp_redirect(admin_url('admin.php?page=wlc-admin&deleted=1'));
        exit;
    }
});

// Mecanismo de diagnóstico e testes automatizados de backend
function wlc_run_diagnostics() {
    global $wpdb;
    $results = [];
    
    // Teste 1: Existência da Tabela
    $table_name = $wpdb->prefix . 'wlc_comments';
    $table_exists = $wpdb->get_var("SHOW TABLES LIKE '$table_name'") === $table_name;
    if ($table_exists) {
        $results[] = [
            'status' => 'ok',
            'title' => 'Banco de Dados Local',
            'desc' => "A tabela <code>$table_name</code> está configurada corretamente e pronta para capturar comentários."
        ];
    } else {
        $results[] = [
            'status' => 'err',
            'title' => 'Banco de Dados Local',
            'desc' => "A tabela de armazenamento de comentários local não existe. Tentando criar agora..."
        ];
        wlc_create_comments_table();
    }
    
    // Teste 2: Escrita, Leitura e Benchmark de Latência
    if ($table_exists) {
        $start_time = microtime(true);
        $insert_ok = $wpdb->insert($table_name, [
            'webinar_id' => 'test-diagnostics',
            'webinar_title' => 'Webinário Teste',
            'time_offset' => 12,
            'name' => 'Teste Diagnóstico',
            'role' => 'Attendee',
            'message' => 'Comentário de teste automático do backend',
            'mode' => 'Chat',
            'created_at' => current_time('mysql')
        ]);
        $duration = round((microtime(true) - $start_time) * 1000, 2);
        
        if ($insert_ok) {
            $wpdb->delete($table_name, ['webinar_id' => 'test-diagnostics']);
            $results[] = [
                'status' => $duration < 150 ? 'ok' : 'warn',
                'title' => 'Latência de Leitura/Escrita',
                'desc' => "Tempo de processamento de dados concluído em <strong>{$duration}ms</strong>. " . ($duration < 150 ? "(Excelente performance local)" : "(Performance razoável)")
            ];
        } else {
            $results[] = [
                'status' => 'err',
                'title' => 'Integridade de Dados',
                'desc' => "Falha ao persistir dados na tabela local. Verifique as permissões do usuário do banco."
            ];
        }
    }
    
    // Teste 3: Hash de segurança e Credenciais
    $stored_password = wlc_get('staff_password');
    if ($stored_password) {
        $is_hashed = (strpos($stored_password, '$P$') === 0 || strpos($stored_password, '$2y$') === 0);
        if ($is_hashed) {
            $results[] = [
                'status' => 'ok',
                'title' => 'Criptografia de Senha (Staff)',
                'desc' => "A credencial da equipe está protegida usando hashing nativo seguro do WordPress."
            ];
        } else {
            $results[] = [
                'status' => 'warn',
                'title' => 'Criptografia de Senha (Staff)',
                'desc' => "A senha da equipe não está em hash seguro. Por favor, redefina a senha para criptografá-la de forma segura."
            ];
        }
    } else {
        $results[] = [
            'status' => 'warn',
            'title' => 'Credenciais da Equipe',
            'desc' => "Nenhuma senha cadastrada. Apenas acesso de administrador do WP consegue autenticar como staff."
        ];
    }
    
    // Teste 4: Conectividade Supabase (se configurado)
    $sb_url = wlc_get('supabase_url');
    $sb_anon = wlc_get('supabase_anon_key');
    if ($sb_url && $sb_anon && strpos($sb_url, 'XXXX') === false) {
        $response = wp_remote_get($sb_url . '/rest/v1/settings?limit=1', [
            'headers' => [
                'apikey' => $sb_anon,
                'Authorization' => 'Bearer ' . $sb_anon
            ],
            'timeout' => 5
        ]);
        
        if (is_wp_error($response)) {
            $results[] = [
                'status' => 'err',
                'title' => 'Supabase Connection',
                'desc' => "Falha de conectividade REST externa com o Supabase: " . esc_html($response->get_error_message())
            ];
        } else {
            $code = wp_remote_retrieve_response_code($response);
            if ($code === 200) {
                $results[] = [
                    'status' => 'ok',
                    'title' => 'Supabase Realtime Connection',
                    'desc' => "Conexão REST externa ativa e respondendo com status 200 (OK)."
                ];
            } else {
                $results[] = [
                    'status' => 'warn',
                    'title' => 'Supabase Realtime Authorization',
                    'desc' => "Supabase respondeu com código HTTP de erro <code>$code</code>. Verifique a URL e a Anon Key nas configurações de conexão."
                ];
            }
        }
    } else {
        $results[] = [
            'status' => 'info',
            'title' => 'Supabase Realtime Connection',
            'desc' => "Supabase não configurado. O plugin está operando com sucesso no modo local."
        ];
    }
    
    return $results;
}

// Endpoint de AJAX para executar diagnósticos via painel admin
add_action('wp_ajax_wlc_run_diagnostics', function() {
    check_ajax_referer('wlc_admin_nonce', 'nonce');
    if (!current_user_can('manage_options')) {
        wp_send_json_error('Não autorizado.');
    }
    
    $results = wlc_run_diagnostics();
    wp_send_json_success($results);
});



