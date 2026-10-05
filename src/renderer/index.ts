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

const tabsEl = document.getElementById("tabs") as HTMLElement;
const backBtn = document.getElementById("back") as HTMLButtonElement;
const forwardBtn = document.getElementById("forward") as HTMLButtonElement;
const reloadBtn = document.getElementById("reload") as HTMLButtonElement;
const homeBtn = document.getElementById("home") as HTMLButtonElement;
const newTabBtn = document.getElementById("new-tab") as HTMLButtonElement;

let dragId: string | null = null;

function applyState(state: WindowState): void {
  renderTabs(state.tabs);
  backBtn.disabled = !state.canGoBack;
  forwardBtn.disabled = !state.canGoForward;
}

window.desktop.onState(applyState);
void window.desktop.getState().then((state) => applyState(state));

backBtn.addEventListener("click", () => window.desktop.goBack());
forwardBtn.addEventListener("click", () => window.desktop.goForward());
reloadBtn.addEventListener("click", () => window.desktop.reload());
homeBtn.addEventListener("click", () => window.desktop.goHome());
newTabBtn.addEventListener("click", () => window.desktop.newTab());

function renderTabs(tabs: TabState[]): void {
  tabsEl.replaceChildren();
  for (const tab of tabs) {
    tabsEl.append(tabButton(tab));
  }
}

function tabButton(tab: TabState): HTMLButtonElement {
  const button = document.createElement("button");
  button.className = `tab${tab.active ? " active" : ""}${tab.loading ? " loading" : ""}`;
  button.title = tab.title;
  button.draggable = true;
  button.dataset.id = tab.id;

  if (tab.favicon) {
    const img = document.createElement("img");
    img.src = tab.favicon;
    img.alt = "";
    img.referrerPolicy = "no-referrer";
    button.append(img);
  } else {
    const mark = document.createElement("span");
    mark.className = "favicon-fallback";
    mark.textContent = "⊞";
    button.append(mark);
  }

  const title = document.createElement("span");
  title.className = "title";
  title.textContent = tab.title || "Smartsheet";
  button.append(title);

  const close = document.createElement("button");
  close.className = "close";
  close.type = "button";
  close.title = "Close tab";
  close.textContent = "×";
  close.addEventListener("click", (event) => {
    event.stopPropagation();
    window.desktop.closeTab(tab.id);
  });
  button.append(close);

  button.addEventListener("click", () => window.desktop.activateTab(tab.id));
  button.addEventListener("auxclick", (event) => {
    if (event.button === 1) {
      event.preventDefault();
      window.desktop.closeTab(tab.id);
    }
  });
  button.addEventListener("contextmenu", (event) => {
    event.preventDefault();
    showTabMenu(event.clientX, event.clientY, tab.id);
  });
  button.addEventListener("dragstart", () => {
    dragId = tab.id;
  });
  button.addEventListener("dragover", (event) => {
    event.preventDefault();
  });
  button.addEventListener("drop", (event) => {
    event.preventDefault();
    if (!dragId || dragId === tab.id) return;
    const ids = Array.from(tabsEl.querySelectorAll<HTMLElement>(".tab")).map((el) => el.dataset.id ?? "");
    const from = ids.indexOf(dragId);
    const to = ids.indexOf(tab.id);
    if (from < 0 || to < 0) return;
    ids.splice(to, 0, ids.splice(from, 1)[0] ?? "");
    window.desktop.reorderTabs(ids.filter(Boolean));
  });
  return button;
}

function showTabMenu(x: number, y: number, id: string): void {
  const existing = document.getElementById("tab-menu");
  existing?.remove();
  const menu = document.createElement("div");
  menu.id = "tab-menu";
  Object.assign(menu.style, {
    position: "fixed",
    left: `${x}px`,
    top: `${y}px`,
    background: "var(--tab-active)",
    border: "1px solid var(--border)",
    borderRadius: "8px",
    padding: "4px",
    zIndex: "20",
    minWidth: "180px",
    boxShadow: "0 8px 24px rgb(0 0 0 / 18%)",
  });
  const items: [string, () => void][] = [
    ["Reload", () => window.desktop.reload()],
    ["Duplicate", () => window.desktop.duplicateTab(id)],
    ["Move to New Window", () => window.desktop.moveToNewWindow(id)],
    ["Open in Browser", () => window.desktop.openInBrowser(id)],
    ["Close", () => window.desktop.closeTab(id)],
  ];
  for (const [label, action] of items) {
    const item = document.createElement("button");
    item.textContent = label;
    Object.assign(item.style, {
      display: "block",
      width: "100%",
      textAlign: "left",
      border: "0",
      background: "transparent",
      color: "var(--text)",
      padding: "6px 8px",
      borderRadius: "6px",
      cursor: "pointer",
    });
    item.addEventListener("click", () => {
      menu.remove();
      action();
    });
    menu.append(item);
  }
  document.body.append(menu);
  const dismiss = () => {
    menu.remove();
    document.removeEventListener("click", dismiss);
  };
  setTimeout(() => document.addEventListener("click", dismiss), 0);
}
