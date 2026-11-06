import test from 'node:test';
import assert from 'node:assert/strict';
import {mkdtempSync,rmSync} from 'node:fs';
import {tmpdir} from 'node:os';
import {join} from 'node:path';
import {backup} from 'node:sqlite';
import {createPortal} from '../server/index.mjs';
import {passwordHash,openDatabase} from '../server/db.mjs';

test('실제 서비스: 인증, 고객사 격리, 저장, 상태, 첨부, 초대·재설정, 백업',async t=>{
 const folder=mkdtempSync(join(tmpdir(),'support-test-'));const origin='http://test.local';let portal=createPortal({directory:folder,origin});let base;
 async function start(){await new Promise(resolve=>portal.server.listen(0,'127.0.0.1',resolve));base=`http://127.0.0.1:${portal.server.address().port}`;}
 await start();
 const hash=await passwordHash('Test-only-password!2026');
 portal.db.exec("INSERT INTO customers VALUES(1,'A'),(2,'B'); INSERT INTO products VALUES(1,1,'A product','A contract'),(2,2,'B product','B contract');");
 for(const [id,role,company] of [[1,'customer',1],[2,'customer',1],[3,'manager',1],[4,'customer',2],[5,'staff',null],[6,'admin',null]])portal.db.prepare('INSERT INTO users(id,email,name,role,customer_id,password_hash) VALUES (?,?,?,?,?,?)').run(id,`u${id}@example.com`,`User ${id}`,role,company,hash);
 portal.db.exec('INSERT INTO assignments VALUES(5,1);');
 const clients={};
 async function request(client,path,method='GET',body,headers={}){const response=await fetch(base+'/api'+path,{method,headers:{Origin:origin,...(method==='GET'?{}:{'Content-Type':'application/json','X-CSRF-Token':client?.csrf||''}),...(client?.cookie?{Cookie:client.cookie}:{}),...headers},body:body===undefined?undefined:JSON.stringify(body)});const data=(response.headers.get('content-type')||'').includes('application/json')?await response.json():Buffer.from(await response.arrayBuffer());return {status:response.status,data,response};}
 async function login(id){const result=await request(null,'/login','POST',{email:`u${id}@example.com`,password:'Test-only-password!2026'});assert.equal(result.status,200);return clients[id]={csrf:result.data.csrf,cookie:result.response.headers.get('set-cookie').split(';')[0]};}
 let ticketA,ticketPeer,ticketB,attachment;
 try{
 await t.test('로그인 실패·CSRF·운영 시연 로그인 차단',async()=>{
  assert.equal((await request(null,'/tickets')).status,401);
  assert.equal((await request(null,'/login','POST',{email:'u1@example.com',password:'wrong'})).status,401);
  assert.equal((await request(null,'/demo-login','POST',{userId:6})).status,404);
  for(let id=1;id<=6;id++)await login(id);
  assert.equal((await request(clients[1],'/logout','POST',{}, {'X-CSRF-Token':'bad'})).status,403);
  assert.equal((await request(clients[1],'/logout','POST',{}, {Origin:'https://evil.example'})).status,403);
 });
 const create=(client,product_id,key)=>request(client,'/tickets','POST',{product_id,title:'검증 문의 <script>alert(1)</script>',body:'재현 절차와 내용',kind:'오류',priority:'보통',request_key:key,customer_id:999,author_id:999});
 await t.test('문의 생성·중복 방지·제품 고객사 검증',async()=>{
  const a=await create(clients[1],1,'a');assert.equal(a.status,201);ticketA=a.data.id;
  ticketPeer=(await create(clients[2],1,'peer')).data.id;ticketB=(await create(clients[4],2,'b')).data.id;
  assert.equal((await create(clients[1],1,'a')).data.id,ticketA);
  assert.equal((await create(clients[1],2,'other')).status,404);
  assert.equal(portal.db.prepare('SELECT author_id,customer_id FROM tickets WHERE id=?').get(ticketA).author_id,1);
 });
 await t.test('고객 본인·고객사 담당자·배정 담당자·관리자 조회 경계',async()=>{
  assert.equal((await request(clients[1],'/tickets')).data.tickets.length,1);
  assert.equal((await request(clients[3],'/tickets')).data.tickets.length,2);
  assert.equal((await request(clients[5],'/tickets')).data.tickets.length,2);
  assert.equal((await request(clients[6],'/tickets')).data.tickets.length,3);
  assert.equal((await request(clients[1],`/tickets/${ticketPeer}`)).status,404);
  assert.equal((await request(clients[3],`/tickets/${ticketB}`)).status,404);
  assert.equal((await request(clients[5],`/tickets/${ticketB}`)).status,404);
  assert.equal((await request(clients[4],'/catalog')).data.products[0].id,2);
 });
 await t.test('내부 메모·댓글·관리 API 권한',async()=>{
  assert.equal((await request(clients[1],`/tickets/${ticketA}/comments`,'POST',{body:'메모',internal:true})).status,403);
  assert.equal((await request(clients[5],`/tickets/${ticketA}/comments`,'POST',{body:'내부 정보',internal:true})).status,201);
  assert.equal((await request(clients[1],`/tickets/${ticketA}/comments`,'POST',{body:'추가 설명',internal:false})).status,201);
  assert.equal((await request(clients[1],`/tickets/${ticketA}`)).data.comments.length,1);
  assert.equal((await request(clients[5],`/tickets/${ticketA}`)).data.comments.length,2);
  assert(!(await request(clients[1],`/tickets/${ticketA}`)).data.events.some(e=>e.internal));
  assert.equal((await request(clients[4],`/tickets/${ticketA}/comments`,'POST',{body:'공격',internal:false})).status,404);
  assert.equal((await request(clients[1],'/admin/data')).status,403);
 });
 await t.test('상태 전환·동시 변경 충돌·담당자 범위',async()=>{
  const payload={version:1,status:'확인 중',priority:'높음',assignee_id:5};
  assert.equal((await request(clients[1],`/tickets/${ticketA}`,'PATCH',payload)).status,403);
  assert.equal((await request(clients[5],`/tickets/${ticketA}`,'PATCH',{...payload,status:'완료'})).status,400);
  assert.equal((await request(clients[5],`/tickets/${ticketA}`,'PATCH',payload)).status,200);
  assert.equal((await request(clients[5],`/tickets/${ticketA}`,'PATCH',payload)).status,409);
  assert.equal((await request(clients[6],`/tickets/${ticketB}`,'PATCH',payload)).status,400);
  let version=2;for(const status of ['처리 중','고객 확인 대기','완료']){assert.equal((await request(clients[5],`/tickets/${ticketA}`,'PATCH',{...payload,version:version++,status})).status,200);}
  assert.equal((await request(clients[1],`/tickets/${ticketA}/reopen`,'POST',{body:'다시 확인해주세요'})).status,201);
 });
 await t.test('첨부 형식·개수·소유 범위 및 직접 다운로드',async()=>{
  const upload={filename:'example.txt',base64:Buffer.from('safe example').toString('base64')};
  assert.equal((await request(clients[1],`/tickets/${ticketA}/attachments`,'POST',upload)).status,201);
  assert.equal((await request(clients[1],`/tickets/${ticketA}/attachments`,'POST',{...upload,filename:'attack.html'})).status,400);
  assert.equal((await request(clients[1],`/tickets/${ticketA}/attachments`,'POST',{...upload,filename:'fake.png'})).status,400);
  attachment=(await request(clients[1],`/tickets/${ticketA}`)).data.attachments[0].id;
  assert.equal((await request(clients[1],`/attachments/${attachment}`)).data.toString(),'safe example');
  assert.equal((await request(clients[4],`/attachments/${attachment}`)).status,404);
  assert.equal((await request(clients[2],`/attachments/${attachment}`)).status,404);
  for(let i=0;i<4;i++)assert.equal((await request(clients[1],`/tickets/${ticketA}/attachments`,'POST',upload)).status,201);
  assert.equal((await request(clients[1],`/tickets/${ticketA}/attachments`,'POST',upload)).status,400);
 });
 await t.test('가이드·공지 고객사 격리',async()=>{
  assert.equal((await request(clients[6],'/admin/articles','POST',{kind:'guide',customer_id:2,product_id:2,title:'B only',body:'B private'})).status,201);
  assert(!(await request(clients[1],'/catalog')).data.articles.some(a=>a.title==='B only'));
  assert((await request(clients[4],'/catalog')).data.articles.some(a=>a.title==='B only'));
  assert.equal((await request(clients[6],'/admin/articles','POST',{kind:'guide',customer_id:1,product_id:2,title:'bad',body:'bad'})).status,400);
 });
 await t.test('초대 토큰 1회 사용·재설정 세션 폐기·비활성 차단',async()=>{
  const invitation=await request(clients[6],'/admin/users','POST',{name:'새 고객',email:'new@example.com',role:'customer',customer_id:1});assert.equal(invitation.status,201);
  const activation=await request(null,'/activate','POST',{token:invitation.data.token,password:'New-test-password!2026'});assert.equal(activation.status,200);
  assert.equal((await request(null,'/activate','POST',{token:invitation.data.token,password:'New-test-password!2026'})).status,400);
  const c={cookie:activation.response.headers.get('set-cookie').split(';')[0],csrf:activation.data.csrf};
  const reset=await request(clients[6],`/admin/users/${invitation.data.id}/reset`,'POST',{});
  assert.equal((await request(null,'/activate','POST',{token:reset.data.token,password:'Reset-password!2026'})).status,200);
  assert.equal((await request(c,'/me')).status,401);
  assert.equal((await request(clients[6],`/admin/users/${invitation.data.id}/active`,'POST',{active:false})).status,200);
  assert.equal((await request(null,'/login','POST',{email:'new@example.com',password:'Reset-password!2026'})).status,401);
 });
 await t.test('계정 권한 변경·세션 만료·고객사 이동 제한',async()=>{
  assert.equal((await request(clients[6],'/admin/users/6/permissions','PATCH',{role:'customer',customer_id:1})).status,400);
  assert.equal((await request(clients[6],'/admin/users/2/permissions','PATCH',{role:'manager',customer_id:2})).status,400);
  assert.equal((await request(clients[6],'/admin/users/2/permissions','PATCH',{role:'manager',customer_id:1})).status,200);
  assert.equal((await request(clients[2],'/me')).status,401);
  await login(2);assert.equal((await request(clients[2],'/tickets')).data.tickets.length,2);
 });
 await t.test('담당 범위 해제 즉시 접근 차단',async()=>{
  assert.equal((await request(clients[6],'/admin/assignments','POST',{user_id:5,customer_ids:[]})).status,200);
  assert.equal((await request(clients[5],`/tickets/${ticketA}`)).status,404);
  assert.equal((await request(clients[5],`/attachments/${attachment}`)).status,404);
 });
 await t.test('재시작·재로그인 영구 저장, 첨부 포함 백업 복원',async()=>{
  await portal.close();portal=createPortal({directory:folder,origin});await start();await login(1);
  assert.equal((await request(clients[1],`/tickets/${ticketA}`)).data.ticket.status,'완료');
  assert.equal((await request(clients[1],`/attachments/${attachment}`)).data.toString(),'safe example');
  const restoreDir=join(folder,'restore');const restored=openDatabase(restoreDir,'live');restored.close();
  await backup(portal.db,join(restoreDir,'portal.sqlite'));
  const copy=openDatabase(restoreDir,'live');assert.equal(copy.prepare('SELECT count(*) n FROM tickets').get().n,3);assert.equal(Buffer.from(copy.prepare('SELECT content FROM attachments WHERE id=?').get(attachment).content).toString(),'safe example');copy.close();
 });
 await t.test('시연 DB를 실제 서비스로 재사용 금지',()=>{assert.throws(()=>openDatabase(folder,'demo'),/같은 데이터베이스/);});
 }finally{await portal.close();rmSync(folder,{recursive:true,force:true});}
});

test('시연 역할 전환은 별도 DB에서만 동작',async()=>{
 const folder=mkdtempSync(join(tmpdir(),'support-demo-'));const app=createPortal({directory:folder,mode:'demo',origin:'http://demo.local'});
 await new Promise(resolve=>app.server.listen(0,'127.0.0.1',resolve));
 try{const base=`http://127.0.0.1:${app.server.address().port}`;const config=await(await fetch(base+'/api/config')).json();assert.equal(config.mode,'demo');assert.equal(config.demoUsers.length,6);const login=await fetch(base+'/api/demo-login',{method:'POST',headers:{Origin:'http://demo.local','Content-Type':'application/json'},body:JSON.stringify({userId:1})});assert.equal(login.status,200);assert(login.headers.get('set-cookie').startsWith('support_demo='));}finally{await app.close();rmSync(folder,{recursive:true,force:true});}
});
