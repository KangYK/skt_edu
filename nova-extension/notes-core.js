'use strict';
(function(root){
  function normalize(raw) {
    if(!Array.isArray(raw))return [];
    const ids=new Set();
    return raw.filter(item=>item&&typeof item.id==='string'&&!ids.has(item.id)&&ids.add(item.id)&&typeof item.text==='string'&&item.text.trim()).map(item=>({id:item.id,text:item.text.slice(0,10000),createdAt:Number.isFinite(item.createdAt)?item.createdAt:0}));
  }
  function restore(stored){
    if(Array.isArray(stored.noteItems))return normalize(stored.noteItems);
    return typeof stored.notes==='string'&&stored.notes.trim()?[{id:'legacy-note',text:stored.notes.slice(0,10000),createdAt:0}]:[];
  }
  function exportText(raw){
    const items=normalize(raw).sort((a,b)=>b.createdAt-a.createdAt);
    return ['수업 중 메모',`전체 ${items.length}개`,'',...items.map((item,index)=>`${index+1}. ${item.text}`)].join('\r\n\r\n')+'\r\n';
  }
  const api={normalize,restore,exportText};if(typeof module!=='undefined')module.exports=api;else root.NotesCore=api;
})(globalThis);
