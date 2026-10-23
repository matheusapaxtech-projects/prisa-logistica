/* Marco da validade do RNTRC (marcoRntrc de prototipo/proprietario.html): nome e data à esquerda, dias
   restantes à direita, trilho de um ano embaixo. Sem estado: serve ao servidor e ao formulário. */
import { EstadoVazio } from "@/components/EstadoVazio";
import { MarcoKm } from "@/components/MarcoKm";
import { Ponto } from "@/components/Ponto";
import { diasAte } from "@/lib/datas";
import { formato } from "@/lib/formato";

export function MarcoRntrc({ validade, numero }: { validade: string; numero: string }) {
  if (!validade)
    return (
      <EstadoVazio>
        {numero
          ? "Validade do RNTRC não informada: sem ela o NILT não avisa quando vencer."
          : "Sem RNTRC: o proprietário fica pendente até o número e a validade serem informados."}
      </EstadoVazio>
    );
  const dias = diasAte(validade);
  const venc = dias < 0;
  return (
    <div className={`marco-rntrc ${venc ? "vencido" : dias <= 30 ? "vencendo" : "ok"}`}>
      <span className="quem">
        <b>Validade do RNTRC</b>
        <span>
          {numero && (
            <>
              <span className="cod">{numero}</span>
              <Ponto />
            </>
          )}
          {venc ? "venceu em" : "válido até"} {formato.data(validade)}
        </span>
      </span>
      <span className={`dias${venc ? " vencido" : ""}`}>
        <b>{venc ? "Vencido" : `${dias} ${dias === 1 ? "dia" : "dias"}`}</b>
        <span>{venc ? formato.dias(dias) : "restantes"}</span>
      </span>
      <MarcoKm dias={dias} janela={365} />
      <span className="escala" aria-hidden="true">
        <span>hoje</span>
        <span>6 meses</span>
        <span>1 ano</span>
      </span>
    </div>
  );
}
