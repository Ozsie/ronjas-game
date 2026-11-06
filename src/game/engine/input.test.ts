import { describe, expect, it } from 'vitest';
import { createInputHarness, InputAction } from './input';

const keyEvent = (code: string, target?: unknown) => ({
  code,
  target: target ?? null,
  preventDefault: () => {},
});

describe('createInputHarness', () => {
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
