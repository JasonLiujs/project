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
          console.log('[SDKContext] 开始获取飞书上下文...');

          // 使用标准的飞书JSSDK方法获取上下文
          const context = await sdk.Context.load();
          const tabContext = await sdk.tab.getContext();

          console.log('[SDKContext] Context.load() 结果:', context);
          console.log('[SDKContext] tab.getContext() 结果:', tabContext);

          // 从 Context.load() 获取 activeWorkItemId
          if (context && context.activeWorkItem) {
            workItemId = context.activeWorkItem.id.toString();
            console.log('[SDKContext] 从Context获取workItemId:', workItemId);
          }

          // 从 tab.getContext() 获取 spaceId 和 workObjectId
          if (tabContext) {
            spaceId = tabContext.spaceId;
            workItemType = tabContext.workObjectId; // 这里对应story等工作项类型
            projectKey = tabContext.projectKey;

            console.log('[SDKContext] 从tabContext获取spaceId:', spaceId);
            console.log('[SDKContext] 从tabContext获取workObjectId(workItemType):', workItemType);
            console.log('[SDKContext] 从tabContext获取projectKey:', projectKey);
          }

          console.log('[SDKContext] 最终上下文:', {
            workItemId,
            workItemType,
            spaceId,
            projectKey
          });

        } catch (e) {
          console.warn('[SDKContext] 获取上下文失败:', e);

          // 如果标准方法失败，回退到项目方法
          try {
            console.log('[SDKContext] 尝试回退方法...');
            const urlInfo = await sdk.project.getUrlInfo({});
            workItemId = urlInfo.workItemId;
            workItemType = urlInfo.workItemTypeKey;
            projectKey = urlInfo.projectKey;
            spaceId = urlInfo.spaceId;
            console.log('[SDKContext] 回退方法成功:', { workItemId, workItemType, spaceId, projectKey });
          } catch (fallbackError) {
            console.error('[SDKContext] 回退方法也失败:', fallbackError);
          }
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
        console.error('[SDKContext] 加载上下文时发生错误:', error);
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
