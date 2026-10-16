/**
 * Typed client for the RepPilot API (apps/api). The app works fully offline
 * without an account; the API is used for sync and community features.
 */

export const API_URL = (process.env.EXPO_PUBLIC_API_URL ?? 'http://localhost:8000').replace(/\/$/, '');

export class ApiError extends Error {
  constructor(
    public status: number,
    message: string,
    public detail?: unknown,
  ) {
    super(message);
  }
}

function messageFrom(status: number, body: unknown): string {
  const detail = (body as { detail?: unknown } | null)?.detail;
  if (typeof detail === 'string') return detail;
  if (detail && typeof detail === 'object' && 'message' in detail) return String((detail as { message: unknown }).message);
  if (Array.isArray(detail)) {
    const first = detail[0] as { msg?: string; loc?: unknown[] } | undefined;
    if (first?.msg) return `${first.loc?.slice(-1)[0] ?? 'Input'}: ${first.msg.replace(/^Value error, /, '')}`;
  }
  if (status === 0) return 'Cannot reach the RepPilot server. Check your internet connection.';
  return 'Something went wrong. Please try again.';
}

export async function request<T>(
  path: string,
  opts: { method?: string; token?: string | null; body?: unknown; form?: FormData } = {},
): Promise<T> {
  const headers: Record<string, string> = {};
  if (opts.token) headers.Authorization = `Bearer ${opts.token}`;
  let body: BodyInit | undefined;
  if (opts.form) body = opts.form;
  else if (opts.body !== undefined) {
    headers['Content-Type'] = 'application/json';
    body = JSON.stringify(opts.body);
  }
  let res: Response;
  try {
    res = await fetch(`${API_URL}${path}`, { method: opts.method ?? 'GET', headers, body });
  } catch {
    throw new ApiError(0, messageFrom(0, null));
  }
  if (res.status === 204) return undefined as T;
  let json: unknown = null;
  try {
    json = await res.json();
  } catch {
    // Non-JSON error page.
  }
  if (!res.ok) {
    const detail = (json as { detail?: unknown } | null)?.detail;
    throw new ApiError(res.status, messageFrom(res.status, json), detail);
  }
  return json as T;
}

// ── Types mirroring the API ─────────────────────────────────────────

export interface Me {
  id: number;
  email: string;
  display_name: string;
  bio: string;
  experience: string;
  profile_visibility: 'public' | 'friends';
  role: 'member' | 'moderator';
  strikes: number;
  suspended: boolean;
}

export interface AuthResult {
  token: string;
  user: Me;
}

export interface SyncDoc {
  version: number;
  data: Record<string, unknown>;
  updated_at: string | null;
}

export interface Person {
  id: number;
  display_name: string;
  bio: string;
  experience: string;
  relationship: 'self' | 'friend' | 'request_sent' | 'request_received' | 'none' | 'blocked';
}

export interface FriendRequest {
  id: number;
  from_user: Person;
}

export type PostKind = 'text' | 'workout' | 'progress' | 'meal' | 'achievement';
export type Visibility = 'public' | 'friends' | 'private';

export interface Post {
  id: number;
  author: { id: number; display_name: string };
  kind: PostKind;
  body: string;
  visibility: Visibility;
  status: 'visible' | 'held' | 'removed';
  media: { id: number; kind: 'image' | 'video'; status: string } | null;
  like_count: number;
  liked_by_me: boolean;
  comment_count: number;
  created_at: string;
  edited: boolean;
  notice?: string | null;
}

export interface Comment {
  id: number;
  author: { id: number; display_name: string };
  body: string;
  status: string;
  created_at: string;
}

export interface Conversation {
  user_id: number;
  display_name: string;
  last_message: string | null;
  last_at: string | null;
  unread: number;
}

export interface ChatMessageDto {
  id: number;
  from_me: boolean;
  body: string;
  status: string;
  created_at: string;
}

export interface Challenge {
  id: number;
  slug: string;
  title: string;
  description: string;
  unit: string;
  rules: string;
  joined: boolean;
  my_best: number | null;
  participants: number;
}

export interface BoardRow {
  rank: number;
  user_id: number;
  display_name: string;
  experience: string;
  value: number;
  is_me: boolean;
}

export interface Board {
  challenge_id: number;
  unit: string;
  mode: string;
  rows: BoardRow[];
  my_row: BoardRow | null;
}

export type ReportReason =
  | 'sexual'
  | 'harassment'
  | 'hate'
  | 'violence'
  | 'self_harm'
  | 'spam'
  | 'misinformation'
  | 'minor_safety'
  | 'other';

export interface ModAction {
  id: number;
  target_type: string;
  target_id: number;
  action: string;
  reason: string;
  created_at: string;
  appeal_status: string | null;
}

export interface QueueItem {
  target_type: 'post' | 'comment' | 'message' | 'entry' | 'media' | 'user';
  target_id: number;
  author_id: number | null;
  author_name: string | null;
  preview: string;
  status: string;
  report_count: number;
  reasons: string[];
  priority: 'high' | 'normal';
  created_at: string | null;
}

export interface AppealItem {
  id: number;
  action_id: number;
  action: string;
  action_reason: string;
  target_type: string;
  target_id: number;
  user_id: number;
  message: string;
  created_at: string;
}

export interface ModStats {
  open_reports: number;
  high_priority_open: number;
  held_items: number;
  pending_media: number;
  open_appeals: number;
  appeals_overturned: number;
  appeals_decided: number;
  users_with_strikes: number;
}

// ── Endpoints ───────────────────────────────────────────────────────

type T = string | null;

export const api = {
  register: (b: { email: string; password: string; display_name: string; date_of_birth: string; accept_community_standards: boolean }) =>
    request<AuthResult>('/auth/register', { method: 'POST', body: b }),
  login: (email: string, password: string) => request<AuthResult>('/auth/login', { method: 'POST', body: { email, password } }),
  me: (t: T) => request<Me>('/me', { token: t }),
  updateMe: (t: T, b: Partial<Pick<Me, 'display_name' | 'bio' | 'experience' | 'profile_visibility'>>) =>
    request<Me>('/me', { method: 'PATCH', token: t, body: b }),
  deleteAccount: (t: T) => request<void>('/me', { method: 'DELETE', token: t }),

  getSync: (t: T) => request<SyncDoc>('/sync', { token: t }),
  putSync: (t: T, base_version: number, data: Record<string, unknown>) =>
    request<SyncDoc>('/sync', { method: 'PUT', token: t, body: { base_version, data } }),

  search: (t: T, q: string) => request<Person[]>(`/users/search?q=${encodeURIComponent(q)}`, { token: t }),
  user: (t: T, id: number) => request<Person>(`/users/${id}`, { token: t }),
  friends: (t: T) => request<Person[]>('/friends', { token: t }),
  friendRequests: (t: T) => request<FriendRequest[]>('/friends/requests', { token: t }),
  sendFriendRequest: (t: T, userId: number) => request<{ status: string }>(`/friends/requests/${userId}`, { method: 'POST', token: t }),
  acceptRequest: (t: T, id: number) => request<void>(`/friends/requests/${id}/accept`, { method: 'POST', token: t }),
  rejectRequest: (t: T, id: number) => request<void>(`/friends/requests/${id}/reject`, { method: 'POST', token: t }),
  removeFriend: (t: T, userId: number) => request<void>(`/friends/${userId}`, { method: 'DELETE', token: t }),
  blocks: (t: T) => request<Person[]>('/blocks', { token: t }),
  block: (t: T, userId: number) => request<void>(`/blocks/${userId}`, { method: 'POST', token: t }),
  unblock: (t: T, userId: number) => request<void>(`/blocks/${userId}`, { method: 'DELETE', token: t }),

  feed: (t: T, scope: 'friends' | 'everyone' | 'mine', beforeId?: number) =>
    request<Post[]>(`/feed?scope=${scope}${beforeId ? `&before_id=${beforeId}` : ''}`, { token: t }),
  post: (t: T, id: number) => request<Post>(`/posts/${id}`, { token: t }),
  createPost: (t: T, b: { kind: PostKind; body: string; visibility: Visibility; media_id?: number | null }) =>
    request<Post>('/posts', { method: 'POST', token: t, body: b }),
  editPost: (t: T, id: number, b: { body?: string; visibility?: Visibility }) =>
    request<Post>(`/posts/${id}`, { method: 'PATCH', token: t, body: b }),
  deletePost: (t: T, id: number) => request<void>(`/posts/${id}`, { method: 'DELETE', token: t }),
  like: (t: T, id: number) => request<void>(`/posts/${id}/like`, { method: 'POST', token: t }),
  unlike: (t: T, id: number) => request<void>(`/posts/${id}/like`, { method: 'DELETE', token: t }),
  comments: (t: T, id: number) => request<Comment[]>(`/posts/${id}/comments`, { token: t }),
  addComment: (t: T, id: number, body: string) => request<Comment>(`/posts/${id}/comments`, { method: 'POST', token: t, body: { body } }),
  deleteComment: (t: T, postId: number, id: number) => request<void>(`/posts/${postId}/comments/${id}`, { method: 'DELETE', token: t }),
  uploadMedia: (t: T, form: FormData) => request<{ id: number; kind: string; status: string; notice: string }>('/media', { method: 'POST', token: t, form }),

  report: (t: T, b: { target_type: string; target_id: number; reason: ReportReason; details?: string }) =>
    request<{ status: string; message: string }>('/reports', { method: 'POST', token: t, body: b }),
  myActions: (t: T) => request<ModAction[]>('/moderation/actions/mine', { token: t }),
  appeal: (t: T, action_id: number, message: string) =>
    request<{ message: string }>('/appeals', { method: 'POST', token: t, body: { action_id, message } }),

  conversations: (t: T) => request<Conversation[]>('/conversations', { token: t }),
  messages: (t: T, userId: number) => request<ChatMessageDto[]>(`/messages/${userId}`, { token: t }),
  sendMessage: (t: T, userId: number, body: string) =>
    request<ChatMessageDto>(`/messages/${userId}`, { method: 'POST', token: t, body: { body } }),

  challenges: (t: T) => request<Challenge[]>('/challenges', { token: t }),
  joinChallenge: (t: T, id: number, show_on_leaderboard: boolean) =>
    request<void>(`/challenges/${id}/join`, { method: 'POST', token: t, body: { show_on_leaderboard } }),
  leaveChallenge: (t: T, id: number) => request<void>(`/challenges/${id}/join`, { method: 'DELETE', token: t }),
  submitEntry: (t: T, id: number, value: number, note = '') =>
    request<{ id: number; value: number; status: string; notice: string | null }>(`/challenges/${id}/entries`, {
      method: 'POST',
      token: t,
      body: { value, note },
    }),
  leaderboard: (t: T, id: number, q: { division: string; scope: string; mode: string }) =>
    request<Board>(`/challenges/${id}/leaderboard?division=${q.division}&scope=${q.scope}&mode=${q.mode}`, { token: t }),

  modQueue: (t: T) => request<{ items: QueueItem[]; appeals: AppealItem[] }>('/moderation/queue', { token: t }),
  modDecide: (t: T, b: { target_type: string; target_id: number; action: string; reason: string; strike?: boolean }) =>
    request<void>('/moderation/decide', { method: 'POST', token: t, body: b }),
  modAppeal: (t: T, id: number, decision: 'uphold' | 'overturn', response: string) =>
    request<void>(`/moderation/appeals/${id}`, { method: 'POST', token: t, body: { decision, response } }),
  modStats: (t: T) => request<ModStats>('/moderation/stats', { token: t }),
};

export function mediaUrl(id: number): string {
  return `${API_URL}/media/${id}`;
}
