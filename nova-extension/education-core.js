'use strict';
(function(root) {
  function dateKey(date = new Date()) { return `${date.getFullYear()}-${String(date.getMonth()+1).padStart(2,'0')}-${String(date.getDate()).padStart(2,'0')}`; }
  function minutes(value) {
    if (typeof value !== 'string' || !/^([01]\d|2[0-3]):[0-5]\d$/.test(value)) return NaN;
    const [h,m] = value.split(':').map(Number); return h*60+m;
  }
  function validDate(value) {
    if (typeof value !== 'string' || !/^\d{4}-\d{2}-\d{2}$/.test(value)) return false;
    const date = new Date(`${value}T12:00:00`); return Number.isFinite(date.getTime()) && dateKey(date) === value;
  }
  function validate(item, items = []) {
    if (!validDate(item.date)) return '교육 날짜를 선택해 주세요.';
    if (typeof item.title !== 'string' || !item.title.trim() || item.title.trim().length > 80) return '수업명을 1~80자로 입력해 주세요.';
    const start = minutes(item.start), end = minutes(item.end);
    if (!Number.isFinite(start) || !Number.isFinite(end)) return '시작 시간과 종료 시간을 입력해 주세요.';
    if (end <= start) return '종료 시간은 같은 날의 시작 시간보다 늦어야 합니다.';
    if (items.some(other => other.id !== item.id && other.date === item.date && start < minutes(other.end) && end > minutes(other.start))) return '같은 날짜의 다른 수업과 시간이 겹칩니다.';
    return '';
  }
  function forDate(items, date) { return items.filter(item => item.date === date).sort((a,b) => minutes(a.start)-minutes(b.start)); }
  function split(item, lessonMinutes, breakMinutes, items = []) {
    const error = validate(item, items);
    if (error) return { error, segments: [] };
    if (!Number.isInteger(lessonMinutes) || lessonMinutes < 1 || lessonMinutes > 1440) return { error:'교육 시간은 1~1440분의 정수로 입력해 주세요.', segments:[] };
    if (!Number.isInteger(breakMinutes) || breakMinutes < 0 || breakMinutes > 1440) return { error:'휴식 시간은 0~1440분의 정수로 입력해 주세요.', segments:[] };
    const format = value => `${String(Math.floor(value/60)).padStart(2,'0')}:${String(value%60).padStart(2,'0')}`;
    const segments = []; let cursor = minutes(item.start), count = 1;
    const finish = minutes(item.end);
    while (cursor < finish) {
      const lessonEnd = Math.min(cursor + lessonMinutes, finish);
      segments.push({date:item.date,title:`${item.title.trim().slice(0,65)} · ${count}교시`,start:format(cursor),end:format(lessonEnd),kind:'lesson'});
      cursor = lessonEnd;
      if (breakMinutes > 0 && cursor < finish) {
        const breakEnd = Math.min(cursor + breakMinutes, finish);
        segments.push({date:item.date,title:`휴식 · ${count}교시 후`,start:format(cursor),end:format(breakEnd),kind:'break'});
        cursor = breakEnd;
      }
      count++;
    }
    return {error:'',segments};
  }
  function status(items, date, now = new Date()) {
    const schedule = forDate(items, date);
    const active = schedule.find(item => new Date(`${item.date}T${item.start}:00`) <= now && now < new Date(`${item.date}T${item.end}:00`));
    const next = schedule.find(item => new Date(`${item.date}T${item.start}:00`) > now);
    if (active) {
      const start = new Date(`${active.date}T${active.start}:00`), end = new Date(`${active.date}T${active.end}:00`);
      return { kind:'active', item:active, seconds:Math.max(0,Math.ceil((end-now)/1000)), progress:Math.max(0,Math.min(100,(now-start)/(end-start)*100)) };
    }
    return { kind:schedule.length ? next ? 'upcoming' : 'finished' : 'empty', item:next || null, seconds:0, progress:0 };
  }
  function normalize(raw) {
    if (!Array.isArray(raw)) return [];
    const result = [];
    for (const item of raw) if (item && typeof item.id === 'string' && !result.some(other=>other.id===item.id) && !validate(item,result)) result.push({id:item.id,date:item.date,title:item.title.trim(),start:item.start,end:item.end,...(['lesson','break'].includes(item.kind)?{kind:item.kind}:{})});
    return result;
  }
  const api = {dateKey,minutes,validDate,validate,forDate,status,normalize,split};
  if(typeof module !== 'undefined') module.exports=api; else root.EducationCore=api;
})(globalThis);
