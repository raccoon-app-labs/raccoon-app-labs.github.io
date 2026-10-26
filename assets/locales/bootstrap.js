/* Migrate the old RU/EN preference without changing any account or purchase region. */
(() => {
  const valid = ['en','ru','es','pt','fr','de','ar','hi','id','ja','ko','tr'];
  const base = value => String(value || '').toLowerCase().split(/[-_]/)[0];
  let legacy = null, saved = null;
  try { legacy = localStorage.getItem('ral-language'); saved = localStorage.getItem('hanzi-plus-language'); } catch {}
  window.HANZI_INITIAL_LOCALE = {legacy:valid.includes(legacy) ? legacy : null};
  const requested = base(new URLSearchParams(location.search).get('lang'));
  const choice = [requested,saved,legacy,...(navigator.languages || [navigator.language]).map(base)].find(value => valid.includes(value)) || 'en';
  // Legacy demos still initialize their English/Russian source text. The common
  // observer translates it afterwards, preserving the live demo's state.
  try { localStorage.setItem('ral-language',choice === 'ru' ? 'ru' : 'en'); } catch {}
})();
