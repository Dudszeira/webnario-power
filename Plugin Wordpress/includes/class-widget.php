<?php
namespace WLC;

use Elementor\Controls_Manager;
use Elementor\Group_Control_Typography;

if ( ! defined( 'ABSPATH' ) ) exit;

class Widget_Live_Comments extends \Elementor\Widget_Base {

    public function get_name()       { return 'wlc-live-comments'; }
    public function get_title()      { return 'Comentários ao Vivo'; }
    public function get_icon()       { return 'eicon-comments'; }
    public function get_categories() { return [ 'general' ]; }
    public function get_keywords()   { return [ 'comments', 'live', 'chat', 'webinar' ]; }
    public function get_script_depends() { return [ 'wlc-widget' ]; }
    public function get_style_depends()  { return [ 'wlc-widget' ]; }

    protected function register_controls() {

        /* ── CONTEÚDO ── */
        $this->start_controls_section('sec_widget', [
            'label' => '⚙️ Widget',
            'tab'   => Controls_Manager::TAB_CONTENT,
        ]);
        $this->add_control('host_name', [
            'label'   => 'Nome do Host',
            'type'    => Controls_Manager::TEXT,
            'default' => 'Robison Kunz',
        ]);
        $this->add_control('default_theme', [
            'label'   => 'Tema padrão',
            'type'    => Controls_Manager::SELECT,
            'default' => 'dark',
            'options' => [ 'dark' => 'Escuro', 'light' => 'Claro' ],
        ]);
        $this->add_control('list_height', [
            'label'      => 'Altura do chat',
            'type'       => Controls_Manager::SLIDER,
            'size_units' => ['px'],
            'range'      => ['px' => ['min'=>150,'max'=>700,'step'=>10]],
            'default'    => ['unit'=>'px','size'=>340],
        ]);
        $this->add_control('cta_timestamp', [
            'label'       => 'Ativar CTA automaticamente no segundo',
            'type'        => Controls_Manager::NUMBER,
            'default'     => 0, 'min' => 0,
            'description' => '0 = desativado. Configure o conteúdo no painel Live Comments.',
        ]);
        $this->add_control('panel_link', [
            'type' => Controls_Manager::RAW_HTML,
            'raw'  => '<a href="'.admin_url('admin.php?page=wlc-admin').'" target="_blank"
                           style="display:inline-block;margin-top:4px;font-size:12px;color:#55A0EE;text-decoration:none">
                           → Abrir painel de controle Live Comments
                       </a>',
        ]);
        $this->end_controls_section();

        /* ── ESTILO ── */
        $this->start_controls_section('sec_colors', [
            'label' => 'Cores', 'tab' => Controls_Manager::TAB_STYLE,
        ]);
        $this->add_control('accent_color', [
            'label'   => 'Cor de destaque (botões, ícones, badges)',
            'type'    => Controls_Manager::COLOR,
            'default' => '#55A0EE',
        ]);
        $this->add_control('host_color', [
            'label'   => 'Cor do nome do host',
            'type'    => Controls_Manager::COLOR,
            'default' => '#e0a030',
        ]);
        $this->end_controls_section();

        $this->start_controls_section('sec_dims', [
            'label' => 'Dimensões', 'tab' => Controls_Manager::TAB_STYLE,
        ]);
        $this->add_control('border_radius', [
            'label'      => 'Arredondamento das bordas',
            'type'       => Controls_Manager::SLIDER,
            'size_units' => ['px'],
            'range'      => ['px' => ['min'=>0,'max'=>30]],
            'default'    => ['unit'=>'px','size'=>15],
        ]);
        $this->end_controls_section();

        $this->start_controls_section('sec_typo', [
            'label' => 'Tipografia', 'tab' => Controls_Manager::TAB_STYLE,
        ]);
        $this->add_group_control(Group_Control_Typography::get_type(), [
            'name'     => 'widget_typography',
            'selector' => '{{WRAPPER}} .lc-wrap',
        ]);
        $this->end_controls_section();
    }

    protected function render() {
        $s = $this->get_settings_for_display();
        $p = 'lcw' . $this->get_id();   /* prefixo único por instância */

        $accent = ! empty($s['accent_color']) ? $s['accent_color'] : '#55A0EE';
        $hcolor = ! empty($s['host_color'])   ? $s['host_color']   : '#e0a030';
        $lh     = ($s['list_height']['size'] ?? 340) . ($s['list_height']['unit'] ?? 'px');
        $brad   = ($s['border_radius']['size'] ?? 15) . ($s['border_radius']['unit'] ?? 'px');

        $webinar_id = get_the_ID() ? strval(get_the_ID()) : $p;
        $webinar_title = get_the_title() ? get_the_title() : 'Webinário ' . $this->get_id();

        $config = [
            'hostName'       => $s['host_name']     ?: 'Host',
            'defaultTheme'   => $s['default_theme'] ?: 'dark',
            'ctaTimestamp'   => (int)($s['cta_timestamp'] ?? 0),
            'restUrl'        => get_rest_url(null, 'wlc/v1/'),
            'restNonce'      => wp_create_nonce('wp_rest'),
            'supabaseUrl'    => wlc_get('supabase_url'),
            'supabaseAnonKey'=> wlc_get('supabase_anon_key'),
            'webinarId'      => $webinar_id,
            'webinarTitle'   => $webinar_title,
        ];
        $cfg = wp_json_encode($config, JSON_HEX_TAG | JSON_HEX_APOS | JSON_HEX_AMP);
        ?>

        <style>
        /* Variáveis de cor e tamanho — por instância */
        #<?php echo esc_attr($p); ?> {
            --lc-accent:     <?php echo esc_attr($accent); ?>;
            --lc-host-color: <?php echo esc_attr($hcolor); ?>;
            border-radius:   <?php echo esc_attr($brad); ?> !important;
        }
        #<?php echo esc_attr($p); ?> .lc-list {
            height: <?php echo esc_attr($lh); ?> !important;
        }
        </style>

        <div class="lc-wrap" id="<?php echo esc_attr($p); ?>" data-wlc="1">
        <div class="lc-wrap-inner">

            <!-- CTA Banner -->
            <div class="lc-cta-banner" id="<?php echo esc_attr($p); ?>-cta">
                <a class="lc-cta-link" id="<?php echo esc_attr($p); ?>-cta-link"
                   href="#" target="_blank" rel="noopener noreferrer">
                    <div class="lc-cta-pulse"></div>
                    <span id="<?php echo esc_attr($p); ?>-cta-text">🔥 Vagas abertas! Garanta sua vaga agora</span>
                    <svg viewBox="0 0 24 24" fill="none" stroke="#fff" stroke-width="2.5"
                         stroke-linecap="round" stroke-linejoin="round">
                        <line x1="5" y1="12" x2="19" y2="12"/>
                        <polyline points="12 5 19 12 12 19"/>
                    </svg>
                </a>
                <button class="lc-cta-close" id="<?php echo esc_attr($p); ?>-cta-close">×</button>
            </div>

            <!-- Barra staff (aparece após login) -->
            <div class="lc-staff-bar" id="<?php echo esc_attr($p); ?>-staff-bar">
                <span class="lc-staff-bar-label">⚡ Staff</span>
                <div class="lc-staff-name-tag" id="<?php echo esc_attr($p); ?>-staff-name-tag"></div>
                <div class="lc-staff-toggle-wrap">
                    <label class="lc-staff-switch">
                        <input type="checkbox" id="<?php echo esc_attr($p); ?>-staff-vis-toggle" checked>
                        <span class="lc-staff-slider"></span>
                    </label>
                    <span class="lc-staff-toggle-label">Ver todos os comentários</span>
                </div>
                <div class="lc-staff-toggle-wrap">
                    <label class="lc-staff-switch">
                        <input type="checkbox" id="<?php echo esc_attr($p); ?>-staff-cta-toggle">
                        <span class="lc-staff-slider"></span>
                    </label>
                    <span class="lc-staff-toggle-label">CTA ativo</span>
                </div>
                
                <!-- Dashboard Staff Real-Time -->
                <div class="lc-staff-dashboard" style="display: inline-flex; align-items: center; gap: 10px; margin: 0 10px; padding: 4px 10px; background: rgba(255,255,255,0.06); border: 1px solid rgba(255,255,255,0.1); border-radius: 4px; font-size: 11px; color: #fff;">
                    <span>🟢 <strong id="<?php echo esc_attr($p); ?>-staff-metrics-online">0</strong> online</span>
                    <span style="opacity: 0.3;">|</span>
                    <span>🛒 <strong id="<?php echo esc_attr($p); ?>-staff-metrics-cta">0</strong> cliques</span>
                </div>

                <span class="lc-staff-hint">Clique em um comentário para responder</span>
                <button class="lc-staff-logout" id="<?php echo esc_attr($p); ?>-staff-logout-btn">Sair</button>
            </div>

            <!-- Reply form staff -->
            <div class="lc-staff-reply-form" id="<?php echo esc_attr($p); ?>-staff-reply-form">
                <input type="hidden" id="<?php echo esc_attr($p); ?>-staff-reply-target">
                <div class="lc-staff-reply-label">↩ Respondendo comentário</div>
                <div class="lc-staff-reply-row">
                    <textarea class="lc-staff-reply-input"
                              id="<?php echo esc_attr($p); ?>-staff-reply-text"
                              placeholder="Digite a resposta do host..."></textarea>
                    <button class="lc-staff-reply-send" id="<?php echo esc_attr($p); ?>-staff-reply-send">Enviar</button>
                    <button class="lc-staff-reply-cancel" id="<?php echo esc_attr($p); ?>-staff-reply-cancel">✕</button>
                </div>
            </div>

            <!-- Header -->
            <div class="lc-header">
                <div class="lc-header-left">
                    <div class="lc-live-dot" id="<?php echo esc_attr($p); ?>-dot"></div>
                    <div class="lc-title">Comentários ao vivo</div>
                </div>
                <div class="lc-header-right">

                    <!-- Botão de acesso staff (cadeado) -->
                    <button class="lc-staff-access-btn"
                            id="<?php echo esc_attr($p); ?>-staff-access-btn"
                            title="Acesso da equipe">
                        <!-- Ícone cadeado minimalista -->
                        <svg viewBox="0 0 24 24" fill="none"
                             stroke="rgba(255,255,255,0.5)" stroke-width="2"
                             stroke-linecap="round" stroke-linejoin="round">
                            <rect x="5" y="11" width="14" height="10" rx="2"/>
                            <path d="M8 11V7a4 4 0 0 1 8 0v4"/>
                        </svg>
                        <span class="lc-staff-dot"></span>
                    </button>

                    <!-- Botão dark/light -->
                    <button class="lc-theme-toggle"
                            id="<?php echo esc_attr($p); ?>-toggle"
                            title="Alternar tema">
                        <svg class="lc-icon-moon" viewBox="0 0 24 24" fill="none"
                             stroke="rgba(255,255,255,0.5)" stroke-width="2"
                             stroke-linecap="round" stroke-linejoin="round">
                            <path d="M21 12.79A9 9 0 1 1 11.21 3 7 7 0 0 0 21 12.79z"/>
                        </svg>
                        <svg class="lc-icon-sun" viewBox="0 0 24 24" fill="none"
                             stroke="rgba(0,0,0,0.45)" stroke-width="2"
                             stroke-linecap="round" stroke-linejoin="round">
                            <circle cx="12" cy="12" r="5"/>
                            <line x1="12" y1="1"  x2="12" y2="3"/>
                            <line x1="12" y1="21" x2="12" y2="23"/>
                            <line x1="4.22" y1="4.22"   x2="5.64"  y2="5.64"/>
                            <line x1="18.36" y1="18.36" x2="19.78" y2="19.78"/>
                            <line x1="1"  y1="12" x2="3"  y2="12"/>
                            <line x1="21" y1="12" x2="23" y2="12"/>
                            <line x1="4.22"  y1="19.78" x2="5.64"  y2="18.36"/>
                            <line x1="18.36" y1="5.64"  x2="19.78" y2="4.22"/>
                        </svg>
                    </button>

                </div>
            </div>

            <!-- Lista de comentários -->
            <div class="lc-list" id="<?php echo esc_attr($p); ?>-list"></div>

            <!-- Typing indicator -->
            <div class="lc-typing" id="<?php echo esc_attr($p); ?>-typing">
                <div class="lc-typing-dots"><span></span><span></span><span></span></div>
                <div class="lc-typing-text" id="<?php echo esc_attr($p); ?>-typing-text">
                    alguém está digitando...
                </div>
            </div>

            <!-- Input do usuário -->
            <div class="lc-input-area">
                <input class="lc-name-input"
                       id="<?php echo esc_attr($p); ?>-name"
                       type="text" placeholder="Seu nome" maxlength="30">
                <textarea class="lc-text-input"
                          id="<?php echo esc_attr($p); ?>-text"
                          placeholder="Escreva seu comentário..."
                          maxlength="200"></textarea>
                <div class="lc-input-row">
                    <div class="lc-viewers">
                        <svg viewBox="0 0 24 24">
                            <path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2"/>
                            <circle cx="9" cy="7" r="4"/>
                            <path d="M23 21v-2a4 4 0 0 0-3-3.87"/>
                            <path d="M16 3.13a4 4 0 0 1 0 7.75"/>
                        </svg>
                        <span id="<?php echo esc_attr($p); ?>-viewer-count">
                            <?php echo esc_html(wlc_get('base_viewers') ?: 247); ?>
                        </span>
                        assistindo
                    </div>
                    <button class="lc-send-btn" id="<?php echo esc_attr($p); ?>-send">
                        Comentar
                    </button>
                </div>
            </div>

        </div><!-- .lc-wrap-inner -->

        <!-- Modal Staff — fora do lc-wrap-inner para usar position:fixed sem conflito -->
        <div class="lc-staff-overlay" id="<?php echo esc_attr($p); ?>-staff-overlay">
            <div class="lc-staff-card">
                <div class="lc-staff-card-header">
                    <div class="lc-staff-title">🔐 Acesso da Equipe</div>
                    <button class="lc-staff-close-btn"
                            id="<?php echo esc_attr($p); ?>-staff-close-btn">×</button>
                </div>
                <div class="lc-staff-error"
                     id="<?php echo esc_attr($p); ?>-staff-error"></div>
                <input class="lc-staff-input"
                       id="<?php echo esc_attr($p); ?>-staff-name-input"
                       type="text"
                       placeholder="Seu nome (ex: Ana — equipe)">
                <div class="lc-staff-pw-container">
                    <input class="lc-staff-input"
                           id="<?php echo esc_attr($p); ?>-staff-pw"
                           type="password"
                           placeholder="Senha da equipe">
                    <button class="lc-staff-pw-toggle" id="<?php echo esc_attr($p); ?>-staff-pw-toggle" type="button" title="Mostrar/Ocultar Senha">
                        <!-- Ícone do Olho Fechado (Default) -->
                        <svg class="lc-icon-eye-off" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
                            <path d="M17.94 17.94A10.07 10.07 0 0 1 12 20c-7 0-11-8-11-8a18.45 18.45 0 0 1 5.06-5.94M9.9 4.24A9.12 9.12 0 0 1 12 4c7 0 11 8 11 8a18.5 18.5 0 0 1-2.16 3.19m-6.72-1.07a3 3 0 1 1-4.24-4.24"/>
                            <line x1="1" y1="1" x2="23" y2="23"/>
                        </svg>
                        <!-- Ícone do Olho Aberto (Revealed) -->
                        <svg class="lc-icon-eye" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" style="display: none;">
                            <path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z"/>
                            <circle cx="12" cy="12" r="3"/>
                        </svg>
                    </button>
                </div>
                <button class="lc-staff-btn"
                        id="<?php echo esc_attr($p); ?>-staff-login-btn">
                    Entrar como Staff
                </button>
            </div>
        </div>

        </div><!-- .lc-wrap -->

        <script>
        window.WLCWidgets = window.WLCWidgets || {};
        window.WLCWidgets['<?php echo esc_js($p); ?>'] = <?php echo $cfg; ?>;
        if (typeof window.WLCInit === 'function') {
            window.WLCInit('<?php echo esc_js($p); ?>');
        }
        </script>
        <?php
    }
}
