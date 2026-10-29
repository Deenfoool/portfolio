/* Game tabs. Every new game needs a tab (data-game-tab) and a matching panel (data-game-panel). */
(() => {
  const tabs = Array.from(document.querySelectorAll('[role="tab"][data-game-tab]'));
  const panels = Array.from(document.querySelectorAll('[role="tabpanel"][data-game-panel]'));
  if (!tabs.length || !panels.length) return;

  function activate(tab, focus = false) {
    const activeId = tab.dataset.gameTab;
    tabs.forEach(item => {
      const selected = item === tab;
      item.setAttribute('aria-selected', String(selected));
      item.tabIndex = selected ? 0 : -1;
    });
    panels.forEach(panel => {
      panel.hidden = panel.dataset.gamePanel !== activeId;
    });
    if (focus) tab.focus();
  }

  tabs.forEach((tab, index) => {
    tab.addEventListener('click', () => activate(tab));
    tab.addEventListener('keydown', event => {
      let next;
      if (event.key === 'ArrowRight') next = (index + 1) % tabs.length;
      else if (event.key === 'ArrowLeft') next = (index - 1 + tabs.length) % tabs.length;
      else if (event.key === 'Home') next = 0;
      else if (event.key === 'End') next = tabs.length - 1;
      else return;
      event.preventDefault();
      activate(tabs[next], true);
    });
  });

  const hash = decodeURIComponent(window.location.hash.slice(1));
  const requestedPanel = panels.find(panel => panel.id === hash);
  const initialTab = requestedPanel
    ? tabs.find(tab => tab.dataset.gameTab === requestedPanel.dataset.gamePanel)
    : tabs.find(tab => tab.getAttribute('aria-selected') === 'true');
  activate(initialTab || tabs[0]);
  window.addEventListener('hashchange', () => {
    const matchingPanel = panels.find(panel => panel.id === window.location.hash.slice(1));
    const matchingTab = matchingPanel && tabs.find(tab => tab.dataset.gameTab === matchingPanel.dataset.gamePanel);
    if (matchingTab) activate(matchingTab);
  });
})();
