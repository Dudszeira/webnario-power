/* Live Comments — Admin JS */
(function ($) {
    'use strict';

    /* ── Feedback helper ── */
    function fb(id, msg, isOk) {
        var el = $('#' + id);
        el.removeClass('ok err').addClass(isOk ? 'ok' : 'err').text(msg);
        clearTimeout(el.data('t'));
        el.data('t', setTimeout(function () { el.removeClass('ok err').text(''); }, 4000));
    }

    /* ── AJAX helper ── */
    function wlcAjax(action, data, fbId, successMsg) {
        var btn = $('[data-action="' + action + '"]');
        btn.prop('disabled', true).text('Salvando...');
        $.post(WLC_ADMIN.ajaxUrl, $.extend({ action: action, nonce: WLC_ADMIN.nonce }, data))
            .done(function (res) {
                if (res.success) {
                    fb(fbId, successMsg || '✓ Salvo com sucesso!', true);
                    if (res.data && res.data.count !== undefined) {
                        fb(fbId, '✓ ' + res.data.count + ' itens salvos!', true);
                    }
                } else {
                    fb(fbId, '✗ ' + (res.data || 'Erro.'), false);
                }
            })
            .fail(function () { fb(fbId, '✗ Falha na requisição.', false); })
            .always(function () { btn.prop('disabled', false).text(btn.data('orig') || 'Salvar'); });
    }

    /* ── Salva label original dos botões ── */
    $('[data-action]').each(function () { $(this).data('orig', $(this).text()); });

    /* ── Conexão Supabase ── */
    $('[data-action="wlc_save_connection"]').on('click', function () {
        wlcAjax('wlc_save_connection', {
            supabase_url:         $('#wlc-sb-url').val(),
            supabase_anon_key:    $('#wlc-sb-anon').val(),
            supabase_service_key: $('#wlc-sb-service').val(),
        }, 'fb-connection', '✓ Conexão salva!');
    });

    /* ── Comportamento ── */
    $('[data-action="wlc_save_general"]').on('click', function () {
        wlcAjax('wlc_save_general', {
            fake_min_interval: $('#wlc-min-int').val(),
            fake_max_interval: $('#wlc-max-int').val(),
            base_viewers:      $('#wlc-viewers').val(),
        }, 'fb-general');
    });

    /* ── Senha ── */
    $('[data-action="wlc_save_password"]').on('click', function () {
        var pw1 = $('#wlc-pw-new').val().trim();
        var pw2 = $('#wlc-pw-confirm').val().trim();
        if (!pw1) { fb('fb-password', '✗ Digite a nova senha.', false); return; }
        if (pw1 !== pw2) { fb('fb-password', '✗ As senhas não conferem.', false); return; }
        wlcAjax('wlc_save_password', { staff_password: pw1 }, 'fb-password', '✓ Senha atualizada!');
        $('#wlc-pw-new, #wlc-pw-confirm').val('');
    });

    /* ── Visibilidade ── */
    $('[data-action="wlc_save_visibility"]').on('click', function () {
        wlcAjax('wlc_save_visibility', {
            show_user_comments: $('#wlc-show-users').is(':checked') ? '1' : '0',
        }, 'fb-visibility', '✓ Aplicado em tempo real!');
    });

    /* ── CTA ── */
    $('[data-action="wlc_save_cta"]').on('click', function () {
        wlcAjax('wlc_save_cta', {
            cta_visible: $('#wlc-cta-vis').is(':checked') ? '1' : '0',
            cta_text:    $('#wlc-cta-text').val(),
            cta_url:     $('#wlc-cta-url').val(),
        }, 'fb-cta', '✓ CTA atualizado!');
    });

    /* ── Comentários simulados ── */
    function validateJson(textareaId, countId) {
        var raw = $(textareaId).val().trim();
        if (!raw) return null;
        try {
            var parsed = JSON.parse(raw);
            if (!Array.isArray(parsed)) throw new Error('Deve ser um array.');
            $(countId).text('(' + parsed.length + ' itens)');
            return parsed;
        } catch (e) {
            return e.message;
        }
    }

    $('#wlc-fake-validate').on('click', function () {
        var result = validateJson('#wlc-fake-json', '#wlc-fake-count');
        if (typeof result === 'string') fb('fb-fake', '✗ ' + result, false);
        else if (result) fb('fb-fake', '✓ JSON válido — ' + result.length + ' comentários.', true);
        else fb('fb-fake', '✗ Campo vazio.', false);
    });

    $('[data-action="wlc_save_fake"]').on('click', function () {
        var raw = $('#wlc-fake-json').val().trim();
        if (!raw) { fb('fb-fake', '✗ Campo vazio.', false); return; }
        try { JSON.parse(raw); } catch (e) { fb('fb-fake', '✗ JSON inválido: ' + e.message, false); return; }
        wlcAjax('wlc_save_fake', { fake_comments_json: raw }, 'fb-fake');
    });

    /* ── Timestamps ── */
    $('#wlc-ts-validate').on('click', function () {
        var result = validateJson('#wlc-ts-json', '#wlc-ts-count');
        if (typeof result === 'string') fb('fb-timestamps', '✗ ' + result, false);
        else if (result) fb('fb-timestamps', '✓ JSON válido — ' + result.length + ' timestamps.', true);
        else fb('fb-timestamps', '✗ Campo vazio.', false);
    });

    $('[data-action="wlc_save_timestamps"]').on('click', function () {
        var raw = $('#wlc-ts-json').val().trim();
        if (!raw) { fb('fb-timestamps', '✗ Campo vazio.', false); return; }
        try { JSON.parse(raw); } catch (e) { fb('fb-timestamps', '✗ JSON inválido: ' + e.message, false); return; }
        wlcAjax('wlc_save_timestamps', { timestamp_json: raw }, 'fb-timestamps');
    });

    /* ── Sincronizar tudo ── */
    $('#wlc-sync-all').on('click', function () {
        var btn = $(this);
        btn.prop('disabled', true).text('Sincronizando...');
        $.post(WLC_ADMIN.ajaxUrl, { action: 'wlc_sync_supabase', nonce: WLC_ADMIN.nonce })
            .done(function (res) {
                if (res.success) {
                    btn.text('✓ Sincronizado!');
                    setTimeout(function () { btn.prop('disabled', false).text('↑ Sincronizar tudo com Supabase'); }, 2500);
                } else {
                    btn.text('✗ Erro: ' + (res.data || 'verifique as chaves'));
                    setTimeout(function () { btn.prop('disabled', false).text('↑ Sincronizar tudo com Supabase'); }, 3000);
                }
            })
            .fail(function () {
                btn.prop('disabled', false).text('↑ Sincronizar tudo com Supabase');
            });
    });

    /* ── Importação de CSV para Timestamps ── */
    $('#wlc-csv-file').on('change', function (e) {
        var file = e.target.files[0];
        if (!file) return;

        var reader = new FileReader();
        reader.onload = function (evt) {
            var text = evt.target.result;
            var lines = text.split(/\r\n|\n/);
            if (lines.length < 2) {
                $('#wlc-csv-status').css('color', 'var(--wlc-red)').text('Erro: Arquivo CSV vazio ou inválido.');
                return;
            }

            // Função para parsear linha de CSV suportando aspas duplas com vírgulas internas
            function parseCSVLine(line) {
                var result = [];
                var current = '';
                var inQuotes = false;
                for (var i = 0; i < line.length; i++) {
                    var char = line[i];
                    if (char === '"') {
                        inQuotes = !inQuotes;
                    } else if (char === ',' && !inQuotes) {
                        result.push(current.trim());
                        current = '';
                    } else {
                        current += char;
                    }
                }
                result.push(current.trim());
                return result;
            }

            var parsedHeaders = parseCSVLine(lines[0]);
            var hourIdx = parsedHeaders.map(function(h){ return h.toLowerCase().trim(); }).indexOf('hour');
            var minIdx = parsedHeaders.map(function(h){ return h.toLowerCase().trim(); }).indexOf('minute');
            var secIdx = parsedHeaders.map(function(h){ return h.toLowerCase().trim(); }).indexOf('second');
            var nameIdx = parsedHeaders.map(function(h){ return h.toLowerCase().trim(); }).indexOf('name');
            var msgIdx = parsedHeaders.map(function(h){ return h.toLowerCase().trim(); }).indexOf('message');
            var roleIdx = parsedHeaders.map(function(h){ return h.toLowerCase().trim(); }).indexOf('role');

            if (hourIdx === -1 || minIdx === -1 || secIdx === -1 || nameIdx === -1 || msgIdx === -1) {
                $('#wlc-csv-status').css('color', 'var(--wlc-red)').text('Erro: Colunas básicas Hour, Minute, Second, Name, Message não encontradas no cabeçalho.');
                return;
            }

            var items = [];
            for (var i = 1; i < lines.length; i++) {
                var line = lines[i].trim();
                if (!line) continue;
                var cols = parseCSVLine(line);
                if (cols.length < 5) continue;

                var hour = parseInt(cols[hourIdx] || 0, 10);
                var minute = parseInt(cols[minIdx] || 0, 10);
                var second = parseInt(cols[secIdx] || 0, 10);
                var name = cols[nameIdx] || '';
                var message = cols[msgIdx] || '';
                var role = roleIdx !== -1 ? (cols[roleIdx] || '') : '';

                // Remove aspas do início e fim do texto se houver
                name = name.replace(/^"|"$/g, '').trim();
                message = message.replace(/^"|"$/g, '').trim();

                var timeInSeconds = (hour * 3600) + (minute * 60) + second;

                if (name && message) {
                    var comment = {
                        time: timeInSeconds,
                        name: name,
                        text: message
                    };
                    if (role.toLowerCase() === 'admin') {
                        comment.type = 'host';
                    }
                    items.push(comment);
                }
            }

            if (items.length > 0) {
                var jsonStr = JSON.stringify(items, null, 4);
                $('#wlc-ts-json').val(jsonStr);
                $('#wlc-ts-count').text('(' + items.length + ' itens)');
                $('#wlc-csv-status').css('color', 'var(--wlc-green)').text('✓ ' + items.length + ' comentários importados!');
                fb('fb-timestamps', '✓ CSV importado com sucesso! Lembre-se de salvar as alterações abaixo.', true);
            } else {
                $('#wlc-csv-status').css('color', 'var(--wlc-red)').text('Nenhum comentário válido encontrado no CSV.');
            }
        };
        reader.readAsText(file, 'UTF-8');
    });
    /* ── Executa testes de diagnósticos do backend ── */
    $('#wlc-btn-run-diagnostics').on('click', function () {
        var btn = $(this);
        var resultsBox = $('#wlc-diagnostics-results');
        
        btn.prop('disabled', true).text('⚡ Executando testes...');
        resultsBox.hide().html('');
        
        $.post(WLC_ADMIN.ajaxUrl, {
            action: 'wlc_run_diagnostics',
            nonce: WLC_ADMIN.nonce
        })
        .done(function (res) {
            if (res.success && Array.isArray(res.data)) {
                resultsBox.css('display', 'flex');
                res.data.forEach(function (item) {
                    var iconColor = 'var(--wlc-green)';
                    var icon = '✓';
                    if (item.status === 'warn') {
                        iconColor = 'var(--wlc-accent)';
                        icon = '⚠️';
                    } else if (item.status === 'err') {
                        iconColor = 'var(--wlc-red)';
                        icon = '✗';
                    } else if (item.status === 'info') {
                        iconColor = '#3b82f6';
                        icon = 'ℹ️';
                    }
                    
                    var html = '<div style="display: flex; align-items: flex-start; gap: 10px; padding: 12px; background: rgba(255,255,255,0.02); border: 1px solid rgba(255,255,255,0.06); border-radius: 6px;">' +
                        '<div style="font-size: 16px; min-width: 24px; text-align: center; color: ' + iconColor + ';">' + icon + '</div>' +
                        '<div>' +
                            '<div style="font-weight: 600; color: #fff; font-size: 13px;">' + item.title + '</div>' +
                            '<div style="font-size: 11.5px; color: var(--wlc-muted); margin-top: 2px;">' + item.desc + '</div>' +
                        '</div>' +
                    '</div>';
                    resultsBox.append(html);
                });
            } else {
                resultsBox.css('display', 'flex').html('<div style="color: var(--wlc-red); font-size: 12px; padding: 10px; background: rgba(239,68,68,0.05); border: 1px solid rgba(239,68,68,0.15); border-radius: 6px;">✗ Erro ao carregar diagnósticos: ' + (res.data || 'Erro desconhecido') + '</div>');
            }
        })
        .fail(function () {
            resultsBox.css('display', 'flex').html('<div style="color: var(--wlc-red); font-size: 12px; padding: 10px; background: rgba(239,68,68,0.05); border: 1px solid rgba(239,68,68,0.15); border-radius: 6px;">✗ Falha de rede ao se comunicar com a REST API local.</div>');
        })
        .always(function () {
            btn.prop('disabled', false).text('⚡ Executar Testes de Integridade');
        });
    });
    /* ── Conta itens nos JSONs ao carregar ── */
    [['#wlc-fake-json', '#wlc-fake-count'], ['#wlc-ts-json', '#wlc-ts-count']].forEach(function (p) {
        try {
            var parsed = JSON.parse($(p[0]).val());
            if (Array.isArray(parsed)) $(p[1]).text('(' + parsed.length + ' itens)');
        } catch (e) {}
    });

    /* ── Poller de métricas real-time para o Admin ── */
    function updateAdminMetrics() {
        if (!window.WLC_ADMIN || !window.WLC_ADMIN.restUrl) return;
        var endpoint = window.WLC_ADMIN.restUrl + 'metrics?webinar_id=all';
        $.ajax({
            url: endpoint,
            method: 'GET',
            beforeSend: function(xhr) {
                xhr.setRequestHeader('X-WP-Nonce', window.WLC_ADMIN.restNonce);
            }
        })
        .done(function(data) {
            $('#wlc-admin-metrics-online').text(data.online || 0);
            $('#wlc-admin-metrics-cta').text(data.cta_clicks || 0);
            $('#wlc-admin-metrics-views').text(data.total_views || 0);
        })
        .fail(function() {});
    }
    
    if ($('#wlc-admin-metrics-online').length) {
        updateAdminMetrics();
        setInterval(updateAdminMetrics, 5000); // atualiza a cada 5 segundos
    }

})(jQuery);
