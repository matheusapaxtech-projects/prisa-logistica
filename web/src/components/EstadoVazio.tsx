import type { CSSProperties, ReactNode } from "react";

/* Estado vazio (`.vazio-bloco`): mantém o quadro e diz o que fazer. Pode levar um botão de texto. */
export function EstadoVazio({ children, style }: { children: ReactNode; style?: CSSProperties }) {
  return (
    <div className="vazio-bloco" style={style}>
      {children}
    </div>
  );
}
