import "@/styles/paginas/veiculos.css";

/* Esqueleto da ficha: cabeçalho com a placa grande, a faixa de abas e a primeira seção de campos,
   com as alturas da tela pronta (campo de 38 px com rótulo de 18 px). */
function Barra({ w, h = 12, r }: { w: number | string; h?: number; r?: number | string }) {
  return <i style={{ width: w, height: h, ...(r != null ? { borderRadius: r } : {}) }} />;
}

const CAMPOS: [string, number][] = [
  ["f4", 90], ["f3", 60], ["f2", 70], ["f3", 80], ["f3", 120], ["f3", 100], ["f6", 150], ["f6", 150],
];

export default function CarregandoFicha() {
  return (
    <main aria-busy="true" aria-label="Carregando o veículo">
      <div className="titulo cab-veiculo">
        <div className="cab-id carregando" aria-hidden="true">
          <Barra w={150} h={52} r={6} />
          <div className="cab-txt">
            <Barra w={180} h={16} />
            <Barra w={260} h={14} />
            <div className="sinais">
              <Barra w={120} h={22} r={4} />
              <Barra w={90} h={22} r={4} />
            </div>
          </div>
        </div>
      </div>

      <nav className="abas carregando" aria-hidden="true">
        {[40, 90, 110, 100, 100, 44, 96, 70].map((w, n) => (
          <span key={n} style={{ display: "inline-flex", alignItems: "center", height: 40 }}>
            <Barra w={w} h={14} />
          </span>
        ))}
      </nav>

      <section className="secao carregando" aria-hidden="true">
        <div className="secao-rotulo">
          <h2>Veículo no CRLV</h2>
          <Barra w="80%" h={14} />
        </div>
        <div className="campos">
          {CAMPOS.map(([classe, w], n) => (
            <div className={`campo ${classe}`} key={n}>
              <label>
                <Barra w={w} h={14} />
              </label>
              <Barra w="100%" h={38} r={6} />
            </div>
          ))}
        </div>
      </section>
    </main>
  );
}
