import { UnitType } from "../core/game/Game";
import { GameUpdateType, GameUpdateViewData } from "../core/game/GameUpdates";
import { GameView } from "../core/game/GameView";
import { translateText } from "./Utils";
import { TransformHandler } from "./graphics/TransformHandler";

export class WarshipDemoOverlay {
  private root: HTMLDivElement;
  private pathOverlay: SVGSVGElement;
  private cycle = 0;
  private currentWarshipID: number | undefined;
  private totalDiagonalSteps = 0;
  private cycleStartDiagonalSteps = 0;
  private completedCleanCycles = 0;
  private lastIllegalJump:
    | { from: number; to: number; dx: number; dy: number }
    | undefined;
  private lastStep = translateText("warship_demo.waiting");

  constructor(
    private game: GameView,
    private transform: TransformHandler,
  ) {
    this.pathOverlay = document.createElementNS(
      "http://www.w3.org/2000/svg",
      "svg",
    );
    this.pathOverlay.classList.add("warship-demo-path-overlay");
    this.pathOverlay.innerHTML = `
      <defs>
        <marker id="warship-demo-arrow" markerWidth="10" markerHeight="10" refX="8" refY="5" orient="auto">
          <path d="M 0 0 L 10 5 L 0 10 z"></path>
        </marker>
      </defs>
      <line data-demo-path marker-end="url(#warship-demo-arrow)"></line>
      <circle data-demo-path-start r="18"></circle>
      <circle data-demo-path-end r="18"></circle>
      <text data-demo-path-label></text>
    `;
    document.body.append(this.pathOverlay);

    this.root = document.createElement("div");
    this.root.className = "warship-demo-overlay";
    this.root.innerHTML = `
      <div class="warship-demo-header">
        <div>
          <div class="warship-demo-kicker">${translateText("warship_demo.kicker")}</div>
          <div class="warship-demo-title">${translateText("warship_demo.title")}</div>
        </div>
        <div class="warship-demo-badge">${translateText("warship_demo.baseline")}</div>
      </div>
      <div class="warship-demo-copy">${translateText("warship_demo.summary")}</div>
      <div class="warship-demo-metrics">
        <div><span>${translateText("warship_demo.cycle")}</span><strong data-demo-cycle>0</strong></div>
        <div><span>${translateText("warship_demo.distance")}</span><strong data-demo-distance>—</strong></div>
        <div><span>${translateText("warship_demo.last_step")}</span><strong data-demo-step>—</strong></div>
        <div><span>${translateText("warship_demo.diagonal_steps")}</span><strong data-demo-diagonals>0</strong></div>
        <div class="warship-demo-jump"><span>${translateText("warship_demo.last_illegal_jump")}</span><strong data-demo-jump>${translateText("warship_demo.none")}</strong></div>
      </div>
      <div class="warship-demo-status" data-demo-status>${translateText("warship_demo.arming")}</div>
      <div class="warship-demo-actions">
        <a href="https://github.com/openfrontio/OpenFrontIO/pull/3807" target="_blank" rel="noreferrer">PR #3807</a>
        <button type="button" data-demo-restart>${translateText("warship_demo.restart")}</button>
      </div>
    `;
    this.root
      .querySelector("[data-demo-restart]")
      ?.addEventListener("click", () => {
        window.location.assign("/?demo=warship-diagonal-chase");
      });
    document.body.append(this.root);
  }

  update(update: GameUpdateViewData): void {
    const warship = this.game.units(UnitType.Warship)[0];
    const tradeShip = this.game.units(UnitType.TradeShip)[0];

    if (warship !== undefined && warship.id() !== this.currentWarshipID) {
      if (
        this.currentWarshipID !== undefined &&
        this.totalDiagonalSteps === this.cycleStartDiagonalSteps
      ) {
        this.completedCleanCycles++;
      }
      this.currentWarshipID = warship.id();
      this.cycle++;
      this.cycleStartDiagonalSteps = this.totalDiagonalSteps;
      if (this.lastIllegalJump === undefined) {
        this.lastStep = translateText("warship_demo.waiting");
      }
    }

    for (const unit of update.updates[GameUpdateType.Unit]) {
      if (
        unit.unitType !== UnitType.Warship ||
        unit.id !== this.currentWarshipID ||
        unit.pos === unit.lastPos
      ) {
        continue;
      }
      const dx = this.game.x(unit.pos) - this.game.x(unit.lastPos);
      const dy = this.game.y(unit.pos) - this.game.y(unit.lastPos);
      if (dx !== 0 && dy !== 0) {
        this.totalDiagonalSteps++;
        this.lastIllegalJump = { from: unit.lastPos, to: unit.pos, dx, dy };
        this.lastStep = translateText("warship_demo.diagonal");
      } else {
        this.lastStep = translateText("warship_demo.cardinal");
      }
    }

    const separation =
      warship !== undefined && tradeShip !== undefined
        ? this.game.manhattanDist(warship.tile(), tradeShip.tile())
        : undefined;
    const captured =
      tradeShip !== undefined && tradeShip.owner() === this.game.myPlayer();
    const reproduced = this.totalDiagonalSteps > 0;
    const verifiedFixed =
      !reproduced && (captured || this.completedCleanCycles > 0);

    this.setText("[data-demo-cycle]", String(this.cycle));
    this.setText(
      "[data-demo-distance]",
      separation === undefined ? "—" : String(separation),
    );
    this.setText("[data-demo-step]", this.lastStep);
    this.setText("[data-demo-diagonals]", String(this.totalDiagonalSteps));
    this.setText(
      "[data-demo-jump]",
      this.lastIllegalJump === undefined
        ? translateText("warship_demo.none")
        : this.describeJump(this.lastIllegalJump),
    );
    this.setText(
      "[data-demo-status]",
      reproduced
        ? translateText("warship_demo.reproduced")
        : verifiedFixed
          ? translateText("warship_demo.fixed")
          : translateText("warship_demo.arming"),
    );
    this.root.dataset.state = reproduced
      ? "reproduced"
      : verifiedFixed
        ? "fixed"
        : "arming";
    this.renderIllegalJump();
  }

  dispose(): void {
    this.pathOverlay.remove();
    this.root.remove();
  }

  private describeJump(jump: {
    from: number;
    to: number;
    dx: number;
    dy: number;
  }): string {
    const sign = (value: number) => (value > 0 ? `+${value}` : String(value));
    return `(${this.game.x(jump.from)}, ${this.game.y(jump.from)}) → (${this.game.x(jump.to)}, ${this.game.y(jump.to)}), Δx=${sign(jump.dx)}, Δy=${sign(jump.dy)}`;
  }

  private renderIllegalJump(): void {
    const jump = this.lastIllegalJump;
    if (jump === undefined) return;

    const from = this.transform.worldToScreenCoordinates(
      this.game.cell(jump.from),
    );
    const to = this.transform.worldToScreenCoordinates(this.game.cell(jump.to));
    const line = this.pathOverlay.querySelector("[data-demo-path]");
    const start = this.pathOverlay.querySelector("[data-demo-path-start]");
    const end = this.pathOverlay.querySelector("[data-demo-path-end]");
    const label = this.pathOverlay.querySelector("[data-demo-path-label]");

    line?.setAttribute("x1", String(from.x));
    line?.setAttribute("y1", String(from.y));
    line?.setAttribute("x2", String(to.x));
    line?.setAttribute("y2", String(to.y));
    start?.setAttribute("cx", String(from.x));
    start?.setAttribute("cy", String(from.y));
    end?.setAttribute("cx", String(to.x));
    end?.setAttribute("cy", String(to.y));
    label?.setAttribute("x", String(to.x + 24));
    label?.setAttribute("y", String(to.y - 22));
    if (label !== null) {
      label.textContent = `ILLEGAL Δx=${jump.dx}, Δy=${jump.dy}`;
    }
    this.pathOverlay.classList.add("visible");
  }

  private setText(selector: string, value: string): void {
    const element = this.root.querySelector(selector);
    if (element !== null) element.textContent = value;
  }
}
