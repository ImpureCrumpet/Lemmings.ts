import { GameResources } from './game-resources';
import { GameResult } from './game-result';
import { GameStateTypes } from './game-state-types';
import { CommandNuke } from './game-play/commands/command-nuke';
import { CommandLemmingsAction } from './game-play/commands/command-lemming-action';
import { CommandReleaseRateDecrease } from './game-play/commands/command-release-rate-decrease';
import { CommandReleaseRateIncrease } from './game-play/commands/command-release-rate-increase';
import { CommandSelectSkill } from './game-play/commands/command-select-skill';
import type { ICommand } from './game-play/commands/command';
import { CommandManager } from './game-play/commands/command-manager';
import { GameSkills } from './game-play/game-skills';
import { GameTimer, type FrameScheduler } from './game-play/game-timer';
import { GameVictoryCondition } from './game-play/game-victory-condition';
import { LemmingManager } from './game-play/lemming-manager';
import { ObjectManager } from './game-play/object-manager';
import { TriggerManager } from './game-play/trigger-manager';
import { LemmingsSprite } from './resources/lemmings-sprite';
import { Level } from './resources/level';
import { MaskProvider } from './resources/mask-provider';
import { ParticleTable } from './resources/particle-table';
import { SkillPanelSprites } from './resources/skill-panel-sprites';
import { EventHandler } from './utilities/event-handler';
import { LogHandler } from './utilities/log-handler';
import { DisplayImage } from './view/display-image';
import { GameDisplay } from './view/game-display';
import { GameGui } from './view/game-gui';
import { SkillTypes } from './game-play/skill-types';
import {
    getSkillForControlAction,
    type GameControlAction,
} from './controls/game-control-actions';

const RELEASE_RATE_STEP = 3;
const NUKE_CONFIRMATION_MS = 4_000;

/** provides an game object to control the game */
export class Game {

    private log: LogHandler = new LogHandler('Game');

    public level: Level;
    private triggerManager: TriggerManager;
    private lemmingManager: LemmingManager;
    private objectManager: ObjectManager;

    private gameVictoryCondition: GameVictoryCondition;

    private gameGui: GameGui;
    private guiDisplay: DisplayImage | null = null;

    private display: DisplayImage | null = null;
    private gameDisplay: GameDisplay;
    private gameTimer: GameTimer;
    private commandManager: CommandManager;

    private skills: GameSkills;
    private showDebug = false;
    private focusedLemmingId: number | undefined;
    private nukeConfirmationDeadline = 0;

    public onGameEnd = new EventHandler<GameResult>();
    public onControlAction = new EventHandler<GameControlAction>();

    private finalGameState: GameStateTypes = GameStateTypes.UNKNOWN;

    public constructor(
        level: Level,
        masks: MaskProvider, 
        lemSprite: LemmingsSprite,
        skillPanelSprites: SkillPanelSprites,
        frameScheduler?: FrameScheduler,
     ) {

        this.gameTimer = new GameTimer(level, frameScheduler);
        this.skills = new GameSkills(level);

        this.level = level;

        this.gameVictoryCondition = new GameVictoryCondition(level);
 
        this.commandManager = new CommandManager(this, this.gameTimer);

        this.gameTimer.onGameTick.on(() => {
            this.advanceSimulation();
        });

        this.gameTimer.onRenderFrame.on(() => {
            this.render();
        });

        this.triggerManager = new TriggerManager(this.gameTimer);
        this.triggerManager.addRange(level.triggers);


        /// setup Lemmings
        const particleTable = new ParticleTable(level.colorPalette);

        this.lemmingManager = new LemmingManager(level, lemSprite, this.triggerManager, this.gameVictoryCondition, masks, particleTable);

        /// setup gui
        this.gameGui = new GameGui(this, skillPanelSprites, this.skills, this.gameTimer, this.gameVictoryCondition);

        if (this.guiDisplay) {
            this.gameGui.setGuiDisplay(this.guiDisplay);
        }

        this.objectManager = new ObjectManager(this.gameTimer);
        this.objectManager.addRange(this.level.objects);

        this.gameDisplay = new GameDisplay(this, this.level, this.lemmingManager, this.objectManager, this.triggerManager);

        if (this.display) {
            this.gameDisplay.setGuiDisplay(this.display);
        }

    }

    public setGameDisplay(display: DisplayImage) {
        this.display = display;

        if (!this.gameDisplay) {
            return;
        }

        this.gameDisplay.setGuiDisplay(display);

        if (this.level) {
            this.display.setScreenPosition(this.level.screenPositionX, 0);
        }
        
     
    }

    public setGuiDisplay(display: DisplayImage) {
        this.guiDisplay = display;

        if (this.gameGui) {
            this.gameGui.setGuiDisplay(display);
        }
    }


    /** load a new game/level */
    public static async loadLevel(gameResources: GameResources, levelGroupIndex: number, levelIndex: number): Promise<Game | undefined> {

        // read level data
        const level = await gameResources.getLevel(levelGroupIndex, levelIndex);

        if (!level) {
            return;
        }

        /// request next resources
        const maskPromise = gameResources.getMasks();
        const lemPromise = gameResources.getLemmingsSprite(level.colorPalette);

        const results = await Promise.all([maskPromise, lemPromise]);

        // query gui elements
        const skillPanelSprites = await gameResources.getSkillPanelSprite(level.colorPalette);

        /// create the game
        return new Game(level, results[0], results[1], skillPanelSprites);

    }


    /** run the game */
    public start() {
        this.gameTimer.resume();
    }

    /** end the game */
    public stop() {
        if (this.gameTimer) {
            this.gameTimer.stop();
        }

        this.gameDisplay?.dispose();
        this.gameGui?.dispose();
        this.onGameEnd.dispose();
        this.onControlAction.dispose();
    }


    /** return the game Timer for this game */
    public getGameTimer(): GameTimer {
        return this.gameTimer;
    }

    /** increase the amount of skills */
    public cheat() {
        if (!this.skills) {
            return;
        }

        this.skills.cheat();
    }

    public getGameSkills(): GameSkills {
        return this.skills;
    }

    public getLemmingManager(): LemmingManager {
        return this.lemmingManager;
    }

    public getVictoryCondition(): GameVictoryCondition {
        return this.gameVictoryCondition;
    }

    public getCommandManager(): CommandManager {
        return this.commandManager;
    }

    public queueCommand(newCommand: ICommand): boolean {
        if (!this.commandManager) {
            return false;
        }

        return this.commandManager.queueCommand(newCommand);
    }

    /** Execute a named control action through the same replay-aware command path. */
    public performControlAction(action: GameControlAction): boolean {
        let accepted = false;
        const skill = getSkillForControlAction(action);

        if (skill !== SkillTypes.UNKNOWN) {
            accepted = this.queueCommand(new CommandSelectSkill(skill));
        } else {
            switch (action) {
                case 'release-rate-decrease':
                    accepted = this.queueCommand(new CommandReleaseRateDecrease(RELEASE_RATE_STEP));
                    break;
                case 'release-rate-increase':
                    accepted = this.queueCommand(new CommandReleaseRateIncrease(RELEASE_RATE_STEP));
                    break;
                case 'toggle-pause':
                    this.gameTimer.toggle();
                    accepted = true;
                    break;
                case 'focus-previous-lemming':
                    accepted = this.moveFocusedLemming(-1);
                    break;
                case 'focus-next-lemming':
                    accepted = this.moveFocusedLemming(1);
                    break;
                case 'apply-selected-skill':
                    return this.focusedLemmingId !== undefined
                        && this.applySelectedSkillToLemming(this.focusedLemmingId);
                case 'nuke':
                    if (this.lemmingManager.isNuking()) {
                        break;
                    }
                    if (!this.isNukeConfirmationPending()) {
                        this.nukeConfirmationDeadline = Date.now() + NUKE_CONFIRMATION_MS;
                        accepted = true;
                    } else {
                        this.nukeConfirmationDeadline = 0;
                        accepted = this.queueCommand(new CommandNuke());
                    }
                    break;
                case 'cancel-nuke':
                    accepted = this.cancelNukeConfirmation();
                    break;
            }
        }

        if (accepted) {
            this.onControlAction.trigger(action);
        }
        return accepted;
    }

    /** Apply the current skill to a lemming selected by canvas or keyboard. */
    public applySelectedSkillToLemming(lemmingId: number): boolean {
        const accepted = this.queueCommand(new CommandLemmingsAction(lemmingId));
        if (accepted) {
            this.focusedLemmingId = lemmingId;
            this.onControlAction.trigger('apply-selected-skill');
        }
        return accepted;
    }

    public isNukeConfirmationPending(): boolean {
        if (this.nukeConfirmationDeadline <= Date.now()) {
            this.nukeConfirmationDeadline = 0;
        }
        return this.nukeConfirmationDeadline > 0;
    }

    public cancelNukeConfirmation(): boolean {
        if (!this.isNukeConfirmationPending()) {
            return false;
        }
        this.nukeConfirmationDeadline = 0;
        return true;
    }

    public getFocusedLemmingId(): number | undefined {
        const lemming = this.focusedLemmingId === undefined
            ? undefined
            : this.lemmingManager.getLemming(this.focusedLemmingId);
        if (!lemming || lemming.isRemoved() || lemming.isDisabled()) {
            this.focusedLemmingId = undefined;
        }
        return this.focusedLemmingId;
    }

    private moveFocusedLemming(direction: -1 | 1): boolean {
        const available = this.lemmingManager.getLemmings()
            .filter((lemming) => !lemming.isRemoved() && !lemming.isDisabled());
        if (available.length === 0) {
            this.focusedLemmingId = undefined;
            return false;
        }

        const currentIndex = available.findIndex((lemming) => lemming.id === this.focusedLemmingId);
        const nextIndex = currentIndex < 0
            ? (direction > 0 ? 0 : available.length - 1)
            : (currentIndex + direction + available.length) % available.length;
        this.focusedLemmingId = available[nextIndex].id;
        this.render();
        return true;
    }

    /** enables / disables the display of debug information */
    public setDebugMode(vale: boolean) {
        this.showDebug = vale;
    }

    /** Advance the simulation by one fixed logical step. */
    private advanceSimulation() {
        this.runGameLogic();
        this.checkForGameOver();
    }

    /** return the current state of the game */
    public getGameState(): GameStateTypes {

        if ((!this.gameTimer) || (!this.gameVictoryCondition)) {
            return GameStateTypes.UNKNOWN;
        }

        /// if the game has finished return it's saved state
        if (this.finalGameState != GameStateTypes.UNKNOWN) {
            return this.finalGameState;
        }

        const hasWon = this.gameVictoryCondition.getSurvivorsCount() >= this.gameVictoryCondition.getNeedCount();

        /// are there any lemmings alive?
        if ((this.gameVictoryCondition.getLeftCount() <= 0) && (this.gameVictoryCondition.getOutCount() <= 0)) {
            if (hasWon) {
                return GameStateTypes.SUCCEEDED;
            }
            else {
                return GameStateTypes.FAILED_LESS_LEMMINGS;
            }
        }

        /// is the game out of time?
        if (this.gameTimer.getGameLeftTime() <= 0) {
            if (hasWon) {
                return GameStateTypes.SUCCEEDED;
            }
            else {
                return GameStateTypes.FAILED_OUT_OF_TIME;
            }

        }

        return GameStateTypes.RUNNING;

    }

    /** check if the game  */
    private checkForGameOver() {
        if (!this.gameVictoryCondition) {
            return;
        }

        if (this.finalGameState != GameStateTypes.UNKNOWN) {
            return;
        }

        const state = this.getGameState();

        if ((state != GameStateTypes.RUNNING) && (state != GameStateTypes.UNKNOWN)) {
            this.gameVictoryCondition.doFinalize();
            this.finalGameState = state;

            this.onGameEnd.trigger(new GameResult(this));
        }
    }

    /** run the game logic one step in time */
    private runGameLogic() {
        if (!this.lemmingManager) {
            this.log.log('level not loaded!');
            return;
        }

        this.lemmingManager.tick();
    }


    /** refresh display */
    private render() {
        if (this.gameDisplay) {
            this.gameDisplay.render();

            if (this.showDebug) {
                this.gameDisplay.renderDebug();
            }
        }

        if (this.gameGui) {
            this.gameGui.render();
        }

        if (this.guiDisplay) {
            this.guiDisplay.redraw();
        }
    }

}
