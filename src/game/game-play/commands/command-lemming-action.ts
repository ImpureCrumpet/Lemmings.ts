import { Game } from '@/game/game';
import { LogHandler } from '@/game/utilities/log-handler';
import type { ICommand } from './command';

    /** Commands actions on lemmings the user has given */
    export class CommandLemmingsAction implements ICommand {

        private lemmingId: number;
        private log = new LogHandler('CommandLemmingsAction');

        public constructor(lemmingId: number = 0) {
            this.lemmingId = lemmingId;
        }

        public getCommandKey(): string {
            return 'l';
        }

        /** load parameters for this command from serializer */
        load(values: number[]): boolean {
            if (values.length < 1) {
                this.log.log('Unable to process load');
                return false;
            }
            this.lemmingId = values[0];
            return true;
        }

        /** save parameters of this command to serializer */
        save(): number[] {
            return [this.lemmingId];
        }

        /** execute this command */
        execute(game: Game): boolean {

            const lemManager = game.getLemmingManager();
            const lem = lemManager.getLemming(this.lemmingId);

            if (!lem) {
                this.log.log('Lemming not found! ' + this.lemmingId);
                return false;
            }

            const skills = game.getGameSkills();
            const selectedSkill = skills.getSelectedSkill();

            if (!skills.canDecreaseSkill(selectedSkill)) {
                this.log.log('Not enough skills!');
                return false;
            }


            /// set the skill
            if (!lemManager.doLemmingAction(lem, selectedSkill)) {
                this.log.log('unable to execute action on lemming!');
                return false;
            }

            /// reduce the available skill count
            return skills.decreaseSkill(selectedSkill);

        }
    }

