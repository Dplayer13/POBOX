// Shared API response types — imported by both server routes and the client.

export interface UserPublic {
  id: string;
  email: string;
}

/** Returned by signup + login. Carries the raw session token so the client
 *  can store it in localStorage and send it as a Bearer header (cookies don't
 *  survive cross-origin preview iframes). */
export interface AuthResponse {
  user: UserPublic;
  boxId: string;
  token: string;
}

/** Returned by GET /api/auth/me — no token (client already has it). */
export interface MeResponse {
  user: UserPublic;
  boxId: string;
}

export interface AttachmentPublic {
  id: string;
  filename: string;
  mimeType: string;
  size: number;
}

export interface LetterListItem {
  id: string;
  senderBoxId: string;
  recipientBoxId: string;
  preview: string;
  sentAt: string; // ISO
  deliverAt: string; // ISO
  openedAt: string | null; // ISO
  attachmentCount: number;
}

export interface LetterDetail {
  id: string;
  senderBoxId: string;
  recipientBoxId: string;
  body: string;
  sentAt: string;
  deliverAt: string;
  openedAt: string | null;
  attachments: AttachmentPublic[];
}
