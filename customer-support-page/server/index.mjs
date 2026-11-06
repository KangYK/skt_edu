import {createServer} from 'node:http';
import {readFileSync} from 'node:fs';
import {resolve,join} from 'node:path';
import {fileURLToPath} from 'node:url';
import {openDatabase,seedDemo,transaction,now,token,digest,passwordHash,verifyPassword,accessToken,audit} from './db.mjs';

const root=fileURLToPath(new URL('../',import.meta.url));
const statuses=['접수','확인 중','처리 중','정보 요청','범위 검토','고객 확인 대기','완료'];
const transitions={'접수':['확인 중','정보 요청','범위 검토'],'확인 중':['처리 중','정보 요청','범위 검토'],'처리 중':['정보 요청','범위 검토','고객 확인 대기'],'정보 요청':['확인 중','처리 중'],'범위 검토':['확인 중','처리 중','고객 확인 대기'],'고객 확인 대기':['완료','처리 중'],'완료':['확인 중']};
const roles=['customer','manager','staff','admin'];
class HttpError extends Error{constructor(status,message){super(message);this.status=status;}}
function requireThat(condition,status,message){if(!condition)throw new HttpError(status,message);}
function text(value,max=2000,optional=false){requireThat(typeof value==='string'&&value.length<=max&&(optional||value.trim()),400,'입력 내용과 길이를 확인해 주세요.');return value.trim();}
function integer(value){const id=Number(value);requireThat(Number.isSafeInteger(id)&&id>0,400,'올바른 번호가 필요합니다.');return id;}
function oneOf(value,values){requireThat(values.includes(value),400,'선택 값이 올바르지 않습니다.');return value;}
function email(value){const s=text(value,254).toLowerCase();requireThat(/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(s),400,'이메일 형식을 확인해 주세요.');return s;}
function validatePassword(value){requireThat(typeof value==='string'&&value.length>=12&&value.length<=128,400,'비밀번호는 12~128자로 입력해 주세요.');return value;}
const publicUser=u=>({id:u.id,name:u.name,email:u.email,role:u.role,customer_id:u.customer_id});

export function createPortal({directory=join(root,'data/live'),mode='live',origin='http://127.0.0.1:4310',secure=false}={}){
 const db=openDatabase(directory,mode);if(mode==='demo')seedDemo(db);
 const cookieName=mode==='demo'?'support_demo':'support_live';
 const run=(sql,...args)=>db.prepare(sql).run(...args),get=(sql,...args)=>db.prepare(sql).get(...args),all=(sql,...args)=>db.prepare(sql).all(...args);
 const staff=u=>u.role==='staff'||u.role==='admin';
 const customerAccess=(u,id)=>u.role==='admin'||(u.role==='staff'?!!get('SELECT 1 FROM assignments WHERE user_id=? AND customer_id=?',u.id,id):u.customer_id===id);
 function ticketAccess(u,id){const t=get('SELECT * FROM tickets WHERE id=?',integer(id));requireThat(t&&customerAccess(u,t.customer_id)&&(u.role!=='customer'||t.author_id===u.id),404,'문의를 찾을 수 없습니다.');return t;}
 function productAccess(u,id){const p=get('SELECT * FROM products WHERE id=?',integer(id));requireThat(p&&customerAccess(u,p.customer_id),404,'제품을 찾을 수 없습니다.');return p;}
 function admin(u){requireThat(u.role==='admin',403,'관리자 권한이 필요합니다.');}
 function event(t,u,body,internal=0){run('INSERT INTO events(ticket_id,actor_id,body,internal,created_at) VALUES (?,?,?,?,?)',t.id,u.id,body,internal,now());}
 function session(req){const raw=(req.headers.cookie||'').split(';').map(s=>s.trim()).find(s=>s.startsWith(cookieName+'='))?.slice(cookieName.length+1);if(!raw)return null;const row=get('SELECT s.csrf,s.token_hash,u.* FROM sessions s JOIN users u ON u.id=s.user_id WHERE s.token_hash=? AND s.expires>? AND u.active=1',digest(raw),Date.now());return row||null;}
 function establish(res,u){const value=token(),csrf=token();run('DELETE FROM sessions WHERE expires<?',Date.now());run('INSERT INTO sessions VALUES (?,?,?,?)',digest(value),u.id,csrf,Date.now()+8*3600000);res.setHeader('Set-Cookie',`${cookieName}=${value}; HttpOnly; SameSite=Strict; Path=/; Max-Age=28800${secure?'; Secure':''}`);return {user:publicUser(u),csrf};}
 function expire(res){res.setHeader('Set-Cookie',`${cookieName}=; HttpOnly; SameSite=Strict; Path=/; Max-Age=0${secure?'; Secure':''}`);}
 function throttle(key,max=10){const time=Date.now();run('DELETE FROM login_limits WHERE expires<?',time);const item=get('SELECT * FROM login_limits WHERE key=?',key);requireThat(!item||item.count<max,429,'시도가 너무 많습니다. 15분 후 다시 시도해 주세요.');run('INSERT INTO login_limits VALUES (?,1,?) ON CONFLICT(key) DO UPDATE SET count=count+1',key,time+900000);}
 function listTickets(u){return all(`SELECT t.*,p.name product_name,c.name customer_name,a.name author_name,s.name assignee_name FROM tickets t JOIN products p ON p.id=t.product_id JOIN customers c ON c.id=t.customer_id JOIN users a ON a.id=t.author_id LEFT JOIN users s ON s.id=t.assignee_id ORDER BY t.updated_at DESC,t.id DESC`).filter(t=>customerAccess(u,t.customer_id)&&(u.role!=='customer'||t.author_id===u.id));}
 function mutationVersion(t,b){requireThat(t.version===b.version,409,'다른 담당자가 먼저 변경했습니다. 새로고침한 뒤 다시 시도해 주세요.');}
 async function body(req){let size=0,chunks=[];for await(const chunk of req){size+=chunk.length;requireThat(size<=3*1024*1024,413,'요청이 너무 큽니다. 첨부는 2MB 이하로 줄여 주세요.');chunks.push(chunk);}try{const obj=JSON.parse(Buffer.concat(chunks).toString()||'{}');requireThat(obj&&typeof obj==='object'&&!Array.isArray(obj),400,'입력 형식이 올바르지 않습니다.');return obj;}catch(e){if(e.status)throw e;throw new HttpError(400,'JSON 형식이 올바르지 않습니다.');}}
 function send(res,status,data){res.writeHead(status,{'Content-Type':'application/json; charset=utf-8'});res.end(JSON.stringify(data));}
 async function handler(req,res){
  res.setHeader('X-Content-Type-Options','nosniff');res.setHeader('Referrer-Policy','no-referrer');res.setHeader('X-Frame-Options','DENY');res.setHeader('Cache-Control','no-store');
  res.setHeader('Content-Security-Policy',"default-src 'self'; script-src 'self'; style-src 'self'; img-src 'self' data:; font-src 'self'; connect-src 'self'; object-src 'none'; base-uri 'none'; frame-ancestors 'none'; form-action 'self'");
  try{
   const path=new URL(req.url,'http://local').pathname,method=req.method;
   if(!path.startsWith('/api/')){
    requireThat(method==='GET'||method==='HEAD',405,'허용되지 않은 요청입니다.');
    const files={'/':['index.html','text/html; charset=utf-8'],'/app.js':['app.js','text/javascript; charset=utf-8'],'/styles.css':['styles.css','text/css; charset=utf-8'],'/fonts/PretendardVariable.woff2':['fonts/PretendardVariable.woff2','font/woff2']};
    const file=files[path];requireThat(file,404,'페이지를 찾을 수 없습니다.');res.setHeader('Content-Type',file[1]);res.end(method==='HEAD'?undefined:readFileSync(join(root,'public',file[0])));return;
   }
   if(method==='GET'&&path==='/api/config')return send(res,200,{mode,companyLogin:false,setupRequired:!get('SELECT id FROM users LIMIT 1'),statuses,transitions,demoUsers:mode==='demo'?all('SELECT id,name,role FROM users WHERE active=1'):[]});
   const modifying=!['GET','HEAD'].includes(method);
   if(modifying){requireThat(req.headers.origin===origin,403,'다른 출처의 요청은 허용하지 않습니다.');requireThat((req.headers['content-type']||'').startsWith('application/json'),415,'JSON 요청이 필요합니다.');}
   if(method==='POST'&&path==='/api/login'){
    throttle('ip:'+req.socket.remoteAddress,60);const b=await body(req);const address=email(b.email);throttle('email:'+address);
    requireThat(typeof b.password==='string'&&b.password.length<=128,400,'로그인 정보를 확인해 주세요.');const u=get('SELECT * FROM users WHERE email=?',address);const valid=await verifyPassword(b.password,u?.password_hash);
    requireThat(valid&&u?.active&&u.password_hash,401,'이메일 또는 비밀번호를 확인해 주세요.');run('DELETE FROM login_limits WHERE key=?','email:'+address);audit(db,u.id,'이메일 로그인');return send(res,200,establish(res,u));
   }
   if(method==='POST'&&path==='/api/demo-login'){
    requireThat(mode==='demo',404,'지원하지 않는 경로입니다.');const b=await body(req);const u=get('SELECT * FROM users WHERE id=? AND active=1',integer(b.userId));requireThat(u,400,'계정을 선택해 주세요.');const previous=session(req);if(previous)run('DELETE FROM sessions WHERE token_hash=?',previous.token_hash);return send(res,200,establish(res,u));
   }
   if(method==='POST'&&path==='/api/activate'){
    throttle('activate:'+req.socket.remoteAddress,30);const b=await body(req);const raw=text(b.token,100);const hash=await passwordHash(validatePassword(b.password));
    const result=transaction(db,()=>{const entry=get('SELECT * FROM access_tokens WHERE token_hash=? AND expires>?',digest(raw),Date.now());requireThat(entry,400,'초대/재설정 링크가 만료되었거나 이미 사용되었습니다.');const u=get('SELECT * FROM users WHERE id=? AND active=1',entry.user_id);requireThat(u,400,'사용할 수 없는 계정입니다.');run('UPDATE users SET password_hash=? WHERE id=?',hash,u.id);run('DELETE FROM access_tokens WHERE user_id=?',u.id);run('DELETE FROM sessions WHERE user_id=?',u.id);audit(db,u.id,'비밀번호 설정');return u;});return send(res,200,establish(res,result));
   }
   const u=session(req);requireThat(u,401,'로그인이 필요합니다.');
   if(modifying)requireThat(req.headers['x-csrf-token']===u.csrf,403,'세션 확인에 실패했습니다. 다시 로그인해 주세요.');
   if(method==='GET'&&path==='/api/me')return send(res,200,{user:publicUser(u),csrf:u.csrf});
   if(method==='POST'&&path==='/api/logout'){run('DELETE FROM sessions WHERE token_hash=?',u.token_hash);expire(res);return send(res,200,{ok:true});}
   if(method==='GET'&&path==='/api/catalog'){
    const products=all('SELECT p.*,c.name customer_name FROM products p JOIN customers c ON c.id=p.customer_id').filter(p=>customerAccess(u,p.customer_id));
    const articles=all('SELECT * FROM articles ORDER BY id DESC').filter(a=>a.customer_id===null||customerAccess(u,a.customer_id));
    const customers=all('SELECT * FROM customers').filter(c=>customerAccess(u,c.id));
    const agents=staff(u)?all("SELECT id,name,role FROM users WHERE active=1 AND role IN ('staff','admin')").map(a=>({...a,customers:all('SELECT customer_id FROM assignments WHERE user_id=?',a.id).map(c=>c.customer_id)})):[];
    return send(res,200,{products,articles,customers,agents});
   }
   if(method==='GET'&&path==='/api/tickets'){const tickets=listTickets(u).map(({body,request_key,...t})=>t);return send(res,200,{tickets});}
   if(method==='POST'&&path==='/api/tickets'){
    const b=await body(req),p=productAccess(u,b.product_id),title=text(b.title,160),content=text(b.body,10000),kind=oneOf(b.kind,['오류','사용 문의','개선 요청']),priority=oneOf(b.priority,['낮음','보통','높음','긴급']),key=text(b.request_key,100);
    const existing=get('SELECT id FROM tickets WHERE author_id=? AND request_key=?',u.id,key);if(existing)return send(res,200,{id:existing.id});
    const id=transaction(db,()=>{const timestamp=now();const result=run('INSERT INTO tickets(customer_id,product_id,author_id,title,body,kind,priority,request_key,created_at,updated_at) VALUES (?,?,?,?,?,?,?,?,?,?)',p.customer_id,p.id,u.id,title,content,kind,priority,key,timestamp,timestamp);const id=Number(result.lastInsertRowid);event({id},u,'문의 접수');return id;});return send(res,201,{id});
   }
   let match=path.match(/^\/api\/tickets\/(\d+)(?:\/(comments|attachments|reopen))?$/);
   if(match){const t=ticketAccess(u,match[1]),sub=match[2];
    if(method==='GET'&&!sub){const detail=listTickets(u).find(row=>row.id===t.id);const comments=all('SELECT c.*,u.name author_name FROM comments c JOIN users u ON u.id=c.author_id WHERE ticket_id=? ORDER BY c.id',t.id).filter(c=>staff(u)||!c.internal);const events=all('SELECT e.*,u.name actor_name FROM events e JOIN users u ON u.id=e.actor_id WHERE ticket_id=? ORDER BY e.id DESC',t.id).filter(e=>staff(u)||!e.internal);const attachments=all('SELECT id,filename,length(content) size,created_at FROM attachments WHERE ticket_id=?',t.id);delete detail.request_key;return send(res,200,{ticket:detail,comments,events,attachments});}
    if(method==='PATCH'&&!sub){requireThat(staff(u),403,'담당자만 문의 상태를 변경할 수 있습니다.');const b=await body(req);mutationVersion(t,b);const status=oneOf(b.status,statuses);requireThat(status===t.status||transitions[t.status].includes(status),400,'허용되지 않은 상태 변경입니다.');const assignee=b.assignee_id===null?null:integer(b.assignee_id);if(assignee){const a=get('SELECT * FROM users WHERE id=? AND active=1',assignee);requireThat(a&&staff(a)&&customerAccess(a,t.customer_id),400,'이 고객사를 담당할 수 있는 사용자만 배정할 수 있습니다.');}
     transaction(db,()=>{run('UPDATE tickets SET status=?,assignee_id=?,priority=?,version=version+1,updated_at=? WHERE id=?',status,assignee,oneOf(b.priority,['낮음','보통','높음','긴급']),now(),t.id);event(t,u,`상태: ${t.status} → ${status} · 우선순위: ${b.priority}`);if(t.assignee_id!==assignee)event(t,u,`담당자 배정: ${assignee?get('SELECT name FROM users WHERE id=?',assignee).name:'미배정'}`);});return send(res,200,{ok:true});
    }
    if(method==='POST'&&sub==='comments'){const b=await body(req),content=text(b.body,10000);requireThat(typeof b.internal==='boolean',400,'댓글 공개 범위를 확인해 주세요.');requireThat(!b.internal||staff(u),403,'내부 메모 작성 권한이 없습니다.');transaction(db,()=>{run('INSERT INTO comments(ticket_id,author_id,body,internal,created_at) VALUES (?,?,?,?,?)',t.id,u.id,content,b.internal?1:0,now());event(t,u,b.internal?'내부 메모 추가':'공개 답변 추가',b.internal?1:0);if(!b.internal)run('UPDATE tickets SET updated_at=? WHERE id=?',now(),t.id);});return send(res,201,{ok:true});}
    if(method==='POST'&&sub==='reopen'){requireThat(t.status==='완료',400,'완료된 문의에 재개 요청을 남길 수 있습니다.');const b=await body(req);run('INSERT INTO comments(ticket_id,author_id,body,internal,created_at) VALUES (?,?,?,0,?)',t.id,u.id,'[재개 요청] '+text(b.body,2000),now());event(t,u,'재개 요청');run('UPDATE tickets SET updated_at=? WHERE id=?',now(),t.id);return send(res,201,{ok:true});}
    if(method==='POST'&&sub==='attachments'){
     const b=await body(req),filename=text(b.filename,150);requireThat(!/[\x00-\x1f\\/]/.test(filename),400,'파일 이름을 확인해 주세요.');requireThat(typeof b.base64==='string'&&/^[A-Za-z0-9+/]*={0,2}$/.test(b.base64),400,'파일 형식이 올바르지 않습니다.');const bytes=Buffer.from(b.base64,'base64');requireThat(bytes.length>0&&bytes.length<=2*1024*1024,400,'첨부 파일은 2MB 이하로 선택해 주세요.');let mime='';
     if(/\.png$/i.test(filename)&&bytes.subarray(0,8).equals(Buffer.from([137,80,78,71,13,10,26,10])))mime='image/png';
     if(/\.jpe?g$/i.test(filename)&&bytes[0]===255&&bytes[1]===216&&bytes[2]===255)mime='image/jpeg';
     if(/\.txt$/i.test(filename)){try{new TextDecoder('utf-8',{fatal:true}).decode(bytes);if(!bytes.includes(0))mime='text/plain';}catch{}}
     requireThat(mime,400,'PNG, JPG 또는 UTF-8 TXT 파일만 첨부할 수 있습니다.');requireThat(get('SELECT count(*) n FROM attachments WHERE ticket_id=?',t.id).n<5,400,'문의당 첨부는 최대 5개입니다.');
     transaction(db,()=>{run('INSERT INTO attachments(ticket_id,author_id,filename,mime,content,created_at) VALUES (?,?,?,?,?,?)',t.id,u.id,filename,mime,bytes,now());event(t,u,'첨부 파일 추가');});return send(res,201,{ok:true});
    }
   }
   match=path.match(/^\/api\/attachments\/(\d+)$/);
   if(method==='GET'&&match){const a=get('SELECT * FROM attachments WHERE id=?',integer(match[1]));requireThat(a,404,'첨부 파일을 찾을 수 없습니다.');ticketAccess(u,a.ticket_id);res.setHeader('Content-Type','application/octet-stream');res.setHeader('Content-Disposition',`attachment; filename="attachment"; filename*=UTF-8''${encodeURIComponent(a.filename).replace(/'/g,'%27')}`);res.end(Buffer.from(a.content));return;}
   if(path.startsWith('/api/admin/')){
    admin(u);
    if(method==='GET'&&path==='/api/admin/data')return send(res,200,{users:all('SELECT id,email,name,role,customer_id,active FROM users'),customers:all('SELECT * FROM customers'),products:all('SELECT * FROM products'),assignments:all('SELECT * FROM assignments'),audit:all('SELECT a.*,u.name actor_name FROM audit a LEFT JOIN users u ON u.id=a.actor_id ORDER BY a.id DESC LIMIT 100')});
    if(method==='POST'&&path==='/api/admin/customers'){const b=await body(req);const result=run('INSERT INTO customers(name) VALUES (?)',text(b.name,100));audit(db,u.id,'고객사 추가');return send(res,201,{id:Number(result.lastInsertRowid)});}
    if(method==='POST'&&path==='/api/admin/products'){const b=await body(req);requireThat(get('SELECT id FROM customers WHERE id=?',integer(b.customer_id)),400,'고객사를 선택해 주세요.');const result=run('INSERT INTO products(customer_id,name,contract) VALUES (?,?,?)',b.customer_id,text(b.name,100),text(b.contract,10000));audit(db,u.id,'제품 추가');return send(res,201,{id:Number(result.lastInsertRowid)});}
    match=path.match(/^\/api\/admin\/products\/(\d+)$/);
    if(method==='PATCH'&&match){const b=await body(req);requireThat(get('SELECT id FROM products WHERE id=?',integer(match[1])),404,'제품을 찾을 수 없습니다.');run('UPDATE products SET contract=? WHERE id=?',text(b.contract,10000),Number(match[1]));audit(db,u.id,'유지보수 범위 수정');return send(res,200,{ok:true});}
    if(method==='POST'&&path==='/api/admin/users'){
     const b=await body(req),role=oneOf(b.role,roles),customer=['customer','manager'].includes(role)?integer(b.customer_id):null;requireThat(!customer||get('SELECT id FROM customers WHERE id=?',customer),400,'고객사를 선택해 주세요.');
     const result=transaction(db,()=>{const id=Number(run('INSERT INTO users(email,name,role,customer_id) VALUES (?,?,?,?)',email(b.email),text(b.name,80),role,customer).lastInsertRowid);audit(db,u.id,'계정 초대: '+id);return {id,token:accessToken(db,id)};});return send(res,201,{...result,expiresIn:3600});
    }
    match=path.match(/^\/api\/admin\/users\/(\d+)\/permissions$/);
    if(method==='PATCH'&&match){const target=get('SELECT * FROM users WHERE id=?',integer(match[1]));requireThat(target,404,'계정을 찾을 수 없습니다.');requireThat(target.id!==u.id,400,'자기 계정의 권한은 변경할 수 없습니다.');const b=await body(req),role=oneOf(b.role,roles),customer=['customer','manager'].includes(role)?integer(b.customer_id):null;requireThat(!customer||get('SELECT id FROM customers WHERE id=?',customer),400,'고객사를 확인해 주세요.');requireThat(customer===target.customer_id||!get('SELECT id FROM tickets WHERE author_id=? LIMIT 1',target.id),400,'접수 이력이 있는 계정의 고객사는 변경할 수 없습니다. 별도 계정을 초대해 주세요.');transaction(db,()=>{run('UPDATE users SET role=?,customer_id=? WHERE id=?',role,customer,target.id);if(role!=='staff')run('DELETE FROM assignments WHERE user_id=?',target.id);if(!['staff','admin'].includes(role))run('UPDATE tickets SET assignee_id=NULL,version=version+1 WHERE assignee_id=?',target.id);run('DELETE FROM sessions WHERE user_id=?',target.id);run('DELETE FROM access_tokens WHERE user_id=?',target.id);audit(db,u.id,`계정 권한 변경: ${target.id} (${target.role} → ${role})`);});return send(res,200,{ok:true});}
    match=path.match(/^\/api\/admin\/users\/(\d+)\/(reset|active)$/);
    if(method==='POST'&&match){const target=get('SELECT * FROM users WHERE id=?',integer(match[1]));requireThat(target,404,'계정을 찾을 수 없습니다.');
     if(match[2]==='reset'){requireThat(target.active,400,'비활성 계정입니다.');audit(db,u.id,'재설정 링크 발급: '+target.id);return send(res,200,{token:accessToken(db,target.id),expiresIn:3600});}
     const b=await body(req);requireThat(target.id!==u.id,400,'자기 계정을 비활성화할 수 없습니다.');requireThat(typeof b.active==='boolean',400,'활성 상태를 확인해 주세요.');transaction(db,()=>{run('UPDATE users SET active=? WHERE id=?',b.active?1:0,target.id);run('DELETE FROM sessions WHERE user_id=?',target.id);run('DELETE FROM access_tokens WHERE user_id=?',target.id);if(!b.active)run('UPDATE tickets SET assignee_id=NULL,version=version+1 WHERE assignee_id=?',target.id);audit(db,u.id,`계정 ${b.active?'활성':'비활성'}: ${target.id}`);});return send(res,200,{ok:true});
    }
    if(method==='POST'&&path==='/api/admin/assignments'){const b=await body(req),agent=get("SELECT * FROM users WHERE id=? AND role='staff' AND active=1",integer(b.user_id));requireThat(agent,400,'유지보수 담당자를 선택해 주세요.');requireThat(Array.isArray(b.customer_ids)&&b.customer_ids.every(id=>Number.isSafeInteger(id)&&get('SELECT id FROM customers WHERE id=?',id)),400,'고객사 목록을 확인해 주세요.');transaction(db,()=>{run('DELETE FROM assignments WHERE user_id=?',agent.id);for(const id of new Set(b.customer_ids))run('INSERT INTO assignments VALUES (?,?)',agent.id,id);run('UPDATE tickets SET assignee_id=NULL,version=version+1 WHERE assignee_id=? AND customer_id NOT IN (SELECT customer_id FROM assignments WHERE user_id=?)',agent.id,agent.id);audit(db,u.id,'담당 고객사 변경: '+agent.id);});return send(res,200,{ok:true});}
    if(method==='POST'&&path==='/api/admin/articles'){const b=await body(req);const customer=b.customer_id===null?null:integer(b.customer_id);requireThat(customer===null||get('SELECT id FROM customers WHERE id=?',customer),400,'고객사를 확인해 주세요.');const p=b.product_id===null?null:get('SELECT * FROM products WHERE id=?',integer(b.product_id));requireThat(b.product_id===null||(p&&p.customer_id===customer),400,'제품과 고객사가 일치해야 합니다.');run('INSERT INTO articles(customer_id,product_id,kind,title,body,created_at) VALUES (?,?,?,?,?,?)',customer,p?.id??null,oneOf(b.kind,['guide','notice','faq']),text(b.title,160),text(b.body,20000),now());audit(db,u.id,'안내 콘텐츠 게시');return send(res,201,{ok:true});}
   }
   throw new HttpError(404,'지원하지 않는 경로입니다.');
  }catch(error){if(!res.headersSent){const constraint=error.code?.startsWith('ERR_SQLITE')&&/UNIQUE constraint/.test(error.message);const status=error.status||(constraint?409:500);if(status===500)console.error('Request failed:',error.message);send(res,status,{error:constraint?'이미 등록된 값입니다.':status===500?'처리 중 오류가 발생했습니다. 다시 시도해 주세요.':error.message});}else res.end();}
 }
 const server=createServer(handler);server.requestTimeout=30000;server.headersTimeout=15000;
 return {server,db,close:()=>new Promise((resolve,reject)=>server.close(err=>{db.close();err?reject(err):resolve();}))};
}
if(process.argv[1]&&resolve(process.argv[1])===fileURLToPath(import.meta.url)){
 const demo=process.argv.includes('--demo'),port=demo?4311:Number(process.env.PORT||4310),host=process.env.HOST||'127.0.0.1';
 const origin=demo?`http://127.0.0.1:${port}`:(process.env.APP_ORIGIN||`http://127.0.0.1:${port}`),secure=process.env.SECURE_COOKIES==='true';
 if(process.env.NODE_ENV==='production'&&(!secure||!origin.startsWith('https://')))throw new Error('운영 환경은 HTTPS APP_ORIGIN과 SECURE_COOKIES=true가 필요합니다.');
 const app=createPortal({mode:demo?'demo':'live',directory:demo?join(root,'data/demo'):resolve(process.env.DATA_DIR||join(root,'data/live')),origin,secure});
 app.server.listen(port,host,()=>console.log(`${demo?'시연':'실제 저장'} 포털: ${origin}`));
 process.on('SIGINT',()=>app.close().then(()=>process.exit()));process.on('SIGTERM',()=>app.close().then(()=>process.exit()));
}
