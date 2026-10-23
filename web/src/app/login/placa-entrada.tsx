import { ArrowRight, ArrowUp, ArrowUpRight } from "lucide-react";

// Placa de orientação: o NILT se apresenta como uma placa verde de rodovia (prototipo/login.html).
export function PlacaEntrada() {
  return (
    <section className="placa-entrada" aria-label="NILT, Núcleo Integrado de Logística e Transporte">
      <div className="cabeca">
        <svg
          className="sinal-nilt"
          viewBox="0 0 24 24"
          fill="none"
          stroke="#fff"
          strokeWidth="2.2"
          strokeLinecap="round"
          strokeLinejoin="round"
          aria-hidden="true"
        >
          <path d="M12 21V8" />
          <path d="M12 8l-4 4" />
          <path d="M12 8l4 4" />
          <path d="M5 21h14" />
        </svg>
        <div>
          <p className="nome">NILT</p>
          <p className="extenso">Núcleo Integrado de Logística e Transporte</p>
        </div>
      </div>
      <div className="faixa" aria-hidden="true"></div>
      <ul className="destinos" aria-label="O que está no NILT">
        <li>
          <ArrowUp />
          <span>Motoristas e proprietários</span>
        </li>
        <li>
          <ArrowUpRight />
          <span>Veículos e conjuntos</span>
        </li>
        <li>
          <ArrowRight />
          <span>Documentos e vencimentos</span>
        </li>
      </ul>
      <p className="rodape">Prisa Logística e Transportes</p>
    </section>
  );
}
