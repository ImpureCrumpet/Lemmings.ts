import { Game } from '../game';
import { getSkillControlAction } from '../controls/game-control-actions';
import { GameSkills } from '../game-play/game-skills';
import { GameTimer } from '../game-play/game-timer';
import { GameVictoryCondition } from '../game-play/game-victory-condition';
import { SkillTypes } from '../game-play/skill-types';
import { SkillPanelSprites } from '../resources/skill-panel-sprites';
import type { Position2D } from '../utilities/position2d';
import { DisplayImage } from './display-image';

/** handles the in-game-gui. e.g. the panel on the bottom of the game */
export class GameGui {

    private gameTimeChanged = true;
    private skillsCountChanged = true;
    private skillSelectionChanged = true;
    private backgroundChanged = true;

    private display?: DisplayImage;
    private deltaReleaseRate = 0;
    private panelScale = 1;
    private readonly handleMouseDown = (e?: Position2D) => {
        this.deltaReleaseRate = 0;
        if (e && e.y > 15 * this.panelScale) {
            this.handleSkillMouseDown(e.x);
        }
    };
    private readonly handleMouseUp = () => {
        this.deltaReleaseRate = 0;
    };
    private readonly handlePointerCancel = () => {
        this.deltaReleaseRate = 0;
    };
    private readonly handleDoubleClick = (e?: Position2D) => {
        this.deltaReleaseRate = 0;
        if (e && e.y > 15 * this.panelScale) {
            this.handleSkillDoubleClick(e.x);
        }
    };

    constructor(private game: Game,
        private skillPanelSprites: SkillPanelSprites,
        private skills: GameSkills,
        private gameTimer: GameTimer,
        private gameVictoryCondition: GameVictoryCondition) {

        gameTimer.onGameTick.on(() => {
            this.gameTimeChanged = true;
            this.doReleaseRateChanges();
        });

        skills.onCountChanged.on(() => {
            this.skillsCountChanged = true;
            this.backgroundChanged = true;
        });

        skills.onSelectionChanged.on(() => {
            this.skillSelectionChanged = true;
            this.backgroundChanged = true;
        })
    }

    private doReleaseRateChanges() {
        if (this.deltaReleaseRate == 0) {
            return;
        }

        if (this.deltaReleaseRate > 0) {
            this.game.performControlAction('release-rate-increase');
        }
        else {
            this.game.performControlAction('release-rate-decrease');
        }

    }

    /// handel click on the skills panel
    private handleSkillMouseDown(x: number) {
        const panelIndex = Math.trunc(x / (16 * this.panelScale));

        if (panelIndex == 0) {
            this.deltaReleaseRate = -1;
            this.doReleaseRateChanges();
            return;
        }
        if (panelIndex == 1) {

            this.deltaReleaseRate = 1;
            this.doReleaseRateChanges();
            return;
        }

        if (panelIndex == 10) {
            this.game.performControlAction('toggle-pause');
            return;
        }
        if (panelIndex == 11) {
            this.game.performControlAction('nuke');
            return;
        }

        const newSkill = this.getSkillByPanelIndex(panelIndex);
        if (newSkill == SkillTypes.UNKNOWN) return;

        const action = getSkillControlAction(newSkill);
        if (action) {
            this.game.performControlAction(action);
        }

        this.skillSelectionChanged = true;
    }


    public handleSkillDoubleClick(x: number) {
        const panelIndex = Math.trunc(x / (16 * this.panelScale));

        /// trigger the nuke for all lemmings
        if (panelIndex == 11) {
            this.game.performControlAction('nuke');
        }
    }

    /** init the display */
    public setGuiDisplay(display: DisplayImage) {
        this.detachDisplayHandlers();
        this.display = display;

        /// handle user input in gui
        this.display.onMouseDown.on(this.handleMouseDown);
        this.display.onMouseUp.on(this.handleMouseUp);
        this.display.onPointerCancel.on(this.handlePointerCancel);
        this.display.onDoubleClick.on(this.handleDoubleClick);


        this.gameTimeChanged = true;
        this.skillsCountChanged = true;
        this.skillSelectionChanged = true;
        this.backgroundChanged = true;
    }

    private detachDisplayHandlers(): void {
        this.display?.onMouseDown.off(this.handleMouseDown);
        this.display?.onMouseUp.off(this.handleMouseUp);
        this.display?.onPointerCancel.off(this.handlePointerCancel);
        this.display?.onDoubleClick.off(this.handleDoubleClick);
    }

    public dispose(): void {
        this.detachDisplayHandlers();
        this.display = undefined;
        this.deltaReleaseRate = 0;
    }


    /** render the gui to the screen display */
    public render() {
        if (!this.display) {
            return;
        }

        const display = this.display;

        /// background
        if (this.backgroundChanged) {
            this.backgroundChanged = false;

            const panelImage = this.skillPanelSprites.getPanelSprite();
            this.panelScale = this.skillPanelSprites.getScale();
            display.initSize(panelImage.width, panelImage.height);
            display.setBackground(panelImage.getData());

            /// redraw everything
            this.gameTimeChanged = true;
            this.skillsCountChanged = true;
            this.skillSelectionChanged = true;
        }

        /////////
        /// green text
        this.drawGreenString(display, 'Out ' + this.gameVictoryCondition.getOutCount() + '  ', 112, 0);
        this.drawGreenString(display, 'In' + this.stringPad(this.gameVictoryCondition.getSurvivorPercentage() + '', 3) + '%', 186, 0);

        if (this.gameTimeChanged) {
            this.gameTimeChanged = false;

            this.renderGameTime(display, 248, 0);
        }

        /////////
        /// white skill numbers
        this.drawPanelNumber(display, this.gameVictoryCondition.getMinReleaseRate(), 0);
        this.drawPanelNumber(display, this.gameVictoryCondition.getCurrentReleaseRate(), 1);

        if (this.skillsCountChanged) {
            this.skillsCountChanged = false;

            for (let i = 1 /* jump over unknown */; i < SkillTypes.length(); i++) {
                const count = this.skills.getSkill(i);
                this.drawPanelNumber(display, count, this.getPanelIndexBySkill(i));
            }
        }

        ////////
        /// selected skill
        if (this.skillSelectionChanged) {
            this.skillSelectionChanged = false;
            this.drawSelection(display, this.getPanelIndexBySkill(this.skills.getSelectedSkill()));
        }

    }

    /** left pad a string with spaces */
    private stringPad(str: string, length: number): string {
        if (str.length >= length) {
            return str;
        }

        return ' '.repeat(length - str.length) + str;
    }

    /** return the skillType for an index */
    private getSkillByPanelIndex(panelIndex: number): SkillTypes {
        switch (Math.trunc(panelIndex)) {
            case 2: return SkillTypes.CLIMBER;
            case 3: return SkillTypes.FLOATER;
            case 4: return SkillTypes.BOMBER;
            case 5: return SkillTypes.BLOCKER;
            case 6: return SkillTypes.BUILDER;
            case 7: return SkillTypes.BASHER;
            case 8: return SkillTypes.MINER;
            case 9: return SkillTypes.DIGGER;
            default: return SkillTypes.UNKNOWN;
        }
    }

    /** return the index for a skillType */
    private getPanelIndexBySkill(skill: SkillTypes): number {
        switch (skill) {
            case SkillTypes.CLIMBER: return 2;
            case SkillTypes.FLOATER: return 3;
            case SkillTypes.BOMBER: return 4;
            case SkillTypes.BLOCKER: return 5;
            case SkillTypes.BUILDER: return 6;
            case SkillTypes.BASHER: return 7;
            case SkillTypes.MINER: return 8;
            case SkillTypes.DIGGER: return 9;
            default: return -1;
        }
    }

    /** draw a white rectangle border to the panel */
    private drawSelection(display: DisplayImage, panelIndex: number) {
        display.drawRect(
            16 * panelIndex * this.panelScale,
            16 * this.panelScale,
            16 * this.panelScale,
            23 * this.panelScale,
            255,
            255,
            255,
            this.panelScale,
        );
    }

    /** draw the game time to the panel */
    private renderGameTime(display: DisplayImage, x: number, y: number) {
        const gameTime = this.gameTimer.getGameLeftTimeString();

        this.drawGreenString(display, 'Time ' + gameTime + '-00', x, y);
    }

    /** draw a white number to the skill-panel */
    private drawPanelNumber(display: DisplayImage, number: number, panelIndex: number) {
        this.drawNumber(display, number, 4 + 16 * panelIndex, 17);
    }

    /** draw a white number */
    private drawNumber(display: DisplayImage, number: number, x: number, y: number): number {

        if (number > 0) {
            const num1Img = this.skillPanelSprites.getNumberSpriteLeft(Math.floor(number / 10));
            const num2Img = this.skillPanelSprites.getNumberSpriteRight(number % 10);

            display.drawFrameCovered(
                num1Img,
                x * this.panelScale,
                y * this.panelScale,
                0,
                0,
                0,
                this.panelScale,
            );
            display.drawFrame(num2Img, x * this.panelScale, y * this.panelScale, this.panelScale);
        }
        else {
            const numImg = this.skillPanelSprites.getNumberSpriteEmpty();
            display.drawFrame(numImg, x * this.panelScale, y * this.panelScale, this.panelScale);
        }


        return x + 8;
    }

    /** draw a text with green letters */
    private drawGreenString(display: DisplayImage, text: string, x: number, y: number): number {

        for (let i = 0; i < text.length; i++) {

            const letterImg = this.skillPanelSprites.getLetterSprite(text[i]);

            if (letterImg != null) {
                display.drawFrameCovered(
                    letterImg,
                    x * this.panelScale,
                    y * this.panelScale,
                    0,
                    0,
                    0,
                    this.panelScale,
                );
            }

            x += 8;
        }

        return x;
    }
}
