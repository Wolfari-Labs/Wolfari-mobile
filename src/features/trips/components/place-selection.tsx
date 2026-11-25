import { createContext, useContext, useState, type PropsWithChildren } from "react";
import type { PlaceItem } from "../model/place-item";

// Keep the licensed image and save token in this trip's navigation stack.
const Selection = createContext<{ place?: PlaceItem; selectPlace: (place: PlaceItem) => void } | null>(null);
export function PlaceSelectionProvider({ children }: PropsWithChildren) {
  const [place, selectPlace] = useState<PlaceItem>();
  return <Selection.Provider value={{ place, selectPlace }}>{children}</Selection.Provider>;
}
export function usePlaceSelection() {
  const value = useContext(Selection);
  if (!value) throw Error("PlaceSelectionProvider is required.");
  return value;
}
