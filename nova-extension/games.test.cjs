'use strict';
const assert=require('node:assert/strict'),fs=require('node:fs'),vm=require('node:vm');
const t=require('./tetris-core'),m=require('./mines-core');
let game=t.create(()=>.4);assert.equal(game.board.length,20);assert.ok(game.board.every(row=>row.length===10));
const bag=new Set([game.piece.type]);for(let i=0;i<6;i++){game.state='playing';t.hardDrop(game);bag.add(game.piece.type);game.board.forEach(row=>row.fill(0));}assert.equal(bag.size,7);
game=t.create();game.state='playing';game.piece={type:1,matrix:[[1,1],[1,1]],x:0,y:0};assert.equal(t.move(game,-1),false);assert.equal(t.move(game,1),true);assert.equal(t.rotate(game),true);
game.piece={type:0,matrix:[[1,1,1,1]],x:3,y:19};game.board[19]=[1,1,1,0,0,0,0,1,1,1];t.drop(game);assert.equal(game.lines,1);assert.equal(game.score,100);assert.equal(game.board.length,20);
game=t.create();game.state='playing';game.piece={type:0,matrix:[[1],[1],[1],[1]],x:9,y:16};for(let y=16;y<20;y++)game.board[y]=[1,1,1,1,1,1,1,1,1,0];t.drop(game);assert.equal(game.lines,4);assert.equal(game.score,800);
game=t.create();game.state='playing';game.piece={type:1,matrix:[[1,1],[1,1]],x:0,y:18};game.board[0].fill(1);game.board[0][0]=0;t.drop(game);assert.equal(game.state,'lost');
game=t.create();game.state='paused';const y=game.piece.y;t.drop(game);t.hardDrop(game);assert.equal(game.piece.y,y);
for(let run=0;run<30;run++){game=t.create();game.state='playing';for(let i=0;i<40&&game.state==='playing';i++){t.rotate(game);t.move(game,(i%3)-1);t.hardDrop(game);assert.ok(game.board.length===20&&game.board.every(row=>row.length===10));}}

let mine=m.create();m.flag(mine,0);m.reveal(mine,0);assert.equal(mine.state,'ready');m.flag(mine,0);m.reveal(mine,0,()=>.5);assert.equal(mine.cells.filter(c=>c.mine).length,10);assert.ok([0,...m.neighbors(0)].every(i=>!mine.cells[i].mine));assert.ok(mine.revealed>0);
const bomb=mine.cells.findIndex(c=>c.mine);m.reveal(mine,bomb);assert.equal(mine.state,'lost');const revealed=mine.revealed;m.reveal(mine,80);assert.equal(mine.revealed,revealed);
mine=m.create();m.reveal(mine,40,()=>.3);assert.ok([40,...m.neighbors(40)].every(i=>!mine.cells[i].mine));for(let i=0;i<81;i++)if(!mine.cells[i].mine)m.reveal(mine,i);assert.equal(mine.state,'won');assert.equal(mine.revealed,71);
mine=m.create();for(let i=0;i<20;i++)m.flag(mine,i);assert.equal(mine.flags,10);m.flag(mine,0);assert.equal(mine.flags,9);
for(let run=0;run<30;run++){mine=m.create();m.reveal(mine,run%81);assert.equal(mine.cells.filter(c=>c.mine).length,10);for(let i=0;i<81;i++)assert.equal(mine.cells[i].count,m.neighbors(i).filter(j=>mine.cells[j].mine).length);}

const events=[],panels=new Map(['breakout','tetris','mines'].map(name=>['panel-'+name,{hidden:name!=='breakout'}]));
const tabs=['breakout','tetris','mines'].map(name=>({dataset:{gameTab:name},handlers:{},attrs:{'aria-controls':'panel-'+name},addEventListener(k,f){this.handlers[k]=f},getAttribute(k){return this.attrs[k]},setAttribute(k,v){this.attrs[k]=v},focus(){this.focused=true}}));
vm.runInNewContext(fs.readFileSync('game-tabs.js','utf8'),{document:{querySelectorAll:()=>tabs,getElementById:id=>panels.get(id),dispatchEvent:event=>events.push(event)},CustomEvent:class{constructor(type,opts){this.type=type;this.detail=opts.detail}}});
tabs[1].handlers.click();assert.equal(panels.get('panel-tetris').hidden,false);assert.equal(panels.get('panel-breakout').hidden,true);assert.equal(events.at(-1).detail,'tetris');tabs[1].handlers.keydown({key:'ArrowRight',preventDefault(){}});assert.equal(panels.get('panel-mines').hidden,false);assert.equal(tabs[2].attrs['aria-selected'],'true');assert.equal(tabs[2].focused,true);
const html=fs.readFileSync('dashboard.html','utf8');for(const match of html.matchAll(/(?:src|href)="([^"]+)"/g))assert.ok(fs.existsSync(match[1]),match[1]);const ids=[...html.matchAll(/\bid="([^"]+)"/g)].map(m=>m[1]);assert.equal(ids.length,new Set(ids).size);
console.log('PASS: Tetris bag, movement, rotation, line scoring, top-out, pause; Mines safety, flood, win/loss, flags, neighbors; tab keyboard navigation, events, assets and unique IDs');
