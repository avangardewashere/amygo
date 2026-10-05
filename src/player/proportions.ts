// Body measurements of the person, in meters. Shared with machines that need
// to fit the body (how low to sit so the hips land on a seat, where the
// shoulders are so a machine's arms can swing with yours).

export const HIP_Y = 0.88 // hip joint height when standing
export const HIP_X = 0.1 // each hip joint, out from the middle
export const KNEE_DROP = 0.42 // hip → knee
export const FOOT_DROP = 0.42 // knee → middle of the shoe
export const SHOE_Y = 0.04 // middle of the shoe, when standing on the floor

export const SHOULDER_Y = 1.45 // shoulder joint height when standing
export const SHOULDER_X = 0.28 // each shoulder joint, out from the middle
export const ELBOW_DROP = 0.31 // shoulder → elbow
export const HAND_DROP = 0.3 // elbow → hand

export const TORSO_RADIUS = 0.2 // half the body's thickness
