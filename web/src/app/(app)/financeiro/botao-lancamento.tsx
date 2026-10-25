"use client";

import { useState } from "react";
import { Plus } from "lucide-react";
import type { Conta } from "./consultas";
import { DialogoLancamento, type AberturaManual } from "./dialogo-lancamento";

/** Botão "Novo lançamento" do topo do Financeiro: abre o diálogo do lançamento feito à mão. */
export function BotaoNovoLancamento({ mes, contas, primario = false }: { mes: string; contas: Conta[]; primario?: boolean }) {
  const [abertura, setAbertura] = useState<AberturaManual | null>(null);
  return (
    <>
      <button className={primario ? "btn btn-primario" : "btn"} type="button" onClick={() => setAbertura({ novo: true, mes })}>
        <Plus size={16} strokeWidth={1.6} aria-hidden="true" />
        Novo lançamento
      </button>
      <DialogoLancamento abertura={abertura} contas={contas} aoFechar={() => setAbertura(null)} />
    </>
  );
}
