import {DatabaseSync} from 'node:sqlite';
import {readFileSync,mkdirSync} from 'node:fs';
import {resolve,join} from 'node:path';
import {randomBytes,createHash,scrypt,timingSafeEqual} from 'node:crypto';
import {promisify} from 'node:util';
const derive=promisify(scrypt);
export const now=()=>new Date().toISOString();
export const token=()=>randomBytes(32).toString('base64url');
export const digest=value=>createHash('sha256').update(value).digest('hex');
export async function passwordHash(password){const salt=randomBytes(16).toString('hex');const key=await derive(password,salt,64,{N:32768,maxmem:64*1024*1024});return `${salt}:${key.toString('hex')}`;}
export async function verifyPassword(password,hash){const [salt,key]=(hash||'00000000000000000000000000000000:'+ '0'.repeat(128)).split(':');const actual=await derive(password,salt,64,{N:32768,maxmem:64*1024*1024});return timingSafeEqual(actual,Buffer.from(key,'hex'));}
export function openDatabase(directory,mode='live'){
 mkdirSync(directory,{recursive:true});const db=new DatabaseSync(join(resolve(directory),'portal.sqlite'),{timeout:5000});
 db.exec('PRAGMA journal_mode=WAL; PRAGMA foreign_keys=ON;');
 db.exec(readFileSync(new URL('../db/schema.sql',import.meta.url),'utf8'));
 const existing=db.prepare('SELECT value FROM meta WHERE key=?').get('mode');
 if(existing&&existing.value!==mode){db.close();throw new Error('시연과 실제 서비스는 같은 데이터베이스를 사용할 수 없습니다.');}
 db.prepare('INSERT OR IGNORE INTO meta(key,value) VALUES (?,?)').run('mode',mode);
 return db;
}
export function transaction(db,fn){db.exec('BEGIN IMMEDIATE');try{const result=fn();db.exec('COMMIT');return result;}catch(error){db.exec('ROLLBACK');throw error;}}
export function accessToken(db,userId){const value=token();db.prepare('DELETE FROM access_tokens WHERE user_id=?').run(userId);db.prepare('INSERT INTO access_tokens VALUES (?,?,?)').run(digest(value),userId,Date.now()+3600000);return value;}
export function audit(db,actor,action){db.prepare('INSERT INTO audit(actor_id,action,created_at) VALUES (?,?,?)').run(actor,action,now());}
export function seedDemo(db){
 if(db.prepare('SELECT id FROM users LIMIT 1').get())return;
 transaction(db,()=>{
  db.exec("INSERT INTO customers VALUES (1,'가상 고객사 A'),(2,'가상 고객사 B');");
  const add=db.prepare('INSERT INTO users(id,email,name,role,customer_id) VALUES (?,?,?,?,?)');
  [[1,'customer.a@example.com','고객 A','customer',1],[2,'colleague.a@example.com','동료 고객 A','customer',1],[3,'manager.a@example.com','고객사 담당자 A','manager',1],[4,'engineer@example.com','유지보수 담당자','staff',null],[5,'admin@example.com','관리자','admin',null],[6,'customer.b@example.com','고객 B','customer',2]].forEach(r=>add.run(...r));
  db.exec('INSERT INTO assignments VALUES (4,1);');
  db.prepare('INSERT INTO products VALUES (?,?,?,?)').run(1,1,'서비스 포털','[시연 예시] 포함: 납품 기능의 오류 분석 및 수정, 사용 문의 안내. 제외: 신규 기능 개발, 외부 시스템 변경. 지원 시간과 응답 기한은 실제 계약에서 확인합니다.');
  db.prepare('INSERT INTO products VALUES (?,?,?,?)').run(2,2,'업무 관리 시스템','[시연 예시] 기존 기능 오류 수정 및 사용 안내. 추가 개발은 별도 협의합니다.');
  const titles=['파일 업로드 시 안내 메시지 확인 요청','대시보드 조회 조건 저장 문의','모바일 화면 메뉴 표시 오류','사용자 권한 변경 방법 문의','월별 보고서 출력 형식 개선 요청','로그인 화면 문구 수정 문의','알림 목록 표시 순서 문의'];
  titles.forEach((title,i)=>{const status=['처리 중','정보 요청','접수','고객 확인 대기','범위 검토','완료','확인 중'][i];const stamp=new Date(Date.now()-(7-i)*86400000).toISOString();
   db.prepare('INSERT INTO tickets(customer_id,product_id,author_id,title,body,kind,priority,status,assignee_id,request_key,created_at,updated_at) VALUES (1,1,?,?,?,?,?,?,4,?,?,?)').run(i===2?2:1,title,'가상의 접수 예시입니다.\n발생 화면과 재현 절차를 함께 확인해 주세요. 실제 고객 자료는 포함하지 않습니다.',i%2?'사용 문의':'오류',i===2?'높음':'보통',status,`demo-${i}`,stamp,stamp);
  });
  db.prepare('INSERT INTO tickets(customer_id,product_id,author_id,title,body,kind,request_key,created_at,updated_at) VALUES (2,2,6,?,?,?,?,?,?)').run('고객사 B의 전용 문의','다른 고객사에는 보이지 않는 가상 문의입니다.','오류','demo-b',now(),now());
  db.prepare('INSERT INTO comments(ticket_id,author_id,body,internal,created_at) VALUES (1,4,?,0,?)').run('문의 내용을 확인했습니다. 재현 환경을 확인하고 있습니다.',now());
  db.prepare('INSERT INTO comments(ticket_id,author_id,body,internal,created_at) VALUES (1,4,?,1,?)').run('내부 확인용 메모입니다. 고객에게는 보이지 않습니다.',now());
  db.exec("INSERT INTO events(ticket_id,actor_id,body,created_at) SELECT id,author_id,'문의 접수',created_at FROM tickets;");
  const article=db.prepare('INSERT INTO articles(customer_id,product_id,kind,title,body,created_at) VALUES (?,?,?,?,?,?)');
  article.run(null,null,'faq','오류를 접수할 때 무엇을 알려주면 좋나요?','발생 화면, 발생 시점, 재현 순서, 기대한 결과와 실제 결과를 알려주세요. 비밀번호나 인증 토큰은 포함하지 마세요.',now());
  article.run(null,null,'faq','문의 상태는 어떻게 확인하나요?','처리 현황에서 접수 번호나 제목을 검색하고 상세 화면의 상태와 대화를 확인하세요.',now());
  article.run(1,1,'guide','서비스 포털 · 처음 사용하기','1. 초대받은 계정으로 로그인합니다.\n2. 사용 권한이 있는 메뉴를 확인합니다.\n3. 문의가 있으면 제품을 선택해 접수합니다.\n이 문서는 시연용 안내입니다.',now());
  article.run(1,1,'notice','[시연] 서비스 포털 정기 점검 안내','가상 점검 공지입니다. 실제 점검 일정은 운영 시 담당자가 게시합니다.',now());
  article.run(2,2,'guide','업무 관리 시스템 사용 안내','고객사 B 전용 시연 가이드입니다.',now());
 });
}
