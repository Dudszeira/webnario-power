/* ═══════════════════════════════════════════════════
   Live Comments Widget JS — v2.6.1
   - Botão de cadeado no header para acesso staff
   - Modal com position:fixed (foge do Elementor)
   - Senha verificada via REST WP (servidor)
   - Settings carregadas da REST API
   - Guard anti-dupla-init
═══════════════════════════════════════════════════ */
(function () {
    'use strict';
    window.WLCWidgets = window.WLCWidgets || {};

    function WLCInit(p) {
        /* Permite resetar sessões e cache locais via parâmetro na URL (?wlc_clear=1) */
        if (window.location.search.indexOf('wlc_clear=1') !== -1) {
            try {
                localStorage.removeItem('lc_username');
                localStorage.removeItem('lc_sid');
                localStorage.removeItem('lc_staff_' + p);
                // Remove o parâmetro da URL de forma limpa sem recarregar a página
                var newUrl = window.location.protocol + "//" + window.location.host + window.location.pathname;
                var search = window.location.search.replace(/[\?&]wlc_clear=1/, '');
                if (search && search !== '?') {
                    if (search.indexOf('&') === 0) search = '?' + search.substr(1);
                    newUrl += search;
                }
                window.history.replaceState({ path: newUrl }, '', newUrl);
            } catch(e) {}
        }

        var wrap = document.getElementById(p);
        if (!wrap || wrap.dataset.wlcReady === '1') return;
        wrap.dataset.wlcReady = '1';

        var LC = window.WLCWidgets[p];
        if (!LC) return;

        /* ── Helper: elemento com prefixo ── */
        function q(id) { return document.getElementById(p + (id ? '-' + id : '')); }

        /* ── Supabase (realtime, opcional) ── */
        var _sb = null;
        var _replyChannel = null;
        try {
            if (LC.supabaseUrl && LC.supabaseUrl.length > 15 && LC.supabaseUrl.indexOf('XXXX') === -1) {
                _sb = window.supabase.createClient(LC.supabaseUrl, LC.supabaseAnonKey);
            }
        } catch(e) {}

        /* ── Session ID ── */
        var lcSid = (function(){
            var k='lc_sid', id=localStorage.getItem(k);
            if(!id){ id=Math.random().toString(36).substr(2,12); localStorage.setItem(k,id); }
            return id;
        })();

        /* ── Estado ── */
        var settings = { showUserComments:true, ctaVisible:false, ctaUrl:'#', ctaText:'🔥 Vagas abertas!' };
        var ctaClosedByUser = false;
        var isStaff = false;
        var staffName = '';
        var staffToken = '';

        /* ── Helpers ── */
        var COLORS = ['#55A0EE','#EE8855','#55EEA0','#EE55A0','#A055EE','#EED555','#55D5EE','#EE5555'];
        function pickColor(n){ var h=0; for(var i=0;i<n.length;i++) h=n.charCodeAt(i)+((h<<5)-h); return COLORS[Math.abs(h)%COLORS.length]; }
        function initial(n){ return n.trim().charAt(0).toUpperCase(); }
        function rand(a,b){ return Math.floor(Math.random()*(b-a+1))+a; }
        function esc(s){ return String(s).replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;').replace(/"/g,'&quot;').replace(/'/g,'&#x27;'); }
        /* ── Heartbeat and tracking ── */
        function sendTrackingEvent(event) {
            var url = LC.restUrl + 'heartbeat';
            var data = {
                session_id: lcSid,
                webinar_id: LC.webinarId || 'default',
                event: event || 'heartbeat'
            };
            
            if (event === 'leave' && typeof navigator.sendBeacon === 'function') {
                var blob = new Blob([JSON.stringify(data)], { type: 'application/json' });
                navigator.sendBeacon(url, blob);
                return;
            }
            
            fetch(url, {
                method: 'POST',
                headers: { 
                    'Content-Type': 'application/json'
                },
                body: JSON.stringify(data)
            }).catch(function(){});
        }
        
        function initTracking() {
            sendTrackingEvent('heartbeat');
            
            setInterval(function() {
                sendTrackingEvent('heartbeat');
            }, 30000);
            
            window.addEventListener('beforeunload', function() {
                sendTrackingEvent('leave');
            });
        }

        /* ════════════════════
           TEMA DARK/LIGHT
           (chave única por instância)
        ════════════════════ */
        var themeKey = 'lc_theme_' + p;
        function initTheme(){
            var btn = q('toggle');
            if(!btn) return;
            var saved = localStorage.getItem(themeKey) || LC.defaultTheme || 'dark';
            if(saved==='light') wrap.classList.add('lc-light');
            btn.addEventListener('click', function(){
                wrap.classList.toggle('lc-light');
                localStorage.setItem(themeKey, wrap.classList.contains('lc-light') ? 'light' : 'dark');
            });
        }

        /* ════════════════════
           CTA
        ════════════════════ */
        function updateCTA(){
            var banner=q('cta'), link=q('cta-link'), txt=q('cta-text');
            if(!banner) return;
            if(settings.ctaVisible && !ctaClosedByUser){
                if(link) link.href = settings.ctaUrl||'#';
                if(txt)  txt.textContent = settings.ctaText;
                banner.classList.add('lc-cta-visible');
            } else {
                banner.classList.remove('lc-cta-visible');
            }
        }
        function initCTA(){
            var cb=q('cta-close');
            if(cb) cb.addEventListener('click',function(){ ctaClosedByUser=true; var b=q('cta'); if(b) b.classList.remove('lc-cta-visible'); });
            
            var link=q('cta-link');
            if(link) {
                link.addEventListener('click', function() {
                    sendTrackingEvent('cta_click');
                });
            }
        }

        /* ════════════════════
           MODAL STAFF
           position:fixed — escapa overflow:hidden do Elementor
        ════════════════════ */
        function initStaffModal(){
            var accessBtn = q('staff-access-btn');
            var overlay   = q('staff-overlay');
            var closeBtn  = q('staff-close-btn');
            var loginBtn  = q('staff-login-btn');
            var nameInput = q('staff-name-input');
            var pwInput   = q('staff-pw');
            var pwToggle  = q('staff-pw-toggle');
            var errorEl   = q('staff-error');

            function openModal(){
                if(!overlay) return;
                overlay.classList.add('lc-staff-open');
                if(nameInput){ nameInput.value=''; nameInput.focus(); }
                if(pwInput){
                    pwInput.value='';
                    pwInput.type='password';
                }
                var eyeOn = pwToggle ? pwToggle.querySelector('.lc-icon-eye') : null;
                var eyeOff = pwToggle ? pwToggle.querySelector('.lc-icon-eye-off') : null;
                if(eyeOn)  eyeOn.style.setProperty('display', 'none', 'important');
                if(eyeOff) eyeOff.style.setProperty('display', 'block', 'important');
                if(errorEl)   errorEl.classList.remove('lc-show');
            }
            function closeModal(){
                if(overlay) overlay.classList.remove('lc-staff-open');
            }

            if(accessBtn) accessBtn.addEventListener('click', openModal);
            if(closeBtn)  closeBtn.addEventListener('click',  closeModal);
            if(overlay)   overlay.addEventListener('click', function(e){ if(e.target===overlay) closeModal(); });

            if (pwToggle) {
                pwToggle.addEventListener('click', function() {
                    if (!pwInput) return;
                    var eyeOn = pwToggle.querySelector('.lc-icon-eye');
                    var eyeOff = pwToggle.querySelector('.lc-icon-eye-off');
                    if (pwInput.type === 'password') {
                        pwInput.type = 'text';
                        if(eyeOn)  eyeOn.style.setProperty('display', 'block', 'important');
                        if(eyeOff) eyeOff.style.setProperty('display', 'none', 'important');
                    } else {
                        pwInput.type = 'password';
                        if(eyeOn)  eyeOn.style.setProperty('display', 'none', 'important');
                        if(eyeOff) eyeOff.style.setProperty('display', 'block', 'important');
                    }
                });
            }

            /* ESC fecha o modal */
            document.addEventListener('keydown', function(e){ if(e.key==='Escape') closeModal(); });

            function doLogin(){
                var name = nameInput ? nameInput.value.trim() : '';
                var pw   = pwInput   ? pwInput.value           : '';
                if(!name){ showError('Digite seu nome.'); return; }
                if(!pw)  { showError('Digite a senha.');  return; }
                if(loginBtn){ loginBtn.disabled=true; loginBtn.textContent='Verificando...'; }

                fetch(LC.restUrl+'staff-auth',{
                    method:'POST',
                    headers:{ 'Content-Type':'application/json' },
                    body: JSON.stringify({ password: pw })
                })
                .then(function(r){ if(r.ok) return r.json(); throw new Error('fail'); })
                .then(function(data){
                    if(data.ok){
                        isStaff   = true;
                        staffName = name;
                        staffToken = data.token || '';
                        localStorage.setItem('lc_staff_'+p, JSON.stringify({name:name, token:staffToken, ts:Date.now()}));
                        closeModal();
                        activateStaffBar();
                    }
                })
                .catch(function(){
                    showError('Senha incorreta.');
                    if(loginBtn){ loginBtn.disabled=false; loginBtn.textContent='Entrar como Staff'; }
                });
            }

            function showError(msg){
                if(errorEl){ errorEl.textContent=msg; errorEl.classList.add('lc-show'); }
                if(loginBtn){ loginBtn.disabled=false; loginBtn.textContent='Entrar como Staff'; }
            }

            if(loginBtn) loginBtn.addEventListener('click', doLogin);
            if(pwInput)  pwInput.addEventListener('keydown', function(e){ if(e.key==='Enter') doLogin(); });
            if(nameInput) nameInput.addEventListener('keydown', function(e){ if(e.key==='Enter') pwInput&&pwInput.focus(); });
        }

        /* ════════════════════
           BARRA STAFF (pós-login)
        ════════════════════ */
        function activateStaffBar(){
            var bar       = q('staff-bar');
            var nameTag   = q('staff-name-tag');
            var visToggle = q('staff-vis-toggle');
            var ctaToggle = q('staff-cta-toggle');
            var logoutBtn = q('staff-logout-btn');
            var accessBtn = q('staff-access-btn');

            wrap.dataset.staff = '1';
            if(bar)     bar.classList.add('lc-staff-active');
            if(nameTag) nameTag.textContent = staffName;
            if(visToggle) visToggle.checked = settings.showUserComments;
            if(ctaToggle) ctaToggle.checked = settings.ctaVisible;

            /* Visibilidade */
            if(visToggle) visToggle.addEventListener('change', function(){
                settings.showUserComments = visToggle.checked;
                pushSetting('show_user_comments', visToggle.checked?'true':'false');
            });

            /* CTA */
            if(ctaToggle) ctaToggle.addEventListener('change', function(){
                settings.ctaVisible = ctaToggle.checked;
                ctaClosedByUser = false;
                updateCTA();
                pushSetting('cta_visible', ctaToggle.checked?'true':'false');
            });

            var metricsInterval = null;

            /* Logout */
            if(logoutBtn) logoutBtn.addEventListener('click', function(){
                isStaff=false; staffName=''; staffToken='';
                localStorage.removeItem('lc_staff_'+p);
                delete wrap.dataset.staff;
                if(bar) bar.classList.remove('lc-staff-active');
                var rf = q('staff-reply-form');
                if(rf) rf.classList.remove('lc-reply-open');
                if(metricsInterval) clearInterval(metricsInterval);
                loadRealComments(); // Volta para o contexto de participante comum (limpa e recarrega)
            });

            /* Clique em comentário = responder */
            var list = q('list');
            var replyForm = q('staff-reply-form');
            if(list && replyForm){
                list.addEventListener('click', function(e){
                    if(!isStaff) return;
                    var card = e.target.closest('.lc-comment[data-id]');
                    if(!card) return;
                    var tgt = q('staff-reply-target');
                    var rtx = q('staff-reply-text');
                    if(tgt) tgt.value = card.dataset.id;
                    if(rtx) rtx.value = '';
                    replyForm.classList.add('lc-reply-open');
                    if(rtx) rtx.focus();
                });
                var sendBtn   = q('staff-reply-send');
                var cancelBtn = q('staff-reply-cancel');
                if(sendBtn) sendBtn.addEventListener('click', function(){
                    var id  = q('staff-reply-target') ? q('staff-reply-target').value : '';
                    var txt = q('staff-reply-text')   ? q('staff-reply-text').value.trim() : '';
                    if(!id||!txt) return;
                    sendBtn.disabled=true;
                    
                    var replyId = String(id); /* força string — data-id no DOM sempre é string */

                    // Salva a resposta localmente no banco do WordPress e sincroniza no Supabase (usando a service_role key segura do servidor)
                    fetch(LC.restUrl + 'save-comment', {
                        method: 'POST',
                        headers: { 'Content-Type': 'application/json' },
                        body: JSON.stringify({
                            webinar_id: LC.webinarId,
                            webinar_title: LC.webinarTitle,
                            time_offset: (typeof getVideoTime === 'function' ? Math.max(0, getVideoTime()) : 0),
                            name: LC.hostName || 'Host',
                            message: txt,
                            role: 'Admin',
                            mode: 'Highlighted',
                            reply_to: replyId,
                            staff_token: staffToken || ''
                        })
                    })
                    .then(function(r){
                        if(r.ok) return r.json();
                        throw new Error('Falha no servidor');
                    })
                    .then(function(data){
                        if(data.success){
                            /* Atualiza DOM da staff */
                            updateReply(replyId, txt);
                            /* Broadcast redundante rápido */
                            if(_replyChannel) _replyChannel.send({type:'broadcast',event:'reply',payload:{id:replyId,reply:txt}});
                            replyForm.classList.remove('lc-reply-open');
                        } else {
                            alert("Falha ao salvar a resposta.");
                        }
                        sendBtn.disabled=false;
                    })
                    .catch(function(err){
                        console.error("Save Reply Error:", err);
                        alert("Erro de conexão ao salvar resposta no servidor.");
                        sendBtn.disabled=false;
                    });
                });
                if(cancelBtn) cancelBtn.addEventListener('click', function(){ replyForm.classList.remove('lc-reply-open'); });
            }

            function updateStaffMetrics() {
                if (!isStaff) return;
                fetch(LC.restUrl + 'metrics?webinar_id=' + encodeURIComponent(LC.webinarId || 'default'))
                .then(function(r){ if(r.ok) return r.json(); throw new Error(); })
                .then(function(data){
                    var onlineEl = q('staff-metrics-online');
                    var ctaEl = q('staff-metrics-cta');
                    if (onlineEl) onlineEl.textContent = data.online || 0;
                    if (ctaEl) ctaEl.textContent = data.cta_clicks || 0;
                })
                .catch(function(){});
            }
            
            updateStaffMetrics();
            metricsInterval = setInterval(updateStaffMetrics, 10000);
            loadRealComments(); // Ao carregar o modo Staff, limpa a tela e puxa tudo
        }

        /* Envia setting ao Supabase */
        function pushSetting(key, value){
            if(_sb) _sb.from('settings').upsert({key:key,value:value},{onConflict:'key'});
        }

        /* ════════════════════
           COMENTÁRIOS DOM
        ════════════════════ */
        function addComment(name, text, type, reply, dbId){
            var list=q('list'); if(!list) return null;
            var c=document.createElement('div');
            c.className='lc-comment';
            if(dbId) c.dataset.id=String(dbId); /* sempre string para querySelector funcionar */
            var nc='lc-comment-name', badge='';
            if(type==='host'){ nc+=' lc-host-name'; badge='<span class="lc-badge lc-badge-host">Host</span>'; }
            if(type==='user'){ nc+=' lc-user-name';  badge='<span class="lc-badge lc-badge-you">Você</span>'; }
            var rh=reply?'<div class="lc-reply"><div class="lc-reply-label">'+esc(LC.hostName)+' respondeu</div><div class="lc-reply-text">'+esc(reply)+'</div></div>':'';
            var col=type==='host'?'var(--lc-host-color)':pickColor(name);
            /* BUGFIX: 'var(--lc-host-color)22' é CSS inválido — usa rgba() para o fundo do host */
            var bg=type==='host'?'rgba(224,160,48,0.13)':col+'22';
            c.innerHTML='<div class="lc-avatar" style="background:'+bg+';color:'+col+'">'+initial(name)+'</div>'+
                '<div class="lc-comment-body"><div class="'+nc+'">'+esc(name)+badge+'</div>'+
                '<div class="lc-comment-text">'+esc(text)+'</div>'+rh+'</div>';
            list.appendChild(c);
            list.scrollTop=list.scrollHeight;
            return c;
        }

        function updateReply(id, replyText){
            var list=q('list'); if(!list) return;
            var c=list.querySelector('[data-id="'+id+'"]'); if(!c) return;
            var ex=c.querySelector('.lc-reply');
            var html='<div class="lc-reply"><div class="lc-reply-label">'+esc(LC.hostName)+' respondeu</div><div class="lc-reply-text">'+esc(replyText)+'</div></div>';
            if(ex) ex.outerHTML=html;
            else { var bd=c.querySelector('.lc-comment-body'); if(bd) bd.insertAdjacentHTML('beforeend',html); }
            list.scrollTop=list.scrollHeight;
        }

        /* ── Typing ── */
        var _tt=null;
        function showTyping(name){
            var el=q('typing'),tx=q('typing-text'); if(!el||!tx) return;
            tx.textContent=name+' está digitando...';
            el.classList.add('visible');
            clearTimeout(_tt);
            _tt=setTimeout(function(){ el.classList.remove('visible'); },2200);
        }

        /* ── Espectadores ── */
        function startViewers(){
            var el=q('viewer-count'); var cur=LC.baseViewers||247;
            setInterval(function(){
                cur+=rand(-3,5);
                cur=Math.max((LC.baseViewers||247)-20,Math.min((LC.baseViewers||247)+40,cur));
                if(el) el.textContent=cur;
            }, rand(8000,15000));
        }

        /* ── Comentários falsos ── */
        var fakeUsed=[], _fakeTimer=null;
        function nextFake(){
            /* Guard: encerra timer se o elemento foi removido do DOM */
            if(!document.getElementById(p)) return;
            var fc=LC.fakeComments;
            if(!fc||!fc.length) return;
            if(fakeUsed.length>=fc.length) fakeUsed=[];
            var av=fc.filter(function(_,i){ return fakeUsed.indexOf(i)===-1; });
            if(!av.length) return;
            var pick=av[rand(0,av.length-1)];
            fakeUsed.push(fc.indexOf(pick));
            showTyping(pick.name);
            setTimeout(function(){ addComment(pick.name,pick.text,'fake'); },rand(1500,2500));
            _fakeTimer=setTimeout(nextFake, rand(LC.fakeMinInterval||12, LC.fakeMaxInterval||35)*1000);
        }

        /* ── YouTube time ── */
        function getVideoTime(){
            try {
                var now = new Date();
                var day = now.getDay(); // 0 = Domingo, 1 = Segunda, 2 = Terça, etc.
                if (day === 2) {
                    var hr = now.getHours();
                    var min = now.getMinutes();
                    var sec = now.getSeconds();
                    if (hr >= 20) {
                        var elapsed = (hr - 20) * 3600 + min * 60 + sec;
                        return elapsed;
                    }
                }
            } catch(e) {}

            try{
                if(window.wbnPlayer&&typeof window.wbnPlayer.getCurrentTime==='function') return Math.floor(window.wbnPlayer.getCurrentTime());
                if(window.ytPlayer&&typeof window.ytPlayer.getCurrentTime==='function')   return Math.floor(window.ytPlayer.getCurrentTime());
            }catch(e){}
            return -1; /* -1 = player não disponível */
        }

        /* ── Timestamps ── */
        var shownTs=[], ctaAutoTriggered=false;
        function startTimestamps(){
            var hasTs=LC.timestampComments&&LC.timestampComments.length;
            var hasCta=LC.ctaTimestamp>0;
            if(!hasTs&&!hasCta) return;
            
            var initialTimeChecked = false;
            
            setInterval(function(){
                var t=getVideoTime();
                if(t<0) return; /* player não disponível ainda */
                
                if (!initialTimeChecked) {
                    initialTimeChecked = true;
                    if (hasTs) {
                        var pastComments = [];
                        LC.timestampComments.forEach(function(tc,i){
                            if(t >= tc.time) {
                                shownTs.push(i);
                                pastComments.push(tc);
                            }
                        });
                        pastComments.sort(function(a,b){ return a.time - b.time; });
                        
                        // Limita o histórico inicial a 40 comentários recentes para evitar lentidão
                        if(pastComments.length > 40) {
                            pastComments = pastComments.slice(pastComments.length - 40);
                        }
                        
                        pastComments.forEach(function(tc){
                            addComment(tc.name, tc.text, tc.type||'fake', tc.reply||null);
                        });
                    }
                } else {
                    if(hasTs) LC.timestampComments.forEach(function(tc,i){
                        if(shownTs.indexOf(i)!==-1||t<tc.time) return;
                        shownTs.push(i);
                        showTyping(tc.name);
                        setTimeout(function(){ addComment(tc.name,tc.text,tc.type||'fake',tc.reply||null); },rand(1500,2500));
                    });
                }
                
                if(hasCta&&!ctaAutoTriggered&&t>=LC.ctaTimestamp){
                    ctaAutoTriggered=true; settings.ctaVisible=true; ctaClosedByUser=false; updateCTA();
                }
            },2000);
        }

        /* ── Supabase realtime ── */
        function subscribeSupabase(){
            if(!_sb) return;
            _sb.channel('wlc-s-'+p)
                .on('postgres_changes',{event:'UPDATE',schema:'public',table:'settings'},function(p2){
                    var s=p2.new;
                    if(s.key==='show_user_comments'){
                        var prev = settings.showUserComments;
                        settings.showUserComments = s.value==='true';
                        /* Recarrega lista para todos os clientes não-staff quando a visibilidade muda */
                        if(!isStaff && settings.showUserComments !== prev) loadRealComments();
                    }
                    if(s.key==='cta_visible'){ settings.ctaVisible=s.value==='true'; ctaClosedByUser=false; }
                    if(s.key==='cta_url')  settings.ctaUrl=s.value;
                    if(s.key==='cta_text') settings.ctaText=s.value;
                    updateCTA();
                    var ct=q('staff-cta-toggle'); if(ct) ct.checked=settings.ctaVisible;
                    var vt=q('staff-vis-toggle'); if(vt) vt.checked=settings.showUserComments;
                }).subscribe();

            _sb.channel('wlc-c-'+p)
                .on('postgres_changes',{event:'INSERT',schema:'public',table:'comments'},function(p2){
                    var c=p2.new;
                    // Se for o comentário enviado pelo próprio usuário
                    if(c.session_id===lcSid) {
                        var list = q('list');
                        if (list) {
                            var cards = list.querySelectorAll('.lc-comment');
                            for (var i = cards.length - 1; i >= 0; i--) {
                                var card = cards[i];
                                // Se for um card temporário (sem ID real ou ID começando com temp-)
                                if (!card.dataset.id || card.dataset.id.indexOf('temp-') === 0) {
                                    var nameEl = card.querySelector('.lc-comment-name');
                                    var textEl = card.querySelector('.lc-comment-text');
                                    if (nameEl && textEl && nameEl.textContent.indexOf(c.name) !== -1 && textEl.textContent === c.text) {
                                        card.dataset.id = String(c.id); /* vincula ID real (string) */
                                        break;
                                    }
                                }
                            }
                        }
                        return;
                    }
                    if(c.type==='host'){ addComment(c.name,c.text,'host',c.reply||null,c.id); }
                    // Staff sempre recebe todas as mensagens; usuários normais recebem dependendo de showUserComments
                    else if(settings.showUserComments || isStaff){
                        showTyping(c.name);
                        setTimeout(function(){ addComment(c.name,c.text,'fake',null,c.id); },rand(500,1500));
                    }
                })
                .on('postgres_changes',{event:'UPDATE',schema:'public',table:'comments'},function(p2){
                    var c=p2.new; if(c.reply) updateReply(String(c.id),c.reply);
                }).subscribe();

            _replyChannel = _sb.channel('wlc-r-'+p)
                .on('broadcast',{event:'reply'},function(ev){
                    if(ev.payload&&ev.payload.id&&ev.payload.reply)
                        updateReply(String(ev.payload.id), ev.payload.reply);
                });
            _replyChannel.subscribe();
        }

        /* ── Input usuário ── */
        function initInput(){
            var sendBtn=q('send'),nameInp=q('name'),textInp=q('text');
            if(!sendBtn||!nameInp||!textInp) return;
            var sn=localStorage.getItem('lc_username'); if(sn) nameInp.value=sn;
            nameInp.addEventListener('blur',function(){ if(nameInp.value.trim()) localStorage.setItem('lc_username',nameInp.value.trim()); });
            function send(){
                var name=nameInp.value.trim(),text=textInp.value.trim();
                if(!name){nameInp.focus();return;} if(!text){textInp.focus();return;}
                sendBtn.disabled=true; textInp.value='';
                
                var msgType = isStaff ? 'host' : 'user';
                var displayName = isStaff ? (LC.hostName || 'Host') : name;
                
                // Gera ID temporário para permitir pareamento com Realtime
                var tempId = 'temp-' + Date.now() + Math.random().toString(36).substr(2, 5);
                var el=addComment(displayName,text,msgType,null,tempId);
                
                // Salva o comentário localmente no banco de dados do WordPress para exportações futuras
                fetch(LC.restUrl + 'save-comment', {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({
                        webinar_id: LC.webinarId,
                        webinar_title: LC.webinarTitle,
                        time_offset: (typeof getVideoTime === 'function' ? Math.max(0, getVideoTime()) : 0),
                        name: displayName,
                        message: text,
                        role: isStaff ? 'Admin' : 'Attendee',
                        mode: 'Chat',
                        session_id: lcSid,
                        staff_token: staffToken || ''
                    })
                })
                .then(function(r){ if(r.ok) return r.json(); throw new Error(); })
                .then(function(data){
                    if(data.success && data.supabase_id && el) {
                        el.dataset.id = String(data.supabase_id);
                    }
                })
                .catch(function(){});

                /* O INSERT no Supabase é feito pelo servidor (save-comment REST) para todos os tipos
                   de comentário. O supabase_id real é retornado acima via data.supabase_id,
                   garantindo que el.dataset.id seja definido de forma síncrona. */
                setTimeout(function(){ sendBtn.disabled=false; },1200);
            }
            sendBtn.addEventListener('click',send);
            textInp.addEventListener('keydown',function(e){ if(e.key==='Enter'&&!e.shiftKey){e.preventDefault();send();} });
        }

        /* ── Carrega comentários reais anteriores do Supabase ── */
        var useWebinarFilter = true;
        var useTimeFilter    = true; /* desativado se coluna created_at não existir */
        function loadRealComments(){
            if(!_sb) return;

            function runQuery() {
                var query = _sb.from('comments').select('*');

                /* Filtro resiliente por webinar_id */
                if (useWebinarFilter && LC.webinarId) {
                    query = query.eq('webinar_id', LC.webinarId);
                }

                /* Só carrega comentários das últimas 12h — evita trazer sessões anteriores */
                if (useTimeFilter) {
                    var cutoff = new Date(Date.now() - 12 * 3600 * 1000).toISOString();
                    query = query.gte('created_at', cutoff);
                }

                /* Usuário sem visibilidade pública vê apenas seus próprios comentários e do host */
                if (!isStaff && !settings.showUserComments) {
                    query = query.or('session_id.eq.' + lcSid + ',type.eq.host');
                }

                query.order('id', { ascending: true })
                .then(function(res){
                    if (res.error) {
                        /* Fallback: coluna webinar_id ausente */
                        if (useWebinarFilter && (res.error.message.indexOf('webinar_id') !== -1 || res.error.code === 'PGRST204' || (res.error.hint && res.error.hint.indexOf('webinar_id') !== -1))) {
                            useWebinarFilter = false;
                            runQuery();
                            return;
                        }
                        /* Fallback: coluna created_at ausente */
                        if (useTimeFilter && res.error.message.indexOf('created_at') !== -1) {
                            useTimeFilter = false;
                            runQuery();
                            return;
                        }
                        console.error("Supabase SELECT Error (RLS Issue?):", res.error);
                        return;
                    }

                    var list = q('list');
                    if (!list) return;

                    /* Remove todos os comentários EXCETO a mensagem de boas-vindas fixada */
                    list.querySelectorAll('.lc-comment:not([data-wlc-welcome])').forEach(function(c){ c.remove(); });

                    if (res.data) {
                        res.data.forEach(function(c){
                            var type = c.type;
                            /* Garante badge "Você" para o próprio autor */
                            if (c.session_id === lcSid && type !== 'host') type = 'user';
                            addComment(c.name, c.text, type, c.reply || null, c.id);
                        });
                    }
                });
            }

            runQuery();
        }

        /* ── Carrega settings do WP REST ── */
        function loadSettings(){
            fetch(LC.restUrl+'settings')
            .then(function(r){ return r.json(); })
            .then(function(data){
                settings.showUserComments = !!data.show_user_comments;
                settings.ctaVisible       = !!data.cta_visible;
                settings.ctaUrl           = data.cta_url  || '#';
                settings.ctaText          = data.cta_text || '🔥 Vagas abertas!';
                LC.fakeComments      = data.fake_comments      || [];
                LC.timestampComments = data.timestamp_comments || [];
                LC.fakeMinInterval   = data.fake_min_interval  || 12;
                LC.fakeMaxInterval   = data.fake_max_interval  || 35;
                LC.baseViewers       = data.base_viewers       || 247;
                var vc=q('viewer-count'); if(vc) vc.textContent=LC.baseViewers;
                updateCTA();
                setTimeout(nextFake, rand(8,20)*1000);
                startTimestamps();
                loadRealComments(); // Carrega os comentários reais anteriores do Supabase
                if(isStaff && !wrap.dataset.staff) activateStaffBar();
            })
            .catch(function(){
                setTimeout(nextFake, rand(8,20)*1000);
                startTimestamps();
                loadRealComments(); // Fallback: carrega comentários reais se a API falhar
            });
        }

        /* ════════════════════
           BOOT
        ════════════════════ */
        initTheme();
        initCTA();
        initStaffModal();
        /* Restaura sessão staff do localStorage (expira em 8h) */
        try{
            var _savedStaff=JSON.parse(localStorage.getItem('lc_staff_'+p)||'null');
            if(_savedStaff&&_savedStaff.name&&(Date.now()-_savedStaff.ts)<28800000){
                isStaff=true; staffName=_savedStaff.name; staffToken=_savedStaff.token||'';
            }
        }catch(e){}
        subscribeSupabase();
        startViewers();
        initInput();
        initTracking();
        /* Mensagem de boas-vindas fixa — marcada para não ser removida pelo loadRealComments */
        (function(){
            var el = addComment(LC.hostName,'Sejam muito bem-vindos! 🎉 Fico feliz que estejam aqui. Deixem seus comentários e perguntas!','host');
            if(el) el.dataset.wlcWelcome = '1';
        })();
        loadSettings();
    }

    window.WLCInit = WLCInit;

    document.addEventListener('DOMContentLoaded', function(){
        document.querySelectorAll('.lc-wrap[data-wlc]').forEach(function(el){ WLCInit(el.id); });
    });

    window.addEventListener('elementor/frontend/init', function(){
        if(!window.elementorFrontend) return;
        elementorFrontend.hooks.addAction('frontend/element_ready/wlc-live-comments.default', function($scope){
            var wrap=$scope[0]&&$scope[0].querySelector('.lc-wrap[data-wlc]');
            if(wrap) WLCInit(wrap.id);
        });
    });
})();
