import { build } from 'esbuild';
import { readFile, writeFile } from 'node:fs/promises';

const result = await build({
  entryPoints: ['apps/frontend/src/components/remarks-virtual-list.tsx'],
  bundle: true, write: false, minify: true, format: 'iife', target: 'es2022',
  define: { 'process.env.NODE_ENV': '"production"' }, legalComments: 'inline',
});
const path = 'apps/backend/private/dashboard-source.html';
let source = await readFile(path, 'utf8');
const pattern = /(<script type="application\/json" id="data-amos">)([\s\S]*?)(<\/script>)/;
const match = source.match(pattern);
let html = JSON.parse(match[2]);
const bundle = '<script id="remarks-react-window">' + result.outputFiles[0].text.replace(/<\/script/gi, '<\\/script') + '</script>';
const existing = /<script id="remarks-react-window">[\s\S]*?<\/script>/;
if (existing.test(html)) html = html.replace(existing, () => bundle);
else { const index = html.lastIndexOf('</head>'); html = html.slice(0, index) + bundle + html.slice(index); }
source = source.replace(pattern, () => match[1] + JSON.stringify(html).replace(/<\/script/gi, '<\\/script') + match[3]);
await writeFile(path, source);
console.log('Embedded react-window Remarks list updated.');
