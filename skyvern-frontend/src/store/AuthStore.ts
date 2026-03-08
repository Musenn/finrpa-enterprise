import { create } from "zustand";
import {
  setAuthorizationHeader,
  removeAuthorizationHeader,
} from "@/api/AxiosClient";

const LS_TOKEN = "finrpa_auth_token";
const LS_USER_ID = "finrpa_auth_user_id";
const LS_DISPLAY_NAME = "finrpa_auth_display_name";

type AuthState = {
  token: string | null;
  userId: string | null;
  displayName: string | null;
  isAuthenticated: boolean;
  login: (token: string, userId: string, displayName: string) => void;
  logout: () => void;
  initialize: () => void;
};

const useAuthStore = create<AuthState>((set) => ({
  token: null,
  userId: null,
  displayName: null,
  isAuthenticated: false,

  login: (token: string, userId: string, displayName: string) => {
    localStorage.setItem(LS_TOKEN, token);
    localStorage.setItem(LS_USER_ID, userId);
    localStorage.setItem(LS_DISPLAY_NAME, displayName);
    setAuthorizationHeader(token);
    set({ token, userId, displayName, isAuthenticated: true });
  },

  logout: () => {
    localStorage.removeItem(LS_TOKEN);
    localStorage.removeItem(LS_USER_ID);
    localStorage.removeItem(LS_DISPLAY_NAME);
    removeAuthorizationHeader();
    set({ token: null, userId: null, displayName: null, isAuthenticated: false });
  },

  initialize: () => {
    const token = localStorage.getItem(LS_TOKEN);
    const userId = localStorage.getItem(LS_USER_ID);
    const displayName = localStorage.getItem(LS_DISPLAY_NAME);

    if (token) {
      setAuthorizationHeader(token);
      set({ token, userId, displayName, isAuthenticated: true });
    }
  },
}));

export { useAuthStore };
