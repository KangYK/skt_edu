'use strict';
const $ = selector => document.querySelector(selector);
const extensionStorage = typeof chrome !== 'undefined' && chrome.storage?.local;
let displayName = '교육생', toastTimeout, saving = false;
let activeProfile = {name:'교육생',manualName:'교육생',automatic:true,source:'fallback'};
function toast(text) { $('#status').textContent = text; clearTimeout(toastTimeout); toastTimeout = setTimeout(() => { $('#status').textContent = ''; }, 4000); }
function greet() { $('#greeting').textContent = displayName + '님, 반가워요.'; }
function tick() {
  const date = new Date();
  $('#clock').textContent = date.toLocaleTimeString('ko-KR', { hour:'2-digit', minute:'2-digit', second:'2-digit', hour12:false });
  $('#clock').dateTime = date.toISOString();
  $('#date').textContent = date.toLocaleDateString('ko-KR', { year:'numeric', month:'long', day:'numeric', weekday:'long' });
}
function showProfile(profile) {
  activeProfile=profile;displayName=profile.name;greet();
}
async function init() {
  $('#settings-open').disabled=true;
  showProfile(await TimetableProfile.resolve());
  $('#settings-open').disabled=false;tick();setInterval(tick,500);
  TimetableProfile.watch(showProfile);
}
function updateNameField(profile) {
  $('#name').value=profile.name;$('#name').disabled=profile.automatic;
  $('#name-source').textContent=profile.source==='account'?'로그인 이메일의 아이디를 표시하고 있습니다. 구글 프로필의 실제 이름과는 다를 수 있습니다.':profile.automatic?'크롬 로그인 계정을 읽을 수 없어 저장한 이름을 사용합니다. 직접 입력하려면 자동 사용을 해제하세요.':'인사말에 표시할 이름을 직접 입력하세요.';
}
$('#settings-open').addEventListener('click',async()=>{const profile=await TimetableProfile.resolve();showProfile(profile);$('#automatic-name').checked=profile.automatic;updateNameField(profile);$('#settings').showModal();});
let nameRequest=0;
$('#automatic-name').addEventListener('change',async()=>{const request=++nameRequest;const automaticName=$('#automatic-name').checked;const profile=await TimetableProfile.resolve({automaticName});if(request===nameRequest)updateNameField(profile);});
$('#settings-close').addEventListener('click', () => $('#settings').close());
$('#name').addEventListener('input', () => $('#name').setCustomValidity(''));
$('#settings-form').addEventListener('submit', async event => {
  event.preventDefault(); if(saving)return;
  const automaticName=$('#automatic-name').checked;
  const name = automaticName ? activeProfile.manualName : $('#name').value.trim();
  if(!name){$('#name').setCustomValidity('이름을 입력해 주세요.');$('#name').reportValidity();return;}
  saving=true; const button=$('#settings-form button[type="submit"]');button.disabled=true;
  try {
    if(extensionStorage)await chrome.storage.local.set({name,automaticName});
    else { const stored=JSON.parse(localStorage.getItem('nova-preview')||'{}');localStorage.setItem('nova-preview',JSON.stringify({...stored,name,automaticName})); }
    showProfile(await TimetableProfile.resolve());$('#settings').close();toast('이름 설정을 저장했습니다.');
  } catch { toast('이름을 저장하지 못했습니다. 다시 시도해 주세요.'); }
  finally { saving=false;button.disabled=false; }
});
init();
