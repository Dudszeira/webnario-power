import test from 'node:test';
import assert from 'node:assert/strict';
import { mapInsightRow } from './meta-map.ts';

test('mapInsightRow reads spend, clicks, IC (pixel first), video and LPV', () => {
  const d = mapInsightRow({
    date_start: '2026-10-08', ad_id: '1', ad_name: 'img_10', adset_name: 'cj', campaign_name: 'cp',
    spend: '100.12', impressions: '5000', inline_link_clicks: '43',
    actions: [
      { action_type: 'initiate_checkout', value: '3' },
      { action_type: 'offsite_conversion.fb_pixel_initiate_checkout', value: '2' },
      { action_type: 'landing_page_view', value: '30' },
      { action_type: 'video_view', value: '900' },
    ],
    video_thruplay_watched_actions: [{ action_type: 'video_view', value: '120' }],
  });
  assert.deepEqual(d, {
    date: '2026-10-08', adId: '1', adName: 'img_10', adsetName: 'cj', campaignName: 'cp',
    spend: 100.12, impressions: 5000, linkClicks: 43, landingViews: 30,
    initiateCheckouts: 2, video3s: 900, thruplays: 120,
  });
});

test('mapInsightRow tolerates missing fields', () => {
  const d = mapInsightRow({ date_start: '2026-10-08', ad_id: '2' });
  assert.equal(d.spend, 0);
  assert.equal(d.initiateCheckouts, 0);
  assert.equal(d.adName, '');
});
