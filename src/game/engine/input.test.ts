import { describe, expect, it } from 'vitest';
import {
  createInputHarness,
  directionTowardPoint,
  InputAction,
  isCollisionDebugToggleKey,
} from './input';

const keyEvent = (code: string, target?: unknown) => ({
  code,
  target: target ?? null,
  preventDefault: () => {},
});

describe('collision debug shortcut', () => {
  it('recognizes § once per key press', () => {
    expect(isCollisionDebugToggleKey('§', false)).toBe(true);
    expect(isCollisionDebugToggleKey('§', true)).toBe(false);
    expect(isCollisionDebugToggleKey('`', false)).toBe(false);
  });
});

describe('createInputHarness', () => {
  it('returns a normalized direction toward a target point', () => {
    expect(directionTowardPoint({ x: 2, y: 3 }, { x: 5, y: 7 })).toEqual({
      x: 0.6,
      y: 0.8,
    });
    expect(directionTowardPoint({ x: 2, y: 3 }, { x: 2, y: 3 })).toEqual({
      x: 0,
      y: 0,
    });
  });

  it('tracks held actions between keydown and keyup', () => {
    const input = createInputHarness();
    input.handleKeyDown(keyEvent('KeyW'));
    expect(input.isHeld(InputAction.UP)).toBe(true);
    input.handleKeyUp(keyEvent('KeyW'));
    expect(input.isHeld(InputAction.UP)).toBe(false);
  });

  it('supports bound alternates for the same action', () => {
    const input = createInputHarness();
    input.handleKeyDown(keyEvent('ArrowUp'));
    input.handleKeyUp(keyEvent('ArrowUp'));
    input.handleKeyDown(keyEvent('KeyW'));
    expect(input.isHeld(InputAction.UP)).toBe(true);
  });

  it('keeps an action held until every bound key is released', () => {
    const input = createInputHarness();
    input.handleKeyDown(keyEvent('ArrowUp'));
    input.handleKeyDown(keyEvent('KeyW'));
    input.handleKeyUp(keyEvent('ArrowUp'));
    expect(input.isHeld(InputAction.UP)).toBe(true);
    input.handleKeyUp(keyEvent('KeyW'));
    expect(input.isHeld(InputAction.UP)).toBe(false);
  });

  it('ignores keys with no binding', () => {
    const input = createInputHarness();
    input.handleKeyDown(keyEvent('F5'));
    expect(input.heldActions()).toEqual([]);
  });

  it('ignores typing in editable targets', () => {
    const input = createInputHarness();
    input.handleKeyDown(keyEvent('KeyW', { tagName: 'INPUT' }));
    expect(input.isHeld(InputAction.UP)).toBe(false);
  });

  it('clears all held actions', () => {
    const input = createInputHarness();
    input.handleKeyDown(keyEvent('KeyA'));
    input.handleKeyDown(keyEvent('KeyD'));
    input.clear();
    expect(input.heldActions()).toEqual([]);
  });
});
