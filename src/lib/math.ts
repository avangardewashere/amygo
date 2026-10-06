// Small number helpers (so plain-data modules don't need three.js's versions)

// Keep a value between two limits
export const clamp = (value: number, min: number, max: number) => Math.min(Math.max(value, min), max)
