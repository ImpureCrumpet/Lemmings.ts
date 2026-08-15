import { SkillTypes } from '../game-play/skill-types';

export const GAME_SKILL_CONTROLS = [
    { action: 'select-climber', skill: SkillTypes.CLIMBER, name: 'Climber', shortcut: '1' },
    { action: 'select-floater', skill: SkillTypes.FLOATER, name: 'Floater', shortcut: '2' },
    { action: 'select-bomber', skill: SkillTypes.BOMBER, name: 'Bomber', shortcut: '3' },
    { action: 'select-blocker', skill: SkillTypes.BLOCKER, name: 'Blocker', shortcut: '4' },
    { action: 'select-builder', skill: SkillTypes.BUILDER, name: 'Builder', shortcut: '5' },
    { action: 'select-basher', skill: SkillTypes.BASHER, name: 'Basher', shortcut: '6' },
    { action: 'select-miner', skill: SkillTypes.MINER, name: 'Miner', shortcut: '7' },
    { action: 'select-digger', skill: SkillTypes.DIGGER, name: 'Digger', shortcut: '8' },
] as const;

export type SkillControlAction = typeof GAME_SKILL_CONTROLS[number]['action'];

export type GameControlAction =
    | SkillControlAction
    | 'release-rate-decrease'
    | 'release-rate-increase'
    | 'toggle-pause'
    | 'focus-previous-lemming'
    | 'focus-next-lemming'
    | 'apply-selected-skill'
    | 'nuke'
    | 'cancel-nuke';

export type ViewControlAction =
    | GameControlAction
    | 'start'
    | 'previous-level'
    | 'next-level'
    | 'cycle-speed';

export function getSkillForControlAction(action: GameControlAction): SkillTypes {
    return GAME_SKILL_CONTROLS.find((control) => control.action === action)?.skill
        ?? SkillTypes.UNKNOWN;
}

export function getSkillControlAction(skill: SkillTypes): SkillControlAction | undefined {
    return GAME_SKILL_CONTROLS.find((control) => control.skill === skill)?.action;
}
