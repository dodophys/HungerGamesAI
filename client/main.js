
/**
 * 繪製 13 * 13 個方格子背景，真像一塊塊綠豆糕
 */
var gridsContainer = document.getElementById('gridsContainer');
gridsContainer.style.height = '780px';
gridsContainer.style.width = '780px';
gridsContainer.innerHTML = new Array(13 * 13 + 1).join('<div></div>');

var grids = document.getElementById('gridsContainer').childNodes;
/**
 * 炸彈相關參數
 */
var myBombingPower = 1; // default value
var bombCount = 0;
var preparing = true;
/**
 * 使用一個陣列，儲存所有玩家的資訊
 */
var players = [];

/**
 * 遊戲開始了沒？
 */
var gameStarted = false;

players.getPlayerById = function (uuid) {
    for (var i = 0, len = this.length; i < len; i += 1)
    if (this[i] && this[i].id === uuid) return this[i];

    // 如果沒有這個人，則直接 create 出來
    var newPlayer = createPlayer();
    newPlayer.id = uuid;
    players.push(newPlayer);

    sendObjToServer({
        event: 'ask_player_info',
        playerid: newPlayer.id
    });

    newPlayer.elm = document.createElement('div');
    playersContainer.appendChild(newPlayer.elm);
    newPlayer.setX(360);
    newPlayer.setY(360);

    return newPlayer;
};

players.removePlayerById = function (uuid) {
    for (var i = 0, len = this.length; i < len; i += 1)
    if (this[i] && this[i].id === uuid) {
        var _target = this[i].elm;
        _target && _target.parentNode.removeChild(_target);
        return delete this[i];
    }
};

players.setPositionById = function (uuid, x, y) {
    var _player = this.getPlayerById(uuid);
    _player.setX(x);
    _player.setY(y);
};

players.updateInfoById = function (uuid, name, team) {
    var _player = players.getPlayerById(uuid);
    _player.name = name;
    _player.team = team;
};

function createPlayer() {
    // Private data field
    var _x = 0,
        _y = 0;
    return {
        id: null,
        elm: null,
        name: null,
        team: null,
        getX: function () {
            return _x;
        },
        getY: function () {
            return _y;
        },
        setX: function (x) {
            if (this.elm) this.elm.style.left = ((_x = parseInt(x, 10)) - 25) + 'px';
        },
        setY: function (y) {
            if (this.elm) this.elm.style.top = ((_y = parseInt(y, 10)) - 25) + 'px';
        }
    };
}

/**
 * 顯示自己
 */
var playersContainer = document.getElementById('playersContainer');
playersContainer.style.height = '780px';
playersContainer.style.width = '780px';
playersContainer.innerHTML = '<div id="thisPlayer"></div>';

var thisPlayerElm = document.getElementById('thisPlayer');
// 以下覆蓋掉 #playersContainer > div 之樣式規則對 #thisPlayerElm 的影響
thisPlayerElm.style.overflow = 'visible';
thisPlayerElm.style.position = 'absolute';
thisPlayerElm.style.zIndex = '200';
thisPlayerElm.style.height = '50px'; //<- mod
thisPlayerElm.style.width = '50px'; //<- mod
thisPlayerElm.style.opacity = '1';
thisPlayerElm.style.textAlign = 'center'; //<-mod
//thisPlayerElm.style.top = '100%';

var thisPlayer = createPlayer();
players.push(thisPlayer);
thisPlayer.elm = thisPlayerElm;
thisPlayer.setX(360);
thisPlayer.setY(360);


/**
 * 綁定鍵盤事件
 */
var keysPressed = []; // 記錄哪些按鍵正在被按著
var pressedSeq = []; // 依序記錄被按的 keyCodes
var KEYS = [];
KEYS[37] = KEYS[38] = KEYS[39] = KEYS[40] = true;

var bomblimit=0;
window.addEventListener('keydown', function (event) {
	var tkey = event.which;
	if(tkey===229)
		alert('警告：請切換至英文輸入法');
    if (!KEYS[tkey]) {
        if (tkey === 32 && gameStarted) { // 空白鍵
            if (!thisPlayer.dead && bombCount <= bomblimit) {
                putBomb(
                thisPlayer.id, Math.floor(thisPlayer.getX() / 60),
                Math.floor(thisPlayer.getY() / 60));
            }
        }
    }
    var ti = pressedSeq.indexOf(tkey);
    if (ti === -1) {
        if (pressedSeq.length !== 0) {
            keysPressed[pressedSeq[pressedSeq.length - 1]] = false;
        }
        pressedSeq.push(tkey);
        keysPressed[tkey] = true;
    }
});

window.addEventListener('keyup', function (event) {
    var tkey = event.which;
    if (!KEYS[tkey]) return;
    var ti = pressedSeq.indexOf(tkey);
    if (ti !== -1) {
        pressedSeq.splice(ti, 1);
    }
    keysPressed[tkey] = false;
    if (pressedSeq.length !== 0) {
        keysPressed[pressedSeq[pressedSeq.length - 1]] = true;
    }
});

window.addEventListener('blur', function (event) {
    keysPressed = [];
    pressedSeq = [];
});

/**
 * 根據哪一個按鍵被按下、以及當前的坐標，
 * 決定接下來應該移動到哪裡。
 */
var map;
var distancePerIteration = 5; // default 每次人物要移動的距離 (單位是 px)
var penetrate = false;
//var bomb_penetrate=false;
// 重新計算 thisPlayer 的坐標，如果座標有變化則回傳 true
// 否則回傳 false 代表不需要重新做一些事情...

/** [ BEGINNING ] section: position calculation  maintained by ping */

function recalculatePosition() {
    var oldX = thisPlayer.getX();
    var oldY = thisPlayer.getY();
    var newX = calculateNewValue(oldX, 37, 39); // LEFT, RIGHT
    var newY = calculateNewValue(oldY, 38, 40); // UP, DOWN
    var presGrid = gridCalc(oldX, oldY);
    var err = 25;

    if (map && !penetrate && map[presGrid].empty && near(newX, newY, err)) {
        var nGd0 = gridCalc(newX + err, newY + err); // right bottom
        var nGd1 = gridCalc(newX - err, newY + err); // left bottom
        var nGd2 = gridCalc(newX + err, newY - err); // right top
        var nGd3 = gridCalc(newX - err, newY - err); // left top
        thisPlayer.setX(oldX);
        thisPlayer.setY(oldY);
        // left pressed
        if (keysPressed[37]) {
            newX = oldX;
            if (!map[nGd1].empty && map[nGd3].empty && map[nGd2].empty) {
                newY = calculateNewValue(oldY, 37, 40);
            } //left top empty	
            else if (map[nGd1].empty && !map[nGd3].empty && map[nGd0].empty) {
                newY = calculateNewValue(oldY, 38, 37);
            } //left bot empty
            else return false;
        }
        // right pressed
        else if (keysPressed[39]) {
            newX = oldX;
            if (!map[nGd0].empty && map[nGd2].empty && map[nGd3].empty) {
                newY = calculateNewValue(oldY, 39, 40);
            } //right top empty	
            else if (map[nGd0].empty && !map[nGd2].empty && map[nGd1].empty) {
                newY = calculateNewValue(oldY, 38, 39);
            } //right bot empty
            else return false;
        }
        //up pressed
        else if (keysPressed[38]) {
            newY = oldY;
            if (!map[nGd3].empty && map[nGd2].empty &&map[nGd0].empty) {
                newX = calculateNewValue(oldX, 37, 38);
            } //right top empty	
            else if (map[nGd3].empty && !map[nGd2].empty&&map[nGd1].empty) {
                newX = calculateNewValue(oldX, 38, 39);
            } //left top empty
            else return false;
        }

        // down pressed
        else if (keysPressed[40]) {
            newY = oldY;
            if (!map[nGd1].empty && map[nGd0].empty&&map[nGd2].empty) {
                newX = calculateNewValue(oldX, 37, 40);
            } //right bot empty	
            else if (map[nGd1].empty && !map[nGd0].empty&&map[nGd3].empty) {
                newX = calculateNewValue(oldX, 40, 39);
            } //left bot empty
            else return false;
        }
    }

    var changed = false;
    if (newX !== oldX) {
        thisPlayer.setX(newX);
        changed = true;
    }

    if (newY !== oldY) {
        thisPlayer.setY(newY);
        changed = true;
    }
    return changed;
}

function calculateNewValue(value, keyCode1, keyCode2) {
    // 座標範圍是 25 ~ 755
    var BOUNDARY_LOWER = 25;
    var BOUNDARY_UPPER = 755;
    var value;
    if (keysPressed[keyCode1]) {
        value -= distancePerIteration;
    }
    if (keysPressed[keyCode2]) {
        value += distancePerIteration;
    }
    if (value < BOUNDARY_LOWER) {
        value = BOUNDARY_LOWER;
    } else if (value > BOUNDARY_UPPER) {
        value = BOUNDARY_UPPER;
    }
    return value;
}

function gridCalc(x, y) {
    if(x>=780) x = 779;
	else if( x < 0) x=0;
	if(y>=780) y = 779;
	else if(y<0) y=0;
	return 13 * Math.floor(y / 60) + Math.floor(x / 60);
}

function coordCalc(index) {
    return {
        x: index % 13 * 60 + 30,
        y: parseInt((index / 13), 10) * 60 + 30
    };
}

/** [    END    ] section: position calculation  maintained by ping */

/** [ BEGINNING ] section: repetion at 60Hz ( utility )*/

function main() {
    if (thisPlayer.dead) clearInterval(mainRep);

    // 重新計算坐標，如果沒變化，什麼事都別做
    if (!recalculatePosition()) {
        return;
    }

    // 將新的座標傳給 server
    sendObjToServer({
        event: 'player_position',
        x: thisPlayer.getX(),
        y: thisPlayer.getY()
    });

    var target_grid_id = gridCalc(thisPlayer.getX(), thisPlayer.getY());
	var nowpos=target_grid_id;
    
    myBlockColor(nowpos);
		
	for (var i = 0; i < 169; i += 1) {
        if (grids[target_grid_id].classList.contains('tool')) {
			if(grids[target_grid_id].tooltype===5)
				thisPlayerElm.classList.add('penetrate');
            grids[target_grid_id].classList.remove('tool');
            sendObjToServer({
                event: 'tool_disappeared_by_eaten',
                gridc: target_grid_id,
                tooltype: grids[target_grid_id].tooltype,
				eater:thisPlayer.id
            });
            grids[target_grid_id].tooltype = 0;
            grids[target_grid_id].innerHTML = '';
        }

        if (map[i] && map[i].type === 'empty' && !map[i].empty) 
			map[i].empty = true;
        /**
         * 有時 map[i].type === 'empty' 
         * but map[i].type === false, while reason unknown
         */
    }
}


/** [    END    ] section: repetion at 60Hz ( utility )*/

/** [ BEGINNING ] section: webSocket, message manipulation */
// WARNING: CRITICAL SECTION, NO EDITION WITHOUT PRIOR DECLARATION

/**
 * 和伺服器建立 WebSocket 連線
 * 以一個全域變數 ws 儲存連線物件
 */
var ws;

// 送資訊給 server
function sendObjToServer(obj) {
    // log(obj);
    ws && ws.send(JSON.stringify(obj));
}

function webSocketInit() {

    if (ws) return;

    ws = new WebSocket('ws://' + __wshost__ + '/', 'game-protocol');

    ws.onclose = function (event) {
        if(event.reason === 'error_game_started') {
          alert('錯誤：遊戲已開始');
        } else if(event.reason === 'game_end') {
          gameStarted = false;
          bomblimit = 0;
          myBombingPower = 1;
          penetrate = false;
          players = null;
          distancePerIteration = 5;
          clearInterval(mainRep);
          if(confirm('遊戲結束。重新載入？'))
				location.reload();
        }
        // log('WebSocket 關閉了。');
        ws = null;
        map = null;
		document.getElementById('buttondiv').innerHTML='<button 	id="connect-button">重新載入</button>';
		document.getElementById('buttondiv').addEventListener('click',function(){location.reload();});
    };

    ws.onopen = function () {
        // log('WebSocket 開啟了！');
        // 開啓連線以後，傳送自己的暱稱和隊伍給 server 知道
        sendObjToServer({
            event: 'update_player_info',
            name: thisPlayer.name,
            team: thisPlayer.team
        });
		document.getElementById('buttondiv').innerHTML='';
    };

    ws.onerror = function (event) {
      // console.log(event);
    }

    ws.onmessage = function (event) {

        // msg: 收到的字串
        // obj: 收到的物件 (由 JSON 轉成)
        var msg, obj;
        try {
            msg = event.data;
            obj = JSON.parse(msg);
        } catch (e) {}
        if (!obj) return;

        /***********
         * 來自伺服器的資料 <--- From server
         ***********/
        // log('<< WebSocket 收到訊息: ' + msg);
        if (obj.event === 'resp_variables') {
          window.serverVariables = obj.variables;
          // console.log('window.serverVariables');
          // console.log(obj.variables);
        } else if(obj.event === 'game_started') {
          countDown(3, document.getElementById('timer-preparing'));
		  setTimeout(function(){
		  gameStarted = true;
          mainRep = setInterval(main, 1000 / 60);
          // 3秒無敵
          setTimeout(function () {
            preparing = false;
          }, 3000);
			},3000);	  // 3000 milliseconds for preparing,
        } else if (obj.event === 'playerid') {
            /** it ends here */
            thisPlayer.id = obj.playerid;
            thisPlayer.image = obj.image;
            thisPlayer.elm.style.background = 'url(' + obj.image + ')';
        } else if (obj.event === 'player_position') {
            if (obj.playerid !== thisPlayer.id) {
                players.setPositionById(obj.playerid, obj.x, obj.y);
                
            }
        } else if (obj.event === 'player_offline') {
          if(obj.reason === 'just_offline') {
            players.removePlayerById(obj.playerid);
          }
        } else if (obj.event === 'resp_player_info') {
            //console.log(obj);
            players.updateInfoById(obj.playerid, obj.name, obj.team, obj.image);
        } else if (obj.event === 'map_initial') {
            map = obj.grids;
            if (map) for (var i = 0, len = map.length; i < len; i++) {
                if (map[i].type !== 'empty' && map[i].type !== 'bomb') grids[i].classList.add(map[i].type);
                if (map[i].type === 'tool') {
                     if (map[i].tool === 1) {
						grids[i].innerHTML = '<img src="speed_up.png" height="59px" width="59px"></img>';
					} else if (map[i].tool === 2) {
						grids[i].innerHTML = '<img src="speed_change.png" height="59px" width="59px"></img>';
					} else if (map[i].tool ===  3) {
						grids[i].innerHTML = '<img src="water_ball.png" height="59px" width="59px"></img>';
					} else if (map[i].tool ===  4) {
						grids[i].innerHTML = '<img src="bombpower.jpg" height="59px" width="59px"></img>';
					} else if (map[i].tool ===  5) {
						grids[i].innerHTML = '<img src="ufo_tool.png" height="59px" width="59px"></img>';
					} else if (map[i].tool ===  6) {
						grids[i].innerHTML = '<img src="alive.png" height="59px" width="59px"></img>';
					}
                }
            }
        } else if (obj.event === 'pos_initial') {
            var inipos = coordCalc(obj.pos);
            thisPlayer.setX(inipos.x);
            thisPlayer.setY(inipos.y);
            sendObjToServer({
                event: 'player_position',
                x: thisPlayer.getX(),
                y: thisPlayer.getY()
            });
        } else if (obj.event === 'player_list') { 
            for (var i = 0; i < obj.list.length; i++) {
                if (obj.list[i].playerid == thisPlayer.id) 
					continue;
                var _player = players.getPlayerById(obj.list[i].playerid);
                _player.setX(obj.list[i].x);
                _player.setY(obj.list[i].y);
                _player.image = obj.list[i].image;
                _player.elm.style.background = 'url(' + obj.list[i].image + ')';
                _player.elm.style.textAlign = 'center';
				_player.elm.innerHTML = '<div class="playername"><span>' + obj.list[i].name + '</span><br><span>' + obj.list[i].team + '</span></div>';
                
            }
        }
        /** bomb starts here */
        else if (obj.event === 'bomb_put') {
            var pos = obj.x + obj.y * 13;
            grids[pos].classList.add('bomb');
            map[pos].type = 'bomb';
			map[pos].empty=true;
			var chkleave = setInterval(function(){
				if(gridCalc(thisPlayer.getX()+25,thisPlayer.getY()+25)!==pos&&gridCalc(thisPlayer.getX()+25,thisPlayer.getY()-25)!==pos&&gridCalc(thisPlayer.getX()-25,thisPlayer.getY()+25)!==pos&&gridCalc(thisPlayer.getX()-25,thisPlayer.getY()-25)!==pos&&gridCalc(thisPlayer.getX()-25,thisPlayer.getY())!==pos&&gridCalc(thisPlayer.getX()+25,thisPlayer.getY())!==pos&&gridCalc(thisPlayer.getX(),thisPlayer.getY()-25)!==pos&&gridCalc(thisPlayer.getX(),thisPlayer.getY()+25)!==pos){
					map[pos].empty=false;
					clearInterval(chkleave);
				}
			},1000/60);
        } else if (obj.event === 'bomb_explode') {
            bombExplode(obj.bombPower, obj.x, obj.y);
        } else if (obj.event === 'player_bombed') {
            if (obj.playerid === thisPlayer.id) {
                thisPlayer.elm.style.opacity = 0.3;
                thisPlayer.dead = true;
            } else {
				players.getPlayerById(obj.playerid).elm.style.opacity=0.1;
			}
        } else if (obj.event === 'wall_vanish') {
            wall_vanish(obj.x, obj.y);
        } else if (obj.event === 'grid_bombed') {
            grid_bombed(obj.x, obj.y, true);
        }
        /** bomb ends here */
        /** tool starts here */
        else if (obj.event === 'tool_appeared') {
            grids[obj.grid].classList.add('tool');
            grids[obj.grid].tooltype = obj.tooltype;
            if (obj.tooltype === 1) {
                grids[obj.grid].innerHTML = '<img src="speed_up.png" height="59px" width="59px"></img>';
            } else if (obj.tooltype === 2) {
                grids[obj.grid].innerHTML = '<img src="speed_change.png" height="59px" width="59px"></img>';
            } else if (obj.tooltype === 3) {
                grids[obj.grid].innerHTML = '<img src="water_ball.png" height="59px" width="59px"></img>';
            } else if (obj.tooltype === 4) {
                grids[obj.grid].innerHTML = '<img src="bombpower.jpg" height="59px" width="59px"></img>';
            } else if (obj.tooltype === 5) {
				grids[obj.grid].innerHTML = '<img src="ufo_tool.png" height="59px" width="59px"></img>';
            } else if (obj.tooltype === 6) {
                grids[obj.grid].innerHTML = '<img src="alive.png" height="59px" width="59px"></img>';
            }
        }else if(obj.event === 'tool_disappeared_by_bombed') {
			grids[obj.bombedgrid].tooltype = 0;
			grids[obj.bombedgrid].innerHTML = '';
		
		}else if (obj.event === 'global_tool_disappeared') {
            if (grids[obj.glogrid].classList.contains('tool')) {
				if(obj.tooltype === 5)
				players.getPlayerById(obj.eater).elm.classList.add('penetrate');
                grids[obj.glogrid].classList.remove("tool");
                grids[obj.glogrid].tooltype = 0;
                grids[obj.glogrid].innerHTML = '';
            }
        } else if (obj.event === 'tool_eaten_type') {
			toolapply(obj);
            /** tool ends here */
        } else if (obj.event === 'ufo_removal'){
			if(obj.playerid!==thisPlayer.id)
				players.getPlayerById(obj.playerid).elm.classList.remove('penetrate');
		}
    };
}

// 連線按鈕，按下去以後搜集使用者資訊並建立 WebSocket 連線
// var connectBtn = document.getElementById('connect-button');
// connectBtn.addEventListener('click', function () {
//     if (ws) {
//         log('已經連線。');
//     } else {
//         var default_name = '<輸入您的暱稱>';
//         var default_team = '<輸入您的隊伍>';
// 
//         thisPlayer.name = prompt('您的暱稱', default_name);
//         if (!thisPlayer.name || thisPlayer.name === default_name) return;
// 
//         thisPlayer.team = prompt('您的隊伍', default_team);
//         if (!thisPlayer.team || thisPlayer.team === default_team) return;
// 
//         thisPlayer.elm.innerHTML = '<div style="position:relative; top:100%;">' + thisPlayer.name + '<br>' + thisPlayer.team + '</div>';
// 
//         log('嘗試建立 WebSocket 連線');
//         webSocketInit();
//     }
// });

// WARNING: CRITICAL SECTION, NO EDITION WITHOUT PRIOR DECLARATION
/** [    END    ] section: webSocket, message manipulation */

/** [ BEGINNING ] section: bomb manipulation  maintained by yan */

function putBomb(playerid, x, y) {
    var pos = x + y * 13;
	if (map[pos].type != 'bomb') {// disable repeat spcebar
        bombCount++;
        setTimeout(function(){bombCount--;}, 3000);
        var sss = {
            event: 'put_bomb',
            playerid: playerid,
            bombingPower: myBombingPower,
            x: x,
            y: y
        };
 
        sendObjToServer(sss);
        
    }
}

function bombExplode(bombPower, x, y) {
    var pos = x + y * 13;
	fireInTheHole(pos);
}

function grid_bombed(x, y, status) {
    if ((0 <= x && x <= 12) && (0 <= y && y <= 12)) {
        if (status) {
          grids[x + y * 13].classList.add('bombed');
          if (grids[x + y * 13].classList.contains('tool')){
            grids[x + y * 13].classList.remove('tool');
            sendObjToServer({
              event: 'tool_disappeared',
              gridc: (x + y * 13)
            });
          }
        } else {
          grids[x + y * 13].classList.remove('bombed');
        }
    }
    if (!preparing && (x === Math.floor(thisPlayer.getX() / 60) && y === Math.floor(thisPlayer.getY() / 60))) {
      sendObjToServer({
        event: 'player_bombed',
        playerid: thisPlayer.id
      });
    }
    if (status) {
      setTimeout(function(){
        grid_bombed(x,y, false);
      }, 500);
    }
}

function wall_vanish(x, y) {
  var pos = x + y * 13;

  wallBombard(pos);

}

function countDown(timeout, elm) {
  if(timeout > -1) {
    elm.innerHTML = timeout;
    setTimeout(function (){countDown(timeout-1, elm);}, 1000);
  } else {
    elm.innerHTML = '';
  }
}
function toolapply(obj) {
  if(obj.playerid!=thisPlayer.id)
    return;
  var type=obj.tooltype;
  if(type === 1) { //speed up
    if(distancePerIteration < 10) distancePerIteration += 1;
  } else if(type === 2) { // random speed change
    distancePerIteration = Math.floor(Math.random() * 9) + 2;
  } else if(type === 3) { //increase bomb
    if(bomblimit < 5) bomblimit += 1;
  } else if(type === 4) { //increase bomb power
    if(myBombingPower < 7) 
      myBombingPower += 1;
  } else if(type === 5) {
    if(penetrate)
      return;
    penetrate = true;
    setTimeout(function () {
      document.getElementById('timer-ufo-wrap').style.display = 'none';
      var loop = setInterval(
        function () {
          if(!near(thisPlayer.getX(), thisPlayer.getY(), 25)) {
            clearInterval(loop);
            penetrate = false;
            thisPlayerElm.classList.remove('penetrate');
            sendObjToServer({
              event:'ufo_removal',
              playerid: thisPlayer.id
            });
          }
        }, 1000 / 60); // penetration ending process
    },15000);
    document.getElementById('timer-ufo-wrap').style.display = 'block';
    countDown(15, document.getElementById('timer-ufo'));
    if(obj.playerid != thisPlayer.id) {
      players.getPlayerById(obj.playerid).elm.classList('penetrate');
    }
  } else if(type === 6) {
    if(preparing)
      return;
    preparing = true;
    document.getElementById('timer-alive-wrap').style.display = 'block';
    countDown(10, document.getElementById('timer-alive'));
    setTimeout(function () {
      document.getElementById('timer-alive-wrap').style.display = 'none';
      preparing = false;
    },
    10000);
  }
}

/** [    END    ] section: bomb manipulation  maintained by yan */

function wallBombard(pos){
  if (map[pos].type === 'vwall') {
    map[pos].type = 'empty';
    map[pos].empty = true;
    vwallvanish(pos);
  }
}

function vwallvanish(pos){
	grids[pos].classList.remove('vwall');
}
