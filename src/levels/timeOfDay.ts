import type { TimeOfDay } from './levelTypes';

export interface TimeOfDayProfile {
  overlayColor: number;
  overlayAlpha: number;
  glowColor: number;
  glowAlpha: number;
  mistAlpha: number;
}

export const TIME_OF_DAY_PROFILES: Record<TimeOfDay, TimeOfDayProfile> = {
  morning: {
    overlayColor: 0xffdca3,
    overlayAlpha: 0.08,
    glowColor: 0xfff3a8,
    glowAlpha: 0.12,
    mistAlpha: 0.10,
  },
  noon: {
    overlayColor: 0xffffff,
    overlayAlpha: 0,
    glowColor: 0xfff3a8,
    glowAlpha: 0.08,
    mistAlpha: 0.03,
  },
  afternoon: {
    overlayColor: 0xffb45c,
    overlayAlpha: 0.11,
    glowColor: 0xffe08a,
    glowAlpha: 0.16,
    mistAlpha: 0.05,
  },
  night: {
    overlayColor: 0x203f86,
    overlayAlpha: 0.26,
    glowColor: 0xfff1a0,
    glowAlpha: 0.34,
    mistAlpha: 0.02,
  },
};

export const isTimeOfDay = (value: string | null): value is TimeOfDay => (
  value === 'morning' || value === 'noon' || value === 'afternoon' || value === 'night'
);
