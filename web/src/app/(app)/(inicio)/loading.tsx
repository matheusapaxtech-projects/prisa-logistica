/* Esqueleto do Início: mesma grade, mesmos blocos e alturas de linha da tela pronta
   (placa 5 colunas, marco de 52 px, conjunto de 92 px), com barras no lugar do texto. */
function Barra({ w, h = 12, r }: { w: number | string; h?: number; r?: number | string }) {
  return <i style={{ width: w, height: h, ...(r != null ? { borderRadius: r } : {}) }} />;
}

function Cabecalho({ titulo, id }: { titulo: string; id: string }) {
  return (
    <div className="bloco-cab">
      <h2 id={id}>{titulo}</h2>
      <span className="dir carregando" aria-hidden="true">
        <Barra w={120} />
      </span>
    </div>
  );
}

function LinhaMarco({ conjunto = false }: { conjunto?: boolean }) {
  return (
    <div className={`marco carregando${conjunto ? " marco-conjunto" : ""}`} aria-hidden="true">
      <span className="quem">
        <Barra w="55%" h={14} />
        <br />
        <Barra w="75%" />
      </span>
      {conjunto ? <Barra w="100%" h={44} r={6} /> : <Barra w="100%" h={8} r={4} />}
      <span className="dias">
        <Barra w={conjunto ? "100%" : 64} h={conjunto ? 20 : 14} />
      </span>
    </div>
  );
}

export default function CarregandoInicio() {
  return (
    <main aria-busy="true" aria-label="Carregando o início">
      <div className="titulo">
        <div>
          <h1>Início</h1>
          <p className="sub carregando" aria-hidden="true">
            <Barra w={360} h={14} />
          </p>
        </div>
      </div>

      <div className="grade">
        <section className="bloco c12" aria-labelledby="h-pend">
          <Cabecalho titulo="Pendências" id="h-pend" />
          <div className="advertencias" aria-hidden="true">
            {[0, 1, 2, 3, 4].map((n) => (
              <div className="advertencia carregando" key={n}>
                <Barra w={44} h={44} r="50%" />
                <span className="txt">
                  <Barra w="80%" h={14} />
                  <br />
                  <Barra w="60%" />
                </span>
              </div>
            ))}
          </div>
        </section>

        <section className="bloco c7" aria-labelledby="h-venc">
          <Cabecalho titulo="Vencimentos" id="h-venc" />
          <div className="bloco-corpo" style={{ paddingTop: 8 }}>
            <div className="marcos">
              {[0, 1, 2, 3, 4].map((n) => (
                <LinhaMarco key={n} />
              ))}
            </div>
          </div>
        </section>

        <section className="bloco c5" aria-labelledby="h-cad">
          <Cabecalho titulo="Cadastros" id="h-cad" />
          <div className="bloco-corpo">
            <div className="marcos">
              {[0, 1, 2, 3, 4, 5].map((n) => (
                <div className="marco carregando" key={n} style={{ gridTemplateColumns: "minmax(0,1fr) auto" }} aria-hidden="true">
                  <span className="quem">
                    <Barra w="40%" h={14} />
                    <br />
                    <Barra w="70%" />
                  </span>
                  <span className="dias">
                    <Barra w={28} h={16} />
                  </span>
                </div>
              ))}
            </div>
          </div>
        </section>

        <section className="bloco c12" aria-labelledby="h-conj">
          <Cabecalho titulo="Conjuntos rodando" id="h-conj" />
          <div className="bloco-corpo" style={{ paddingTop: 8 }}>
            {[0, 1].map((n) => (
              <LinhaMarco key={n} conjunto />
            ))}
          </div>
        </section>
      </div>
    </main>
  );
}
