import {
  createContext,
  useContext,
  useState,
  useCallback,
  type ReactNode,
} from "react";

// Storage keys
const TOKEN_STORAGE_KEY = "pulldash_github_token";
const TOKEN_EXPIRY_KEY = "pulldash_github_token_expiry";

// ============================================================================
// Types
// ============================================================================

interface AuthState {
  isAuthenticated: boolean;
  isLoading: boolean;
  token: string | null;
  // Anonymous mode - user can browse public repos without auth
  isAnonymous: boolean;
  // Rate limit state
  isRateLimited: boolean;
}

interface AuthContextValue extends AuthState {
  openSignIn: () => Promise<void>;
  loginWithPAT: (token: string) => Promise<void>;
  logout: () => void;
  // Enable anonymous browsing mode
  enableAnonymousMode: () => void;
  // Check if user can write (authenticated, not anonymous)
  canWrite: boolean;
  // Show the welcome/auth dialog (for re-authenticating from anonymous mode)
  showWelcomeDialog: boolean;
  setShowWelcomeDialog: (show: boolean) => void;
  // Set rate limit state (called by GitHub context when rate limited)
  setRateLimited: (limited: boolean) => void;
}

// ============================================================================
// Context
// ============================================================================

const AuthContext = createContext<AuthContextValue | null>(null);

// ============================================================================
// Helper Functions
// ============================================================================

function getStoredToken(): string | null {
  try {
    const token = localStorage.getItem(TOKEN_STORAGE_KEY);
    const expiry = localStorage.getItem(TOKEN_EXPIRY_KEY);

    // Check if token exists and hasn't expired
    if (token) {
      if (expiry) {
        const expiryDate = new Date(expiry);
        if (expiryDate > new Date()) {
          return token;
        }
        // Token expired, clear it
        clearStoredToken();
        return null;
      }
      // No expiry set, token is valid (GitHub tokens don't expire unless revoked)
      return token;
    }
    return null;
  } catch {
    return null;
  }
}

function storeToken(token: string, expiresIn?: number): void {
  try {
    localStorage.setItem(TOKEN_STORAGE_KEY, token);
    if (expiresIn) {
      const expiryDate = new Date(Date.now() + expiresIn * 1000);
      localStorage.setItem(TOKEN_EXPIRY_KEY, expiryDate.toISOString());
    }
  } catch {
    console.error("Failed to store token in localStorage");
  }
}

function clearStoredToken(): void {
  try {
    localStorage.removeItem(TOKEN_STORAGE_KEY);
    localStorage.removeItem(TOKEN_EXPIRY_KEY);
  } catch {
    // Ignore
  }
}

// ============================================================================
// Provider
// ============================================================================

// Storage key for anonymous mode preference
const ANONYMOUS_MODE_KEY = "pulldash_anonymous_mode";

function getStoredAnonymousMode(): boolean {
  try {
    return localStorage.getItem(ANONYMOUS_MODE_KEY) === "true";
  } catch {
    return false;
  }
}

function setStoredAnonymousMode(enabled: boolean): void {
  try {
    if (enabled) {
      localStorage.setItem(ANONYMOUS_MODE_KEY, "true");
    } else {
      localStorage.removeItem(ANONYMOUS_MODE_KEY);
    }
  } catch {
    // Ignore
  }
}

export function AuthProvider({ children }: { children: ReactNode }) {
  const [state, setState] = useState<AuthState>(() => {
    const token = getStoredToken();
    const isAnonymous = !token && getStoredAnonymousMode();
    return {
      isAuthenticated: !!token,
      isLoading: false,
      token,
      isAnonymous,
      isRateLimited: false,
    };
  });

  // Track whether to show the welcome dialog (for re-authenticating from anonymous mode)
  const [showWelcomeDialog, setShowWelcomeDialog] = useState(false);

  // Set rate limit state
  const setRateLimited = useCallback(
    (limited: boolean) => {
      setState((prev) => ({ ...prev, isRateLimited: limited }));
      // If rate limited and anonymous, force show the welcome dialog
      if (limited && !state.isAuthenticated) {
        setShowWelcomeDialog(true);
      }
    },
    [state.isAuthenticated]
  );

  // Existing sign-in actions open the local token dialog.
  const openSignIn = useCallback(async () => {
    setShowWelcomeDialog(true);
  }, []);

  const loginWithPAT = useCallback(async (token: string): Promise<void> => {
    const trimmedToken = token.trim();
    if (!trimmedToken) {
      throw new Error("Token cannot be empty");
    }

    // Validate token format (GitHub PAT prefixes)
    if (
      !trimmedToken.startsWith("ghp_") &&
      !trimmedToken.startsWith("github_pat_")
    ) {
      throw new Error(
        'Invalid token format. GitHub tokens should start with "ghp_" or "github_pat_"'
      );
    }

    // Validate token directly with GitHub API (CORS is supported)
    const response = await fetch("https://api.github.com/user", {
      headers: {
        Authorization: `Bearer ${trimmedToken}`,
        Accept: "application/vnd.github.v3+json",
      },
    });

    if (!response.ok) {
      if (response.status === 401) {
        throw new Error("Invalid or expired token");
      }
      throw new Error("Failed to validate token with GitHub");
    }

    const userData = await response.json();

    // Check token scopes from response headers
    const scopes = response.headers.get("x-oauth-scopes") || "";
    const hasRepoScope = scopes.includes("repo");

    if (!hasRepoScope) {
      throw new Error(
        'Token is missing the required "repo" scope. Please create a new token with the repo scope.'
      );
    }

    // Store token in the local app profile
    storeToken(trimmedToken);
    setStoredAnonymousMode(false);
    setState({
      isAuthenticated: true,
      isLoading: false,
      token: trimmedToken,
      isAnonymous: false,
      isRateLimited: false,
    });

    console.log("Successfully authenticated with PAT as:", userData.login);
  }, []);

  const logout = useCallback(() => {
    clearStoredToken();
    setStoredAnonymousMode(false);
    setState({
      isAuthenticated: false,
      isLoading: false,
      token: null,
      isAnonymous: false,
      isRateLimited: false,
    });
  }, []);

  const enableAnonymousMode = useCallback(() => {
    setStoredAnonymousMode(true);
    setState((prev) => ({
      ...prev,
      isAnonymous: true,
    }));
  }, []);

  const value: AuthContextValue = {
    ...state,
    openSignIn,
    loginWithPAT,
    logout,
    enableAnonymousMode,
    canWrite: state.isAuthenticated && !state.isAnonymous,
    showWelcomeDialog,
    setShowWelcomeDialog,
    setRateLimited,
  };

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

// ============================================================================
// Hooks
// ============================================================================

export function useAuth(): AuthContextValue {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error("useAuth must be used within AuthProvider");
  }
  return context;
}

export function useToken(): string | null {
  const { token } = useAuth();
  return token;
}

export function useIsAuthenticated(): boolean {
  const { isAuthenticated } = useAuth();
  return isAuthenticated;
}

export function useIsAnonymous(): boolean {
  const { isAnonymous } = useAuth();
  return isAnonymous;
}

export function useCanWrite(): boolean {
  const { canWrite } = useAuth();
  return canWrite;
}
