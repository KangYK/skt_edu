'use strict';
(function(root){
  const SHAPES=[[[1,1,1,1]],[[1,1],[1,1]],[[0,1,0],[1,1,1]],[[0,1,1],[1,1,0]],[[1,1,0],[0,1,1]],[[1,0,0],[1,1,1]],[[0,0,1],[1,1,1]]];
  function take(game){
    if(!game.bag.length){game.bag=[0,1,2,3,4,5,6];for(let i=6;i>0;i--){const j=Math.floor(game.rng()*(i+1));[game.bag[i],game.bag[j]]=[game.bag[j],game.bag[i]];}}
    return game.bag.pop();
  }
  function fits(game,matrix,x,y){
    return matrix.every((row,dy)=>row.every((cell,dx)=>!cell||(x+dx>=0&&x+dx<10&&y+dy<20&&(y+dy<0||!game.board[y+dy][x+dx]))));
  }
  function spawn(game){const type=game.next;game.next=take(game);const matrix=SHAPES[type].map(row=>row.slice());game.piece={type,matrix,x:Math.floor((10-matrix[0].length)/2),y:0};if(!fits(game,matrix,game.piece.x,0))game.state='lost';}
  function create(rng=Math.random){const game={board:Array.from({length:20},()=>Array(10).fill(0)),score:0,lines:0,level:0,state:'ready',bag:[],rng};game.next=take(game);spawn(game);return game;}
  function move(game,dx){if(game.state!=='playing')return false;const p=game.piece;if(!fits(game,p.matrix,p.x+dx,p.y))return false;p.x+=dx;return true;}
  function rotate(game){
    if(game.state!=='playing')return false;const p=game.piece;
    const matrix=p.matrix[0].map((_,x)=>p.matrix.map(row=>row[x]).reverse());
    for(const offset of [0,-1,1,-2,2])if(fits(game,matrix,p.x+offset,p.y)){p.matrix=matrix;p.x+=offset;return true;}return false;
  }
  function lock(game){
    const p=game.piece;let overflow=false;
    p.matrix.forEach((row,dy)=>row.forEach((cell,dx)=>{if(cell){if(p.y+dy<0)overflow=true;else game.board[p.y+dy][p.x+dx]=p.type+1;}}));
    if(overflow){game.state='lost';return;}
    const remaining=game.board.filter(row=>row.some(cell=>!cell)),cleared=20-remaining.length;
    game.score+=[0,100,300,500,800][cleared]*(game.level+1);game.lines+=cleared;game.level=Math.floor(game.lines/10);
    game.board=[...Array.from({length:cleared},()=>Array(10).fill(0)),...remaining];spawn(game);
  }
  function drop(game,soft=false){if(game.state!=='playing')return false;const p=game.piece;if(fits(game,p.matrix,p.x,p.y+1)){p.y++;if(soft)game.score++;return true;}lock(game);return false;}
  function hardDrop(game){if(game.state!=='playing')return;const p=game.piece;while(fits(game,p.matrix,p.x,p.y+1)){p.y++;game.score+=2;}lock(game);}
  function ghostY(game){let y=game.piece.y;while(fits(game,game.piece.matrix,game.piece.x,y+1))y++;return y;}
  const api={SHAPES,create,fits,move,rotate,drop,hardDrop,ghostY};if(typeof module!=='undefined')module.exports=api;else root.TetrisCore=api;
})(globalThis);
