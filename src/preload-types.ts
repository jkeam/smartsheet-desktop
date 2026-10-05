export {};

type TabState = {
  id: string;
  title: string;
  url: string;
  favicon: string | null;
  active: boolean;
  loading: boolean;
};

type WindowState = {
  tabs: TabState[];
  canGoBack: boolean;
  canGoForward: boolean;
};

declare global {
  interface Window {
    desktop: {
      onState: (callback: (state: WindowState) => void) => void;
      newTab: (url?: string) => void;
      closeTab: (id: string) => void;
      activateTab: (id: string) => void;
      reorderTabs: (ids: string[]) => void;
      goHome: () => void;
      reload: () => void;
      goBack: () => void;
      goForward: () => void;
      duplicateTab: (id: string) => void;
      moveToNewWindow: (id: string) => void;
      openInBrowser: (id: string) => void;
    };
  }
}
