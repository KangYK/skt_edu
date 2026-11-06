'use strict';
(() => {
  const root=document.querySelector('#notes-panel');if(!root)return;
  root.innerHTML='<div class="memo-heading"><h2>수업 중 메모</h2><span id="memo-count">0개</span></div><form id="memo-form"><label class="memo-label" for="memo-input">새 메모</label><textarea id="memo-input" maxlength="10000" placeholder="수업 중 기억할 내용을 입력하세요." required disabled></textarea><div class="memo-form-actions"><button id="memo-submit" type="submit" disabled>메모 추가</button><button id="memo-download" type="button" disabled>전체 다운로드</button><button id="memo-cancel" type="button" hidden>취소</button></div></form><p id="memo-message" role="status" aria-live="polite"></p><p id="memo-empty">등록한 메모가 없습니다.</p><ul id="memo-list"></ul><p class="memo-hint">팝업과 대시보드에서 함께 관리합니다.</p>';
  const input=root.querySelector('#memo-input'),submit=root.querySelector('#memo-submit'),cancel=root.querySelector('#memo-cancel'),message=root.querySelector('#memo-message'),list=root.querySelector('#memo-list');
  const store=typeof chrome!=='undefined'&&chrome.storage?.local;
  const isPopup=root.dataset.popup==='true';
  let items=[],editing=null,busy=false,ready=false;
  function controls(disabled){busy=disabled;root.querySelectorAll('button,textarea').forEach(element=>{element.disabled=disabled;});}
  function reset(){editing=null;input.value='';submit.textContent='메모 추가';cancel.hidden=true;}
  async function save(next){
    controls(true);message.textContent='저장 중…';
    try{
      if(store)await chrome.storage.local.set({noteItems:next});
      else {const stored=JSON.parse(localStorage.getItem('nova-preview')||'{}');localStorage.setItem('nova-preview',JSON.stringify({...stored,noteItems:next}));}
      items=next;message.textContent='저장했습니다.';return true;
    }catch{message.textContent='저장하지 못했습니다. 입력 내용을 유지했으니 다시 시도해 주세요.';return false;}
    finally{controls(false);}
  }
  function fitPopupItems(){
    if(!isPopup)return;
    const capacity=Math.max(0,Math.floor(list.clientHeight/32));
    [...list.children].forEach((row,index)=>{row.hidden=index>=capacity;});
    const shown=Math.min(items.length,capacity);
    root.querySelector('#memo-count').textContent=shown<items.length?`전체 ${items.length}개 · 최근 ${shown}개`:`${items.length}개`;
  }
  if(isPopup)new ResizeObserver(fitPopupItems).observe(list);
  function render(){
    list.replaceChildren();root.querySelector('#memo-count').textContent=`${items.length}개`;root.querySelector('#memo-empty').hidden=items.length>0;
    const visibleItems=isPopup?[...items].sort((a,b)=>b.createdAt-a.createdAt):items;
    for(const item of visibleItems){
      const row=document.createElement('li'),body=document.createElement('p'),actions=document.createElement('div'),edit=document.createElement('button'),remove=document.createElement('button');
      body.textContent=item.text;body.title=item.text;actions.className='memo-item-actions';edit.type=remove.type='button';edit.textContent='수정';remove.textContent='삭제';
      edit.setAttribute('aria-label',`${item.text.slice(0,30)} 메모 수정`);remove.setAttribute('aria-label',`${item.text.slice(0,30)} 메모 삭제`);
      edit.addEventListener('click',()=>{if(busy)return;editing=item.id;input.value=item.text;submit.textContent='수정 저장';cancel.hidden=false;message.textContent='';input.focus();});
      remove.addEventListener('click',async()=>{if(busy)return;if(await save(items.filter(note=>note.id!==item.id))){if(editing===item.id)reset();render();}});
      actions.append(edit,remove);row.append(body,actions);list.append(row);
    }
    fitPopupItems();
  }
  root.querySelector('#memo-form').addEventListener('submit',async event=>{
    event.preventDefault();if(!ready||busy)return;const text=input.value.trim();
    if(!text){message.textContent='메모 내용을 입력해 주세요.';input.focus();return;}
    if(editing&&!items.some(item=>item.id===editing)){message.textContent='다른 창에서 삭제한 메모입니다. 내용을 복사한 뒤 취소하고 다시 추가해 주세요.';return;}
    const next=editing?items.map(item=>item.id===editing?{...item,text}:item):[{id:crypto.randomUUID(),text,createdAt:Date.now()},...items];
    if(await save(next)){reset();render();input.focus();}
  });
  root.querySelector('#memo-download').addEventListener('click',()=>{
    if(!ready||busy)return;
    if(!items.length){message.textContent='다운로드할 메모가 없습니다.';return;}
    let url;
    try{
      const now=new Date(),pad=value=>String(value).padStart(2,'0');
      const stamp=`${now.getFullYear()}-${pad(now.getMonth()+1)}-${pad(now.getDate())}_${pad(now.getHours())}${pad(now.getMinutes())}${pad(now.getSeconds())}`;
      const blob=new Blob(['\uFEFF',NotesCore.exportText(items)],{type:'text/plain;charset=utf-8'});
      url=URL.createObjectURL(blob);
      const link=document.createElement('a');link.href=url;link.download=`수업-중-메모_${stamp}.txt`;
      document.body.append(link);link.click();link.remove();
      message.textContent=`전체 메모 ${items.length}개의 다운로드를 요청했습니다.`;
    }catch{message.textContent='다운로드하지 못했습니다. 다시 시도해 주세요.';}
    finally{if(url)setTimeout(()=>URL.revokeObjectURL(url),60000);}
  });
  cancel.addEventListener('click',()=>{reset();message.textContent='';input.focus();});
  if(store)chrome.storage.onChanged.addListener((changes,area)=>{if(area==='local'&&changes.noteItems&&!busy){items=NotesCore.normalize(changes.noteItems.newValue);render();}});
  async function init(){
    controls(true);
    try{
      const stored=store?await chrome.storage.local.get(['noteItems','notes']):JSON.parse(localStorage.getItem('nova-preview')||'{}');
      items=NotesCore.restore(stored);
      if(!Array.isArray(stored.noteItems)&&items.length){if(!await save(items))return;message.textContent='기존 메모를 목록으로 옮겼습니다.';}
      ready=true;render();controls(false);if(root.dataset.popup==='true')input.focus();
    }catch{message.textContent='메모를 불러오지 못했습니다. 화면을 다시 열어주세요.';}
  }
  init();
})();
