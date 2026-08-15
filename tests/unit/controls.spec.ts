import { afterEach, describe, expect, it, vi } from 'vitest';
import {
  getSkillControlAction,
  getSkillForControlAction,
} from '@/game/controls/game-control-actions';
import {
  getKeyboardAction,
  KeyboardControlManager,
  shouldIgnoreKeyboardEvent,
} from '@/game/controls/keyboard-controls';
import type { FrameScheduler } from '@/game/game-play/game-timer';
import { SkillTypes } from '@/game/game-play/skill-types';
import { Position2D } from '@/game/utilities/position2d';
import { DisplayImage } from '@/game/view/display-image';
import { Stage } from '@/game/view/stage';
import { UserInputManager } from '@/game/view/user-input-manager';
import { buildSyntheticGame } from '../fixtures/gameplay-fixtures';

class IdleFrameScheduler implements FrameScheduler {
  requestFrame(): number {
    return 1;
  }

  cancelFrame(): void {
    // No queued callback is needed for command-layer tests.
  }
}

class FakePointerElement extends EventTarget {
  readonly capturedPointers = new Set<number>();
  focus = vi.fn();

  getBoundingClientRect(): DOMRect {
    return {
      left: 5,
      top: 10,
      width: 100,
      height: 100,
      right: 105,
      bottom: 110,
      x: 5,
      y: 10,
      toJSON: () => ({}),
    };
  }

  setPointerCapture(pointerId: number): void {
    this.capturedPointers.add(pointerId);
  }

  hasPointerCapture(pointerId: number): boolean {
    return this.capturedPointers.has(pointerId);
  }

  releasePointerCapture(pointerId: number): void {
    this.capturedPointers.delete(pointerId);
  }
}

class FakeStageCanvas extends FakePointerElement {
  width = 800;
  height = 480;

  override getBoundingClientRect(): DOMRect {
    return {
      left: 0,
      top: 0,
      width: this.width,
      height: this.height,
      right: this.width,
      bottom: this.height,
      x: 0,
      y: 0,
      toJSON: () => ({}),
    };
  }

  getContext(): CanvasRenderingContext2D {
    return {
      canvas: this,
      fillRect: vi.fn(),
      fillStyle: '#000000',
    } as unknown as CanvasRenderingContext2D;
  }
}

interface PointerEventValues {
  pointerId: number;
  clientX: number;
  clientY: number;
  isPrimary?: boolean;
  button?: number;
  pointerType?: string;
}

function dispatchPointer(
  target: EventTarget,
  type: string,
  values: PointerEventValues,
): Event {
  const event = new Event(type, { cancelable: true });
  Object.defineProperties(event, {
    pointerId: { value: values.pointerId },
    clientX: { value: values.clientX },
    clientY: { value: values.clientY },
    isPrimary: { value: values.isPrimary ?? true },
    button: { value: values.button ?? 0 },
    pointerType: { value: values.pointerType ?? 'touch' },
  });
  target.dispatchEvent(event);
  return event;
}

function dispatchKeyboard(
  target: EventTarget,
  values: Partial<Pick<KeyboardEvent, 'altKey' | 'code' | 'ctrlKey' | 'metaKey' | 'repeat' | 'shiftKey'>>,
): Event {
  const event = new Event('keydown', { cancelable: true });
  Object.defineProperties(event, {
    altKey: { value: values.altKey ?? false },
    code: { value: values.code ?? 'KeyP' },
    ctrlKey: { value: values.ctrlKey ?? false },
    metaKey: { value: values.metaKey ?? false },
    repeat: { value: values.repeat ?? false },
    shiftKey: { value: values.shiftKey ?? false },
  });
  target.dispatchEvent(event);
  return event;
}

afterEach(() => {
  vi.useRealTimers();
  vi.unstubAllGlobals();
});

describe('named and keyboard controls', () => {
  it('maps every skill in both directions', () => {
    expect(getSkillForControlAction('select-climber')).toBe(SkillTypes.CLIMBER);
    expect(getSkillForControlAction('toggle-pause')).toBe(SkillTypes.UNKNOWN);
    expect(getSkillControlAction(SkillTypes.DIGGER)).toBe('select-digger');
    expect(getSkillControlAction(SkillTypes.UNKNOWN)).toBeUndefined();
  });

  it('resolves physical-key defaults without taking browser modifier shortcuts', () => {
    const noModifiers = { altKey: false, ctrlKey: false, metaKey: false, shiftKey: false };
    expect(getKeyboardAction({ ...noModifiers, code: 'Digit4' })).toBe('select-blocker');
    expect(getKeyboardAction({ ...noModifiers, code: 'ArrowRight' })).toBe('focus-next-lemming');
    expect(getKeyboardAction({ ...noModifiers, code: 'Enter' })).toBe('apply-selected-skill');
    expect(getKeyboardAction({ ...noModifiers, code: 'Equal', shiftKey: true })).toBe('release-rate-increase');
    expect(getKeyboardAction({ ...noModifiers, code: 'KeyP', ctrlKey: true })).toBeUndefined();
    expect(getKeyboardAction({ ...noModifiers, code: 'KeyP', shiftKey: true })).toBeUndefined();
  });

  it('skips repeat, editable, and native activation events and detaches cleanly', () => {
    class FakeHTMLElement extends EventTarget {
      isContentEditable = false;
    }
    class FakeInput extends FakeHTMLElement {}
    class FakeTextArea extends FakeHTMLElement {}
    class FakeSelect extends FakeHTMLElement {}
    class FakeButton extends FakeHTMLElement {}
    class FakeAnchor extends FakeHTMLElement {}
    vi.stubGlobal('HTMLElement', FakeHTMLElement);
    vi.stubGlobal('HTMLInputElement', FakeInput);
    vi.stubGlobal('HTMLTextAreaElement', FakeTextArea);
    vi.stubGlobal('HTMLSelectElement', FakeSelect);
    vi.stubGlobal('HTMLButtonElement', FakeButton);
    vi.stubGlobal('HTMLAnchorElement', FakeAnchor);

    expect(shouldIgnoreKeyboardEvent({
      code: 'KeyP',
      repeat: false,
      target: new FakeInput(),
    })).toBe(true);
    expect(shouldIgnoreKeyboardEvent({
      code: 'Enter',
      repeat: false,
      target: new FakeButton(),
    })).toBe(true);

    const target = new EventTarget();
    const actions = vi.fn();
    const controls = new KeyboardControlManager(target as Document, actions);
    dispatchKeyboard(target, { code: 'KeyP', repeat: true });
    expect(actions).not.toHaveBeenCalled();
    dispatchKeyboard(target, { code: 'KeyP' });
    expect(actions).toHaveBeenCalledOnce();
    expect(actions).toHaveBeenLastCalledWith('toggle-pause');
    controls.dispose();
    dispatchKeyboard(target, { code: 'KeyP' });
    expect(actions).toHaveBeenCalledOnce();
  });

  it('routes named controls through replay-aware commands', () => {
    const game = buildSyntheticGame({}, new IdleFrameScheduler());
    const actions: Array<string | undefined> = [];
    game.onControlAction.on((action) => actions.push(action));

    expect(game.performControlAction('select-miner')).toBe(true);
    expect(game.performControlAction('release-rate-increase')).toBe(true);
    expect(game.performControlAction('toggle-pause')).toBe(true);

    expect(game.getGameSkills().getSelectedSkill()).toBe(SkillTypes.MINER);
    expect(game.getVictoryCondition().getCurrentReleaseRate()).toBe(53);
    expect(game.getGameTimer().isRunning()).toBe(true);
    expect(game.getCommandManager().serialize()).toBe('0=s7&0=i3');
    expect(actions).toEqual(['select-miner', 'release-rate-increase', 'toggle-pause']);
    game.stop();
  });

  it('supports keyboard-style lemming targeting and records only the applied command', () => {
    const game = buildSyntheticGame({}, new IdleFrameScheduler());
    const manager = game.getLemmingManager();
    (manager as unknown as { addLemming(x: number, y: number): void }).addLemming(20, 20);

    expect(game.performControlAction('select-bomber')).toBe(true);
    expect(game.performControlAction('focus-next-lemming')).toBe(true);
    expect(game.getFocusedLemmingId()).toBe(0);
    expect(game.performControlAction('apply-selected-skill')).toBe(true);
    expect(game.getCommandManager().serialize()).toBe('0=s3&0=l0');
    expect(manager.getLemming(0)?.countdown).toBeGreaterThan(0);
    game.stop();
  });

  it('requires a second nuke action before recording or changing the level', () => {
    vi.useFakeTimers();
    vi.setSystemTime(1_000);
    const game = buildSyntheticGame({}, new IdleFrameScheduler());

    expect(game.performControlAction('nuke')).toBe(true);
    expect(game.isNukeConfirmationPending()).toBe(true);
    expect(game.getVictoryCondition().getLeftCount()).toBe(10);
    expect(game.getCommandManager().serialize()).toBe('');

    expect(game.performControlAction('nuke')).toBe(true);
    expect(game.isNukeConfirmationPending()).toBe(false);
    expect(game.getVictoryCondition().getLeftCount()).toBe(0);
    expect(game.getCommandManager().serialize()).toBe('0=n');
    game.stop();
  });

  it('expires or explicitly cancels an armed nuke', () => {
    vi.useFakeTimers();
    vi.setSystemTime(1_000);
    const game = buildSyntheticGame({}, new IdleFrameScheduler());

    game.performControlAction('nuke');
    vi.setSystemTime(5_001);
    expect(game.isNukeConfirmationPending()).toBe(false);

    game.performControlAction('nuke');
    expect(game.performControlAction('cancel-nuke')).toBe(true);
    expect(game.isNukeConfirmationPending()).toBe(false);
    expect(game.getCommandManager().serialize()).toBe('');
    game.stop();
  });
});

describe('pointer input', () => {
  it('captures one pointer and emits a tap only when it did not become a drag', () => {
    const element = new FakePointerElement();
    const input = new UserInputManager(element as unknown as HTMLElement);
    const taps = vi.fn();
    const moves: boolean[] = [];
    input.onTap.on(taps);
    input.onMouseMove.on((move) => moves.push(move?.button ?? false));

    dispatchPointer(element, 'pointerdown', { pointerId: 1, clientX: 15, clientY: 20 });
    expect(element.capturedPointers.has(1)).toBe(true);
    expect(element.focus).toHaveBeenCalledWith({ preventScroll: true });
    dispatchPointer(element, 'pointerup', { pointerId: 1, clientX: 15, clientY: 20 });
    expect(taps).toHaveBeenCalledOnce();
    expect(taps).toHaveBeenCalledWith(expect.objectContaining({ x: 10, y: 10 }));

    dispatchPointer(element, 'pointerdown', { pointerId: 2, clientX: 15, clientY: 20 });
    dispatchPointer(element, 'pointermove', { pointerId: 2, clientX: 25, clientY: 20 });
    dispatchPointer(element, 'pointerup', { pointerId: 2, clientX: 25, clientY: 20 });
    expect(taps).toHaveBeenCalledOnce();
    expect(moves).toContain(true);
    expect(element.capturedPointers.size).toBe(0);
    input.dispose();
  });

  it('does not report an active drag until movement crosses the threshold', () => {
    const element = new FakePointerElement();
    const input = new UserInputManager(element as unknown as HTMLElement);
    const moves: boolean[] = [];
    const taps = vi.fn();
    input.onMouseMove.on((move) => moves.push(move?.button ?? false));
    input.onTap.on(taps);

    dispatchPointer(element, 'pointerdown', { pointerId: 6, clientX: 15, clientY: 20 });
    dispatchPointer(element, 'pointermove', { pointerId: 6, clientX: 18, clientY: 20 });
    expect(moves).toEqual([false]);
    dispatchPointer(element, 'pointermove', { pointerId: 6, clientX: 21, clientY: 20 });
    expect(moves).toEqual([false, true]);
    dispatchPointer(element, 'pointerup', { pointerId: 6, clientX: 21, clientY: 20 });
    expect(taps).not.toHaveBeenCalled();
    input.dispose();
  });

  it('routes a tap through the stage region where the pointer was pressed', () => {
    const canvas = new FakeStageCanvas();
    const stage = new Stage(canvas as unknown as HTMLCanvasElement);
    const gameTap = vi.fn();
    const guiTap = vi.fn();
    stage.getGameDisplay().onTap.on(gameTap);
    stage.getGuiDisplay().onTap.on(guiTap);

    dispatchPointer(canvas, 'pointerdown', { pointerId: 7, clientX: 20, clientY: 379 });
    dispatchPointer(canvas, 'pointerup', { pointerId: 7, clientX: 20, clientY: 381 });

    expect(gameTap).toHaveBeenCalledOnce();
    expect(guiTap).not.toHaveBeenCalled();
    stage.dispose();
  });

  it('detaches an old game tap listener when that game stops', () => {
    const display = new DisplayImage({
      setGameViewPointPosition: vi.fn(),
    } as unknown as Stage);
    const oldGame = buildSyntheticGame({}, new IdleFrameScheduler());
    const nextGame = buildSyntheticGame({}, new IdleFrameScheduler());
    const oldAction = vi.spyOn(oldGame, 'applySelectedSkillToLemming');
    const nextAction = vi.spyOn(nextGame, 'applySelectedSkillToLemming');
    (oldGame.getLemmingManager() as unknown as { addLemming(x: number, y: number): void })
      .addLemming(20, 20);
    (nextGame.getLemmingManager() as unknown as { addLemming(x: number, y: number): void })
      .addLemming(20, 20);

    oldGame.setGameDisplay(display);
    oldGame.stop();
    nextGame.setGameDisplay(display);
    display.onTap.trigger(new Position2D(20, 15));

    expect(oldAction).not.toHaveBeenCalled();
    expect(nextAction).toHaveBeenCalledOnce();
    nextGame.stop();
  });

  it('rejects extra pointers and clears dragging after cancellation or lost capture', () => {
    const element = new FakePointerElement();
    const input = new UserInputManager(element as unknown as HTMLElement);
    const downs = vi.fn();
    const cancelled = vi.fn();
    const moves: boolean[] = [];
    input.onMouseDown.on(downs);
    input.onPointerCancel.on(cancelled);
    input.onMouseMove.on((move) => moves.push(move?.button ?? false));

    dispatchPointer(element, 'pointerdown', { pointerId: 3, clientX: 15, clientY: 20 });
    dispatchPointer(element, 'pointerdown', {
      pointerId: 4,
      clientX: 20,
      clientY: 20,
      isPrimary: false,
    });
    expect(downs).toHaveBeenCalledOnce();

    dispatchPointer(element, 'pointercancel', { pointerId: 3, clientX: 15, clientY: 20 });
    dispatchPointer(element, 'pointermove', { pointerId: 3, clientX: 16, clientY: 20 });
    expect(cancelled).toHaveBeenCalledOnce();
    expect(moves.at(-1)).toBe(false);

    dispatchPointer(element, 'pointerdown', { pointerId: 5, clientX: 15, clientY: 20 });
    dispatchPointer(element, 'lostpointercapture', { pointerId: 5, clientX: 15, clientY: 20 });
    expect(cancelled).toHaveBeenCalledTimes(2);
    input.dispose();
  });
});
