import "@/styles/paginas/proprietarios.css";
import "@/styles/paginas/pedidos.css";

/* Esqueleto da ficha do pedido: cabeçalho (migalha, linha e sinais), resumo com o saldo e as viagens. */
function Barra({ w, h = 12, r }: { w: number | string; h?: number; r?: number | string }) {
  return <i style={{ width: w, height: h, ...(r != null ? { borderRadius: r } : {}) }} />;
}

export default function CarregandoFichaPedido() {
  return (
    <main className="prop ped" aria-busy="true" aria-label="Carregando o pedido">
      <div className="cab-ficha carregando" aria-hidden="true">
        <div className="ident">
          <Barra w={220} h={20} />
          <Barra w={320} h={14} />
          <div className="sinais">
            <Barra w={70} h={22} r={4} />
            <Barra w={130} h={22} r={4} />
          </div>
        </div>
      </div>
      <div className="resumo-pedido carregando" aria-hidden="true">
        <div style={{ display: "grid", gap: 14 }}>
          {[160, 200, 200, 260, 260, 140, 120, 180].map((w, i) => (
            <Barra key={i} w={w} h={14} />
          ))}
        </div>
        <div className="saldo">
          <Barra w={120} />
          <Barra w={160} h={28} />
          <Barra w="100%" h={8} r={4} />
        </div>
      </div>
    </main>
  );
}
