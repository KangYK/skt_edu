'use strict';
(() => {
  const core=TetrisCore,panel=document.querySelector('#panel-tetris'),canvas=document.querySelector('#tetris-canvas'),ctx=canvas.getContext('2d'),preview=document.querySelector('#tetris-next'),nextCtx=preview.getContext('2d');
  const start=document.querySelector('#tetris-start'),reset=document.querySelector('#tetris-reset'),message=document.querySelector('#tetris-message');
  if(!ctx||!nextCtx){message.textContent='게임 화면을 표시할 수 없습니다.';panel.querySelectorAll('button').forEach(b=>b.disabled=true);return;}
  const colors=['','#6a83c7','#d4af59','#9c80c6','#6ca693','#c97986','#6b8ba8','#d69a6a'];
  let game=core.create(),frame=0,last=0,elapsed=0;
  function sync(){document.querySelector('#tetris-score').textContent=game.score;document.querySelector('#tetris-lines').textContent=game.lines;document.querySelector('#tetris-level').textContent=game.level+1;start.textContent=game.state==='playing'?'일시정지':game.state==='paused'?'계속하기':game.state==='lost'?'다시 도전':'게임 시작';const text=game.state==='playing'?'블록을 쌓아 가로줄을 완성하세요.':game.state==='paused'?'일시정지 상태입니다.':game.state==='lost'?'게임 종료! 다시 도전해 보세요.':'게임 시작 버튼을 눌러주세요.';if(message.textContent!==text)message.textContent=text;}
  function cell(context,x,y,color,size=20){context.fillStyle=color;context.fillRect(x*size+1,y*size+1,size-2,size-2);}
  function draw(){
    ctx.fillStyle='#f2f5fa';ctx.fillRect(0,0,200,400);
    ctx.strokeStyle='#e3e9f2';ctx.lineWidth=.5;for(let x=0;x<=10;x++){ctx.beginPath();ctx.moveTo(x*20,0);ctx.lineTo(x*20,400);ctx.stroke();}for(let y=0;y<=20;y++){ctx.beginPath();ctx.moveTo(0,y*20);ctx.lineTo(200,y*20);ctx.stroke();}
    game.board.forEach((row,y)=>row.forEach((value,x)=>{if(value)cell(ctx,x,y,colors[value]);}));
    const p=game.piece,ghost=core.ghostY(game);
    p.matrix.forEach((row,y)=>row.forEach((value,x)=>{if(value){cell(ctx,p.x+x,ghost+y,'#dce3f0');cell(ctx,p.x+x,p.y+y,colors[p.type+1]);}}));
    nextCtx.clearRect(0,0,100,80);const shape=core.SHAPES[game.next];const ox=(5-shape[0].length)/2,oy=(4-shape.length)/2;shape.forEach((row,y)=>row.forEach((value,x)=>{if(value)cell(nextCtx,ox+x,oy+y,colors[game.next+1]);}));
    if(game.state!=='playing'){ctx.fillStyle='#f5f7fce8';ctx.fillRect(0,155,200,80);ctx.fillStyle='#34445f';ctx.textAlign='center';ctx.font='600 15px Pretendard,sans-serif';ctx.fillText(game.state==='lost'?'게임 종료':game.state==='paused'?'일시정지':'테트리스',100,189);ctx.font='11px Pretendard,sans-serif';ctx.fillText('아래 버튼으로 시작',100,213);}
  }
  function loop(time){elapsed+=last?Math.min(time-last,100):0;last=time;const interval=Math.max(100,750-game.level*55);if(elapsed>=interval){core.drop(game);elapsed=0;}draw();sync();if(game.state==='playing')frame=requestAnimationFrame(loop);else{last=0;frame=0;}}
  function pause(){if(game.state!=='playing')return;game.state='paused';cancelAnimationFrame(frame);last=0;sync();draw();}
  function toggle(){if(panel.hidden)return;if(game.state==='playing'){pause();return;}if(game.state==='lost'){game=core.create();elapsed=0;}game.state='playing';last=0;canvas.focus({preventScroll:true});sync();cancelAnimationFrame(frame);frame=requestAnimationFrame(loop);}
  function action(name){if(game.state!=='playing'||panel.hidden)return;if(name==='left')core.move(game,-1);if(name==='right')core.move(game,1);if(name==='rotate')core.rotate(game);if(name==='down'){core.drop(game,true);elapsed=0;}if(name==='drop'){core.hardDrop(game);elapsed=0;}draw();sync();}
  start.addEventListener('click',toggle);reset.addEventListener('click',()=>{cancelAnimationFrame(frame);frame=last=elapsed=0;game=core.create();draw();sync();});
  canvas.addEventListener('keydown',event=>{const mapping={ArrowLeft:'left',ArrowRight:'right',ArrowUp:'rotate',ArrowDown:'down',Space:'drop'};if(event.code==='KeyP'){event.preventDefault();if(!event.repeat)toggle();return;}if(!mapping[event.code])return;event.preventDefault();if(event.repeat&&['Space','ArrowUp'].includes(event.code))return;action(mapping[event.code]);});
  panel.querySelectorAll('[data-tetris-action]').forEach(button=>button.addEventListener('click',()=>{action(button.dataset.tetrisAction);if(game.state==='playing')canvas.focus({preventScroll:true});}));
  canvas.addEventListener('blur',event=>{if(!panel.contains(event.relatedTarget))pause();});window.addEventListener('blur',pause);document.addEventListener('visibilitychange',()=>{if(document.hidden)pause();});document.addEventListener('game-tab-change',event=>{if(event.detail!=='tetris')pause();else draw();});
  const ratio=Math.min(devicePixelRatio||1,2);canvas.width=200*ratio;canvas.height=400*ratio;ctx.scale(ratio,ratio);preview.width=100*ratio;preview.height=80*ratio;nextCtx.scale(ratio,ratio);draw();sync();
})();
