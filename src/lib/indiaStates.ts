import { STATE_NAMES } from './gst';

/**
 * Turning a screen's stored location into a state the map can shade.
 *
 * Add Screen writes `location` as "City, State" (see AddScreenFlow), with the
 * state picked from the same canonical list the GST code uses — so the state
 * is already structured and does not have to be guessed from a place name.
 * Screens added before that flow, or imported another way, can hold anything,
 * which is why resolution is allowed to fail and the caller counts what it
 * could not place rather than dropping it.
 */

/**
 * Where the map's names differ from the GST list's. The map predates two
 * reorganisations: Ladakh was separated from Jammu and Kashmir in 2019, and
 * Dadra and Nagar Haveli merged with Daman and Diu in 2020. Those territories
 * are therefore shaded on the shape that still contains them, which is the
 * honest option — the alternative is silently losing their screens.
 */
const MAP_NAME_BY_STATE: Record<string, string> = {
  'Ladakh': 'Jammu and Kashmir',
  'Dadra and Nagar Haveli and Daman and Diu': 'Dadra and Nagar Haveli',
};

/** Names in the GST list that the map draws under a different name. */
export function mapNameFor(state: string): string {
  return MAP_NAME_BY_STATE[state] || state;
}

const normalise = (s: string) => s.toLowerCase().replace(/[^a-z]/g, '');

// Every canonical state, plus the shorthands people actually type. Built once:
// this is consulted per screen.
const BY_NORMALISED = new Map<string, string>();
for (const name of STATE_NAMES) BY_NORMALISED.set(normalise(name), name);
for (const [alias, canonical] of Object.entries({
  'Orissa': 'Odisha',
  'Pondicherry': 'Puducherry',
  'Uttaranchal': 'Uttarakhand',
  'NCT of Delhi': 'Delhi',
  'New Delhi': 'Delhi',
  'J&K': 'Jammu and Kashmir',
  'Tamilnadu': 'Tamil Nadu',
})) BY_NORMALISED.set(normalise(alias), canonical);

/**
 * The state a location string names, or '' when it names none.
 *
 * Reads the segments right to left because the state is written last
 * ("Kalyani Nagar, Pune, Maharashtra"), and a city can share a name with a
 * state — "Mumbai, Maharashtra" must resolve on Maharashtra, but so must a
 * lone "Maharashtra". A location with no comma is still checked, so a screen
 * whose location is just "Karnataka" is placed rather than counted as unknown.
 */
export function stateFromLocation(location?: string): string {
  const raw = String(location || '').trim();
  if (!raw) return '';
  const parts = raw.split(',').map(p => p.trim()).filter(Boolean);
  for (let i = parts.length - 1; i >= 0; i--) {
    const hit = BY_NORMALISED.get(normalise(parts[i]));
    if (hit) return hit;
  }
  return '';
}
