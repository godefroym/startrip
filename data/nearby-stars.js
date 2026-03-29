export const LOCAL_BUBBLE_RADIUS_LY = 100;

export const NAMED_STARS = [
  { name: "Soleil", distanceLy: 0, raDeg: 0, decDeg: 0, radiusSolar: 1.0, temperatureK: 5772, type: "G2V" },
  { name: "Proxima Centauri", distanceLy: 4.24, raDeg: 217.43, decDeg: -62.68, radiusSolar: 0.15, temperatureK: 3042, type: "M5.5Ve" },
  { name: "Alpha Centauri A", distanceLy: 4.37, raDeg: 219.90, decDeg: -60.84, radiusSolar: 1.22, temperatureK: 5790, type: "G2V" },
  { name: "Alpha Centauri B", distanceLy: 4.37, raDeg: 219.90, decDeg: -60.84, radiusSolar: 0.86, temperatureK: 5260, type: "K1V" },
  { name: "Barnard", distanceLy: 5.96, raDeg: 269.45, decDeg: 4.69, radiusSolar: 0.2, temperatureK: 3134, type: "M4V" },
  { name: "Wolf 359", distanceLy: 7.86, raDeg: 247.03, decDeg: 7.01, radiusSolar: 0.16, temperatureK: 2800, type: "M6V" },
  { name: "Lalande 21185", distanceLy: 8.31, raDeg: 165.84, decDeg: 35.97, radiusSolar: 0.39, temperatureK: 3828, type: "M2V" },
  { name: "Sirius A", distanceLy: 8.6, raDeg: 101.29, decDeg: -16.72, radiusSolar: 1.71, temperatureK: 9940, type: "A1V" },
  { name: "Sirius B", distanceLy: 8.6, raDeg: 101.29, decDeg: -16.72, radiusSolar: 0.008, temperatureK: 25200, type: "DA2" },
  { name: "Luyten 726-8 A", distanceLy: 8.73, raDeg: 24.75, decDeg: -17.95, radiusSolar: 0.14, temperatureK: 2700, type: "M5.5V" },
  { name: "Luyten 726-8 B", distanceLy: 8.73, raDeg: 24.75, decDeg: -17.95, radiusSolar: 0.13, temperatureK: 2600, type: "M6V" },
  { name: "Ross 154", distanceLy: 9.69, raDeg: 270.16, decDeg: -23.88, radiusSolar: 0.24, temperatureK: 3240, type: "M3.5V" },
  { name: "Ross 248", distanceLy: 10.32, raDeg: 23.08, decDeg: 44.02, radiusSolar: 0.18, temperatureK: 3000, type: "M6V" },
  { name: "Epsilon Eridani", distanceLy: 10.47, raDeg: 53.23, decDeg: -9.46, radiusSolar: 0.74, temperatureK: 5084, type: "K2V" },
  { name: "Lacaille 9352", distanceLy: 10.74, raDeg: 351.00, decDeg: -35.85, radiusSolar: 0.46, temperatureK: 3620, type: "M1.5V" },
  { name: "Procyon A", distanceLy: 11.46, raDeg: 114.83, decDeg: 5.22, radiusSolar: 2.05, temperatureK: 6530, type: "F5IV-V" },
  { name: "Procyon B", distanceLy: 11.46, raDeg: 114.83, decDeg: 5.22, radiusSolar: 0.012, temperatureK: 7740, type: "DQZ" },
  { name: "Tau Ceti", distanceLy: 11.9, raDeg: 26.02, decDeg: -15.94, radiusSolar: 0.79, temperatureK: 5344, type: "G8V" },
  { name: "Epsilon Indi", distanceLy: 11.82, raDeg: 336.17, decDeg: -56.79, radiusSolar: 0.73, temperatureK: 4699, type: "K5V" },
  { name: "61 Cygni A", distanceLy: 11.4, raDeg: 316.73, decDeg: 38.75, radiusSolar: 0.67, temperatureK: 4400, type: "K5V" },
  { name: "61 Cygni B", distanceLy: 11.4, raDeg: 316.73, decDeg: 38.75, radiusSolar: 0.6, temperatureK: 4040, type: "K7V" },
  { name: "Altair", distanceLy: 16.73, raDeg: 297.70, decDeg: 8.87, radiusSolar: 1.63, temperatureK: 7550, type: "A7V" },
  { name: "Vega", distanceLy: 25.04, raDeg: 279.23, decDeg: 38.78, radiusSolar: 2.36, temperatureK: 9600, type: "A0V" },
  { name: "Fomalhaut", distanceLy: 25.13, raDeg: 344.41, decDeg: -29.62, radiusSolar: 1.84, temperatureK: 8590, type: "A3V" },
  { name: "Pollux", distanceLy: 33.78, raDeg: 116.33, decDeg: 28.03, radiusSolar: 8.8, temperatureK: 4865, type: "K0III" },
  { name: "Arcturus", distanceLy: 36.66, raDeg: 213.91, decDeg: 19.18, radiusSolar: 25.4, temperatureK: 4286, type: "K1.5III" },
  { name: "Capella", distanceLy: 42.9, raDeg: 79.17, decDeg: 45.99, radiusSolar: 11.9, temperatureK: 4970, type: "G8III" },
  { name: "Aldebaran", distanceLy: 65.3, raDeg: 68.98, decDeg: 16.51, radiusSolar: 44.0, temperatureK: 3910, type: "K5III" },
  { name: "Regulus", distanceLy: 79.3, raDeg: 152.09, decDeg: 11.97, radiusSolar: 3.8, temperatureK: 12460, type: "B8IVn" },
  { name: "Denebola", distanceLy: 35.88, raDeg: 177.26, decDeg: 14.57, radiusSolar: 1.73, temperatureK: 8520, type: "A3Va" },
];

export function sphericalToCartesian(distanceLy, raDeg, decDeg) {
  const ra = (raDeg * Math.PI) / 180;
  const dec = (decDeg * Math.PI) / 180;
  const cosDec = Math.cos(dec);

  return {
    x: distanceLy * cosDec * Math.cos(ra),
    y: distanceLy * Math.sin(dec),
    z: distanceLy * cosDec * Math.sin(ra),
  };
}

export function createSyntheticPopulation(count, radiusLy, seed = 7) {
  const random = mulberry32(seed);
  const stars = [];

  for (let index = 0; index < count; index += 1) {
    const distanceLy = radiusLy * Math.cbrt(random());
    const raDeg = random() * 360;
    const decDeg = Math.asin(random() * 2 - 1) * (180 / Math.PI);
    const family = pickFamily(random);
    const radiusSolar = family.radiusMin + (family.radiusMax - family.radiusMin) * random();
    const temperatureK = Math.round(family.tempMin + (family.tempMax - family.tempMin) * random());

    stars.push({
      name: `Synth-${index + 1}`,
      distanceLy,
      raDeg,
      decDeg,
      radiusSolar,
      temperatureK,
      type: family.type,
      synthetic: true,
    });
  }

  return stars;
}

function pickFamily(random) {
  const roll = random();

  if (roll < 0.72) {
    return { type: "M", radiusMin: 0.08, radiusMax: 0.55, tempMin: 2400, tempMax: 3800 };
  }

  if (roll < 0.88) {
    return { type: "K", radiusMin: 0.55, radiusMax: 0.9, tempMin: 3900, tempMax: 5200 };
  }

  if (roll < 0.96) {
    return { type: "G", radiusMin: 0.85, radiusMax: 1.2, tempMin: 5300, tempMax: 6100 };
  }

  if (roll < 0.992) {
    return { type: "F", radiusMin: 1.1, radiusMax: 1.6, tempMin: 6200, tempMax: 7400 };
  }

  return { type: "A", radiusMin: 1.5, radiusMax: 2.8, tempMin: 7600, tempMax: 10200 };
}

function mulberry32(seed) {
  let current = seed >>> 0;

  return () => {
    current |= 0;
    current = (current + 0x6d2b79f5) | 0;
    let t = Math.imul(current ^ (current >>> 15), 1 | current);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}
