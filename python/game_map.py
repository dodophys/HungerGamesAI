import util
import texttable
from grid import Grid
import math
from direction import Direction

NEAR_ERR = 25  # half of the player width


class Map(object):

    def __init__(self):
        self.grids = [Grid() for i in util.grid_gen]  # indexed by pos

    def setGrids(self, remote_grids):
        for i in util.grid_gen:
            grid = self.grids[i]
            remote_grid = remote_grids[i]

            grid.grid_type = remote_grid['type']
            if grid.grid_type == 'tool':
                grid.tool = remote_grid['tool']
                toolname = util.tools_map[grid.tool]
                print('Initial tool %s at %s' % (toolname, util.gridStr(i)))
            elif grid.grid_type == Grid.BOMB:
                grid.bombPower = remote_grid['bombingPower']
                print('Initial bomb at %s, power = %d' % (util.gridStr(i), grid.bombPower))
        self.dumpGrids()

    def gridIs(self, gridPos, grid_type):
        return self.grids[gridPos].grid_type == grid_type

    def toolAppeared(self, pos, tooltype):
        grid = self.grids[pos]

        grid.grid_type = 'tool'
        grid.tool = tooltype
        toolname = util.tools_map[grid.tool]

        print('Tool %s appeared at %s' % (toolname, util.posToGrid(pos)))

        self.dumpGrids()

    def toolDisappeared(self, eater, tooltype, pos):
        grid = self.grids[pos]
        toolname = util.tools_map[grid.tool]

        print('Tool %s at %s disappeared' % (toolname, util.posToGrid(pos)))

        grid.grid_type = 'empty'
        grid.tool = None

        self.dumpGrids()

    def bombPut(self, gridX, gridY, power):
        pos = util.gridToPos(gridX, gridY)
        print('Bomb put at %s' % util.gridStr(pos))
        self.grids[pos].grid_type = Grid.BOMB
        self.grids[pos].bombPower = power
        self.dumpGrids()

    def gridBombed(self, gridX, gridY):
        pos = util.gridToPos(gridX, gridY)
        print('Grid at %s bombed' % util.gridStr(pos))
        self.grids[pos].grid_type = 'empty'
        self.dumpGrids()

    def wallBombed(self, gridX, gridY):
        pos = util.gridToPos(gridX, gridY)
        print('Wall at %s bombed' % util.gridStr(pos))
        # Grid settings already done in gridBombed()

    def bombsGen(self):
        for i in range(0, len(self.grids)):
            grid = self.grids[i]
            if grid.grid_type == Grid.BOMB:
                yield (i, grid)

    def bombCount(self):
        count = 0
        for i, grid in self.bombsGen():
            count += 1
        return count

    def eight_corners(self, x, y, half_side):
        corners = [
            (0, -half_side),
            (0, +half_side),
            (-half_side, 0),
            (+half_side, 0),
            (-half_side, -half_side),
            (+half_side, -half_side),
            (-half_side, +half_side),
            (+half_side, +half_side)
        ]
        return [(x+distance[0], y+distance[1]) for distance in corners]

    def near(self, x, y, passBomb=False, passWall=False, half_side=NEAR_ERR):
        for newX, newY in self.eight_corners(x, y, half_side):
            if not self.coordInMap(newX, newY):
                return True
            grid_type = self.grids[util.coordToPos(newX, newY)].grid_type
            if grid_type == 'bomb' and passBomb:
                continue
            if (grid_type == 'nvwall' or grid_type == 'vwall') and passWall:
                continue
            if grid_type != 'empty' and grid_type != 'tool':
                return True
        return False

    def nearPos(self, x, y, pos, half_side=NEAR_ERR):
        for newX, newY in self.eight_corners(x, y, half_side):
            if util.coordToPos(newX, newY) == pos:
                return True
        return False

    @staticmethod
    def gridInMap(gridX, gridY):
        return ((gridX >= 0 and gridX < util.map_dimension) and
                (gridY >= 0 and gridY < util.map_dimension))

    @staticmethod
    def coordInMap(x, y):
        return ((x >= 0 and x < util.map_pixelwidth) and
                (y >= 0 and y < util.map_pixelwidth))

    def dumpGrids(self):

        def _transform(string):
            if len(string) > 4:
                return string[0:2] + '\n' + string[2:4]
            elif len(string) > 2:
                return string[0:2] + '\n' + string[2:]
            else:
                return string

        strings = self.gridStrings()
        gridStrings = [_transform(strings[pos]) for pos in util.grid_gen]

        table = texttable.Texttable()
        table.add_rows(util.linearGridToMap(gridStrings))
        # print(table.draw())

    def gridStrings(self):
        return [str(self.grids[pos]) for pos in util.grid_gen]

    def safeMap(self):
        safe_map = util.linearGridToMap([True for i in util.grid_gen])

        def __markAsUnsafe(gridX, gridY):
            if not self.gridInMap(gridX, gridY):
                return
            safe_map[gridX][gridY] = False

        for i, grid in self.bombsGen():
            gridX, gridY = util.posToGrid(i)
            for direction in Direction.ALL:
                if direction == Direction.STOP:
                    __markAsUnsafe(gridX, gridY)
                else:
                    for i in range(0, grid.bombPower):
                        distance = Direction.distances[direction]
                        newX = gridX + distance[0] * (i+1)
                        newY = gridY + distance[1] * (i+1)
                        __markAsUnsafe(newX, newY)

        return safe_map

    @staticmethod
    def manhattan(coord1, coord2):
        return abs(coord1[0] - coord2[0]) + abs(coord1[1] - coord2[1])

    @staticmethod
    def euclidean(coord1, coord2):
        dx = coord1[0] - coord2[0]
        dy = coord1[1] - coord2[1]
        return math.sqrt(dx * dx + dy * dy)
