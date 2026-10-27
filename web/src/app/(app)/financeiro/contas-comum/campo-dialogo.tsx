import type { ReactNode } from "react";

/** Campo do diálogo: rótulo, controle e a frase de erro ligada a ele (mesma marcação do diálogo de lançamento). */
export function CampoDialogo({
  classe,
  id,
  rotulo,
  opcional,
  erro,
  ajuda,
  children,
}: {
  classe: string;
  id: string;
  rotulo: string;
  opcional?: boolean;
  erro?: string;
  ajuda?: ReactNode;
  children: ReactNode;
}) {
  return (
    <div className={`campo ${classe}`} data-invalido={erro ? "" : undefined}>
      <label htmlFor={id}>
        {rotulo}
        {opcional && (
          <>
            {" "}
            <span className="opcional">(opcional)</span>
          </>
        )}
      </label>
      {children}
      {ajuda && (
        <span className="ajuda" id={`${id}-ajuda`}>
          {ajuda}
        </span>
      )}
      {erro && (
        <span className="erro" id={`${id}-erro`} role="alert">
          {erro}
        </span>
      )}
    </div>
  );
}
