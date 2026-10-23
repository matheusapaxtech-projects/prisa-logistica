import "@/styles/paginas/proprietarios.css";

/* Esqueleto da ficha do cliente: cabeçalho (migalha, documento e sinais), abas e a primeira seção. */
function Barra({ w, h = 12, r }: { w: number | string; h?: number; r?: number | string }) {
  return <i style={{ width: w, height: h, ...(r != null ? { borderRadius: r } : {}) }} />;
}

export default function CarregandoFichaCliente() {
  return (
    <main className="prop" aria-busy="true" aria-label="Carregando a ficha do cliente">
      <div className="cab-ficha carregando" aria-hidden="true">
        <div className="ident">
          <Barra w={340} h={20} />
          <Barra w={300} h={14} />
          <div className="sinais">
            <Barra w={90} h={22} r={4} />
            <Barra w={120} h={22} r={4} />
          </div>
        </div>
      </div>
      <div className="abas carregando" aria-hidden="true" style={{ paddingBottom: 12 }}>
        {[50, 70, 190].map((w, i) => (
          <Barra key={i} w={w} h={14} />
        ))}
      </div>
      <section className="secao carregando" aria-hidden="true">
        <div className="secao-rotulo">
          <Barra w={140} h={16} />
          <br />
          <Barra w="90%" />
        </div>
        <div className="campos">
          {[8, 4, 6, 6].map((c, i) => (
            <div className={`campo f${c}`} key={i}>
              <Barra w={90} />
              <Barra w="100%" h={38} r={6} />
            </div>
          ))}
        </div>
      </section>
    </main>
  );
}
