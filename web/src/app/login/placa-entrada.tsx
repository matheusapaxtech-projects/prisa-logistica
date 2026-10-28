import { ArrowRight, ArrowUp, ArrowUpRight } from "lucide-react";
import { SetaSaida } from "@/components/Logo";

// Placa de orientação: o NILT se apresenta como uma placa verde de rodovia (prototipo/login.html).
export function PlacaEntrada() {
  return (
    <section className="placa-entrada" aria-label="NILT, Núcleo Integrado de Logística e Transporte">
      <div className="cabeca">
        <SetaSaida className="sinal-nilt" />
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
