/** Resumo da conta no alto de um diálogo: número, título, com quem é, vencimento e valor (já formatados). */
export function ResumoConta({ numero, titulo, quem, vencimento, valor }: { numero: number; titulo: string; quem: string; vencimento: string; valor: string }) {
  return (
    <p className="contas-resumo">
      <b>
        Conta {numero} · {titulo}
      </b>
      <span className="linha2">
        {quem} · vence em {vencimento} · {valor}
      </span>
    </p>
  );
}
