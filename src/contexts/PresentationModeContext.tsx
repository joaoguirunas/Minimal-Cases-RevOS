import { createContext, useContext, useState, useEffect, ReactNode } from 'react';

const STORAGE_KEY = 'gs_presentation_mode';

interface PresentationModeContextValue {
  isPresenting: boolean;
  toggle: () => void;
}

const PresentationModeContext = createContext<PresentationModeContextValue>({
  isPresenting: false,
  toggle: () => {},
});

export function PresentationModeProvider({ children }: { children: ReactNode }) {
  const [isPresenting, setIsPresenting] = useState(
    () => localStorage.getItem(STORAGE_KEY) === 'true',
  );

  useEffect(() => {
    const handler = (e: StorageEvent) => {
      if (e.key === STORAGE_KEY) setIsPresenting(e.newValue === 'true');
    };
    window.addEventListener('storage', handler);
    return () => window.removeEventListener('storage', handler);
  }, []);

  const toggle = () =>
    setIsPresenting((v) => {
      const next = !v;
      localStorage.setItem(STORAGE_KEY, String(next));
      return next;
    });

  return (
    <PresentationModeContext.Provider value={{ isPresenting, toggle }}>
      {children}
    </PresentationModeContext.Provider>
  );
}

export function usePresentationMode() {
  return useContext(PresentationModeContext);
}
