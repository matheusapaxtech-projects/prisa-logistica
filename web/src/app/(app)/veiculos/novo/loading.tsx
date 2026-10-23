import "@/styles/paginas/veiculos.css";

/* Esqueleto do cadastro: título e as seções Placa, Tipo e CRLV com as alturas da tela pronta. */
function Barra({ w, h = 12, r }: { w: number | string; h?: number; r?: number | string }) {
  return <i style={{ width: w, height: h, ...(r != null ? { borderRadius: r } : {}) }} />;
}

function Campo({ classe, rotulo }: { classe: string; rotulo: number }) {
  return (
    <div className={`campo ${classe}`}>
      <label>
        <Barra w={rotulo} h={14} />
      </label>
      <Barra w="100%" h={38} r={6} />
    </div>
  );
}

export default function CarregandoNovoVeiculo() {
  return (
    <main aria-busy="true" aria-label="Carregando o cadastro de veículo">
      <div className="titulo">
        <div>
          <nav className="migalha" aria-label="Caminho">
            <span>Veículos</span>
            <span className="sep" aria-hidden="true">/</span>
            <h1>Novo veículo</h1>
          </nav>
          <p className="sub">Comece pela placa. Depois, o tipo, o CRLV e os proprietários; o resto se completa na ficha.</p>
        </div>
      </div>
      <div className="form-novo carregando" aria-hidden="true">
        <section className="secao">
          <div className="secao-rotulo">
            <h2>Placa</h2>
            <Barra w="80%" h={14} />
          </div>
          <div className="campos">
            <Campo classe="f4" rotulo={48} />
            <div className="f8 previa-placa">
              <Barra w={150} h={46} r={6} />
            </div>
          </div>
        </section>
        <section className="secao">
          <div className="secao-rotulo">
            <h2>Tipo</h2>
            <Barra w="80%" h={14} />
          </div>
          <div className="campos">
            <Campo classe="f6" rotulo={110} />
          </div>
        </section>
        <section className="secao">
          <div className="secao-rotulo">
            <h2>Dados do CRLV</h2>
            <Barra w="80%" h={14} />
          </div>
          <div className="campos">
            <Campo classe="f4" rotulo={70} />
            <Campo classe="f5" rotulo={60} />
            <Campo classe="f3" rotulo={80} />
            <Campo classe="f4" rotulo={50} />
            <Campo classe="f8" rotulo={60} />
          </div>
        </section>
      </div>
    </main>
  );
}
