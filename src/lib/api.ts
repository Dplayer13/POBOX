import type {
  AuthResponse,
  MeResponse,
  LetterListItem,
  LetterDetail,
} from "@/lib/types";
import { upload as uploadToBlob } from "@vercel/blob/client";
import { extOf, validateFile } from "@/lib/file-types";

const TOKEN_KEY = "pobox_token";

/** Error thrown by the api client; carries the server's message + status. */
export class ApiError extends Error {
  status: number;
  constructor(message: string, status: number) {
    super(message);
    this.name = "ApiError";
    this.status = status;
  }
}

export interface UploadedAttachment {
  pathname: string;
  filename: string;
  mimeType: string;
  size: number;
}

/** localStorage-backed session token (survives cross-origin preview iframes
 *  where httpOnly cookies can't be set). Read on every request. */
export function getStoredToken(): string | null {
  if (typeof window === "undefined") return null;
  try {
    return window.localStorage.getItem(TOKEN_KEY);
  } catch {
    return null;
  }
}

export function setStoredToken(token: string | null): void {
  if (typeof window === "undefined") return;
  try {
    if (token) window.localStorage.setItem(TOKEN_KEY, token);
    else window.localStorage.removeItem(TOKEN_KEY);
  } catch {
    /* ignore */
  }
}

async function apiFetch<T>(path: string, init?: RequestInit): Promise<T> {
  const token = getStoredToken();
  const mergedHeaders: Record<string, string> = {
    accept: "application/json",
    ...((init?.headers as Record<string, string>) || {}),
  };
  if (token) mergedHeaders["authorization"] = `Bearer ${token}`;

  const res = await fetch(path, {
    credentials: "same-origin",
    ...init,
    headers: mergedHeaders,
  });
  if (res.status === 204) return undefined as unknown as T;
  const text = await res.text();
  let data: unknown = null;
  if (text) {
    try {
      data = JSON.parse(text);
    } catch {
      data = text;
    }
  }
  if (!res.ok) {
    let msg = "Something went wrong. Please try again.";
    if (data && typeof data === "object" && "error" in (data as any)) {
      msg = String((data as any).error) || msg;
    } else if (typeof data === "string" && data) {
      msg = data;
    }
    throw new ApiError(msg, res.status);
  }
  return data as T;
}

export const api = {
  me: () => apiFetch<MeResponse>("/api/auth/me"),
  signup: async (email: string, password: string) => {
    const r = await apiFetch<AuthResponse>("/api/auth/signup", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ email, password }),
    });
    setStoredToken(r.token);
    return r;
  },
  login: async (email: string, password: string) => {
    const r = await apiFetch<AuthResponse>("/api/auth/login", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ email, password }),
    });
    setStoredToken(r.token);
    return r;
  },
  logout: async () => {
    try {
      await apiFetch<void>("/api/auth/logout", { method: "POST" });
    } finally {
      setStoredToken(null);
    }
  },
  inbox: () => apiFetch<{ letters: LetterListItem[] }>("/api/letters?box=inbox"),
  sent: () => apiFetch<{ letters: LetterListItem[] }>("/api/letters?box=sent"),
  letter: (id: string) => apiFetch<{ letter: LetterDetail }>(`/api/letters/${id}`),
  open: (id: string) =>
    apiFetch<{ letter: LetterDetail }>(`/api/letters/${id}`, {
      method: "PATCH",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ opened: true }),
    }),
  uploadFile: async (boxId: string, file: File): Promise<UploadedAttachment> => {
    const validation = validateFile({
      name: file.name,
      type: file.type,
      size: file.size,
    });
    if (!validation.ok) {
      throw new ApiError(`${file.name}: ${validation.reason}`, 400);
    }
    const pathname =
      `letters/${boxId}/${crypto.randomUUID().replace(/-/g, "")}.${extOf(file.name)}`;
    const token = getStoredToken();
    const blob = await uploadToBlob(pathname, file, {
      access: "private",
      contentType: validation.mimeType,
      handleUploadUrl: "/api/uploads",
      clientPayload: JSON.stringify({
        filename: file.name,
        type: validation.mimeType,
        size: file.size,
      }),
      headers: token ? { authorization: `Bearer ${token}` } : {},
      multipart: file.size > 5 * 1024 * 1024,
    });
    return {
      pathname: blob.pathname,
      filename: file.name,
      mimeType: blob.contentType,
      size: file.size,
    };
  },
  deleteUploads: (pathnames: string[]) =>
    apiFetch<void>("/api/uploads", {
      method: "DELETE",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ pathnames }),
    }),
  send: (
    recipientBoxId: string,
    body: string,
    files: UploadedAttachment[]
  ) => {
    return apiFetch<{ letter: LetterDetail }>("/api/letters", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ recipientBoxId, body, files }),
    });
  },
};

export function attachmentUrl(id: string) {
  const base = `/api/attachments/${id}`;
  // <a download> can't set custom headers, so the session token rides in the
  // query string (validated server-side). Required for the preview iframe,
  // where the cookie may be blocked.
  const token = getStoredToken();
  return token ? `${base}?token=${encodeURIComponent(token)}` : base;
}
