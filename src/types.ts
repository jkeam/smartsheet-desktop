export const HOME_URL = "https://app.smartsheet.com";
export const TAB_BAR_HEIGHT = 44;
export const MAX_TABS = 100;
export const SESSION_PARTITION = "persist:smartsheet";

export type TabState = {
  id: string;
  title: string;
  url: string;
  favicon: string | null;
  active: boolean;
  loading: boolean;
};

export type FindState = {
  open: boolean;
  query: string;
  active: number;
  total: number;
};

export type WindowState = {
  tabs: TabState[];
  canGoBack: boolean;
  canGoForward: boolean;
  find: FindState;
};

export type PersistedWindow = {
  x?: number;
  y?: number;
  width: number;
  height: number;
  isMaximized?: boolean;
  tabs: { url: string }[];
  activeIndex: number;
};
