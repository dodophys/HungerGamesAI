import json
import gevent
import ws4py.client

from player import Player
from game_state import GameState
import util

thisPlayer_name = None


def handle_messages(event, data):
    state = GameState.current

    if event != 'player_position':
        print('[event] %s' % event)

    # General events
    if event == 'playerid':
        Player.thisPlayer_id = data['playerid']
        print('My player id is %s' % Player.thisPlayer_id)
        state.add_player(Player.thisPlayer_id, thisPlayer_name)

    elif event == 'map_initial':
        state.game_map.setGrids(data['grids'])

    elif event == 'game_started':
        state.start_game(data['already_started'])

    elif event == 'player_list':
        state.set_players(data['list'])

    elif event == 'pos_initial':
        state.me().setPos(data['pos'])

    elif event == 'player_position':
        playerid = data['playerid']
        state.players[playerid].setCoord(data['x'], data['y'])

    elif event == 'player_offline':
        playerid = data['playerid']
        state.players.pop(playerid, None)
        print('Player %s is offline\nPlayers: ' % playerid)
        state.dump_players()

    # bomb events
    elif event == 'bomb_put':
        state.game_map.bombPut(data['x'], data['y'], data['power'])
        murdererid = str(data['murdererid'])
        state.players[murdererid].putBomb()
        state.checkLeave(util.gridToPos(data['x'], data['y']))

    elif event == 'grid_bombed':
        state.game_map.gridBombed(data['x'], data['y'])

    elif event == 'wall_vanish':
        state.game_map.wallBombed(data['x'], data['y'])

    elif event == 'player_bombed':
        player_id = str(data['playerid'])
        state.players[player_id].bombed()
    elif event == 'bombing':
        murderer_id = str(data['murderer'])
        state.players[murderer_id].bombCount -= 1

    # tool events
    elif event == 'tool_appeared':
        state.game_map.toolAppeared(data['grid'], data['tooltype'])

    elif event == 'tool_disappeared':
        eater = data['eater']
        tooltype = data['tooltype']
        pos = data['glogrid']
        state.game_map.toolDisappeared(eater, tooltype, pos)

        if eater == 'bomb':
            return

        notInPenetrate = not state.me().penetrate
        state.players[eater].toolapply(tooltype)
        if Player.isMe2(eater) and tooltype == 5 and notInPenetrate:  # ufo
            util.loop.add_timed_task(15, state.checkLeaveWall)

    elif event == 'ufo_removal':
        player_id = str(data['playerid'])
        print("Player %s drops UFO" % player_id)
        state.players[player_id].penetrate = False

    else:
        print('Unknown data')
        print(data)


class WebSocketHandler(ws4py.client.WebSocketBaseClient):
    def __init__(self, _agent, AIname, addr, protocols):
        global thisPlayer_name
        super(WebSocketHandler, self).__init__(addr, protocols)

        self._th = gevent.Greenlet(self.run)
        self.agent = _agent

        thisPlayer_name = AIname

    def sendJson(self, data):
        if self.stream:
            self.send(json.dumps(data))
        else:
            print("Error: stream closed")

    def opened(self):
        self.sendJson({
            'event': 'update_player_info',
            'name': thisPlayer_name
        })

    def handshake_ok(self):
        self._th.start()

    def received_message(self, data):
        try:
            obj = json.loads(str(data))  # data is in fact a Message Object
        except:
            print('Invalid JSON from server: %s' % data)
            return
        if not isinstance(obj, dict) or 'event' not in obj:
            print('Invalid message from server')
            print(obj)
            return

        event = obj['event']
        handle_messages(event, obj)

        if GameState.current.game_started:
            util.loop.add_task(self.agent.once, GameState.current)

    def closed(self, code, reason=None):
        print("Closed down, code = %d, reason = %s" % (code, reason))

    def packet_consumer(self):
        while True:
            gevent.sleep(util.BASE_INTERVAL)
            obj = util.packet_queue.get()
            if not obj:
                break
            self.sendJson(obj)
