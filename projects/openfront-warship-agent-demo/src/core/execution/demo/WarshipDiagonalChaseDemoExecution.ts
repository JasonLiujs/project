import {
  Execution,
  Game,
  Player,
  PlayerType,
  Unit,
  UnitType,
} from "../../game/Game";
import { TileRef } from "../../game/GameMap";
import { WaterPathFinder } from "../../pathfinding/PathFinder";
import { WarshipExecution } from "../WarshipExecution";

type DemoTiles = {
  warship: TileRef;
  tradeShip: TileRef;
};

/**
 * Creates a repeatable, real-engine reproduction of the historical diagonal
 * chase bug. This is demo scaffolding only; the buggy WarshipExecution remains
 * untouched so a coding agent must fix the production algorithm.
 */
export class WarshipDiagonalChaseDemoExecution implements Execution {
  private game: Game;
  private hunter: Player;
  private trader: Player;
  private hunterPort: Unit;
  private traderPort: Unit;
  private warship: Unit | undefined;
  private tradeShip: Unit | undefined;
  private tiles: DemoTiles;
  private nextRoundAt = 0;

  init(game: Game): void {
    this.game = game;
  }

  tick(ticks: number): void {
    if (this.game.inSpawnPhase()) return;

    if (this.tiles === undefined) {
      this.initializeScenario();
      this.startRound(ticks);
      return;
    }

    if (this.warship?.isActive() && this.tradeShip?.isActive()) {
      const captured = this.tradeShip.owner() === this.hunter;
      const roundTimedOut = ticks >= this.nextRoundAt;
      if (!captured && !roundTimedOut) return;
    }

    this.cleanupRound();
    this.startRound(ticks);
  }

  isActive(): boolean {
    return true;
  }

  activeDuringSpawnPhase(): boolean {
    return false;
  }

  private initializeScenario(): void {
    const humans = this.game
      .players()
      .filter((player) => player.type() === PlayerType.Human);
    if (humans.length < 2) {
      throw new Error("Warship demo requires two human players");
    }

    [this.hunter, this.trader] = humans;
    const hunterPortTile =
      this.hunter.spawnTile() ?? this.hunter.tiles().values().next().value;
    const traderPortTile =
      this.trader.spawnTile() ?? this.trader.tiles().values().next().value;
    if (hunterPortTile === undefined || traderPortTile === undefined) {
      throw new Error("Warship demo players did not receive spawn tiles");
    }

    this.hunterPort = this.hunter.buildUnit(UnitType.Port, hunterPortTile, {});
    this.traderPort = this.trader.buildUnit(UnitType.Port, traderPortTile, {});
    this.tiles = this.findDiagonalPath();
  }

  private findDiagonalPath(): DemoTiles {
    const pathfinder = new WaterPathFinder(this.game);
    const offsets = [
      { x: 5, y: 10 },
      { x: -5, y: 10 },
      { x: 5, y: -10 },
      { x: -5, y: -10 },
      { x: 10, y: 5 },
      { x: 10, y: -5 },
    ];

    for (let y = 1; y < this.game.height() - 1; y++) {
      for (let x = 1; x < this.game.width() - 1; x++) {
        const start = this.game.ref(x, y);
        if (!this.game.isWater(start) || !this.game.isShoreline(start)) {
          continue;
        }

        for (const offset of offsets) {
          const targetX = x + offset.x;
          const targetY = y + offset.y;
          if (!this.game.isValidCoord(targetX, targetY)) continue;
          const target = this.game.ref(targetX, targetY);
          if (!this.game.isWater(target)) continue;

          const path = pathfinder.findPath(start, target);
          if (path === null || path.length < 2) continue;
          const hasDiagonalStep = path.some(
            (tile, index) =>
              index > 0 &&
              this.game.manhattanDist(path[index - 1], target) > 5 &&
              this.game.x(path[index - 1]) !== this.game.x(tile) &&
              this.game.y(path[index - 1]) !== this.game.y(tile),
          );
          if (hasDiagonalStep) {
            return { warship: start, tradeShip: target };
          }
        }
      }
    }

    throw new Error("No diagonal mini-map path found for warship demo");
  }

  private startRound(ticks: number): void {
    this.warship = this.hunter.buildUnit(UnitType.Warship, this.tiles.warship, {
      patrolTile: this.tiles.warship,
    });
    this.tradeShip = this.trader.buildUnit(
      UnitType.TradeShip,
      this.tiles.tradeShip,
      { targetUnit: this.traderPort, lastSetSafeFromPirates: -10_000 },
    );
    this.game.addExecution(new WarshipExecution(this.warship));
    this.nextRoundAt = ticks + 18;
  }

  private cleanupRound(): void {
    if (this.warship?.isActive()) this.warship.delete(false);
    if (this.tradeShip?.isActive()) this.tradeShip.delete(false);
  }
}
