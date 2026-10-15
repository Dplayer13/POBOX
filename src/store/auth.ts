import { create } from "zustand";
import { api } from "@/lib/api";
import type { MeResponse } from "@/lib/types";

export type AuthStatus = "loading" | "authed" | "unauthed";

interface AuthState {
  status: AuthStatus;
  me: MeResponse | null;
  // Set right after signup so the app can celebrate the box id "shown once".
  justSignedUpBoxId: string | null;
  init: () => Promise<void>;
  login: (email: string, password: string) => Promise<void>;
  signup: (email: string, password: string) => Promise<void>;
  logout: () => Promise<void>;
  clearJustSignedUp: () => void;
}

export const useAuth = create<AuthState>((set) => ({
  status: "loading",
  me: null,
  justSignedUpBoxId: null,
  init: async () => {
    try {
      const me = await api.me();
      set({ status: "authed", me });
    } catch {
      set({ status: "unauthed", me: null });
    }
  },
  login: async (email, password) => {
    const me = await api.login(email, password);
    set({ status: "authed", me, justSignedUpBoxId: null });
  },
  signup: async (email, password) => {
    const me = await api.signup(email, password);
    set({ status: "authed", me, justSignedUpBoxId: me.boxId });
  },
  logout: async () => {
    try {
      await api.logout();
    } finally {
      set({ status: "unauthed", me: null, justSignedUpBoxId: null });
    }
  },
  clearJustSignedUp: () => set({ justSignedUpBoxId: null }),
}));
