// Realtime input holds. The harness is a plain key-press router: it maps
// key codes to actions and tracks which actions are currently held —
// velocity is derived from the held set every update step, never from
// press events, so frame rate cannot change movement. The Svelte
// component (or a future touch layer) wires the DOM listeners; nothing
// here touches the DOM by itself, so tests feed stub events.

import { HeldActionState, isEditableTarget } from '@hoard-engine/input';

export const InputAction = {
  UP: 'up',
  DOWN: 'down',
  LEFT: 'left',
  RIGHT: 'right',
  USE: 'use',
} as const;

export type InputAction = (typeof InputAction)[keyof typeof InputAction];

export const isCollisionDebugToggleKey = (key: string, repeat: boolean) =>
  key === '§' && !repeat;

type KeyEventLike = {
  code: string;
  target?: unknown;
  preventDefault: () => void;
};

export const DEFAULT_KEY_BINDINGS: Record<string, InputAction> = {
  ArrowUp: InputAction.UP,
  KeyW: InputAction.UP,
  ArrowDown: InputAction.DOWN,
  KeyS: InputAction.DOWN,
  ArrowLeft: InputAction.LEFT,
  KeyA: InputAction.LEFT,
  ArrowRight: InputAction.RIGHT,
  KeyD: InputAction.RIGHT,
  Space: InputAction.USE,
  KeyE: InputAction.USE,
};

export type InputHarness = {
  handleKeyDown: (event: KeyEventLike) => void;
  handleKeyUp: (event: KeyEventLike) => void;
  isHeld: (action: InputAction) => boolean;
  heldActions: () => InputAction[];
  clear: () => void;
};

export const directionTowardPoint = (
  from: { x: number; y: number },
  target: { x: number; y: number },
): { x: number; y: number } => {
  const dx = target.x - from.x;
  const dy = target.y - from.y;
  const distance = Math.hypot(dx, dy);
  return distance === 0
    ? { x: 0, y: 0 }
    : { x: dx / distance, y: dy / distance };
};

export const createInputHarness = (
  bindings: Record<string, InputAction> = DEFAULT_KEY_BINDINGS,
): InputHarness => {
  const held = new HeldActionState<InputAction>();

  return {
    handleKeyDown: (event) => {
      const action = bindings[event.code];
      if (!action || isEditableTarget(event.target)) return;
      event.preventDefault();
      held.press(event.code, action);
    },
    handleKeyUp: (event) => {
      const action = bindings[event.code];
      if (!action) return;
      held.release(event.code);
    },
    isHeld: (action) => held.isHeld(action),
    heldActions: () => held.actions(),
    clear: () => {
      held.clear();
    },
  };
};
