// Ista logika kao u klijent app-u — kategorija po ulozi radnika, boja + ikonica, bez fotografija.
export const CATEGORY = {
  hair:   { icon: '✂', from: '#8A2F47', to: '#5C1F32' },
  nails:  { icon: '💅', from: '#7A3F63', to: '#4E2740' },
  face:   { icon: '✦',  from: '#3F5B4E', to: '#28392F' },
  lashes: { icon: '◡',  from: '#6B4A2E', to: '#42301F' },
}
export const ROLE_CATEGORY = {
  'Frizer i kolorista':  'hair',
  'Manikir i pedikir':   'nails',
  'Kozmetičar':          'face',
  'Trepavice i obrve':   'lashes',
}
export function catFor(roleSr) { return CATEGORY[ROLE_CATEGORY[roleSr]] || CATEGORY.hair }
export function initials(n) { return n.split(' ').map(x => x[0]).join('') }