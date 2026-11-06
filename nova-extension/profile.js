'use strict';
(() => {
  const extension = typeof chrome !== 'undefined' && chrome.storage?.local;
  async function resolve(overrides = {}) {
    let stored = {};
    try { stored = extension ? await chrome.storage.local.get(['name','automaticName']) : JSON.parse(localStorage.getItem('nova-preview') || '{}'); } catch {}
    stored = {...stored,...overrides};
    const manualName = typeof stored.name === 'string' && stored.name.trim() ? stored.name.trim().slice(0,30) : '교육생';
    const automatic = stored.automaticName !== false;
    let accountName = '';
    if (automatic && typeof chrome !== 'undefined' && chrome.identity?.getProfileUserInfo) {
      try {
        const account = await chrome.identity.getProfileUserInfo({accountStatus:'ANY'});
        if (typeof account.email === 'string' && account.email.includes('@')) accountName = account.email.split('@')[0].trim().slice(0,30);
      } catch {}
    }
    return {name:accountName || manualName,manualName,automatic,source:accountName?'account':automatic?'fallback':'manual'};
  }
  function watch(callback) {
    let generation = 0;
    async function refresh() { const current=++generation; const profile=await resolve(); if(current===generation)callback(profile); }
    if(extension)chrome.storage.onChanged.addListener((changes,area)=>{if(area==='local'&&(changes.name||changes.automaticName))refresh();});
    if(typeof chrome!=='undefined' && chrome.identity?.onSignInChanged)chrome.identity.onSignInChanged.addListener(refresh);
    window.addEventListener('focus',refresh);
    refresh();
  }
  globalThis.TimetableProfile = {resolve,watch};
})();
