import { Game } from '@/game/game';
import { LogHandler } from '@/game/utilities/log-handler';
import type { ICommand } from './command';

/** Increase the release rate */
export class CommandReleaseRateDecrease implements ICommand {

    private log = new LogHandler('CommandReleaseRateDecrease');
    private number: number;

    public constructor(number: number = 0) {
        this.number = number;
    }

    public getCommandKey(): string {
        return 'd';
    }

    /** load parameters for this command from serializer */
    load(values: number[]): boolean {
        if (values.length < 1) {
            this.log.log('Unable to process load');
            return false;
        }
        this.number = values[0];
        return true;
    }

    /** save parameters of this command to serializer */
    save(): number[] {
        return [this.number];
    }

    /** execute this command */
    execute(game: Game): boolean {
        const victoryConditions = game.getVictoryCondition();
        return victoryConditions.changeReleaseRate(-this.number);
    }
}
