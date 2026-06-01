import { createClient } from '@supabase/supabase-js';

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL || '';
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || '';

if (!supabaseUrl || !supabaseKey) {
  console.warn('⚠️ Supabase URL or Key missing in environmental variables. Please configure your .env.local file.');
}

export const supabase = createClient(supabaseUrl, supabaseKey, {
  auth: {
    persistSession: false,
  },
});

// Entity Type definitions - Identical to the previous schema for compatibility
export type Edition = {
  id: string;
  live_date: string;
  video_source: 'upload' | 'youtube';
  video_url: string;
  video_duration: number;
  sales_page_url: string;
  chat_enabled: number;
  chat_mode: 'general' | 'isolated';
  cta_enabled: number;
  cta_url: string;
  cta_text: string;
  cta_start_seconds: number;
  cta_end_seconds: number;
  viewer_min: number;
  viewer_max: number;
  created_at: string;
  test_mode?: number;
  test_time?: string | null;
};

export type Registration = {
  id: string;
  edition_id: string;
  name: string;
  email: string;
  ip: string;
  consumed: number;
  consumed_at: string | null;
  created_at: string;
};

export type Comment = {
  id: string;
  edition_id: string;
  registration_id: string | null;
  type: 'real_user' | 'real_staff' | 'simulated_user' | 'simulated_staff' | 'simulated_purchase';
  author_name: string;
  text: string;
  video_timestamp: number | null;
  is_pinned: number;
  pin_start_seconds: number | null;
  pin_end_seconds: number | null;
  visible: number;
  reply: string | null;
  reply_author: string | null;
  created_at: string;
};

export type Event = {
  id: string;
  edition_id: string;
  registration_id: string | null;
  type: string;
  metadata: string;
  created_at: string;
};

// ----------------------------------------------------
// DB REPOSITORY FUNCTIONS (SUPABASE MIGRATION)
// ----------------------------------------------------

// Editions Repositories
export async function getEdition(id: string): Promise<Edition | null> {
  const { data, error } = await supabase
    .from('editions')
    .select('*')
    .eq('id', id)
    .maybeSingle();

  if (error) {
    console.error('getEdition error:', error);
  }
  return data;
}

export async function upsertEdition(edition: Partial<Edition> & { id: string }): Promise<void> {
  const { error } = await supabase
    .from('editions')
    .upsert(edition);

  if (error) {
    console.error('upsertEdition error:', error);
    throw error;
  }
}

export async function getEditionsList(): Promise<Edition[]> {
  const { data, error } = await supabase
    .from('editions')
    .select('*')
    .order('id', { ascending: false });

  if (error) {
    console.error('getEditionsList error:', error);
  }
  return data || [];
}

// Registrations Repositories
export async function getRegistrationByEmail(editionId: string, email: string): Promise<Registration | null> {
  const { data, error } = await supabase
    .from('registrations')
    .select('*')
    .eq('edition_id', editionId)
    .eq('email', email)
    .maybeSingle();

  if (error) {
    console.error('getRegistrationByEmail error:', error);
  }
  return data;
}

export async function getRegistrationByIP(editionId: string, ip: string): Promise<Registration | null> {
  const { data, error } = await supabase
    .from('registrations')
    .select('*')
    .eq('edition_id', editionId)
    .eq('ip', ip)
    .maybeSingle();

  if (error) {
    console.error('getRegistrationByIP error:', error);
  }
  return data;
}

export async function getRegistrationById(id: string): Promise<Registration | null> {
  const { data, error } = await supabase
    .from('registrations')
    .select('*')
    .eq('id', id)
    .maybeSingle();

  if (error) {
    console.error('getRegistrationById error:', error);
  }
  return data;
}

export async function createRegistration(reg: Omit<Registration, 'consumed' | 'consumed_at' | 'created_at'>): Promise<void> {
  const { error } = await supabase
    .from('registrations')
    .insert({
      id: reg.id,
      edition_id: reg.edition_id,
      name: reg.name,
      email: reg.email,
      ip: reg.ip,
      consumed: 0,
    });

  if (error) {
    console.error('createRegistration error:', error);
    throw error;
  }
}

export async function markRegistrationConsumed(id: string): Promise<void> {
  const { error } = await supabase
    .from('registrations')
    .update({
      consumed: 1,
      consumed_at: new Date().toISOString(),
    })
    .eq('id', id);

  if (error) {
    console.error('markRegistrationConsumed error:', error);
    throw error;
  }
}

export async function getAllRegistrations(editionId: string): Promise<Registration[]> {
  const { data, error } = await supabase
    .from('registrations')
    .select('*')
    .eq('edition_id', editionId)
    .order('created_at', { ascending: false });

  if (error) {
    console.error('getAllRegistrations error:', error);
  }
  return data || [];
}

export async function getRecentRegistrations(editionId: string, limit: number = 50): Promise<Registration[]> {
  const { data, error } = await supabase
    .from('registrations')
    .select('*')
    .eq('edition_id', editionId)
    .order('created_at', { ascending: false })
    .limit(limit);

  if (error) {
    console.error('getRecentRegistrations error:', error);
  }
  return data || [];
}

// Comments Repositories
export async function getCommentById(id: string): Promise<Comment | null> {
  const { data, error } = await supabase
    .from('comments')
    .select('*')
    .eq('id', id)
    .maybeSingle();

  if (error) {
    console.error('getCommentById error:', error);
  }
  return data;
}

export async function getRealComments(editionId: string, since: string, limit: number = 50): Promise<Comment[]> {
  const { data, error } = await supabase
    .from('comments')
    .select('*')
    .eq('edition_id', editionId)
    .in('type', ['real_user', 'real_staff'])
    .eq('visible', 1)
    .gt('created_at', since)
    .order('created_at', { ascending: true })
    .limit(limit);

  if (error) {
    console.error('getRealComments error:', error);
  }
  return data || [];
}

export async function getIsolatedComments(editionId: string, since: string, registrationId: string, limit: number = 50): Promise<Comment[]> {
  // Two separate queries to avoid ambiguous .or() + .in() interaction in Supabase
  const [userRes, staffRes] = await Promise.all([
    supabase.from('comments').select('*')
      .eq('edition_id', editionId).eq('type', 'real_user')
      .eq('visible', 1).eq('registration_id', registrationId)
      .gt('created_at', since).order('created_at', { ascending: true }).limit(limit),
    supabase.from('comments').select('*')
      .eq('edition_id', editionId).eq('type', 'real_staff')
      .eq('visible', 1)
      .gt('created_at', since).order('created_at', { ascending: true }).limit(20),
  ]);

  if (userRes.error) console.error('getIsolatedComments user error:', userRes.error);
  if (staffRes.error) console.error('getIsolatedComments staff error:', staffRes.error);

  const all = [...(userRes.data || []), ...(staffRes.data || [])];
  all.sort((a, b) => a.created_at > b.created_at ? 1 : -1);
  return all.slice(0, limit);
}

export async function getSimulatedWithReplies(editionId: string): Promise<Comment[]> {
  const { data, error } = await supabase
    .from('comments')
    .select('*')
    .eq('edition_id', editionId)
    .in('type', ['simulated_user', 'simulated_staff'])
    .eq('visible', 1)
    .not('reply', 'is', null);
  if (error) console.error('getSimulatedWithReplies error:', error);
  return data || [];
}

export async function insertComment(comment: Omit<Comment, 'created_at' | 'reply' | 'reply_author'>): Promise<void> {
  const { error } = await supabase
    .from('comments')
    .insert({
      id: comment.id,
      edition_id: comment.edition_id,
      registration_id: comment.registration_id,
      type: comment.type,
      author_name: comment.author_name,
      text: comment.text,
      video_timestamp: comment.video_timestamp,
      is_pinned: comment.is_pinned,
      pin_start_seconds: comment.pin_start_seconds,
      pin_end_seconds: comment.pin_end_seconds,
      visible: comment.visible,
    });

  if (error) {
    console.error('insertComment error:', error);
    throw error;
  }
}

export async function getSimulatedComments(editionId: string): Promise<Comment[]> {
  const { data, error } = await supabase
    .from('comments')
    .select('*')
    .eq('edition_id', editionId)
    .in('type', ['simulated_user', 'simulated_staff', 'simulated_purchase'])
    .eq('visible', 1)
    .order('video_timestamp', { ascending: true });

  if (error) {
    console.error('getSimulatedComments error:', error);
  }
  return data || [];
}

export async function getPinnedComments(editionId: string): Promise<Comment[]> {
  const { data, error } = await supabase
    .from('comments')
    .select('*')
    .eq('edition_id', editionId)
    .eq('is_pinned', 1)
    .eq('visible', 1);

  if (error) {
    console.error('getPinnedComments error:', error);
  }
  return data || [];
}

export async function getAdminComments(editionId: string): Promise<Comment[]> {
  const { data, error } = await supabase
    .from('comments')
    .select('*')
    .eq('edition_id', editionId)
    .order('created_at', { ascending: false });

  if (error) {
    console.error('getAdminComments error:', error);
  }
  return data || [];
}

export async function getRecentRealComments(editionId: string, limit: number = 50): Promise<Comment[]> {
  const { data, error } = await supabase
    .from('comments')
    .select('*')
    .eq('edition_id', editionId)
    .in('type', ['real_user', 'real_staff'])
    .order('created_at', { ascending: false })
    .limit(limit);

  if (error) {
    console.error('getRecentRealComments error:', error);
  }
  return data || [];
}

export async function updateCommentVisibility(id: string, visible: number): Promise<void> {
  const { error } = await supabase
    .from('comments')
    .update({ visible })
    .eq('id', id);

  if (error) {
    console.error('updateCommentVisibility error:', error);
    throw error;
  }
}

export async function updateCommentPin(id: string, isPinned: number, startSecs?: number | null, endSecs?: number | null): Promise<void> {
  const updateData: any = { is_pinned: isPinned };
  if (startSecs !== undefined) updateData.pin_start_seconds = startSecs;
  if (endSecs !== undefined) updateData.pin_end_seconds = endSecs;

  const { error } = await supabase
    .from('comments')
    .update(updateData)
    .eq('id', id);

  if (error) {
    console.error('updateCommentPin error:', error);
    throw error;
  }
}

export async function replyToComment(id: string, replyText: string | null, replyAuthor: string | null): Promise<void> {
  const { error } = await supabase
    .from('comments')
    .update({
      reply: replyText,
      reply_author: replyAuthor,
    })
    .eq('id', id);

  if (error) {
    console.error('replyToComment error:', error);
    throw error;
  }
}

export async function deleteRegistration(id: string): Promise<void> {
  // Delete dependent records first to avoid FK constraint violations
  await supabase.from('events').delete().eq('registration_id', id);
  await supabase.from('comments').delete().eq('registration_id', id);
  const { error } = await supabase.from('registrations').delete().eq('id', id);
  if (error) {
    console.error('deleteRegistration error:', error);
    throw error;
  }
}

// Partial update for edition fields — uses UPDATE instead of UPSERT to avoid replacing unspecified columns
export async function updateEditionFields(id: string, fields: Partial<Omit<Edition, 'id' | 'created_at'>>): Promise<void> {
  const { error } = await supabase
    .from('editions')
    .update(fields)
    .eq('id', id);
  if (error) {
    console.error('updateEditionFields error:', error);
    throw error;
  }
}

export async function deleteEditionData(editionId: string): Promise<void> {
  // Clear data (events, comments, registrations) but PRESERVE the edition config row
  await supabase.from('events').delete().eq('edition_id', editionId);
  await supabase.from('comments').delete().eq('edition_id', editionId);
  const { error } = await supabase.from('registrations').delete().eq('edition_id', editionId);
  if (error) {
    console.error('deleteEditionData error:', error);
    throw error;
  }
}

export async function clearSimulatedComments(editionId: string): Promise<void> {
  const { error } = await supabase
    .from('comments')
    .delete()
    .eq('edition_id', editionId)
    .in('type', ['simulated_user', 'simulated_staff', 'simulated_purchase']);

  if (error) {
    console.error('clearSimulatedComments error:', error);
    throw error;
  }
}

export async function insertCommentsBatch(comments: Omit<Comment, 'created_at'>[]): Promise<void> {
  // Supabase insert supports batching natively by passing an array
  const formatted = comments.map((c) => ({
    id: c.id,
    edition_id: c.edition_id,
    registration_id: c.registration_id,
    type: c.type,
    author_name: c.author_name,
    text: c.text,
    video_timestamp: c.video_timestamp,
    is_pinned: c.is_pinned,
    pin_start_seconds: c.pin_start_seconds,
    pin_end_seconds: c.pin_end_seconds,
    visible: c.visible,
    reply: c.reply,
    reply_author: c.reply_author,
  }));

  const { error } = await supabase
    .from('comments')
    .insert(formatted);

  if (error) {
    console.error('insertCommentsBatch error:', error);
    throw error;
  }
}

// Events Repositories
export async function getLiveEventsForEdition(editionId: string) {
  const { data, error } = await supabase
    .from('events')
    .select('registration_id, type, created_at')
    .eq('edition_id', editionId)
    .in('type', ['enter_live', 'cta_click', 'heartbeat'])
    .order('created_at', { ascending: true });

  if (error) console.error('getLiveEventsForEdition error:', error);
  return data || [];
}

export async function getLiveCommentCountsPerUser(editionId: string) {
  const { data, error } = await supabase
    .from('comments')
    .select('registration_id, count:id.count()')
    .eq('edition_id', editionId)
    .eq('type', 'real_user');

  if (error) console.error('getLiveCommentCountsPerUser error:', error);
  return (data || []) as { registration_id: string | null; count: number }[];
}

export async function createEvent(event: Omit<Event, 'created_at'>): Promise<void> {
  const { error } = await supabase
    .from('events')
    .insert({
      id: event.id,
      edition_id: event.edition_id,
      registration_id: event.registration_id,
      type: event.type,
      metadata: typeof event.metadata === 'string' ? JSON.parse(event.metadata) : event.metadata,
    });

  if (error) {
    console.error('createEvent error:', error);
  }
}

// Metrics consolidated
export async function getEditionMetrics(editionId: string) {
  const [
    { count: registrations },
    { count: consumed },
    { count: realComments },
    { count: ctaClicks },
    { count: enterLive },
    { count: simulatedComments },
  ] = await Promise.all([
    supabase.from('registrations').select('*', { count: 'exact', head: true }).eq('edition_id', editionId),
    supabase.from('registrations').select('*', { count: 'exact', head: true }).eq('edition_id', editionId).eq('consumed', 1),
    supabase.from('comments').select('*', { count: 'exact', head: true }).eq('edition_id', editionId).in('type', ['real_user', 'real_staff']),
    supabase.from('events').select('*', { count: 'exact', head: true }).eq('edition_id', editionId).eq('type', 'cta_click'),
    supabase.from('events').select('*', { count: 'exact', head: true }).eq('edition_id', editionId).eq('type', 'enter_live'),
    supabase.from('comments').select('*', { count: 'exact', head: true }).eq('edition_id', editionId).in('type', ['simulated_user', 'simulated_staff', 'simulated_purchase']),
  ]);

  return {
    editionId,
    registrations: registrations || 0,
    consumed: consumed || 0,
    enterLive: enterLive || 0,
    realComments: realComments || 0,
    ctaClicks: ctaClicks || 0,
    simulatedComments: simulatedComments || 0,
  };
}
