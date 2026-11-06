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
  const api={normalize,restore};if(typeof module!=='undefined')module.exports=api;else root.NotesCore=api;
})(globalThis);
