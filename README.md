# Amygo

A 3D gym you can train in, with a workout log that stays on your device. Built with React + Three.js, made for phones too.

**Try it:** https://amygo.vercel.app · Code: https://github.com/avangardewashere/amygo

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

- **Man** by Quaternius, from [Poly Pizza](https://poly.pizza/m/HMnuH5geEG). Public domain (CC0). File: `public/models/man.glb`. The player's look: its bones follow our own joint maths (`src/player/humanRig.ts`).
- **Fitness Character** by iPoly3D, from [Poly Pizza](https://poly.pizza/m/KX8wzUxep8). Public domain (CC0). File: `public/models/fitness-character.glb`.
  Not used by default (the player is the Man model above). To try it, set `LOOK` to `'fitness'` in `src/player/Player.tsx` (its limbs don't move); `'classic'` gives the original capsule person.
