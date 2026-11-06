'use strict';
(() => {
  const core=MinesCore,board=document.querySelector('#mines-board'),message=document.querySelector('#mines-message'),mode=document.querySelector('#mines-mode');
  let game=core.create(),flagMode=false;const buttons=[];
  for(let index=0;index<81;index++){
    const button=document.createElement('button');button.type='button';
    button.addEventListener('click',()=>{if(flagMode)core.flag(game,index);else core.reveal(game,index);render();});
    button.addEventListener('contextmenu',event=>{event.preventDefault();core.flag(game,index);render();});
    button.addEventListener('keydown',event=>{const x=index%9,y=Math.floor(index/9);let target;if(event.key==='ArrowRight'&&x<8)target=index+1;else if(event.key==='ArrowLeft'&&x>0)target=index-1;else if(event.key==='ArrowDown'&&y<8)target=index+9;else if(event.key==='ArrowUp'&&y>0)target=index-9;else if(event.key.toLowerCase()==='f'){event.preventDefault();core.flag(game,index);render();return;}else return;event.preventDefault();buttons[target].focus();});
    buttons.push(button);board.append(button);
  }
  function render(){
    document.querySelector('#mines-left').textContent=core.MINES-game.flags;document.querySelector('#mines-open').textContent=`${game.revealed}/71`;
    game.cells.forEach((cell,index)=>{const button=buttons[index],showMine=cell.mine&&['lost','won'].includes(game.state),wrong=game.state==='lost'&&cell.flag&&!cell.mine;
      button.textContent=showMine?'✹':wrong?'×':cell.flag?'⚑':cell.open&&cell.count?String(cell.count):'';
      button.className=cell.open?'mine-cell open':'mine-cell';if(showMine)button.classList.add('mine');if(game.exploded===index)button.classList.add('exploded');if(cell.flag)button.classList.add('flagged');button.dataset.count=cell.count;
      const label=showMine?'지뢰':cell.flag?'깃발':cell.open?cell.count?`주변 지뢰 ${cell.count}개`:'빈 칸':'닫힌 칸';button.setAttribute('aria-label',`${Math.floor(index/9)+1}행 ${index%9+1}열 ${label}`);button.setAttribute('aria-disabled',String(cell.open||['won','lost'].includes(game.state)));
    });
    const text=game.state==='lost'?'지뢰를 밟았어요. 새 게임으로 다시 도전하세요.':game.state==='won'?'성공! 모든 안전한 칸을 찾았습니다.':game.state==='ready'?'첫 번째로 여는 칸과 주변 칸은 안전합니다.':flagMode?'깃발 모드 · 칸을 눌러 깃발을 표시하세요.':'빈 칸을 열고 숫자를 단서로 지뢰를 피하세요.';if(message.textContent!==text)message.textContent=text;
  }
  mode.addEventListener('click',()=>{flagMode=!flagMode;mode.setAttribute('aria-pressed',String(flagMode));mode.textContent=flagMode?'깃발 모드 켜짐':'깃발 모드';render();});
  document.querySelector('#mines-reset').addEventListener('click',()=>{game=core.create();render();});render();
})();
