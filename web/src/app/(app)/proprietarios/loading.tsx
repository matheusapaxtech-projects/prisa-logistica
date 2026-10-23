import "@/styles/paginas/proprietarios.css";

/* Esqueleto da lista de proprietários: mesmo título, abas, ferramentas e linhas da tabela pronta,
   com barras no lugar do texto. */
function Barra({ w, h = 12, r }: { w: number | string; h?: number; r?: number | string }) {
  return <i style={{ width: w, height: h, ...(r != null ? { borderRadius: r } : {}) }} />;
}

const COLUNAS = ["Proprietário", "Documento", "RNTRC", "Veículos", "Responsável", "Situação"];
const CLASSES = ["col-prop", "col-doc some-tablet", "some-celular", "num some-celular", "some-celular", ""];

export default function CarregandoProprietarios() {
  return (
    <main className="prop" aria-busy="true" aria-label="Carregando os proprietários">
      <div className="titulo">
        <div>
          <h1>Proprietários</h1>
          <p className="sub carregando" aria-hidden="true">
            <Barra w={420} h={14} />
          </p>
        </div>
      </div>
      <div className="abas carregando" aria-hidden="true" style={{ paddingBottom: 12 }}>
        {[60, 100, 70, 80, 190].map((w, i) => (
          <Barra key={i} w={w} h={14} />
        ))}
      </div>
      <div className="ferramentas carregando" aria-hidden="true">
        <Barra w={320} h={32} r={6} />
        <Barra w={90} h={14} />
      </div>
      <div className="tabela-wrap">
        <table className="tabela" aria-hidden="true">
          <thead>
            <tr>
              {COLUNAS.map((c, i) => (
                <th key={c} scope="col" className={CLASSES[i] || undefined}>
                  {c}
                </th>
              ))}
            </tr>
          </thead>
          <tbody className="carregando">
            {Array.from({ length: 6 }, (_, n) => (
              <tr key={n}>
                <td>
                  <Barra w={200} h={14} />
                  <br />
                  <Barra w={110} />
                </td>
                <td className="some-tablet">
                  <Barra w={130} />
                </td>
                <td className="some-celular">
                  <Barra w={110} h={14} />
                  <br />
                  <Barra w={130} />
                </td>
                <td className="num some-celular">
                  <Barra w={120} h={14} />
                  <br />
                  <Barra w={90} />
                </td>
                <td className="some-celular">
                  <Barra w={120} h={14} />
                  <br />
                  <Barra w={110} />
                </td>
                <td>
                  <Barra w={64} h={20} r={4} />
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </main>
  );
}
