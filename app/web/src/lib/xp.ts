const BASE_XP = 100;
const START_INCREMENT = 20;
const INCREMENT_STEP = 10;

function xpForLevel(level: number): number {
  if (level === 0) return BASE_XP;
  const extra = START_INCREMENT * level + INCREMENT_STEP * level * (level - 1) / 2;
  return BASE_XP + extra;
}

function cumulativeXPForLevel(level: number): number {
  let total = 0;
  for (let i = 0; i < level; i++) {
    total += xpForLevel(i);
  }
  return total;
}

export function getLevelProgress(totalXp: number, currentLevel: number) {
  const cumXP = cumulativeXPForLevel(currentLevel);
  const surplus = totalXp - cumXP;
  const needed = xpForLevel(currentLevel);
  const progress = Math.min(100, Math.max(0, (surplus / needed) * 100));
  return { surplus, needed, progress };
}
