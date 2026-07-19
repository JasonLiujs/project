import { WarshipExecution } from "../src/core/execution/WarshipExecution";
import {
  Game,
  Player,
  PlayerInfo,
  PlayerType,
  UnitType,
} from "../src/core/game/Game";
import { GameUpdateType } from "../src/core/game/GameUpdates";
import { WaterPathFinder } from "../src/core/pathfinding/PathFinder";
import { setup } from "./util/Setup";

const coastX = 7;

describe("Warship diagonal chase regression", () => {
  let game: Game;
  let hunter: Player;
  let trader: Player;

  beforeEach(async () => {
    game = await setup(
      "half_land_half_ocean",
      { infiniteGold: true, instantBuild: true },
      [
        new PlayerInfo("Hunter", PlayerType.Human, null, "hunter"),
        new PlayerInfo("Trader", PlayerType.Human, null, "trader"),
      ],
    );

    while (game.inSpawnPhase()) {
      game.executeNextTick();
    }

    hunter = game.player("hunter");
    trader = game.player("trader");
  });

  test("uses only cardinal moves while closing on a nearby trade ship", () => {
    const pathfinder = new WaterPathFinder(game);
    let warshipTile: number | undefined;
    let tradeShipTile: number | undefined;
    game.forEachTile((start) => {
      if (warshipTile !== undefined || !game.isWater(start)) return;
      game.forEachTile((target) => {
        if (warshipTile !== undefined || !game.isWater(target)) return;
        const distance = game.manhattanDist(start, target);
        if (distance <= 5 || distance > 20) return;
        const path = pathfinder.findPath(start, target);
        if (
          path?.some(
            (tile, index) =>
              index > 0 &&
              game.manhattanDist(path[index - 1], target) > 5 &&
              game.x(path[index - 1]) !== game.x(tile) &&
              game.y(path[index - 1]) !== game.y(tile),
          )
        ) {
          warshipTile = start;
          tradeShipTile = target;
        }
      });
    });
    expect(warshipTile).toBeDefined();
    expect(tradeShipTile).toBeDefined();

    hunter.buildUnit(UnitType.Port, game.ref(coastX, 3), {});
    const warship = hunter.buildUnit(UnitType.Warship, warshipTile!, {
      patrolTile: warshipTile!,
    });
    const tradeShip = trader.buildUnit(UnitType.TradeShip, tradeShipTile!, {
      targetUnit: trader.buildUnit(UnitType.Port, game.ref(coastX, 13), {}),
    });

    const execution = new WarshipExecution(warship);
    const internals = execution as unknown as {
      findTargetUnit: () => typeof tradeShip | undefined;
    };
    vi.spyOn(internals, "findTargetUnit").mockReturnValue(tradeShip);
    game.addExecution(execution);

    const updateDeltas: Array<{ dx: number; dy: number }> = [];

    for (let tick = 0; tick < 10; tick++) {
      const updates = game.executeNextTick();
      for (const update of updates[GameUpdateType.Unit]) {
        if (update.id !== warship.id() || update.pos === update.lastPos) {
          continue;
        }
        updateDeltas.push({
          dx: game.x(update.pos) - game.x(update.lastPos),
          dy: game.y(update.pos) - game.y(update.lastPos),
        });
      }
      if (tradeShip.owner() === hunter) break;
    }

    expect(updateDeltas.some(({ dx, dy }) => dx !== 0 && dy !== 0)).toBe(false);
    expect(tradeShip.owner()).toBe(hunter);
  });
});
