declare global {
  interface Window {
    JSSDK: {
      tab: {
        getContext: () => Promise<{
          workObjectToken: string;
          workItemToken: string;
          locale: string;
        }>;
      };
      WorkObject: {
        load: (params: { workObjectToken: string }) => Promise<any>;
      };
      WorkItem: {
        load: (params: { workItemToken: string }) => Promise<any>;
      };
      storage: {
        getItem: (key: string) => Promise<string | null>;
        setItem: (key: string, value: string) => Promise<void>;
      };
    };
  }
}

export {};
