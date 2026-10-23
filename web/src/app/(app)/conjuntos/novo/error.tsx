"use client";

import { ErroTela } from "../erro-tela";

export default function ErroMontador({ error, retry }: { error: unknown; retry: () => void }) {
  return (
    <ErroTela
      error={error}
      retry={retry}
      titulo="Montar conjunto"
      frase="Não conseguimos buscar os veículos e os conjuntos abertos agora. Confira a conexão e tente de novo."
    />
  );
}
