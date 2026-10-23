import "@/styles/paginas/veiculos.css";

/* Esqueleto da lista: mesmo título, abas, ferramentas e cabeçalho da tabela da tela pronta,
   com barras no lugar do texto (linha da tabela com placa e duas linhas de apoio). */
function Barra({ w, h = 12, r }: { w: number | string; h?: number; r?: number | string }) {
  return <i style={{ width: w, height: h, ...(r != null ? { borderRadius: r } : {}) }} />;
}

export default function CarregandoVeiculos() {
  return (
    <main aria-busy="true" aria-label="Carregando os veículos">
      <div className="titulo">
        <div>
          <h1>Veículos</h1>
          <p className="sub carregando" aria-hidden="true">
            <Barra w={380} h={14} />
          </p>
        </div>
      </div>

      <nav className="abas carregando" aria-hidden="true">
        {[64, 76, 78, 72, 68, 96, 90].map((w, n) => (
          <span key={n} style={{ display: "inline-flex", alignItems: "center", height: 40 }}>
            <Barra w={w} h={14} />
          </span>
        ))}
      </nav>

      <div className="ferramentas carregando" aria-hidden="true">
        <Barra w={300} h={32} r={6} />
        <Barra w={168} h={32} r={6} />
        <span className="total">
          <Barra w={72} h={14} />
        </span>
      </div>

      <div className="tabela-wrap">
        <table className="tabela tabela-veiculos">
          <thead>
            <tr>
              <th scope="col">Placa</th>
              <th scope="col" className="some-tablet">Tipo</th>
              <th scope="col" className="some-tablet">Marca e modelo</th>
              <th scope="col" className="some-celular">Proprietário</th>
              <th scope="col" className="num some-celular">Carga ou CMT</th>
              <th scope="col" className="some-tablet">Conjunto atual</th>
              <th scope="col">Situação</th>
            </tr>
          </thead>
          <tbody className="carregando" aria-hidden="true">
            {Array.from({ length: 8 }, (_, n) => (
              <tr key={n}>
                <td className="col-placa">
                  <Barra w={108} h={32} r={4} />
                  <span className="linha2 so-tablet"><Barra w={180} h={12} /></span>
                  <span className="linha2 so-celular"><Barra w={180} h={12} /></span>
                  <span className="linha2 so-celular"><Barra w={220} h={12} /></span>
                </td>
                <td className="some-tablet">
                  <Barra w={120} h={14} />
                  <br />
                  <Barra w={48} />
                </td>
                <td className="some-tablet">
                  <Barra w={150} h={14} />
                  <br />
                  <Barra w={64} />
                </td>
                <td className="some-celular col-prop">
                  <Barra w={130} h={14} />
                  <br />
                  <Barra w={100} />
                </td>
                <td className="num some-celular">
                  <Barra w={72} h={14} />
                  <br />
                  <Barra w={96} />
                </td>
                <td className="some-tablet">
                  <Barra w={110} h={14} />
                  <br />
                  <Barra w={80} />
                </td>
                <td>
                  <Barra w={64} h={22} r={4} />
                  <br />
                  <Barra w={40} />
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </main>
  );
}
