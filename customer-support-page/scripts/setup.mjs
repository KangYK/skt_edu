import {createInterface} from 'node:readline/promises';
import {resolve} from 'node:path';
import {openDatabase,accessToken,audit,transaction} from '../server/db.mjs';
const db=openDatabase(resolve(process.env.DATA_DIR||'data/live'),'live');
try{
 const recovery=process.argv.includes('--recover');
 if(!recovery&&db.prepare("SELECT id FROM users WHERE role='admin'").get())throw new Error('관리자가 이미 있습니다. 로그인하거나 로컬 관리자 복구 시 --recover 옵션을 사용하세요.');
 const rl=createInterface({input:process.stdin,output:process.stdout});
 const email=(await rl.question('첫 관리자 이메일: ')).trim().toLowerCase();
 const name=recovery?'관리자':(await rl.question('관리자 표시 이름: ')).trim();rl.close();
 if(!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)||email.length>254||!name||name.length>80)throw new Error('이메일과 이름을 확인해 주세요.');
 const value=transaction(db,()=>{let id;if(recovery){const user=db.prepare("SELECT id FROM users WHERE email=? AND role='admin' AND active=1").get(email);if(!user)throw new Error('활성 관리자 이메일을 확인해 주세요.');id=user.id;}else{id=Number(db.prepare("INSERT INTO users(email,name,role) VALUES (?,?,'admin')").run(email,name).lastInsertRowid);}audit(db,id,recovery?'로컬 관리자 복구 링크 발급':'첫 관리자 생성');return accessToken(db,id);});
 const origin=process.env.APP_ORIGIN||'http://127.0.0.1:4310';
 console.log(`\n관리자 계정을 생성했습니다. 서버 실행 후 아래 일회용 링크에서 비밀번호를 설정하세요.\n${origin}/#activate=${value}\n\n링크는 1시간 후 만료됩니다. 본인만 사용하고 공유하지 마세요.`);
}finally{db.close();}
