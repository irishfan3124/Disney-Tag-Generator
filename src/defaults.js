import { TEMPLATE } from './template.js';

// Default settings reproduce the original stroller tag model.
export const DEFAULTS = {
  name: 'Smith',
  uppercase: true,
  topText: 'The',
  bottomText: 'Family',
  nameFont: 'chewy',
  scriptFont: 'pacifico',

  width: Math.round(TEMPLATE.width * 10) / 10,
  baseThickness: TEMPLATE.baseThickness,
  tileThickness: TEMPLATE.tileThickness,
  letterThickness: TEMPLATE.letterThickness,
  scriptThickness: TEMPLATE.tileThickness,

  tileStyle: 'alternating',
  tileRadius: 0,
  stickerWidth: 2.5,
  letterFill: 0.8,
  nameScale: 1,
  letterBold: 0,
  tilt: 0,
  bounce: 0,
  scriptScale: 1,
  scriptBold: 0,

  pattern: 'sparkle',
  layout: 'original',
  patternScale: 1,
  patternRotation: 0,
  mirrorPattern: true,
  slots: true,
  slotScale: 1,

  colors: ['#D3C5A3', '#F95D73', '#FCECD6', '#3B7DD8'],
  slotBase: 1,
  slotTileA: 2,
  slotTileB: 3,
  slotLetters: 1,
  slotScript: 2,

  bed: 256,
};
