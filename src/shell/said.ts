import { createStore } from '../lib/store'

// What the last tap on a − or + changed, for screen readers: "Bicep curls 11 kg",
// "Bicep curls 4 sets of 12 reps". Read out by WeightAnnouncer, once per page.
export const said = createStore({ text: '' })
export const say = (text: string) => said.set({ text })
