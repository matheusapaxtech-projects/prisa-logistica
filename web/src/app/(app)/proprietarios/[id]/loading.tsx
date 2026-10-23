import "@/styles/paginas/proprietarios.css";

/* Esqueleto da ficha do proprietário: cabeçalho (migalha, documento e sinais), abas e as primeiras
   seções do formulário, nas alturas da ficha pronta. */
function Barra({ w, h = 12, r }: { w: number | string; h?: number; r?: number | string }) {
  return <i style={{ width: w, height: h, ...(r != null ? { borderRadius: r } : {}) }} />;
}

function SecaoCarregando({ campos }: { campos: number[] }) {
  return (
    <section className="secao carregando" aria-hidden="true">
      <div className="secao-rotulo">
        <Barra w={140} h={16} />
        <br />
        <Barra w="90%" />
        <br />
        <Barra w="70%" />
      </div>
      <div className="campos">
        {campos.map((c, i) => (
          <div className={`campo f${c}`} key={i}>
            <Barra w={90} />
            <Barra w="100%" h={38} r={6} />
          </div>
        ))}
      </div>
    </section>
  );
}

export default function CarregandoFichaProprietario() {
  return (
    <main className="prop" aria-busy="true" aria-label="Carregando a ficha do proprietário">
      <div className="cab-ficha carregando" aria-hidden="true">
        <div className="ident">
          <Barra w={340} h={20} />
          <Barra w={300} h={14} />
          <div className="sinais">
            <Barra w={70} h={22} r={4} />
            <Barra w={120} h={22} r={4} />
          </div>
        </div>
        <div className="acoes">
          <Barra w={150} h={32} r={6} />
          <Barra w={160} h={32} r={6} />
        </div>
      </div>
      <div className="abas carregando" aria-hidden="true" style={{ paddingBottom: 12 }}>
        {[50, 40, 90, 80, 70, 100, 90, 80, 70].map((w, i) => (
          <Barra key={i} w={w} h={14} />
        ))}
      </div>
      <SecaoCarregando campos={[12, 4, 8, 4, 12, 12, 4, 4]} />
      <SecaoCarregando campos={[4, 4, 4]} />
    </main>
  );
}
