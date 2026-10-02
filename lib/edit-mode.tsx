"use client";

import { createContext, useContext, useState, type ReactNode } from "react";

/** The Owner's "Edit" switch: while it's on, pencils show on the pages for changing what everyone sees. */
const EditModeContext = createContext<{ editing: boolean; setEditing(on: boolean): void }>({ editing: false, setEditing: () => {} });

export function EditModeProvider({ children }: { children: ReactNode }) {
  const [editing, setEditing] = useState(false);
  return <EditModeContext.Provider value={{ editing, setEditing }}>{children}</EditModeContext.Provider>;
}

export function useEditMode() {
  return useContext(EditModeContext);
}
