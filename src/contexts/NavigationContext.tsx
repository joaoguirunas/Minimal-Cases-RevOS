
import { createContext, useContext, useState, useCallback, ReactNode } from 'react';

interface NavigationContextType {
  showBackButton: boolean;
  leadName?: string;
  pipelineName?: string;
  onBack?: () => void;
  setNavigationState: (state: {
    showBackButton: boolean;
    leadName?: string;
    pipelineName?: string;
    onBack?: () => void;
  }) => void;
  clearNavigationState: () => void;
}

const NavigationContext = createContext<NavigationContextType | undefined>(undefined);

export const useNavigation = () => {
  const context = useContext(NavigationContext);
  if (!context) {
    throw new Error('useNavigation must be used within a NavigationProvider');
  }
  return context;
};

export const NavigationProvider = ({ children }: { children: ReactNode }) => {
  const [navigationState, setNavigationStateInternal] = useState({
    showBackButton: false,
    leadName: undefined as string | undefined,
    pipelineName: undefined as string | undefined,
    onBack: undefined as (() => void) | undefined,
  });

  const setNavigationState = useCallback((state: {
    showBackButton: boolean;
    leadName?: string;
    pipelineName?: string;
    onBack?: () => void;
  }) => {
    setNavigationStateInternal({
      showBackButton: state.showBackButton,
      leadName: state.leadName,
      pipelineName: state.pipelineName,
      onBack: state.onBack,
    });
  }, []);

  const clearNavigationState = useCallback(() => {
    setNavigationStateInternal({
      showBackButton: false,
      leadName: undefined,
      pipelineName: undefined,
      onBack: undefined,
    });
  }, []);

  return (
    <NavigationContext.Provider
      value={{
        ...navigationState,
        setNavigationState,
        clearNavigationState,
      }}
    >
      {children}
    </NavigationContext.Provider>
  );
};
