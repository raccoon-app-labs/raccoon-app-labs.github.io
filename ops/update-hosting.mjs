import fs from 'node:fs';
import path from 'node:path';
const root=new URL('../',import.meta.url);
const note='<p class="legal-notice" data-no-l10n translate="no"><strong>Обновление размещения сайта · 16.11.2026.</strong> Основной сайт neonwallkicker.ru размещён на VPS VDSina в России. При подключении сервер получает технические данные, включая IP-адрес и параметры запроса. Прежняя копия на GitHub Pages временно сохраняется для совместимости; при её посещении применяются описанные ниже условия GitHub. Перенос сайта не меняет размещение баз аккаунтов и платёжные сервисы приложений.<br><span lang="en">Hosting update, 16 November 2026: the primary website neonwallkicker.ru is hosted on VDSina in Russia. The server receives connection metadata such as IP address and request details. The previous GitHub Pages copy remains temporarily for compatibility; the GitHub processing described below applies when visiting it. App account databases and payment processors are unchanged.</span></p>';
function visit(dir){for(const entry of fs.readdirSync(dir,{withFileTypes:true})){if(entry.name==='.git')continue;const file=path.join(dir,entry.name);if(entry.isDirectory())visit(file);else if(entry.name.endsWith('.html')&&/privacy/.test(file)&&!file.includes('archive-')){
 let html=fs.readFileSync(file,'utf8').replaceAll('\r\n','\n');if(html.includes('Обновление размещения сайта'))continue;
 html=html.replace(/<main\b[^>]*>/,main=>main+note);fs.writeFileSync(file,html);
}}}visit(new URL(root).pathname.replace(/^\/([A-Za-z]:)/,'$1'));
