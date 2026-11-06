'use strict';
document.querySelector('#open').addEventListener('click', async () => {
  await chrome.tabs.create({ url: chrome.runtime.getURL('dashboard.html') });
  window.close();
});

TimetableProfile.watch(profile => { document.querySelector('#popup-greeting').textContent = profile.name + '님, 반가워요.'; });

// Share the dashboard timetable; no separate popup timer or stored countdown.
(() => {
  const core = EducationCore;
  const find = selector => document.querySelector(selector);
  let schedule = [], ready = false;
  function renderLesson() {
    if (!ready) return;
    const now = new Date(), date = core.dateKey(now), current = core.status(schedule, date, now);
    const today = core.forDate(schedule,date), first = today[0], last = today.at(-1);
    const begins = first ? new Date(`${date}T${first.start}:00`) : null;
    const ends = last ? new Date(`${date}T${last.end}:00`) : null;
    const titles = [...new Set(today.filter(item=>item.kind!=='break').map(item=>item.title.replace(/ · \d+교시$/, '')))];
    find('#popup-lesson-state').textContent = !first ? '등록된 교육 없음' : now < begins ? '시작 전' : now >= ends ? '오늘 교육 종료' : current.item?.kind === 'break' || current.kind !== 'active' ? '휴식 중' : '교육 진행 중';
    find('#popup-lesson-title').textContent = titles.length ? titles.length === 1 ? titles[0] : `${titles[0]} 외 ${titles.length-1}개` : first ? '오늘의 교육 시간표' : '대시보드에서 오늘의 시간표를 등록해 주세요.';
    find('#popup-lesson-start').textContent = first ? first.start : '--:--';
    find('#popup-lesson-end').textContent = last ? last.end : '--:--';
    const seconds = ends ? Math.max(0,Math.ceil((ends-now)/1000)) : 0;
    find('#popup-lesson-remaining').textContent = ends ? `${String(Math.floor(seconds/3600)).padStart(2,'0')}:${String(Math.floor(seconds%3600/60)).padStart(2,'0')}:${String(seconds%60).padStart(2,'0')}` : '--:--:--';
    find('#popup-lesson-hint').textContent = first ? '오늘의 전체 교육 시간 · 휴식을 포함한 최종 종료까지 남은 시간' : '오늘 날짜 · 컴퓨터 시간 기준';
  }
  chrome.storage.local.get('educationSchedule').then(stored => {
    schedule = core.normalize(stored.educationSchedule); ready = true; renderLesson();
  }).catch(() => {
    find('#popup-lesson-state').textContent = '불러오기 실패';
    find('#popup-lesson-title').textContent = '시간표를 불러오지 못했습니다. 팝업을 다시 열어주세요.';
  });
  chrome.storage.onChanged.addListener((changes,area) => {
    if (area === 'local' && changes.educationSchedule) { schedule = core.normalize(changes.educationSchedule.newValue); ready = true; renderLesson(); }
  });
  setInterval(renderLesson,1000);
})();
