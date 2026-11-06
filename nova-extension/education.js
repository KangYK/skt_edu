'use strict';
(() => {
  const core = EducationCore, root = document.querySelector('#education-card');
  const find = selector => root.querySelector(selector);
  const store = typeof chrome !== 'undefined' && chrome.storage?.local;
  let items = [], editing = null, busy = false, loaded = false;
  const date = find('#education-date'), form = find('#education-form'), title = find('#class-title'), start = find('#class-start'), end = find('#class-end'), message = find('#education-message');
  const splitEnabled = find('#split-enabled'), lessonMinutes = find('#lesson-minutes'), breakMinutes = find('#break-minutes');
  date.value = core.dateKey();
  function notice(text) { message.textContent = text; }
  function reset() { editing = null; title.value = ''; start.value = ''; end.value = ''; splitEnabled.checked = false; find('#class-cancel').hidden = true; preview(); }
  function draft() { return {id:editing||'preview-only',date:date.value,title:title.value.trim(),start:start.value,end:end.value}; }
  function preview() {
    find('#split-options').hidden = !splitEnabled.checked;
    lessonMinutes.required = breakMinutes.required = splitEnabled.checked;
    lessonMinutes.disabled = breakMinutes.disabled = busy || !splitEnabled.checked;
    find('#class-save').textContent = splitEnabled.checked ? editing ? '이 수업을 분할하여 저장' : '분할 시간표 저장' : editing ? '수정 저장' : '수업 추가';
    const list = find('#split-preview'); list.replaceChildren();
    if (!splitEnabled.checked) return;
    const result = core.split(draft(), Number(lessonMinutes.value), Number(breakMinutes.value), items);
    find('#split-summary').textContent = result.error || `${result.segments.filter(item=>item.kind==='lesson').length}개 교육 · ${result.segments.filter(item=>item.kind==='break').length}개 휴식${editing ? ' · 선택한 수업을 아래 시간표로 교체합니다.' : ''}`;
    for (const item of result.segments) {
      const row = document.createElement('li'); row.textContent = `${item.start}–${item.end}  ${item.title}`;
      row.classList.toggle('break-preview', item.kind==='break'); list.append(row);
    }
  }
  function setBusy(value) {
    busy = value; root.querySelectorAll('input,button').forEach(element => { element.disabled = value; });
    lessonMinutes.disabled = breakMinutes.disabled = value || !splitEnabled.checked;
  }
  async function persist(next) {
    setBusy(true);
    try {
      if (store) await chrome.storage.local.set({ educationSchedule: next });
      else localStorage.setItem('nova-education', JSON.stringify(next));
      items = next; return true;
    } catch { notice('저장하지 못했습니다. 입력 내용을 유지했으니 다시 시도해 주세요.'); return false; }
    finally { setBusy(false); }
  }
  function updateStatus() {
    const current = core.status(items,date.value), label = find('#education-label'), countdown = find('#education-time'), description = find('#education-description'), progress = find('#education-progress');
    label.textContent = current.kind === 'active' ? current.item.kind === 'break' ? '휴식 중' : '교육 진행 중' : current.kind === 'upcoming' ? current.item.kind === 'break' ? '다음 휴식' : '다음 교육' : current.kind === 'finished' ? '교육 종료' : '시간표를 만들어 보세요';
    find('#education-start').textContent = current.item ? current.item.start : '--:--';
    find('#education-end').textContent = current.item ? current.item.end : '--:--';
    countdown.textContent = current.kind === 'active' ? `${String(Math.floor(current.seconds/3600)).padStart(2,'0')}:${String(Math.floor(current.seconds%3600/60)).padStart(2,'0')}:${String(current.seconds%60).padStart(2,'0')}` : current.kind === 'finished' ? '00:00:00' : '--:--:--';
    description.textContent = current.item ? current.item.title : current.kind === 'finished' ? '선택한 날짜의 교육이 모두 끝났습니다.' : '수업명과 시간을 입력하면 자동으로 표시됩니다.';
    progress.hidden = current.kind !== 'active'; progress.value = current.progress;
    root.querySelectorAll('[data-class-id]').forEach(row => {
      const active = current.kind === 'active' && current.item.id === row.dataset.classId;
      row.classList.toggle('current-class', active);
      const item = items.find(item => item.id === row.dataset.classId);
      row.querySelector('.class-state').textContent = active ? item.kind === 'break' ? '휴식 중' : '진행 중' : new Date(`${item.date}T${item.end}:00`) <= new Date() ? '종료' : '예정';
    });
  }
  function render() {
    const list = find('#class-list'), schedule = core.forDate(items,date.value); list.replaceChildren();
    const total = kind => schedule.filter(item => (item.kind==='break')===kind).reduce((sum,item)=>sum+core.minutes(item.end)-core.minutes(item.start),0);
    find('#education-total').textContent = `교육 ${total(false)}분 · 휴식 ${total(true)}분`;
    find('#education-empty').hidden = schedule.length !== 0;
    for (const item of schedule) {
      const row = document.createElement('li'); row.dataset.classId = item.id;
      row.classList.toggle('break-class', item.kind==='break');
      const info = document.createElement('div'), time = document.createElement('span'), heading = document.createElement('strong'), badge = document.createElement('span'), actions = document.createElement('div');
      time.className='class-time'; time.textContent=`${item.start} – ${item.end}`; heading.textContent=item.title; badge.className='class-state'; info.append(time,heading,badge); actions.className='class-actions';
      const edit=document.createElement('button'); edit.type='button'; edit.textContent='수정'; edit.setAttribute('aria-label',`${item.title} 수정`);
      edit.addEventListener('click',()=>{ if(busy)return; editing=item.id; title.value=item.title; start.value=item.start; end.value=item.end; splitEnabled.checked=false; preview(); find('#class-cancel').hidden=false; notice(''); title.focus(); });
      const remove=document.createElement('button'); remove.type='button'; remove.textContent='삭제'; remove.setAttribute('aria-label',`${item.title} 삭제`);
      remove.addEventListener('click',async()=>{ if(busy)return; if(await persist(items.filter(other=>other.id!==item.id))){if(editing===item.id)reset();render();notice('수업을 삭제했습니다.');} });
      actions.append(edit,remove); row.append(info,actions); list.append(row);
    }
    updateStatus();
  }
  form.addEventListener('submit',async event=>{
    event.preventDefault(); if(!loaded||busy)return;
    const item={id:editing||crypto.randomUUID(),date:date.value,title:title.value.trim(),start:start.value,end:end.value};
    const error=core.validate(item,items); if(error){notice(error);return;}
    if(editing&&!items.some(other=>other.id===editing)){notice('다른 창에서 삭제된 수업입니다. 취소 후 다시 추가해 주세요.');return;}
    const existing = items.find(other=>other.id===editing);
    let entries = [{...item,...(existing?.kind ? {kind:existing.kind} : {})}];
    if (splitEnabled.checked) {
      const result = core.split(item,Number(lessonMinutes.value),Number(breakMinutes.value),items);
      if(result.error){notice(result.error);return;}
      entries=result.segments.map(segment=>({...segment,id:crypto.randomUUID()}));
    }
    const next=[...items.filter(other=>other.id!==item.id),...entries];
    if(await persist(next)){reset();render();notice('시간표를 저장했습니다.');}
  });
  date.addEventListener('change',()=>{if(!core.validDate(date.value))date.value=core.dateKey();reset();notice('');render();});
  find('#class-cancel').addEventListener('click',()=>{reset();notice('');});
  form.addEventListener('input',preview);
  if(store) chrome.storage.onChanged.addListener((changes,area)=>{if(area==='local'&&changes.educationSchedule&&!busy){items=core.normalize(changes.educationSchedule.newValue);render();preview();}});
  async function init(){
    setBusy(true);
    try { const raw=store?(await chrome.storage.local.get('educationSchedule')).educationSchedule:JSON.parse(localStorage.getItem('nova-education')||'[]'); items=core.normalize(raw); loaded=true; render(); preview(); }
    catch { notice('시간표를 읽지 못했습니다. 화면을 새로고침해 주세요.'); }
    finally { if(loaded)setBusy(false); }
    setInterval(()=>{if(loaded)updateStatus();},1000);
  }
  init();
})();
