import "@/styles/paginas/motoristas.css";

/* Esqueleto da lista de motoristas: mesmo título, abas, ferramentas e linhas de duas linhas da
   tabela pronta, com barras no lugar do texto. */
function Barra({ w, h = 12, r }: { w: number | string; h?: number; r?: number | string }) {
  return <i style={{ width: w, height: h, ...(r != null ? { borderRadius: r } : {}) }} />;
}

const COLUNAS = ["Motorista", "CPF", "CNH", "Consulta de risco", "Telefone", "Cidade", "Cadastro"];
const CLASSES = ["", "col-tab some-celular", "some-celular", "some-celular", "col-tab some-celular", "col-tab some-celular", ""];

export default function CarregandoMotoristas() {
  return (
    <main aria-busy="true" aria-label="Carregando os motoristas">
      <div className="titulo">
        <div>
          <h1>Motoristas</h1>
          <p className="sub carregando" aria-hidden="true">
            <Barra w={420} h={14} />
          </p>
        </div>
      </div>
      <div className="abas carregando" aria-hidden="true" style={{ paddingBottom: 12 }}>
        {[60, 70, 80, 220, 90].map((w, i) => (
          <Barra key={i} w={w} h={14} />
        ))}
      </div>
      <div className="ferramentas carregando" aria-hidden="true">
        <Barra w={300} h={32} r={6} />
        <Barra w={280} h={32} r={6} />
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
            {Array.from({ length: 8 }, (_, n) => (
              <tr key={n}>
                <td>
                  <div className="cel-pessoa">
                    <Barra w={28} h={28} r="50%" />
                    <span>
                      <Barra w={170} h={14} />
                      <br />
                      <Barra w={80} />
                    </span>
                  </div>
                </td>
                <td className="col-tab some-celular">
                  <Barra w={100} />
                </td>
                <td className="some-celular">
                  <Barra w={80} h={14} />
                  <br />
                  <Barra w={120} />
                </td>
                <td className="some-celular">
                  <Barra w={70} h={14} />
                  <br />
                  <Barra w={90} />
                </td>
                <td className="col-tab some-celular">
                  <Barra w={100} h={14} />
                  <br />
                  <Barra w={60} />
                </td>
                <td className="col-tab some-celular">
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
