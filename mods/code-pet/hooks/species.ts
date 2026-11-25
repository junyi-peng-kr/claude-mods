// The kinds of pet and their coats. No `$` here.
//
// Each animal sprite is written as its left half, 7 columns, the 7th being the
// centre column, and mirrored into 13. Characters:
//   . empty   o outline   t main coat   k second coat (saddle, patches)
//   w white   s spot      p inner ear   c cheek   e eye   n nose   m mouth
import type { Species } from '../types'

export type Hex = `#${string}`

export type Coat = {
  /** Shown in pickers. */
  zh: string
  t: Hex
  k: Hex
  w: Hex
  s?: Hex
  /** Eyes, nose and mouth; light on a dark coat. */
  face?: Hex
}

export type Kind = {
  zh: string
  /** What a new pet of this kind is called until you name it. */
  defaultName: string
  /** Left halves, top row first; absent for the blob, which has its own sprites. */
  half?: string[]
  /** The row the collar sits on, for kid and adult. */
  collarRow?: number
  coats: Record<string, Coat>
}

const CORGI_BODY = [
  'otttttw',
  'otetttw',
  'octtwww',
  '.otwwwn',
  '..owwwm',
  '.okkoww',
  'okkkkww',
  'okkkwww',
  'otkwwww',
  '.owwoww',
  '.ooo.oo',
]

export const KINDS: Record<Species, Kind> = {
  bit: {
    zh: '小比特',
    defaultName: '小比特',
    coats: {
      classic: { zh: '经典（随成长变色）', t: '#8EE3C8', k: '#5CC7A6', w: '#FFFFFF' },
    },
  },
  corgi: {
    zh: '柯基',
    defaultName: '柯基',
    half: ['.oo....', '.oto...', '.otto..', '.ottooo', ...CORGI_BODY],
    collarRow: 9,
    coats: {
      tricolor: { zh: '三色', t: '#D9873A', k: '#2E2433', w: '#FFF6EA' },
      red: { zh: '黄白', t: '#E0913F', k: '#D47A30', w: '#FFF6EA' },
      sable: { zh: '貂色', t: '#D99A55', k: '#6B4426', w: '#FFF6EA' },
    },
  },
  shiba: {
    zh: '柴犬',
    defaultName: '柴柴',
    half: ['.......', '.o.....', '.oto...', '.ottooo', ...CORGI_BODY],
    collarRow: 9,
    coats: {
      red: { zh: '赤色', t: '#E58A3A', k: '#E58A3A', w: '#FFF3E2' },
      'black-tan': { zh: '黑色', t: '#3A3036', k: '#3A3036', w: '#E9D3B6', face: '#FFE27A' },
      cream: { zh: '白色', t: '#F3DDB8', k: '#EBCD9E', w: '#FFF8EC' },
    },
  },
  cat: {
    zh: '猫',
    defaultName: '咪咪',
    half: [
      'o......',
      'oo.....',
      'opo....',
      'ottoooo',
      'ottsttt',
      'otetttt',
      'octtttn',
      '.otttwm',
      '..ottww',
      '..ottww',
      '.otttww',
      '.otkttw',
      '.otkttw',
      '.otwotw',
      '..oo.oo',
    ],
    collarRow: 8,
    coats: {
      orange: { zh: '橘猫', t: '#F2A04A', k: '#D9822B', w: '#FFF4E6', s: '#D9822B' },
      black: { zh: '黑猫', t: '#2F2A36', k: '#2F2A36', w: '#3D3745', s: '#2F2A36', face: '#FFE27A' },
      gray: { zh: '狸花', t: '#9AA3B5', k: '#6F788B', w: '#EEF1F6', s: '#6F788B' },
      calico: { zh: '三花', t: '#FFF4E6', k: '#E58A3A', w: '#FFF4E6', s: '#2F2A36' },
    },
  },
  bunny: {
    zh: '兔子',
    defaultName: '团子',
    half: [
      '.o.....',
      'oto....',
      'opo....',
      'opo....',
      'oto....',
      '.ottooo',
      'otttttt',
      'otetttt',
      'octtttn',
      '.otttwm',
      '.ottttw',
      'otttttw',
      'otttttw',
      '.ottott',
      '..oo.oo',
    ],
    collarRow: 10,
    coats: {
      white: { zh: '白兔', t: '#FAF6F0', k: '#E8E0D6', w: '#FFFFFF' },
      brown: { zh: '棕兔', t: '#B98457', k: '#A06E45', w: '#F3E3D0' },
      gray: { zh: '灰兔', t: '#A7A9B4', k: '#8E909C', w: '#EDEDF2' },
    },
  },
}

export const SPECIES = Object.keys(KINDS) as Species[]

export const isSpecies = (s: unknown): s is Species => typeof s === 'string' && s in KINDS

/** The coat by key, or the kind's first coat when the key is not one of its own. */
export function coatOf(species: Species, coat: string | undefined): { key: string; coat: Coat } {
  const coats = KINDS[species].coats
  const key = coat && coat in coats ? coat : Object.keys(coats)[0]!
  return { key, coat: coats[key]! }
}

/** The full 13-column grid of an animal, mirrored from its left half. */
export function gridOf(half: readonly string[]): string[] {
  return half.map(row => row + [...row.slice(0, 6)].reverse().join(''))
}
