import "@/styles/paginas/admin.css";

/* Esqueleto de /auditoria: título, filtros, um dia com 5 eventos e o painel "Quem viu documentos",
   com a grade e as alturas da tela pronta. */
function Barra({ w, h = 12, r }: { w: number | string; h?: number; r?: number | string }) {
  return <i style={{ width: w, height: h, ...(r != null ? { borderRadius: r } : {}) }} />;
}

export default function CarregandoAuditoria() {
  return (
    <main aria-busy="true" aria-label="Carregando a auditoria">
      <div className="titulo">
        <div>
          <h1>Auditoria</h1>
          <p className="sub carregando" aria-hidden="true">
            <Barra w={520} h={14} />
          </p>
        </div>
      </div>
      <div className="ferramentas carregando" aria-hidden="true">
        <Barra w={176} h={36} r={8} />
        <Barra w={176} h={36} r={8} />
        <Barra w={176} h={36} r={8} />
      </div>
      <div className="grade aud-grade">
        <div className="c8 aud-principal">
          <section className="dia" aria-hidden="true">
            <div className="dia-cab carregando">
              <Barra w={80} h={16} />
            </div>
            <ol className="eventos">
              {[0, 1, 2, 3, 4].map((n) => (
                <li className="evento carregando" key={n}>
                  <span className="hora">
                    <Barra w={36} />
                  </span>
                  <span className="no" />
                  <Barra w={28} h={28} r="50%" />
                  <div className="txt">
                    <p>
                      <Barra w="45%" h={14} />
                    </p>
                    <p className="resumo">
                      <Barra w="70%" />
                    </p>
                  </div>
                  <div className="reg">
                    <Barra w={120} h={14} />
                  </div>
                </li>
              ))}
            </ol>
          </section>
        </div>
        <aside className="bloco c4 aud-lgpd" aria-labelledby="h-vistos">
          <div className="bloco-cab">
            <h2 id="h-vistos">Quem viu documentos</h2>
          </div>
          <div className="bloco-corpo carregando" aria-hidden="true">
            <Barra w="100%" h={14} />
            <ul className="vistos">
              {[0, 1, 2].map((n) => (
                <li key={n}>
                  <Barra w={28} h={28} r="50%" />
                  <span className="txt">
                    <Barra w="60%" h={14} />
                    <Barra w="80%" />
                  </span>
                </li>
              ))}
            </ul>
          </div>
        </aside>
      </div>
    </main>
  );
}
