import "@/styles/paginas/proprietarios.css";
import "@/styles/paginas/pedidos.css";
import "@/styles/paginas/viagens.css";

/* Esqueleto da ficha da viagem: cabeçalho (migalha, linha e sinais), próximo passo, resumo e aptidão. */
function Barra({ w, h = 12, r }: { w: number | string; h?: number; r?: number | string }) {
  return <i style={{ width: w, height: h, ...(r != null ? { borderRadius: r } : {}) }} />;
}

export default function CarregandoFichaViagem() {
  return (
    <main className="prop ped via" aria-busy="true" aria-label="Carregando a viagem">
      <div className="cab-ficha carregando" aria-hidden="true">
        <div className="ident">
          <Barra w={220} h={20} />
          <Barra w={320} h={14} />
          <div className="sinais">
            <Barra w={90} h={22} r={4} />
            <Barra w={130} h={22} r={4} />
          </div>
        </div>
      </div>
      <div className="proximo-passo carregando" aria-hidden="true">
        <div className="texto">
          <Barra w={100} />
          <Barra w={220} h={20} />
        </div>
        <Barra w={150} h={32} r={6} />
      </div>
      <div className="resumo-pedido carregando" aria-hidden="true">
        <div style={{ display: "grid", gap: 14 }}>
          {[200, 160, 240, 180, 140, 160, 200].map((w, i) => (
            <Barra key={i} w={w} h={14} />
          ))}
        </div>
        <div style={{ display: "grid", gap: 12 }}>
          <Barra w={120} h={16} />
          <Barra w="100%" h={14} />
          <Barra w="80%" h={14} />
        </div>
      </div>
    </main>
  );
}
