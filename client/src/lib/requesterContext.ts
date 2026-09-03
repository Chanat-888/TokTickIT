import {
  createContext,
  createElement,
  useCallback,
  useContext,
  useState,
  type ReactNode,
} from "react";

// BR-07: sessionStorage, not localStorage — a new tab/session requires
// reselecting rather than silently inheriting a stale test identity.
const STORAGE_KEY = "toktickit.selectedRequester";

export interface SelectedRequester {
  id: number;
  name: string;
}

function isSelectedRequester(value: unknown): value is SelectedRequester {
  return (
    typeof value === "object" &&
    value !== null &&
    typeof (value as SelectedRequester).id === "number" &&
    typeof (value as SelectedRequester).name === "string"
  );
}

export function getSelectedRequester(): SelectedRequester | null {
  try {
    const raw = sessionStorage.getItem(STORAGE_KEY);
    if (!raw) return null;
    const parsed: unknown = JSON.parse(raw);
    return isSelectedRequester(parsed) ? parsed : null;
  } catch {
    return null;
  }
}

export function setSelectedRequester(requester: SelectedRequester): void {
  sessionStorage.setItem(STORAGE_KEY, JSON.stringify(requester));
}

export function clearSelectedRequester(): void {
  sessionStorage.removeItem(STORAGE_KEY);
}

interface RequesterContextValue {
  requester: SelectedRequester | null;
  selectRequester: (requester: SelectedRequester) => void;
  clearRequester: () => void;
}

const RequesterContext = createContext<RequesterContextValue | undefined>(undefined);

export function RequesterProvider({ children }: { children: ReactNode }) {
  const [requester, setRequester] = useState<SelectedRequester | null>(() =>
    getSelectedRequester(),
  );

  const selectRequester = useCallback((next: SelectedRequester) => {
    setSelectedRequester(next);
    setRequester(next);
  }, []);

  const clearRequester = useCallback(() => {
    clearSelectedRequester();
    setRequester(null);
  }, []);

  return createElement(
    RequesterContext.Provider,
    { value: { requester, selectRequester, clearRequester } },
    children,
  );
}

export function useRequester(): RequesterContextValue {
  const ctx = useContext(RequesterContext);
  if (!ctx) {
    throw new Error("useRequester must be used within a RequesterProvider");
  }
  return ctx;
}
