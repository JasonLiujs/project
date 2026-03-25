import { createContext, useContext, useState, useEffect, ReactNode } from 'react';

export interface WorkItemContext {
  workItemId?: string;
  workItemType?: string;
  projectKey?: string;
  spaceId?: string;
  loading: boolean;
  error?: string;
}

export interface SDKContextValue extends WorkItemContext {
  sdk: typeof window.JSSDK;
}

const SDKContext = createContext<SDKContextValue | null>(null);

export function SDKProvider({ children }: { children: ReactNode }) {
  const [context, setContext] = useState<WorkItemContext & { sdk: typeof window.JSSDK }>({
    loading: true,
    sdk: window.JSSDK,
  });

  useEffect(() => {
    const loadContext = async () => {
      try {
        const sdk = window.JSSDK;
        if (!sdk) {
          setContext(prev => ({ ...prev, loading: false, error: 'SDK not available' }));
          return;
        }

        let workItemId: string | undefined;
        let workItemType: string | undefined;
        let projectKey: string | undefined;
        let spaceId: string | undefined;

        try {
          const urlInfo = await sdk.project.getUrlInfo({});
          workItemId = urlInfo.workItemId;
          workItemType = urlInfo.workItemTypeKey;
          projectKey = urlInfo.projectKey;
          spaceId = urlInfo.spaceId;
        } catch (e) {
          console.warn('Could not get URL info:', e);
        }

        setContext({
          workItemId,
          workItemType,
          projectKey,
          spaceId,
          loading: false,
          sdk,
        });
      } catch (error) {
        setContext(prev => ({
          ...prev,
          loading: false,
          error: error instanceof Error ? error.message : 'Unknown error',
        }));
      }
    };

    loadContext();
  }, []);

  return (
    <SDKContext.Provider value={context}>
      {children}
    </SDKContext.Provider>
  );
}

export function useSDKContext(): SDKContextValue {
  const ctx = useContext(SDKContext);
  if (!ctx) {
    return {
      loading: true,
      sdk: window.JSSDK,
    };
  }
  return ctx;
}

export function useWorkItemContext(): WorkItemContext {
  const { workItemId, workItemType, projectKey, spaceId, loading, error } = useSDKContext();
  return { workItemId, workItemType, projectKey, spaceId, loading, error };
}
