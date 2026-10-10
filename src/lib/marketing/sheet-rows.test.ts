import test from 'node:test';
import assert from 'node:assert/strict';
import { creativeFamily } from './creatives.ts';
import {
  checkHeaders, SheetFormatError, toCaptureRows, toSaleRows, toScheduleRows, toOverviewRows,
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
  assert.deepEqual(o, { edition: 22, dayMonth: '13/10', applications: 12, scheduled: 5, done: 3, investment: 950.07 });
});
