// TIDE & THUNDER — shared tuning, palette and city constants for Port Tempest.
// Every number the game balances on lives here so the other modules stay small.

export function mulberry32(seed) {
  let a = seed >>> 0;
  return function nextRandom() {
    a |= 0; a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

export const CITY = {
  half: 200,          // city spans -200..200 on x and z (harbor water beyond z = 170)
  roadGap: 40,        // distance between avenue centrelines
  roadWidth: 12,
  harborZ: 168,       // shoreline; south of this is beach, then water
  waterZ: 184,        // water plane starts here
  bridgeX: 0,         // causeway bridge over the harbor inlet, centred on x = 0
  bridgeHalfWidth: 9,
  bridgeTopY: 7,
  seed: 1337,
};

export const PALETTE = {
  duskSky: 0x2a1e4f,
  fog: 0x3a2b5e,
  asphalt: 0x23232e,
  sidewalk: 0x3d3a44,
  water: 0x0d3a52,
  sand: 0x8a7a5a,
  neonPink: 0xff2e88,
  neonCyan: 0x19e3ff,
  neonAmber: 0xffb020,
  neonLime: 0x7dff5e,
  policeRed: 0xff2a2a,
  policeBlue: 0x2a6bff,
};

export const CAR_COLORS = [
  { name: 'Sunset Coupe', hex: 0xd84040 },
  { name: 'Harbor Taxi', hex: 0xf2c230 },
  { name: 'Neon Sedan', hex: 0x19e3ff },
  { name: 'Midnight SUV', hex: 0x2e3a55 },
  { name: 'Lime Hot Hatch', hex: 0x7dff5e },
  { name: 'Violet Lowrider', hex: 0x8a4dff },
  { name: 'Pearl Cruiser', hex: 0xd8d8e0 },
];

export const MISSIONS = [
  {
    id: 'first-run',
    name: 'FIRST RUN',
    brief: 'Drive the pickup to the harbor pier. The crew is watching — do not keep them waiting.',
    reward: 300,
    target: { x: 0, z: 196 },
    hint: 'Follow the yellow beacon. Any car will do — borrow one if you must.',
  },
  {
    id: 'five-drops',
    name: 'FIVE DROPS',
    brief: 'Five packages are stashed across Port Tempest. Collect them all. Rival lookouts are armed.',
    reward: 600,
    drops: [
      { x: -140, z: -140 }, { x: 140, z: -120 }, { x: -120, z: 60 },
      { x: 120, z: 120 }, { x: -40, z: -40 },
    ],
    hint: 'Walk or drive over a glowing package to grab it.',
  },
  {
    id: 'heat-wave',
    name: 'HEAT WAVE',
    brief: 'The harbor police have your plate. Lose the 3-star heat — break line of sight and stay hidden.',
    reward: 800,
    startWanted: 3,
    hint: 'Wanted stars fade when no police can see you. Alleys and the bridge help.',
  },
  {
    id: 'storm-break',
    name: 'STORM BREAK',
    brief: 'Finale: the whole precinct is coming. Outrun the chase and reach the harbor beacon alive.',
    reward: 1500,
    target: { x: 0, z: 196 },
    startWanted: 4,
    hint: 'Do not stop. Do not get boxed in. The pier is the finish line.',
  },
];

export const TUNING = {
  walkSpeed: 7,
  runSpeed: 12,
  carAccel: 26,
  carBrake: 42,
  carMaxSpeed: 46,
  carReverseMax: 14,
  carTurn: 1.9,
  wetGrip: 0.62,        // storm cuts grip: cars slide more
  dryGrip: 0.92,
  policeTopSpeed: 44,
  wantedDecayPerSec: 0.12,
  wantedHiddenBonus: 0.35,
  bustCashPenalty: 200,
  pistolDamage: 34,
  gangsterDamage: 6,
  playerMaxHealth: 100,
  trafficCount: 14,
  pedestrianCount: 22,
  healthPackHeal: 45,
};

export const SAVE_KEY = 'tide-and-thunder-port-tempest-save-v1';
