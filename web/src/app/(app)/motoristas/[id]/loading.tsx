import "@/styles/paginas/motoristas.css";

/* Esqueleto da ficha do motorista: migalha e sinais, resumo de duas colunas, abas e as primeiras
   seções do formulário, nas alturas da ficha pronta. */
function Barra({ w, h = 12, r }: { w: number | string; h?: number; r?: number | string }) {
  return <i style={{ width: w, height: h, ...(r != null ? { borderRadius: r } : {}) }} />;
}

function SecaoCarregando({ campos }: { campos: number[] }) {
  return (
    <section className="secao carregando" aria-hidden="true">
      <div className="secao-rotulo">
        <Barra w={120} h={16} />
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

export default function CarregandoFicha() {
  return (
    <main aria-busy="true" aria-label="Carregando a ficha do motorista">
      <div className="titulo carregando" aria-hidden="true">
        <div>
          <Barra w={320} h={20} />
          <br />
          <Barra w={300} h={20} r={4} />
        </div>
        <div className="acoes">
          <Barra w={150} h={32} r={6} />
          <Barra w={170} h={32} r={6} />
        </div>
      </div>
      <section className="bloco resumo carregando" aria-hidden="true">
        <div>
          {[0, 1, 2, 3, 4].map((n) => (
            <div key={n} style={{ height: 28 }}>
              <Barra w="70%" />
            </div>
          ))}
        </div>
        <div>
          <Barra w={110} h={14} />
          <br />
          <Barra w="80%" h={28} r={4} />
        </div>
      </section>
      <div className="abas carregando" aria-hidden="true" style={{ paddingBottom: 12 }}>
        {[110, 40, 80, 100, 100, 100, 150].map((w, i) => (
          <Barra key={i} w={w} h={14} />
        ))}
      </div>
      <SecaoCarregando campos={[12, 4]} />
      <SecaoCarregando campos={[4, 4, 4, 8, 4]} />
    </main>
  );
}
