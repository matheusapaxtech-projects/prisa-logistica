/* Trilho do marco de quilômetro (`N.desenhar.marco`): quanto falta até vencer, numa janela de dias.
   Amarelo até 30 dias, verde depois; vencido = trilho vermelho curto. */
export function MarcoKm({ dias, janela = 90 }: { dias: number; janela?: number }) {
  const venc = dias < 0;
  const pct = venc ? 100 : Math.max(2, Math.min(100, (dias / janela) * 100));
  const cor = venc ? undefined : dias <= 30 ? "var(--amarelo)" : "var(--verde)";
  return (
    <div className={`trilho${venc ? " vencido" : ""}`} aria-hidden="true">
      <i style={cor ? { width: `${pct}%`, background: cor } : { width: `${pct}%` }} />
    </div>
  );
}
