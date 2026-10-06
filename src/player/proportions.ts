// Body measurements of the person, in meters. Shared with machines that need
// to fit the body (how low to sit so the hips land on a seat, where the
// shoulders are so a machine's arms can swing with yours).
//
// Measured from the human model (public/models/man.glb, scaled to 1.8 m) so
// its skeleton and these numbers line up: the joint maths moves this body, and
// the model follows it (see HumanPerson.tsx). The classic capsule person is
// drawn from the same numbers.

export const KNEE_DROP = 0.31 // hip → knee
export const FOOT_DROP = 0.48 // knee → foot point (the heel, just above the sole)
export const SHOE_Y = 0.02 // the foot point's height when standing on the floor
export const HIP_Y = SHOE_Y + KNEE_DROP + FOOT_DROP // hip joint height, standing with straight legs
export const HIP_X = 0.11 // each hip joint, out from the middle

// The upper body sits on the hips as in the model's own skeleton
export const SHOULDER_Y = HIP_Y + 0.62 // shoulder joint height when standing
export const SHOULDER_X = 0.18 // each shoulder joint, out from the middle
export const ELBOW_DROP = 0.28 // shoulder → elbow
export const HAND_DROP = 0.34 // elbow → middle of the hand (where it grips)

export const TORSO_RADIUS = 0.11 // spine → back of the body (half the chest's thickness)

// Sitting: the hip joints sit this far above the seat's surface (the model's
// seat is about 9 cm below its hip joints; a padded seat gives a centimeter)
export const SEAT_TO_HIP = 0.08

export const HEAD_Y = HIP_Y + 0.88 // middle of the head when standing
export const HEAD_RADIUS = 0.13
