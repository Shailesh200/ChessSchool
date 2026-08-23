export const PULSE_ORIGIN = 'https://pulse.shaileshjha.in'

export type PulseSite = {
  name: string
  domain: string
  /** Filled after you create the website in Umami. */
  websiteId: string
}

export const sites = {
  portfolio: {
    name: 'Portfolio',
    domain: 'shaileshjha.in',
    websiteId: 'af5a1a8d-ba97-47a3-a7aa-728cf4e510df',
  },
  writes: {
    name: 'Writes',
    domain: 'writes.shaileshjha.in',
    websiteId: 'dd623111-ff38-4c39-9a68-2ccebe599cb6',
  },
  cardorbit: {
    name: 'CardOrbit',
    domain: 'cardorbit.in',
    websiteId: '',
  },
  chessSchool: {
    name: 'ChessSchool',
    domain: 'chess-school.in',
    websiteId: '4bb7a0af-823c-4a21-a4ab-509a7815cf02',
  },
  prismhq: {
    name: 'PrismHQ',
    domain: 'prismhq.in',
    websiteId: '',
  },
} as const satisfies Record<string, PulseSite>

export function scriptSrc(origin = PULSE_ORIGIN) {
  return `${origin.replace(/\/$/, '')}/script.js`
}
