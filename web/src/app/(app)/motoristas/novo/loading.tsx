import "@/styles/paginas/motoristas.css";

/* Esqueleto do "Novo motorista": título e a seção do CPF, na largura da tela pronta. */
function Barra({ w, h = 12, r }: { w: number | string; h?: number; r?: number | string }) {
  return <i style={{ width: w, height: h, ...(r != null ? { borderRadius: r } : {}) }} />;
}

export default function CarregandoNovo() {
  return (
    <main className="novo" aria-busy="true" aria-label="Carregando o novo motorista">
      <div className="titulo">
        <div>
          <h1>Novo motorista</h1>
          <p className="sub carregando" aria-hidden="true">
            <Barra w={460} h={14} />
          </p>
        </div>
      </div>
      <section className="secao carregando" aria-hidden="true">
        <div className="secao-rotulo">
          <Barra w={140} h={16} />
          <br />
          <Barra w="90%" />
          <br />
          <Barra w="80%" />
        </div>
        <div className="campos">
          <div className="campo f5">
            <Barra w={40} />
            <Barra w="100%" h={38} r={6} />
          </div>
        </div>
      </section>
    </main>
  );
}
