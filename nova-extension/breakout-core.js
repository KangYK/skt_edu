'use strict';
(function(root){
  const WIDTH=480,HEIGHT=320,RADIUS=6,PADDLE_WIDTH=82,PADDLE_Y=290;
  const clamp=(value,min,max)=>Math.max(min,Math.min(max,value));
  function serve(game){game.x=game.paddle+PADDLE_WIDTH/2;game.y=PADDLE_Y-RADIUS-2;game.vx=135;game.vy=-210;}
  function create(){
    const game={state:'ready',score:0,lives:3,paddle:(WIDTH-PADDLE_WIDTH)/2,bricks:[]};
    for(let row=0;row<4;row++)for(let col=0;col<8;col++)game.bricks.push({x:17+col*56,y:32+row*25,w:50,h:17,row,alive:true});
    serve(game);return game;
  }
  function move(game,center){game.paddle=clamp(center-PADDLE_WIDTH/2,0,WIDTH-PADDLE_WIDTH);if(['ready','serve'].includes(game.state))game.x=game.paddle+PADDLE_WIDTH/2;}
  function intersects(game,brick){return game.x+RADIUS>brick.x&&game.x-RADIUS<brick.x+brick.w&&game.y+RADIUS>brick.y&&game.y-RADIUS<brick.y+brick.h;}
  function step(game,dt){
    if(game.state!=='playing')return;
    const steps=Math.max(1,Math.ceil(Math.min(Math.max(dt,0),.05)*240)),delta=Math.min(Math.max(dt,0),.05)/steps;
    for(let i=0;i<steps;i++){
      const oldX=game.x,oldY=game.y;game.x+=game.vx*delta;game.y+=game.vy*delta;
      if(game.x<RADIUS){game.x=RADIUS;game.vx=Math.abs(game.vx);}if(game.x>WIDTH-RADIUS){game.x=WIDTH-RADIUS;game.vx=-Math.abs(game.vx);}if(game.y<RADIUS){game.y=RADIUS;game.vy=Math.abs(game.vy);}
      if(game.vy>0&&oldY+RADIUS<=PADDLE_Y&&game.y+RADIUS>=PADDLE_Y&&game.x+RADIUS>=game.paddle&&game.x-RADIUS<=game.paddle+PADDLE_WIDTH){
        const angle=clamp((game.x-game.paddle-PADDLE_WIDTH/2)/(PADDLE_WIDTH/2),-1,1)*1.05;
        const speed=Math.min(340,Math.hypot(game.vx,game.vy)+4);game.vx=Math.sin(angle)*speed;game.vy=-Math.cos(angle)*speed;game.y=PADDLE_Y-RADIUS;
      }
      for(const brick of game.bricks){
        if(!brick.alive||!intersects(game,brick))continue;
        brick.alive=false;game.score+=10;
        if(oldY+RADIUS<=brick.y||oldY-RADIUS>=brick.y+brick.h){game.vy=-game.vy;game.y=oldY;}
        else{game.vx=-game.vx;game.x=oldX;}
        if(game.bricks.every(b=>!b.alive)){game.state='won';return;}break;
      }
      if(game.y-RADIUS>HEIGHT){game.lives--;game.state=game.lives?'serve':'lost';serve(game);return;}
    }
  }
  const api={WIDTH,HEIGHT,RADIUS,PADDLE_WIDTH,PADDLE_Y,create,move,step};if(typeof module!=='undefined')module.exports=api;else root.BreakoutCore=api;
})(globalThis);
