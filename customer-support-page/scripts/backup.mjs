import {backup} from 'node:sqlite';
import {mkdirSync,existsSync} from 'node:fs';
import {resolve,join} from 'node:path';
import {openDatabase} from '../server/db.mjs';
const directory=resolve(process.env.DATA_DIR||'data/live');
if(!existsSync(join(directory,'portal.sqlite')))throw new Error('먼저 실제 저장 서비스를 실행해 데이터베이스를 만드세요.');
const db=openDatabase(directory,'live');
try{mkdirSync('backups',{recursive:true});const file=resolve('backups',`portal-${new Date().toISOString().replace(/[:.]/g,'-')}.sqlite`);await backup(db,file);console.log('백업 완료: '+file);}finally{db.close();}
