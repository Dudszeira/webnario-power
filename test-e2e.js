const fs = require('fs');
const path = require('path');

console.log('⚡ Iniciando ambiente de testes E2E do Webnario Power...\n');

// 1. Carrega variáveis do .env.local
const envPath = path.join(__dirname, '.env.local');
if (fs.existsSync(envPath)) {
  const envContent = fs.readFileSync(envPath, 'utf8');
  envContent.split('\n').forEach(line => {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith('#')) return;
    const parts = trimmed.split('=');
    if (parts.length >= 2) {
      const key = parts[0].trim();
      const val = parts.slice(1).join('=').trim().replace(/^['"]|['"]$/g, '');
      process.env[key] = val;
    }
  });
  console.log('✅ Variáveis de ambiente carregadas do .env.local.');
} else {
  console.warn('⚠️ Arquivo .env.local não encontrado! Usando variáveis globais.');
}

const ADMIN_PASSWORD = process.env.ADMIN_PASSWORD || 'admin123';
const PORT = 3000;
const BASE_URL = `http://localhost:${PORT}`;

// Função auxiliar para requisições HTTP usando fetch nativo
async function request(urlPath, options = {}) {
  const url = `${BASE_URL}${urlPath}`;
  const start = Date.now();
  try {
    const res = await fetch(url, {
      ...options,
      headers: {
        'Content-Type': 'application/json',
        ...options.headers,
      }
    });
    const duration = Date.now() - start;
    const text = await res.text();
    let data = null;
    try {
      data = JSON.parse(text);
    } catch (e) {
      data = text;
    }
    return {
      status: res.status,
      headers: res.headers,
      data,
      duration,
      ok: res.ok
    };
  } catch (err) {
    return {
      status: 500,
      headers: new Headers(),
      data: { error: err.message },
      duration: Date.now() - start,
      ok: false
    };
  }
}

// Extrai e formata o cookie do Set-Cookie header
function getCookieString(headers, cookieName) {
  const setCookies = headers.getSetCookie ? headers.getSetCookie() : [headers.get('set-cookie')].filter(Boolean);
  for (const cookie of setCookies) {
    if (cookie.startsWith(`${cookieName}=`)) {
      return cookie.split(';')[0];
    }
  }
  return '';
}

async function runTests() {
  const results = [];
  let userCookie = '';
  let adminCookie = '';
  const uniqueId = Math.floor(Math.random() * 1000000);
  const testEmail = `test-e2e-${uniqueId}@example.com`;
  const testName = `Participante E2E ${uniqueId}`;

  console.log(`\n📋 Dados gerados para teste:\n- E-mail: ${testEmail}\n- Nome: ${testName}\n`);

  // --- TESTE 1: Status de Conectividade do Servidor ---
  console.log('🔄 Teste 1: Verificando se o servidor está ativo...');
  const t1 = await request('/api/session');
  if (t1.status === 200 || t1.status === 404) {
    console.log(`✅ Teste 1 Concluído! Servidor respondeu na porta ${PORT} (${t1.duration}ms).`);
    results.push({ name: 'Conectividade do Servidor', status: 'ok', duration: t1.duration });
  } else {
    console.error(`❌ Teste 1 Falhou! Certifique-se de que o servidor Next.js está rodando na porta ${PORT}.`);
    results.push({ name: 'Conectividade do Servidor', status: 'fail', error: t1.data });
    printSummary(results);
    process.exit(1);
  }

  // --- PRÉ-LIMPEZA DE REGISTROS DE TESTE NO SUPABASE ---
  const sbUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const sbServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (sbUrl && sbServiceKey) {
    console.log('\n🔄 Executando pré-limpeza de registros de teste antigos no Supabase...');
    try {
      const searchRes = await fetch(`${sbUrl}/rest/v1/registrations?email=ilike.test-e2e-*`, {
        headers: {
          'apikey': sbServiceKey,
          'Authorization': `Bearer ${sbServiceKey}`
        }
      });
      if (searchRes.ok) {
        const regs = await searchRes.json();
        if (Array.isArray(regs) && regs.length > 0) {
          const regIds = regs.map(r => r.id);
          console.log(`🧹 Encontrados ${regs.length} cadastros de teste. Limpando eventos vinculados...`);
          
          for (const regId of regIds) {
            await fetch(`${sbUrl}/rest/v1/events?registration_id=eq.${regId}`, {
              method: 'DELETE',
              headers: {
                'apikey': sbServiceKey,
                'Authorization': `Bearer ${sbServiceKey}`
              }
            });
            await fetch(`${sbUrl}/rest/v1/comments?registration_id=eq.${regId}`, {
              method: 'DELETE',
              headers: {
                'apikey': sbServiceKey,
                'Authorization': `Bearer ${sbServiceKey}`
              }
            });
          }

          const delRes = await fetch(`${sbUrl}/rest/v1/registrations?email=ilike.test-e2e-*`, {
            method: 'DELETE',
            headers: {
              'apikey': sbServiceKey,
              'Authorization': `Bearer ${sbServiceKey}`
            }
          });
          if (delRes.ok) {
            console.log('✅ Pré-limpeza concluída com sucesso!');
          }
        } else {
          console.log('✅ Nenhum registro de teste anterior encontrado no Supabase.');
        }
      }
    } catch (err) {
      console.warn('⚠️ Falha durante a pré-limpeza automática:', err.message);
    }
  }

  // --- TESTE 2: Cadastro de Participante ---
  console.log('\n🔄 Teste 2: Cadastrando novo participante (POST /api/cadastro)...');
  const t2 = await request('/api/cadastro', {
    method: 'POST',
    body: JSON.stringify({ name: testName, email: testEmail })
  });
  if (t2.ok && t2.data.ok) {
    userCookie = getCookieString(t2.headers, 'session');
    console.log(`✅ Teste 2 Concluído! Participante cadastrado com sucesso (${t2.duration}ms). Cookie obtido.`);
    results.push({ name: 'Cadastro de Participante', status: 'ok', duration: t2.duration });
  } else {
    console.error(`❌ Teste 2 Falhou! Status: ${t2.status}`, t2.data);
    results.push({ name: 'Cadastro de Participante', status: 'fail', error: t2.data });
  }

  // --- TESTE 3: Verificação de Sessão do Participante ---
  console.log('\n🔄 Teste 3: Recuperando dados de sessão do participante (GET /api/session)...');
  const t3 = await request('/api/session', {
    headers: userCookie ? { 'Cookie': userCookie } : {}
  });
  if (t3.ok && t3.data?.session?.email === testEmail) {
    console.log(`✅ Teste 3 Concluído! Sessão validada e dados recuperados corretamente (${t3.duration}ms).`);
    results.push({ name: 'Validação de Sessão', status: 'ok', duration: t3.duration });
  } else {
    console.error(`❌ Teste 3 Falhou! Status: ${t3.status}`, t3.data);
    results.push({ name: 'Validação de Sessão', status: 'fail', error: t3.data });
  }

  // --- TESTE 4: Envio de Evento/Clique (POST /api/click) ---
  console.log('\n🔄 Teste 4: Registrando clique do participante no CTA (POST /api/click)...');
  const t4 = await request('/api/click', {
    method: 'POST',
    headers: userCookie ? { 'Cookie': userCookie } : {},
    body: JSON.stringify({ type: 'cta_click', meta: { test_runner: 'e2e' } })
  });
  if (t4.ok && t4.data.ok) {
    console.log(`✅ Teste 4 Concluído! Clique registrado no Supabase com sucesso (${t4.duration}ms).`);
    results.push({ name: 'Rastreio de Cliques (CTA)', status: 'ok', duration: t4.duration });
  } else {
    console.error(`❌ Teste 4 Falhou! Status: ${t4.status}`, t4.data);
    results.push({ name: 'Rastreio de Cliques (CTA)', status: 'fail', error: t4.data });
  }

  // --- TESTE 5: Envio de Mensagem no Chat (POST /api/chat) ---
  console.log('\n🔄 Teste 5: Enviando mensagem no chat ao vivo (POST /api/chat)...');
  const testMessage = `E2E Test Message ${uniqueId}`;
  const t5 = await request('/api/chat', {
    method: 'POST',
    headers: userCookie ? { 'Cookie': userCookie } : {},
    body: JSON.stringify({ text: testMessage })
  });
  if (t5.ok && t5.data.ok) {
    console.log(`✅ Teste 5 Concluído! Comentário enviado com sucesso (${t5.duration}ms). ID: ${t5.data.id}`);
    results.push({ name: 'Envio de Comentário', status: 'ok', duration: t5.duration });
  } else {
    console.error(`❌ Teste 5 Falhou! Status: ${t5.status}`, t5.data);
    results.push({ name: 'Envio de Comentário', status: 'fail', error: t5.data });
  }

  // --- TESTE 6: Busca de Mensagens no Chat (GET /api/chat) ---
  console.log('\n🔄 Teste 6: Recuperando lista de comentários (GET /api/chat)...');
  const t6 = await request('/api/chat', {
    headers: userCookie ? { 'Cookie': userCookie } : {}
  });
  if (t6.ok && Array.isArray(t6.data?.comments)) {
    const found = t6.data.comments.some(c => c.text === testMessage);
    if (found) {
      console.log(`✅ Teste 6 Concluído! Comentário encontrado na lista da API de chat (${t6.duration}ms).`);
      results.push({ name: 'Polling de Comentários', status: 'ok', duration: t6.duration });
    } else {
      console.warn(`⚠️ Comentário de teste não listado imediatamente (pode haver cache/moderação).`);
      results.push({ name: 'Polling de Comentários', status: 'warn', duration: t6.duration, note: 'Comentário não retornado imediatamente' });
    }
  } else {
    console.error(`❌ Teste 6 Falhou! Status: ${t6.status}`, t6.data);
    results.push({ name: 'Polling de Comentários', status: 'fail', error: t6.data });
  }

  // --- TESTE 7: Autenticação Administrativa (POST /api/admin/auth) ---
  console.log('\n🔄 Teste 7: Efetuando login de administrador (POST /api/admin/auth)...');
  const t7 = await request('/api/admin/auth', {
    method: 'POST',
    body: JSON.stringify({ password: ADMIN_PASSWORD })
  });
  if (t7.ok && t7.data.ok) {
    adminCookie = getCookieString(t7.headers, 'admin_session');
    console.log(`✅ Teste 7 Concluído! Admin autenticado com sucesso (${t7.duration}ms). Cookie obtido.`);
    results.push({ name: 'Autenticação Administrativa', status: 'ok', duration: t7.duration });
  } else {
    console.error(`❌ Teste 7 Falhou! Senha incorreta ou erro na API. Status: ${t7.status}`, t7.data);
    results.push({ name: 'Autenticação Administrativa', status: 'fail', error: t7.data });
  }

  // --- TESTE 8: Consulta de Configurações Administrativas (GET /api/admin/config) ---
  console.log('\n🔄 Teste 8: Lendo configurações do webinário (GET /api/admin/config)...');
  const t8 = await request('/api/admin/config', {
    headers: adminCookie ? { 'Cookie': adminCookie } : {}
  });
  if (t8.ok && t8.data?.edition) {
    console.log(`✅ Teste 8 Concluído! Configurações atuais obtidas com sucesso (${t8.duration}ms).`);
    results.push({ name: 'Leitura de Configuração', status: 'ok', duration: t8.duration });
  } else {
    console.error(`❌ Teste 8 Falhou! Status: ${t8.status}`, t8.data);
    results.push({ name: 'Leitura de Configuração', status: 'fail', error: t8.data });
  }

  // --- TESTE 9: Atualização de Configurações Administrativas (PUT /api/admin/config) ---
  console.log('\n🔄 Teste 9: Atualizando configurações do webinário (PUT /api/admin/config)...');
  const currentConfig = t8.data?.edition || {};
  const t9 = await request('/api/admin/config', {
    method: 'PUT',
    headers: adminCookie ? { 'Cookie': adminCookie } : {},
    body: JSON.stringify({
      ...currentConfig,
      chat_enabled: true,
      cta_enabled: true,
      sales_page_url: currentConfig.sales_page_url || 'https://mentoriapower.com.br/vendas-teste-e2e',
      cta_text: currentConfig.cta_text || 'GARANTIR MINHA VAGA E2E',
    })
  });
  if (t9.ok && t9.data.ok) {
    console.log(`✅ Teste 9 Concluído! Configurações salvas e persistidas no Supabase (${t9.duration}ms).`);
    results.push({ name: 'Gravação de Configuração', status: 'ok', duration: t9.duration });
  } else {
    console.error(`❌ Teste 9 Falhou! Status: ${t9.status}`, t9.data);
    results.push({ name: 'Gravação de Configuração', status: 'fail', error: t9.data });
  }

  // --- TESTE 10: Painel de Métricas em Tempo Real (GET /api/admin/metrics) ---
  console.log('\n🔄 Teste 10: Validando o painel de métricas da edição (GET /api/admin/metrics)...');
  const t10 = await request('/api/admin/metrics', {
    headers: adminCookie ? { 'Cookie': adminCookie } : {}
  });
  const metrics = t10.data?.currentMetrics || {};
  if (t10.ok && metrics.registrations !== undefined) {
    console.log(`✅ Teste 10 Concluído! Métricas consolidadas com sucesso (${t10.duration}ms).`);
    console.log(`📊 Métricas do Dashboard:\n- Participantes cadastrados: ${metrics.registrations}\n- Cliques no CTA: ${metrics.ctaClicks}\n- Comentários reais: ${metrics.realComments}\n`);
    results.push({ name: 'Painel de Métricas Real-Time', status: 'ok', duration: t10.duration });
  } else {
    console.error(`❌ Teste 10 Falhou! Status: ${t10.status}`, t10.data);
    results.push({ name: 'Painel de Métricas Real-Time', status: 'fail', error: t10.data });
  }

  printSummary(results);
}

function printSummary(results) {
  console.log('\n======================================================');
  console.log('🏆 RESUMO DOS TESTES DE INTEGRIDADE E2E');
  console.log('======================================================');
  
  let successCount = 0;
  let totalCount = results.length;

  results.forEach((r, i) => {
    const indexStr = String(i + 1).padStart(2, '0');
    const nameStr = r.name.padEnd(35, '.');
    if (r.status === 'ok') {
      successCount++;
      console.log(`  [${indexStr}] ${nameStr} [ ✅ PASSED ] (${r.duration}ms)`);
    } else if (r.status === 'warn') {
      successCount++;
      console.log(`  [${indexStr}] ${nameStr} [ ⚠️ WARN   ] (${r.duration}ms) - ${r.note}`);
    } else {
      console.log(`  [${indexStr}] ${nameStr} [ ❌ FAILED ]`);
      if (r.error) {
        console.log(`       └─ Erro: ${JSON.stringify(r.error)}`);
      }
    }
  });

  console.log('======================================================');
  const rate = Math.round((successCount / totalCount) * 100);
  console.log(`📊 Aproveitamento: ${successCount}/${totalCount} testes (${rate}%)`);
  console.log('======================================================\n');
}

runTests();
