// Shared between the client-side picker (src/components/AdminIconPicker.tsx, maps
// each name to its lucide component) and the server-side route
// (src/app/api/admin/branding/route.ts, validates incoming preset names) so the
// two lists can't drift out of sync.
export const ICON_NAMES: string[] = [
  'Rocket', 'Zap', 'Tv', 'Video', 'Star', 'Radio', 'Sparkles', 'Flame',
  'Globe', 'Shield', 'Award', 'Target', 'Gem', 'Crown', 'Compass', 'Bolt',
];

export const MAX_ICON_UPLOAD_SIZE = 2 * 1024 * 1024;
