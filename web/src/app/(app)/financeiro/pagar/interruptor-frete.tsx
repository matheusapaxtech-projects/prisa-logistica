"use client";

import { useState, useTransition, type FormEvent } from "react";
import { Truck } from "lucide-react";
import { Dialogo } from "@/components/Dialogo";
import { toast } from "@/components/Toast";
import { formato } from "@/lib/formato";
import { definirParcelasFrete } from "./actions";
import type { ConfigFrete } from "./consultas";

/** Quem mudou e quando, para a frase do bloco ("Mudado por Ana em 26/10/2026 14:30."); vazio se nunca mudou. */
function quemMudou(config: ConfigFrete): string | null {
  if (!config.mudadoEm) return null;
  const quando = formato.dataHora(config.mudadoEm);
  return config.mudadoPorNome ? `Mudado por ${config.mudadoPorNome} em ${quando}.` : `Mudado em ${quando}.`;
}

/* Interruptor do frete dos motoristas no Contas a pagar. Ligado, cada viagem contratada daqui em diante ganha o adiantamento
   e o saldo aqui, para outra pessoa aprovar antes de pagar; desligado, o Quadro confirma o pagamento à mão, como antes.
   Todos os perfis do financeiro leem; só o administrador muda (o banco também confere). Mudar pede confirmação. */
export function InterruptorFrete({ config, admin }: { config: ConfigFrete; admin: boolean }) {
  const [aberto, setAberto] = useState(false);
  const mudou = quemMudou(config);

  return (
    <section className="contas-taxa" aria-label="Frete dos motoristas no Contas a pagar">
      <Truck size={16} strokeWidth={1.7} aria-hidden="true" />
      <div className="contas-taxa-texto">
        <p>
          {config.ativo ? (
            <>
              O frete dos motoristas <b>está no Contas a pagar</b>: o adiantamento e o saldo das viagens novas são pagos aqui, depois de aprovados por outra
              pessoa.
            </>
          ) : (
            <>
              O frete dos motoristas <b>não está no Contas a pagar</b>: nas viagens novas, o Quadro confirma o pagamento à mão.
            </>
          )}
        </p>
        {mudou && <p className="nota">{mudou}</p>}
      </div>
      {admin && (
        <button className="btn" type="button" onClick={() => setAberto(true)}>
          {config.ativo ? "Desligar" : "Ligar"}
        </button>
      )}
      {aberto && <DialogoInterruptor key={String(config.ativo)} ativo={config.ativo} aoFechar={() => setAberto(false)} />}
    </section>
  );
}

/* Confirmação de ligar ou desligar: explica em palavras simples o que muda. Monte só quando for abrir. */
function DialogoInterruptor({ ativo, aoFechar }: { ativo: boolean; aoFechar: () => void }) {
  const [erro, setErro] = useState<string | null>(null);
  const [gravando, iniciar] = useTransition();

  function aoEnviar(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    if (gravando) return;
    setErro(null);
    iniciar(async () => {
      const r = await definirParcelasFrete(!ativo);
      if (!r.ok) {
        setErro(r.erro);
        return;
      }
      toast(ativo ? "Frete dos motoristas fora do Contas a pagar nas viagens novas." : "Frete dos motoristas no Contas a pagar nas viagens novas.");
      aoFechar();
    });
  }

  return (
    <Dialogo
      aberto
      aoFechar={aoFechar}
      titulo={ativo ? "Desligar o frete no Contas a pagar" : "Ligar o frete no Contas a pagar"}
      onSubmit={aoEnviar}
      pe={
        <>
          <button className="btn" type="button" data-fechar disabled={gravando}>
            Voltar
          </button>
          <button className="btn btn-primario" type="submit" disabled={gravando} aria-busy={gravando}>
            {ativo ? "Desligar" : "Ligar"}
          </button>
        </>
      }
    >
      {ativo ? (
        <p className="nota">
          As viagens novas voltam a ter o pagamento confirmado à mão no Quadro. As viagens que já têm adiantamento e saldo continuam aqui no Contas a pagar.
        </p>
      ) : (
        <p className="nota">
          As viagens contratadas daqui em diante terão o adiantamento e o saldo pagos aqui no Contas a pagar, com aprovação de outra pessoa. O Quadro deixa de
          confirmar esses pagamentos à mão.
        </p>
      )}
      {erro && (
        <div className="aviso aviso-bloqueado" role="alert">
          <p>{erro}</p>
        </div>
      )}
    </Dialogo>
  );
}
