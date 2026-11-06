import {mkdirSync,readFileSync,writeFileSync,cpSync,rmSync} from 'node:fs';
import {fileURLToPath} from 'node:url';
import {resolve,join,dirname} from 'node:path';
const root=fileURLToPath(new URL('../',import.meta.url)),out=resolve(root,'dist');
if(dirname(out)!==resolve(root)||!out.endsWith('dist'))throw new Error('Invalid output directory');
// Only the fixed generated dist directory is replaced; no runtime data is read.
rmSync(out,{recursive:true,force:true});mkdirSync(out);
for(const name of ['styles.css','fonts'])cpSync(join(root,'public',name),join(out,name),{recursive:true});
const html=readFileSync(join(root,'public/index.html'),'utf8').replace('<script src="/app.js" defer>','<script type="module" src="/app.js">').replace('<title>고객지원팀 · Support Portal</title>','<title>고객지원 포털 · 과제 시연</title>');
writeFileSync(join(out,'index.html'),html);
writeFileSync(join(out,'app.js'),"import {createDemoApi} from './demo-api.mjs';\nglobalThis.SupportDemo=createDemoApi();\n"+readFileSync(join(root,'public/app.js'),'utf8'));
cpSync(join(root,'static-demo/model.mjs'),join(out,'demo-api.mjs'));
console.log('Static assignment demo built: dist/ (no server, secrets or database included)');
