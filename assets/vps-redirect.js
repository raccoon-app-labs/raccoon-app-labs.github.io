/* Old app links remain usable when the primary site cannot be reached. */
(() => {
  if (location.hostname !== 'raccoon-app-labs.github.io') return;
  let interacted = false;
  addEventListener('pointerdown', () => { interacted = true; }, {once:true,capture:true});
  addEventListener('keydown', () => { interacted = true; }, {once:true,capture:true});
  fetch('https://neonwallkicker.ru/site-migration-ready.json', {
    credentials:'omit',cache:'no-store',redirect:'error',referrerPolicy:'no-referrer',signal:AbortSignal.timeout(3000)
  }).then(response => response.ok ? response.json() : null).then(state => {
    if (!state?.ready || state.origin !== 'https://neonwallkicker.ru' || interacted) return;
    const target = new URL(location.href); target.protocol = 'https:'; target.host = 'neonwallkicker.ru';
    location.replace(target.href);
  }).catch(() => {});
})();
