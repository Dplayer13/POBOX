// Shared API response types — imported by both server routes and the client.

export interface UserPublic {
  id: string;
  email: string;
}

export interface MeResponse {
  user: UserPublic;
  boxId: string;
}

export interface AttachmentPublic {
  id: string;
  filename: string;
  mimeType: string;
  size: number;
  // storageKey is intentionally NOT exposed to the client; downloads resolve
  // it server-side via /api/attachments/[id].
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
