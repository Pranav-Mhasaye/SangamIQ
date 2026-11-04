import { Cross, Droplet, Utensils, Toilet, Info, Bus } from 'lucide-react';

export const TYPE_META = {
  medical: { color: '#D62828', Icon: Cross, glyph: '+' },
  water: { color: '#1E7FD6', Icon: Droplet, glyph: '💧' },
  food: { color: '#E08A00', Icon: Utensils, glyph: '🍲' },
  toilet: { color: '#5B4FD6', Icon: Toilet, glyph: '🚻' },
  helpdesk: { color: '#F26B2A', Icon: Info, glyph: 'i' },
  transport: { color: '#4B5563', Icon: Bus, glyph: '🚌' },
};
export const TYPE_IDS = Object.keys(TYPE_META);

export const RISK_COLOR = { low: '#2E9E5B', moderate: '#E0A100', high: '#F26B2A', critical: '#C00000' };
