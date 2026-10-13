import test from 'node:test';
import assert from 'node:assert/strict';
import { creativeFamily } from './creatives.ts';
import {
  checkHeaders, SheetFormatError, toCaptureRows, toSaleRows, toScheduleRows, toOverviewRows, toSurveyRows, toApplicationRows,
} from './sheet-rows.ts';

test('creativeFamily groups ad name variants and UTM prefixes', () => {
  assert.equal(creativeFamily('webp_vendas_img_10'), 'img_10');
  assert.equal(creativeFamily('img_01.2'), 'img_01');
  assert.equal(creativeFamily('img_01 - Cópia do VALIDADOS'), 'img_01');
  assert.equal(creativeFamily('Web3_coleta_vid_2_V2'), 'vid_2');
  assert.equal(creativeFamily('APIWEB01'), 'apiweb01');
  assert.equal(creativeFamily('  '), '(sem utm)');
  assert.equal(creativeFamily('APIWEB01', { apiweb01: 'API' }), 'API');
  assert.equal(creativeFamily('webp_vendas_vid_3', { vid_3: 'Criativo 3' }), 'Criativo 3');
  assert.equal(creativeFamily('webp_vendas_vid_3', { webp_vendas_vid_3: 'Cru', vid_3: 'Criativo 3' }), 'Cru');
});

test('checkHeaders names the tab and the missing columns', () => {
  assert.throws(
    () => checkHeaders('sales', [{ STATUS: 'x' }]),
    (e: unknown) => e instanceof SheetFormatError && e.tab === 'sales' && e.missing.includes('Produto') && e.message === 'colunas não encontradas: ' + e.missing.join(', '),
  );
  assert.throws(() => checkHeaders('capture', []), SheetFormatError);
});

test('toCaptureRows', () => {
  const [r] = toCaptureRows([{
    'e-mail': ' A@B.com', whatsapp: '(51) 99999-1111', utm_source: 'fb', utm_medium: 'x',
    utm_campaign: 'c', utm_content: 'webp_vendas_img_10', data: '10/10/2026 08:57:00',
    'Webinário': '#022', 'Edição': 'WB03 - PAGO',
  }]);
  assert.equal(r.email, 'a@b.com');
  assert.equal(r.edition, 22);
  assert.equal(r.at, '2026-10-10T08:57:00');
  assert.equal(r.funnel, 'WB03 - PAGO');
});

test('toSaleRows: trims status/product, refund is not approved, empty date kept', () => {
  const rows = toSaleRows([
    { STATUS: ' Aprovada', Produto: 'Power ', Ticket: '16.788,00', Email: 'X@y.com', Telefone: '', utm_content_captacao: '', utm_content_venda: '', Data: '', 'Webinário': '#018' },
    { STATUS: 'Reembolso', Produto: 'Power Start', Ticket: '9.990,00', Email: 'z@y.com', Telefone: '', utm_content_captacao: '', utm_content_venda: '', Data: '17/09/2026 15:01:08', 'Webinário': '#018' },
  ]);
  assert.equal(rows[0].approved, true);
  assert.equal(rows[0].product, 'Power');
  assert.equal(rows[0].amount, 16788);
  assert.equal(rows[0].at, null);
  assert.equal(rows[1].approved, false);
});

test('toScheduleRows and toOverviewRows', () => {
  const [s] = toScheduleRows([{
    'Motivo da perda': '', Closer: 'Ana', utm_content: 'Web3_coleta_vid_18', 'SE - Agendada': 'Sim, Automático',
    'Agendada em': '2026-09-29', 'SE - Data': '2026-10-09', 'Ganho em': '', 'SE - Realizada': 'Sim',
    'E-mail - Trabalho': 'Q@w.com', 'WEBNÁRIO': '#020',
  }]);
  assert.equal(s.done, true);
  assert.equal(s.edition, 20);
  assert.equal(s.callDate, '2026-10-09');
  const [o] = toOverviewRows([{
    Data: '13/10', 'Webinário': '#022', 'Aplicações': '12', 'Agendamentos PWR': '3', 'Agendamentos PWS': '2',
    'Realizadas PWR': '2', 'Realizadas PWS': '1', 'Investimento Total': 'R$ 950,07',
  }]);
  assert.deepEqual({ ...o, check: undefined }, { edition: 22, dayMonth: '13/10', applications: 12, scheduled: 5, done: 3, investment: 950.07, check: undefined });
});

test('checkHeaders normalizes spaces and checks needle columns of the new tabs', () => {
  assert.doesNotThrow(() => checkHeaders('overview', [{
    Data: '', 'Webinário': '', 'Aplicações': '', 'Agendamentos  PWR': '', 'Agendamentos PWS': '',
    'Realizadas PWR': '', 'Realizadas PWS': '', 'Investimento Total': '',
  }]));
  assert.throws(() => checkHeaders('survey', [{ 'Qual seu e-mail?': 'x' }]),
    (e: unknown) => e instanceof SheetFormatError && e.tab === 'survey' && e.missing.join() === 'renda familiar');
  assert.doesNotThrow(() => checkHeaders('applications', [{ 'Submitted At': '', 'E-mail': '', 'Qual produto?': '' }]));
});

test('toOverviewRows.check: blank = null, percent as 0–100, sales summed', () => {
  const [o] = toOverviewRows([{
    Data: '13/10', 'Webinário': '#020', 'Aplicações': '', 'Agendamentos PWR': '3', 'Agendamentos PWS': '',
    'Realizadas PWR': '', 'Realizadas PWS': '', 'Investimento Total': 'R$ 1.000,00', 'Investimento Captação Meta': 'R$ 800,00',
    Pico: '', Comparecimento: '0,45', 'Vendas Start': '2', 'Vendas Desafio': '1', 'Vendas Power': '', 'Faturamento Total': 'R$ 5.000,00',
  }]);
  assert.deepEqual(o.check, {
    applications: null, scheduled: 3, done: null, peak: null, attendance: 45,
    metaSpend: 800, investment: 1000, sales: 3, revenue: 5000,
  });
});

test('toSaleRows: refund regex, blank status counts, capture/sale UTMs', () => {
  const base = { Produto: 'Power Start', Ticket: '', Email: 'a@x.com', Telefone: '', utm_content_captacao: 'img_1', utm_content_venda: 'img_2', Data: '', 'Webinário': '#020' };
  const rows = toSaleRows([
    { ...base, STATUS: '', utm_source_captacao: 'ig', utm_campaign_captacao: '[WB] frio', utm_source_venda: 'email', 'Nome contato': 'Ana' },
    { ...base, STATUS: 'Estorno', utm_source_captacao: '', utm_campaign_captacao: '', utm_source_venda: '', 'Nome contato': '' },
  ]);
  assert.equal(rows[0].approved, true);
  assert.equal(rows[0].capSource, 'ig');
  assert.equal(rows[0].capCampaign, '[WB] frio');
  assert.equal(rows[0].saleSource, 'email');
  assert.equal(rows[0].name, 'Ana');
  assert.equal(rows[1].refunded, true);
  assert.equal(rows[1].approved, false);
});

test('toScheduleRows reads the extra Pipedrive columns', () => {
  const [s] = toScheduleRows([{
    'Motivo da perda': '', Closer: '', utm_content: '', 'SE - Agendada': 'Sim, pelo Comercial', 'Agendada em': '2026-10-01',
    'SE - Data': '', 'Ganho em': '', 'SE - Realizada': 'Não', 'E-mail - Trabalho': '', 'E-mail - Residencial': 'B@x.com',
    'WEBNÁRIO': '', 'Título': 'WB - Pessoa Teste', 'Negócio - Valor': '20.040', 'Produto (certo)': '',
    'Renda Mensal': 'R$5 mil a R$7 mil', utm_campaign: 'cp', utm_medium: 'md',
  }]);
  assert.deepEqual(s.emails, ['b@x.com']);
  assert.equal(s.title, 'WB - Pessoa Teste');
  assert.equal(s.value, 20040);
  assert.equal(s.realizedRaw, 'não');
  assert.equal(s.via, 'Sim, pelo Comercial');
  assert.equal(s.income, 'R$5 mil a R$7 mil');
  assert.equal(s.utmCampaign, 'cp');
  assert.equal(s.edition, null);
});

test('toSurveyRows and toApplicationRows', () => {
  const [p] = toSurveyRows([{
    'Submitted At': '10/10/2026 08:00:00', 'Qual seu e-mail?': ' A@X.com ', 'Renda familiar mensal': '5a7k', Faturamento: '1a3k',
    'Tempo de fotografia': '1a3', 'Serviço carro-chefe': 'estudio', 'Há quanto tempo conhece?': 'agora', Desafios: 'Vender mais',
  }]);
  assert.deepEqual(p, { email: 'a@x.com', at: '2026-10-10T08:00:00', tempo: '1a3', servico: 'estudio', renda: '5a7k', fat: '1a3k', conhece: 'agora', desafios: 'Vender mais' });
  const empty = { utm_source: '', utm_medium: '', utm_campaign: '', utm_content: '' };
  const apps = toApplicationRows([
    { ...empty, 'Submitted At': '2026-10-14 01:30:00', 'E-mail': 'C@x.com', WhatsApp: '(51) 9999-0000', 'Nome completo': 'Teste', 'Qual produto?': 'Power',
      'Qual sua renda mensal?': '', 'Faturamento com fotografia': '', 'Teria interesse em mentorias focadas?': 'Sim, claro', 'Escolha o dia': '15/10', utm_source: 'plataforma', utm_content: 'botao' },
    { ...empty, 'Submitted At': '01/01/0001 00:00', 'E-mail': '', WhatsApp: '', 'Nome completo': '', 'Qual produto?': '',
      'Qual sua renda mensal?': '', 'Faturamento com fotografia': '', 'Teria interesse em mentorias focadas?': 'Não', 'Escolha o dia': '' },
  ]);
  assert.equal(apps[0].at, '2026-10-13T22:30:00');
  assert.equal(apps[0].email, 'c@x.com');
  assert.equal(apps[0].interest, 'Sim');
  assert.equal(apps[0].scheduled, true);
  assert.equal(apps[0].utmContent, 'botao');
  assert.equal(apps[1].at, null);
  assert.equal(apps[1].interest, 'Não');
});

test('Ticket and Visão Geral numbers use thousand dots like the old dashboard', () => {
  const [s] = toSaleRows([{ STATUS: 'Aprovada', Produto: 'Power', Ticket: '16.788', Email: '', Telefone: '', utm_content_captacao: '', utm_content_venda: '', Data: '', 'Webinário': '#020' }]);
  assert.equal(s.amount, 16788);
  const [o] = toOverviewRows([{
    Data: '13/10', 'Webinário': '#020', 'Aplicações': '1.204', 'Agendamentos PWR': '', 'Agendamentos PWS': '',
    'Realizadas PWR': '', 'Realizadas PWS': '', 'Investimento Total': 'R$ 1.000',
  }]);
  assert.deepEqual([o.applications, o.investment, o.check.investment], [1204, 1000, 1000]);
});
