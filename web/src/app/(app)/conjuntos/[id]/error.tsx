"use client";

import { ErroTela } from "../erro-tela";

export default function ErroConjunto({ error, retry }: { error: unknown; retry: () => void }) {
  return (
    <ErroTela error={error} retry={retry} titulo="Conjunto" frase="Não conseguimos abrir este conjunto agora. Confira a conexão e tente de novo." />
  );
}
