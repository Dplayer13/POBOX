import type {
  MeResponse,
  LetterListItem,
  LetterDetail,
} from "@/lib/types";

/** Error thrown by the api client; carries the server's message + status. */
export class ApiError extends Error {
  status: number;
  constructor(message: string, status: number) {
    super(message);
    this.name = "ApiError";
    this.status = status;
  }
}

async function apiFetch<T>(path: string, init?: RequestInit): Promise<T> {
  const res = await fetch(path, {
    credentials: "same-origin",
    ...init,
    headers: {
      accept: "application/json",
      ...(init?.headers || {}),
    },
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
  signup: (email: string, password: string) =>
    apiFetch<MeResponse>("/api/auth/signup", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ email, password }),
    }),
  login: (email: string, password: string) =>
    apiFetch<MeResponse>("/api/auth/login", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ email, password }),
    }),
  logout: () =>
    apiFetch<void>("/api/auth/logout", { method: "POST" }),
  inbox: () =>
    apiFetch<{ letters: LetterListItem[] }>("/api/letters?box=inbox"),
  sent: () =>
    apiFetch<{ letters: LetterListItem[] }>("/api/letters?box=sent"),
  letter: (id: string) =>
    apiFetch<{ letter: LetterDetail }>(`/api/letters/${id}`),
  open: (id: string) =>
    apiFetch<{ letter: LetterDetail }>(`/api/letters/${id}`, {
      method: "PATCH",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ opened: true }),
    }),
  send: (recipientBoxId: string, body: string, files: File[]) => {
    const fd = new FormData();
    fd.set("recipientBoxId", recipientBoxId);
    fd.set("body", body);
    for (const f of files) fd.append("files", f);
    // Don't set content-type — the browser sets the multipart boundary.
    return apiFetch<{ letter: LetterDetail }>("/api/letters", {
      method: "POST",
      body: fd,
    });
  },
};

/** Build the download URL for an attachment (auth-checked server-side). */
export function attachmentUrl(id: string) {
  return `/api/attachments/${id}`;
}
