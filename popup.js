const $ = (id) => document.getElementById(id);

async function tab() {
  const [t] = await chrome.tabs.query({ active: true, currentWindow: true });
  return t;
}

async function refresh() {
  const t = await tab();
  if (!t || !/^https:\/\/aktuexams\.in\//.test(t.url || '')) {
    $('status').textContent = 'Not on aktuexams.in — open the portal first.';
    return;
  }
  chrome.tabs.sendMessage(t.id, { type: 'status' }, (res) => {
    if (chrome.runtime.lastError || !res) {
      $('status').textContent = 'Page loaded before the extension. Reload the tab (Ctrl+R).';
      return;
    }
    $('status').textContent = res.viewer
      ? (res.open ? 'Panel is open. Ready to fetch.' : 'Answer script detected — open the panel.')
      : 'No answer script on screen yet. Open one from View Answer Script.';
  });
}

$('toggle').onclick = async () => {
  const t = await tab();
  chrome.tabs.sendMessage(t.id, { type: 'toggle' }, () => {
    if (chrome.runtime.lastError) $('status').textContent = 'Reload the AKTU tab, then try again.';
    else setTimeout(refresh, 150);
  });
};

$('open').onclick = () => {
  chrome.tabs.create({ url: 'https://aktuexams.in/AKTUSUMMER/LoginScreens/Default.aspx' });
};

refresh();
