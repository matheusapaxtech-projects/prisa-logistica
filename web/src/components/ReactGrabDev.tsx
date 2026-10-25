"use client";

import { useEffect } from "react";

/** React Grab (só em `next dev`): passe o mouse num elemento e copie o componente e o código-fonte dele
   para colar no Claude. Em produção o `if` vira `false` no build e o pacote nem entra no bundle. */
export function ReactGrabDev() {
  useEffect(() => {
    if (process.env.NODE_ENV === "development") void import("react-grab");
  }, []);
  return null;
}
