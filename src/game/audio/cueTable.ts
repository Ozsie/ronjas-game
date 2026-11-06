// The sound-cue seam (the audio inversion drakriddarna uses): logic
// modules emit cue ids, never sample paths — this table and a browser
// adapter built on @hoard-engine/audio's SoundEffectManager translate
// them to assets. Logic stays headless and testable; swapping every
// sound file touches nothing but this table.
export type SoundCue =
  'playerStep' | 'blockedDoor' | 'menuOpen' | 'buildPlaced' | 'cropHarvested';

export const SOUND_CUE_TABLE: Record<SoundCue, string> = {
  playerStep: 'sfx/step.mp3',
  blockedDoor: 'sfx/blocked.mp3',
  menuOpen: 'sfx/menu.mp3',
  buildPlaced: 'sfx/build.mp3',
  cropHarvested: 'sfx/harvest.mp3',
};

// The port logic modules call into; the browser adapter (future: built on
// @hoard-engine/audio's SoundEffectManager) is the only implementation
// that reaches HTMLAudioElement.
export interface SoundCuePort {
  playCue: (cue: SoundCue) => void;
}

export const createNullSoundCuePort = (): SoundCuePort => ({
  playCue: () => {},
});
