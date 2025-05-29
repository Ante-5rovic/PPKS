import { create } from "zustand";

//NE KORISTI SE

const useCharacterStore = create((set) => ({

  strength: 10,
  agility: 10,
  intelligence: 10,

  updateCharacter: (param, value) =>
    set((state) => ({ ...state, [param]: value })),
}));

export default useCharacterStore;
