/* Published GitHub releases shared by the catalog, Featured and project dialog.
   Cached discoveries limit anonymous API traffic; destinations always use /releases/latest. */
(() => {
  const USER = 'Deenfoool';
  const KEY = 'deenfoool-releases-v1';
  const POSITIVE_TTL = 12 * 60 * 60 * 1000;
  const NEGATIVE_TTL = 30 * 60 * 1000;
  const listeners = new Set();
  const queue = [];
  const pending = new Map();
  let active = 0;
  let throttled = false;
  let cache = {};
  try {
    const stored = JSON.parse(localStorage.getItem(KEY) || '{}');
    if (stored && typeof stored === 'object' && !Array.isArray(stored)) cache = stored;
  } catch {}

  const nameOf = value => String(typeof value === 'string' ? value : value?.name || '').toLowerCase().trim();
  function status(value) {
    const result = cache[nameOf(value)];
    if (!result || typeof result.available !== 'boolean' || !Number.isFinite(result.time)) return null;
    const ttl = result.available ? POSITIVE_TTL : NEGATIVE_TTL;
    return Date.now() - result.time < ttl ? result.available : null;
  }
  function has(value) { return status(value) === true; }
  function url(repo) {
    const base = repo.html_url || ('https://github.com/' + USER + '/' + encodeURIComponent(repo.name));
    return base.replace(/\/$/, '') + '/releases/latest';
  }
  function record(name, available) {
    const old = status(name);
    cache[name] = { available: available, time: Date.now() };
    try { localStorage.setItem(KEY, JSON.stringify(cache)); } catch {}
    if (old !== available) listeners.forEach(listener => {
      try { listener(name, available); } catch (err) { console.error('Release UI update failed', err); }
    });
  }
  function flushPending() {
    while (queue.length) {
      const item = queue.shift();
      pending.delete(item.name);
      item.resolve(null);
    }
  }
  function pump() {
    if (throttled) { flushPending(); return; }
    while (active < 3 && queue.length) {
      const item = queue.shift();
      active++;
      (async () => {
        let availability = null;
        try {
          const response = await fetch(
            'https://api.github.com/repos/' + encodeURIComponent(USER) + '/' + encodeURIComponent(item.repo.name) + '/releases/latest',
            { headers: { Accept: 'application/vnd.github+json' }, cache: 'no-store' }
          );
          if (response.ok) {
            availability = true;
            record(item.name, true);
          } else if (response.status === 404) {
            availability = false;
            record(item.name, false);
          } else if (response.status === 403 || response.status === 429) {
            // Quota exhaustion is not evidence that the repository has no release.
            throttled = true;
          }
          if (response.headers.get('x-ratelimit-remaining') === '0') throttled = true;
        } catch {
          // Leave previous information untouched if offline.
        } finally {
          pending.delete(item.name);
          item.resolve(availability);
          active--;
          pump();
        }
      })();
    }
  }
  function check(repo) {
    const name = nameOf(repo);
    if (!name || !repo?.name) return Promise.resolve(null);
    const cached = status(name);
    if (cached !== null) return Promise.resolve(cached);
    if (throttled) return Promise.resolve(null);
    if (pending.has(name)) return pending.get(name);
    const promise = new Promise(resolve => queue.push({ repo, name, resolve }));
    pending.set(name, promise);
    pump();
    return promise;
  }
  function scan(items) {
    const repos = (Array.isArray(items) ? items : []).filter(repo => repo?.name && !repo.fork && !repo.archived);
    const isFeatured = repo => Array.isArray(repo.topics) && repo.topics.some(t => String(t).toLowerCase() === 'featured');
    repos.sort((a,b) => Number(isFeatured(b)) - Number(isFeatured(a)));
    repos.forEach(repo => { void check(repo); });
  }
  function onChange(callback) {
    listeners.add(callback);
    return () => listeners.delete(callback);
  }
  window.PortfolioReleases = { has, check, scan, onChange, url };
})();
