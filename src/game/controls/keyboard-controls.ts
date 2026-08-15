import type { ViewControlAction } from './game-control-actions';

export type KeyboardBindings = Readonly<Record<string, ViewControlAction>>;

/**
 * Physical-key defaults avoid keyboard-layout surprises and form the settings
 * model that can be overridden without changing the action implementation.
 */
export const DEFAULT_KEYBOARD_BINDINGS: KeyboardBindings = Object.freeze({
    Digit1: 'select-climber',
    Digit2: 'select-floater',
    Digit3: 'select-bomber',
    Digit4: 'select-blocker',
    Digit5: 'select-builder',
    Digit6: 'select-basher',
    Digit7: 'select-miner',
    Digit8: 'select-digger',
    Minus: 'release-rate-decrease',
    Equal: 'release-rate-increase',
    KeyP: 'toggle-pause',
    KeyS: 'start',
    BracketLeft: 'previous-level',
    BracketRight: 'next-level',
    KeyX: 'cycle-speed',
    ArrowLeft: 'focus-previous-lemming',
    ArrowRight: 'focus-next-lemming',
    Enter: 'apply-selected-skill',
    KeyN: 'nuke',
    Escape: 'cancel-nuke',
});

const NON_BINDABLE_KEY_CODES = new Set([
    'AltLeft',
    'AltRight',
    'CapsLock',
    'ContextMenu',
    'ControlLeft',
    'ControlRight',
    'MetaLeft',
    'MetaRight',
    'NumLock',
    'Eject',
    'Fn',
    'FnLock',
    'Power',
    'PrintScreen',
    'ScrollLock',
    'ShiftLeft',
    'ShiftRight',
    'Sleep',
    'Tab',
    'WakeUp',
]);

const NON_BINDABLE_KEY_PREFIXES = ['AudioVolume', 'Browser', 'Launch', 'Media'];

/** Keep browser navigation and modifier/lock keys available to the page and OS. */
export function isBindableKeyboardCode(code: string): boolean {
    return code.length > 0
        && !NON_BINDABLE_KEY_CODES.has(code)
        && !NON_BINDABLE_KEY_PREFIXES.some((prefix) => code.startsWith(prefix));
}

export function isEditableKeyboardTarget(target: EventTarget | null): boolean {
    if (typeof HTMLElement === 'undefined' || !(target instanceof HTMLElement)) {
        return false;
    }

    return target.isContentEditable
        || (typeof HTMLInputElement !== 'undefined' && target instanceof HTMLInputElement)
        || (typeof HTMLTextAreaElement !== 'undefined' && target instanceof HTMLTextAreaElement)
        || (typeof HTMLSelectElement !== 'undefined' && target instanceof HTMLSelectElement);
}

function isNativeActivationTarget(target: EventTarget | null): boolean {
    return (typeof HTMLButtonElement !== 'undefined' && target instanceof HTMLButtonElement)
        || (typeof HTMLAnchorElement !== 'undefined' && target instanceof HTMLAnchorElement);
}

export function shouldIgnoreKeyboardEvent(
    event: Pick<KeyboardEvent, 'code' | 'repeat' | 'target'>,
): boolean {
    return event.repeat
        || isEditableKeyboardTarget(event.target)
        || (event.code === 'Enter' && isNativeActivationTarget(event.target));
}

export function getKeyboardAction(
    event: Pick<KeyboardEvent, 'altKey' | 'code' | 'ctrlKey' | 'metaKey' | 'shiftKey'>,
    bindings: KeyboardBindings = DEFAULT_KEYBOARD_BINDINGS,
): ViewControlAction | undefined {
    if (event.altKey || event.ctrlKey || event.metaKey || !isBindableKeyboardCode(event.code)) {
        return undefined;
    }

    // Shift is accepted for whichever physical key increases the release rate,
    // so a remapped + shortcut keeps the same behaviour.
    if (event.shiftKey && bindings[event.code] !== 'release-rate-increase') {
        return undefined;
    }

    return bindings[event.code];
}

export class KeyboardControlManager {
    private readonly eventController = new AbortController();

    public constructor(
        target: Document,
        handleAction: (action: ViewControlAction) => void,
        bindings: KeyboardBindings = DEFAULT_KEYBOARD_BINDINGS,
    ) {
        target.addEventListener('keydown', (event) => {
            if (shouldIgnoreKeyboardEvent(event)) {
                return;
            }

            const action = getKeyboardAction(event, bindings);
            if (!action) {
                return;
            }

            event.preventDefault();
            handleAction(action);
        }, { signal: this.eventController.signal });
    }

    public dispose(): void {
        this.eventController.abort();
    }
}
