import "@/styles/paginas/admin.css";

/* Esqueleto de /usuarios: título, aviso, abas, busca e 5 linhas da tabela (altura real da linha). */
function Barra({ w, h = 12, r }: { w: number | string; h?: number; r?: number | string }) {
  return <i style={{ width: w, height: h, ...(r != null ? { borderRadius: r } : {}) }} />;
}

export default function CarregandoUsuarios() {
  return (
    <main aria-busy="true" aria-label="Carregando os usuários">
      <div className="titulo">
        <div>
          <h1>Usuários</h1>
          <p className="sub carregando" aria-hidden="true">
            <Barra w={300} h={14} />
          </p>
        </div>
      </div>
      <div className="aviso aviso-info aviso-topo carregando" aria-hidden="true">
        <div>
          <Barra w="70%" h={14} />
        </div>
      </div>
      <div className="abas carregando" aria-hidden="true">
        {[64, 72, 96, 88].map((w) => (
          <a key={w}>
            <Barra w={w} h={14} />
          </a>
        ))}
      </div>
      <div className="ferramentas carregando" aria-hidden="true">
        <Barra w={300} h={36} r={8} />
      </div>
      <div className="tabela-wrap">
        <table className="tabela tabela-usuarios" aria-hidden="true">
          <tbody>
            {[0, 1, 2, 3, 4].map((n) => (
              <tr key={n} className="carregando" style={{ cursor: "default" }}>
                <td>
                  <div className="usuario-cel">
                    <Barra w={28} h={28} r="50%" />
                    <div className="txt">
                      <Barra w={140} h={14} />
                      <br />
                      <Barra w={200} />
                    </div>
                  </div>
                </td>
                <td className="col-papel some-celular">
                  <Barra w={90} />
                </td>
                <td className="some-celular">
                  <Barra w={70} />
                </td>
                <td className="num some-celular">
                  <Barra w={64} />
                </td>
                <td className="acao">
                  <Barra w={70} h={36} r={8} />
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </main>
  );
}
