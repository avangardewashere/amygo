// Which machine is in use right now, so its moving parts can animate
// (the treadmill belt, the leg press sled). Written when an exercise starts
// or stops, read by the machine models every frame. Kept in its own tiny
// file so models don't import the game state (that would make the imports
// go round in a circle).
export const machine = {
  activeId: null as string | null,
  speed: 0, // treadmill belt speed, m/s
  startedAt: 0, // when the exercise started (for rep timing)
}
