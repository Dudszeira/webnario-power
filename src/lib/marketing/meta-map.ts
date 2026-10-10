import type { MetaAdDay } from './types.ts';

type Action = { action_type: string; value: string };

export type MetaInsightRow = {
  date_start: string;
  ad_id: string;
  ad_name?: string;
  adset_name?: string;
  campaign_name?: string;
  spend?: string;
  impressions?: string;
  inline_link_clicks?: string;
  actions?: Action[];
  video_thruplay_watched_actions?: Action[];
};

const n = (s?: string) => (s && Number.isFinite(Number(s)) ? Number(s) : 0);
const act = (list: Action[] | undefined, type: string) => n(list?.find(a => a.action_type === type)?.value);

export function mapInsightRow(r: MetaInsightRow): MetaAdDay {
  // O Meta devolve o IC do pixel e um agregado 'initiate_checkout'; somar duplicaria.
  const pixelIc = r.actions?.find(a => a.action_type === 'offsite_conversion.fb_pixel_initiate_checkout');
  return {
    date: r.date_start,
    adId: r.ad_id,
    adName: r.ad_name ?? '',
    adsetName: r.adset_name ?? '',
    campaignName: r.campaign_name ?? '',
    spend: n(r.spend),
    impressions: n(r.impressions),
    linkClicks: n(r.inline_link_clicks),
    landingViews: act(r.actions, 'landing_page_view'),
    initiateCheckouts: pixelIc ? n(pixelIc.value) : act(r.actions, 'initiate_checkout'),
    video3s: act(r.actions, 'video_view'),
    thruplays: act(r.video_thruplay_watched_actions, 'video_view'),
  };
}
