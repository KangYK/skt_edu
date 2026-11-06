'use strict';
(() => {
  const core=BreakoutCore,canvas=document.querySelector('#breakout-canvas'),ctx=canvas.getContext('2d');
  const start=document.querySelector('#game-start'),reset=document.querySelector('#game-reset'),message=document.querySelector('#game-message');
  if(!ctx){message.textContent='이 브라우저에서는 게임 화면을 표시할 수 없습니다.';start.disabled=reset.disabled=true;return;}
  let game=core.create(),frame=0,last=0,left=false,right=false;
  const titles={ready:'잠깐, 머리를 식혀볼까요?',paused:'잠시 쉬는 중',serve:'다음 공을 준비하세요',won:'모든 벽돌을 깼어요!',lost:'다시 도전해 보세요'};
  function sync(){
    document.querySelector('#game-score').textContent=String(game.score);
    document.querySelector('#game-lives').textContent=String(game.lives);
    start.textContent=game.state==='playing'?'일시정지':game.state==='paused'?'계속하기':game.state==='serve'?'다음 공 시작':['won','lost'].includes(game.state)?'다시 도전':'게임 시작';
    const status=game.state==='playing'?'게임 진행 중':titles[game.state];if(message.textContent!==status)message.textContent=status;
  }
  function draw(){
    ctx.clearRect(0,0,core.WIDTH,core.HEIGHT);ctx.fillStyle='#f5f7fc';ctx.fillRect(0,0,core.WIDTH,core.HEIGHT);
    const colors=['#5268ac','#7489bc','#97a9d0','#bdcbe2'];
    for(const b of game.bricks){if(!b.alive)continue;ctx.fillStyle=colors[b.row];ctx.beginPath();ctx.roundRect(b.x,b.y,b.w,b.h,4);ctx.fill();}
    ctx.fillStyle='#34445f';ctx.beginPath();ctx.roundRect(game.paddle,core.PADDLE_Y,core.PADDLE_WIDTH,9,4);ctx.fill();
    ctx.fillStyle='#e39a64';ctx.beginPath();ctx.arc(game.x,game.y,core.RADIUS,0,Math.PI*2);ctx.fill();
    if(game.state!=='playing'){
      ctx.fillStyle='#f5f7fcd9';ctx.fillRect(0,135,core.WIDTH,95);ctx.textAlign='center';ctx.fillStyle='#34445f';ctx.font='600 18px Pretendard, sans-serif';ctx.fillText(titles[game.state],core.WIDTH/2,171);ctx.fillStyle='#738198';ctx.font='12px Pretendard, sans-serif';ctx.fillText('아래 버튼 또는 스페이스 키로 시작',core.WIDTH/2,197);
    }
  }
  function resize(){const width=canvas.getBoundingClientRect().width;if(!width)return;const ratio=Math.min(window.devicePixelRatio||1,2);canvas.width=Math.round(width*ratio);canvas.height=Math.round(width/core.WIDTH*core.HEIGHT*ratio);ctx.setTransform(canvas.width/core.WIDTH,0,0,canvas.height/core.HEIGHT,0,0);draw();}
  function loop(time){
    const dt=last?Math.min((time-last)/1000,.05):0;last=time;
    if(left!==right)core.move(game,game.paddle+core.PADDLE_WIDTH/2+(right?1:-1)*360*dt);
    core.step(game,dt);draw();sync();if(game.state==='playing')frame=requestAnimationFrame(loop);else{frame=0;last=0;}
  }
  function pause(){if(game.state!=='playing')return;game.state='paused';cancelAnimationFrame(frame);frame=0;last=0;left=right=false;sync();draw();}
  function toggle(){
    if(game.state==='playing'){pause();return;}
    if(['won','lost'].includes(game.state))game=core.create();
    game.state='playing';last=0;canvas.focus({preventScroll:true});sync();cancelAnimationFrame(frame);frame=requestAnimationFrame(loop);
  }
  start.addEventListener('click',toggle);
  reset.addEventListener('click',()=>{cancelAnimationFrame(frame);frame=0;last=0;left=right=false;game=core.create();sync();draw();});
  canvas.addEventListener('pointermove',event=>{const rect=canvas.getBoundingClientRect();core.move(game,(event.clientX-rect.left)/rect.width*core.WIDTH);if(game.state!=='playing')draw();});
  canvas.addEventListener('pointerdown',event=>{canvas.focus({preventScroll:true});canvas.setPointerCapture(event.pointerId);const rect=canvas.getBoundingClientRect();core.move(game,(event.clientX-rect.left)/rect.width*core.WIDTH);draw();});
  canvas.addEventListener('keydown',event=>{if(!['ArrowLeft','ArrowRight','Space'].includes(event.code))return;event.preventDefault();if(event.code==='Space'){if(!event.repeat)toggle();}else if(event.code==='ArrowLeft')left=true;else right=true;});
  canvas.addEventListener('keyup',event=>{if(event.code==='ArrowLeft'){left=false;event.preventDefault();}if(event.code==='ArrowRight'){right=false;event.preventDefault();}});
  canvas.addEventListener('blur',event=>{left=right=false;if(event.relatedTarget!==start&&event.relatedTarget!==reset)pause();});window.addEventListener('blur',pause);document.addEventListener('visibilitychange',()=>{if(document.hidden)pause();});
  document.addEventListener('game-tab-change',event=>{if(event.detail!=='breakout')pause();else resize();});
  new ResizeObserver(resize).observe(canvas);sync();resize();
})();
