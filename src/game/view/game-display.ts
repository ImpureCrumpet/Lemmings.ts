import { Game } from '../game';
import { LemmingManager } from '../game-play/lemming-manager';
import { ObjectManager } from '../game-play/object-manager';
import { TriggerManager } from '../game-play/trigger-manager';
import { Level } from '../resources/level';
import { DisplayImage } from './display-image';

export class GameDisplay {

    private display?: DisplayImage;
    private readonly handleTap = (e?: { x: number; y: number }) => {
        if (!e) {
            return;
        }

        const lem = this.lemmingManager.getLemmingAt(e.x, e.y);
        if (!lem) {
            return;
        }

        this.game.applySelectedSkillToLemming(lem.id);
    };

    constructor(
        private game: Game,
        private level: Level,
        private lemmingManager: LemmingManager,
        private objectManager: ObjectManager,
        private triggerManager: TriggerManager) {
    }


    public setGuiDisplay(display: DisplayImage) {
        this.display?.onTap.off(this.handleTap);
        this.display = display;
        this.display.onTap.on(this.handleTap);
    }

    public dispose(): void {
        this.display?.onTap.off(this.handleTap);
        this.display = undefined;
    }


    public render() {
        if (!this.display) {
            return;
        }

        this.level.render(this.display);

        this.objectManager.render(this.display);

        this.lemmingManager.render(this.display);

        const focusedLemmingId = this.game.getFocusedLemmingId();
        const focusedLemming = focusedLemmingId === undefined
            ? undefined
            : this.lemmingManager.getLemming(focusedLemmingId);
        if (focusedLemming) {
            this.display.drawRect(
                focusedLemming.x - 6,
                focusedLemming.y - 12,
                12,
                16,
                255,
                255,
                0,
            );
        }
    }


    public renderDebug() {
        if (!this.display) {
            return;
        }

        this.lemmingManager.renderDebug(this.display);
        this.triggerManager.renderDebug(this.display);
    }

}
