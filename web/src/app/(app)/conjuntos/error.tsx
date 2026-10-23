"use client";

import { ErroTela } from "./erro-tela";

export default function ErroConjuntos({ error, retry }: { error: unknown; retry: () => void }) {
  return (
    <ErroTela error={error} retry={retry} titulo="Conjuntos" frase="Não conseguimos buscar os conjuntos agora. Confira a conexão e tente de novo." />
  );
}
