'use strict';
(function(root){
  const SIZE=9,MINES=10;
  function neighbors(index){const x=index%SIZE,y=Math.floor(index/SIZE),out=[];for(let dy=-1;dy<=1;dy++)for(let dx=-1;dx<=1;dx++){const nx=x+dx,ny=y+dy;if((dx||dy)&&nx>=0&&nx<SIZE&&ny>=0&&ny<SIZE)out.push(ny*SIZE+nx);}return out;}
  function create(){return {state:'ready',cells:Array.from({length:81},()=>({mine:false,open:false,flag:false,count:0})),flags:0,revealed:0};}
  function seed(game,first,rng){const safe=new Set([first,...neighbors(first)]),candidates=game.cells.map((_,i)=>i).filter(i=>!safe.has(i));for(let i=candidates.length-1;i>0;i--){const j=Math.floor(rng()*(i+1));[candidates[i],candidates[j]]=[candidates[j],candidates[i]];}for(const index of candidates.slice(0,MINES))game.cells[index].mine=true;game.cells.forEach((cell,i)=>cell.count=neighbors(i).filter(n=>game.cells[n].mine).length);game.state='playing';}
  function flag(game,index){if(['won','lost'].includes(game.state)||!game.cells[index]||game.cells[index].open)return;const cell=game.cells[index];if(cell.flag){cell.flag=false;game.flags--;}else if(game.flags<MINES){cell.flag=true;game.flags++;}}
  function reveal(game,index,rng=Math.random){
    if(['won','lost'].includes(game.state)||!game.cells[index]||game.cells[index].open||game.cells[index].flag)return;
    if(game.state==='ready')seed(game,index,rng);
    if(game.cells[index].mine){game.cells[index].open=true;game.state='lost';game.exploded=index;return;}
    const stack=[index];while(stack.length){const i=stack.pop(),cell=game.cells[i];if(cell.open||cell.flag||cell.mine)continue;cell.open=true;game.revealed++;if(!cell.count)stack.push(...neighbors(i));}
    if(game.revealed===SIZE*SIZE-MINES)game.state='won';
  }
  const api={SIZE,MINES,neighbors,create,flag,reveal};if(typeof module!=='undefined')module.exports=api;else root.MinesCore=api;
})(globalThis);
