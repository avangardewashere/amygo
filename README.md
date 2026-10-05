# Gym 3D

A 3D gym built with React + Three.js, mobile-friendly.

## Run it

```bash
npm install
npm run dev
```

## Stack

- **Vite + React + TypeScript**: app shell
- **three**: the 3D engine
- **@react-three/fiber**: lets you write Three.js scenes as React components
- **@react-three/drei**: ready-made helpers (camera controls, etc.)

## Where things live

- `src/scene/dimensions.ts`: room size (meters) and colors
- `src/scene/Room.tsx`: floor, walls, ceiling
- `src/scene/CameraFit.tsx`: frames the whole room on any screen shape
- `src/scene/GymScene.tsx`: canvas, lights, camera controls

## Credits

- **Fitness Character** by iPoly3D, from [Poly Pizza](https://poly.pizza/m/KX8wzUxep8). Public domain (CC0). File: `public/models/fitness-character.glb`.
  Not used by default: the built-in animated person is the player. To try this model instead, set `LOOK` to `'fitness'` in `src/player/Player.tsx` (its limbs don't move).
