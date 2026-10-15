import type { Prisma } from "@prisma/client";
import type {
  LetterDetail,
  LetterListItem,
  AttachmentPublic,
} from "@/lib/types";

type LetterWithAttachments = Prisma.LetterGetPayload<{
  include: { attachments: true };
}>;

export function toAttachmentPublic(a: {
  id: string;
  filename: string;
  mimeType: string;
  size: number;
}): AttachmentPublic {
  return {
    id: a.id,
    filename: a.filename,
    mimeType: a.mimeType,
    size: a.size,
  };
}

export function toDetail(l: LetterWithAttachments): LetterDetail {
  return {
    id: l.id,
    senderBoxId: l.senderBoxId,
    recipientBoxId: l.recipientBoxId,
    body: l.body,
    sentAt: l.sentAt.toISOString(),
    deliverAt: l.deliverAt.toISOString(),
    openedAt: l.openedAt ? l.openedAt.toISOString() : null,
    attachments: l.attachments.map(toAttachmentPublic),
  };
}

export function toListItem(l: LetterWithAttachments): LetterListItem {
  const trimmed = l.body.replace(/\s+/g, " ").trim();
  const preview =
    trimmed.length > 180 ? trimmed.slice(0, 180) + "…" : trimmed;
  return {
    id: l.id,
    senderBoxId: l.senderBoxId,
    recipientBoxId: l.recipientBoxId,
    preview,
    sentAt: l.sentAt.toISOString(),
    deliverAt: l.deliverAt.toISOString(),
    openedAt: l.openedAt ? l.openedAt.toISOString() : null,
    attachmentCount: l.attachments.length,
  };
}

// Delivery delay. The plan says "a few hours"; we use 60 seconds here so the
// ritual of waiting is observable in a single demo session. Easy to raise.
export const DELIVERY_DELAY_MS = 60_000;
