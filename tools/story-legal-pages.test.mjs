import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync, readdirSync, existsSync} from 'node:fs';
import {fileURLToPath} from 'node:url';
import {resolve} from 'node:path';

const root = fileURLToPath(new URL('../', import.meta.url));
const legal = resolve(root, 'apps/magical-stories/legal');
const read = name => readFileSync(resolve(legal, name), 'utf8');
test('Robokassa documents are discoverable from the existing app page in both languages', () => {
  const app = readFileSync(resolve(root, 'apps/magical-stories/index.html'), 'utf8');
  for (const document of ['premium-terms','privacy','user-agreement','personal-data-consent','subscription-terms']) {
    assert.ok(app.includes(`/apps/magical-stories/legal/${document}-ru.html`));
    for (const suffix of ['', '-ru']) {
      const source = read(`${document}${suffix}.html`);
      assert.ok(source.includes(`${document}.html`) && source.includes(`${document}-ru.html`));
      assert.ok(source.includes('https://raccoon-app-labs.github.io/apps/magical-stories/'));
      assert.ok(!source.includes('enotessa.github.io'));
    }
  }
});
test('Local legal links and styles resolve in the actual published directory', () => {
  for (const name of readdirSync(legal).filter(value => value.endsWith('.html'))) {
    for (const [, href] of read(name).matchAll(/href="([^"]+)"/g)) {
      if (/^(?:https?:|mailto:|intent:|com\.|\/|#)/.test(href)) continue;
      assert.ok(existsSync(resolve(legal, href.split('#')[0])), `${name}: missing ${href}`);
    }
  }
});
test('Management documents reach the authenticated web cancellation flow', () => {
  for (const name of ['premium-manage.html', 'premium-manage-ru.html']) {
    assert.ok(read(name).includes('https://raccoon-app-labs.github.io/apps/magical-stories/checkout/?manage=1'));
  }
});
