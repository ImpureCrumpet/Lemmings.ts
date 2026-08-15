import { Game } from '@/game/game';
import { GameTimer } from '../game-timer';
import type { ICommand } from './command';
import { CommandLemmingsAction } from './command-lemming-action';
import { CommandNuke } from './command-nuke';
import { CommandReleaseRateDecrease } from './command-release-rate-decrease';
import { CommandReleaseRateIncrease } from './command-release-rate-increase';
import { CommandSelectSkill } from './command-select-skill';

/** Manages live commands and deterministic replay playback. */
export class CommandManager {
    private runCommands: Record<number, ICommand[]> = {};
    private loggedCommands: Record<number, ICommand[]> = {};

    public constructor(private game: Game, private gameTimer: GameTimer) {
        this.gameTimer.onBeforeGameTick.on((tick?: number) => {
            if (tick == null) {
                return;
            }

            for (const command of this.runCommands[tick] ?? []) {
                this.queueCommand(command);
            }
        });
    }

    /** Replace the pending replay with commands parsed from a serialized replay. */
    public loadReplay(replayString: string): void {
        this.runCommands = {};
        if (replayString.trim().length === 0) {
            return;
        }

        for (const part of replayString.split('&')) {
            const separatorIndex = part.indexOf('=');
            if (separatorIndex < 1) {
                continue;
            }

            const tickValue = Number(part.slice(0, separatorIndex));
            if (!Number.isInteger(tickValue) || tickValue < 0) {
                continue;
            }

            const command = this.parseCommand(part.slice(separatorIndex + 1));
            if (command) {
                (this.runCommands[tickValue] ??= []).push(command);
            }
        }
    }

    /** Execute a command now and record it when the game accepts it. */
    public queueCommand(newCommand: ICommand): boolean {
        const currentTick = this.gameTimer.getGameTicks();

        if (!newCommand.execute(this.game)) {
            return false;
        }

        (this.loggedCommands[currentTick] ??= []).push(newCommand);
        return true;
    }

    /** Serialize accepted commands in canonical tick and insertion order. */
    public serialize(): string {
        const result: string[] = [];
        const ticks = Object.keys(this.loggedCommands).map(Number).sort((left, right) => left - right);

        for (const tick of ticks) {
            for (const command of this.loggedCommands[tick]) {
                result.push(`${tick}=${command.getCommandKey()}${command.save().join(':')}`);
            }
        }

        return result.join('&');
    }

    private commandFactory(type: string): ICommand | null {
        switch (type.toLowerCase()) {
            case 'l':
                return new CommandLemmingsAction();
            case 'n':
                return new CommandNuke();
            case 's':
                return new CommandSelectSkill();
            case 'i':
                return new CommandReleaseRateIncrease();
            case 'd':
                return new CommandReleaseRateDecrease();
            default:
                return null;
        }
    }

    private parseCommand(serializedCommand: string): ICommand | null {
        if (serializedCommand.length < 1) {
            return null;
        }

        const newCommand = this.commandFactory(serializedCommand.slice(0, 1));
        if (!newCommand) {
            return null;
        }

        const serializedValues = serializedCommand.slice(1);
        const values = serializedValues.length === 0
            ? []
            : serializedValues.split(':').map(Number);
        if (values.some((value) => !Number.isFinite(value))) {
            return null;
        }

        return newCommand.load(values) ? newCommand : null;
    }
}
