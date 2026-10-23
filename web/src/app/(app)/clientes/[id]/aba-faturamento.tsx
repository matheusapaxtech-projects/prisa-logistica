"use client";

import { startTransition, useActionState, useEffect, useRef, useState, type FormEvent, type ReactNode } from "react";
import { useRouter } from "next/navigation";
import { CircleAlert } from "lucide-react";
import { BarraSalvar, useAlteracoes } from "@/components/BarraSalvar";
import { Campo } from "@/components/Campo";
import { toast } from "@/components/Toast";
import { MSG_FALTAM_DADOS } from "../../_pessoa/formulario";
import { Marcar } from "../../_pessoa/partes";
import { salvarFaturamento } from "../actions";
import type { ClienteRow } from "../consultas";
import { CONDICOES } from "../regras";

type Props = { cliente: ClienteRow; podeEditar: boolean };

function Secao({ id, titulo, texto, children }: { id: string; titulo: string; texto: string; children: ReactNode }) {
  return (
    <section className="secao" aria-labelledby={id}>
      <div className="secao-rotulo">
        <h2 id={id}>{titulo}</h2>
        <p>{texto}</p>
      </div>
      <div className="campos">{children}</div>
    </section>
  );
}

/* Aba "Faturamento e exigências": um formulário com a barra de salvar da ficha. Remonta a cada
   gravação (a página passa `key = updated_at`), então "Descartar" volta ao que está no banco. */
export function AbaFaturamento({ cliente: c, podeEditar }: Props) {
  const router = useRouter();
  const form = useRef<HTMLFormElement>(null);
  const { pendente, aoAlterar, limpar } = useAlteracoes();
  const [estado, enviar, salvando] = useActionState(salvarFaturamento, null);
  const [dispensado, setDispensado] = useState<typeof estado>(null);
  const [gr, setGr] = useState(c.exige_gr);

  const resposta = estado !== dispensado ? estado : null;
  const campos: Record<string, string> = resposta && !resposta.ok && "campos" in resposta ? (resposta.campos as Record<string, string>) : {};
  const erro = resposta && !resposta.ok && !("campos" in resposta) ? resposta.erro : null;

  useEffect(() => {
    if (!estado) return;
    if (estado.ok) {
      toast("Alterações salvas.");
      router.refresh();
    } else if ("campos" in estado) {
      toast(MSG_FALTAM_DADOS, "alert-circle");
      form.current?.querySelector<HTMLElement>(`[name="${Object.keys(estado.campos)[0]}"]`)?.focus();
    }
  }, [estado, router]);

  function salvar(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    if (salvando) return;
    const dados = new FormData(e.currentTarget);
    setDispensado(estado);
    startTransition(() => enviar(dados));
  }

  function descartar() {
    form.current?.reset();
    setGr(c.exige_gr);
    setDispensado(estado);
    limpar();
  }

  const corpo = (
    <>
      <input type="hidden" name="pessoa_id" value={c.pessoa_id} />
      <Secao id="h-fat" titulo="Faturamento" texto="Quando o frete deste cliente é cobrado e para onde vão o XML e a cobrança.">
        <div className="campo f12">
          <span className="rotulo" id="r-condicao">
            Condição de faturamento
          </span>
          <div className="opcoes" role="radiogroup" aria-labelledby="r-condicao">
            {Object.entries(CONDICOES).map(([v, rotulo]) => (
              <label className="opcao" key={v}>
                <input type="radio" name="condicao_faturamento" value={v} defaultChecked={c.condicao_faturamento === v} />
                <span>{rotulo}</span>
              </label>
            ))}
          </div>
          <span className="ajuda">Por CT-e: cada frete é cobrado quando o CT-e sai. Nas outras, os fretes do período vão numa fatura só.</span>
          {campos.condicao_faturamento && <span className="erro">{campos.condicao_faturamento}</span>}
        </div>
        <Campo
          classe="f6"
          id="email_xml"
          name="email_xml"
          type="email"
          label="E-mail para o XML"
          opcional
          placeholder="xml@empresa.com.br"
          autoComplete="off"
          defaultValue={c.email_xml ?? ""}
          ajuda="Recebe o XML do CT-e e do MDF-e."
          erro={campos.email_xml}
        />
        <Campo
          classe="f6"
          id="email_cobranca"
          name="email_cobranca"
          type="email"
          label="E-mail de cobrança"
          opcional
          placeholder="financeiro@empresa.com.br"
          autoComplete="off"
          defaultValue={c.email_cobranca ?? ""}
          ajuda="Recebe fatura e boleto."
          erro={campos.email_cobranca}
        />
      </Secao>
      <Secao id="h-exig" titulo="Exigências" texto="O que este cliente pede em cada viagem. Aparece como aviso ao iniciar a viagem.">
        <div className="campo f4">
          <span className="rotulo" aria-hidden="true">
            &nbsp;
          </span>
          <label className="marcar" htmlFor="exige_gr">
            <input type="checkbox" id="exige_gr" name="exige_gr" defaultChecked={c.exige_gr} onChange={(e) => setGr(e.currentTarget.checked)} />
            Exige GR (gerenciamento de risco)
          </label>
        </div>
        <Campo
          classe="f8"
          id="gerenciadora"
          name="gerenciadora"
          label="Gerenciadora"
          placeholder="Nome da gerenciadora de risco"
          maxLength={110}
          autoComplete="off"
          disabled={!gr}
          defaultValue={c.gerenciadora ?? ""}
          ajuda={gr ? "Quem faz a consulta e o cadastro do motorista para este cliente." : "Marque “Exige GR” para informar."}
          erro={campos.gerenciadora}
        />
        <div className="campo f12">
          <Marcar id="exige_sm" name="exige_sm" marcado={c.exige_sm}>
            Exige SM (solicitação de monitoramento) a cada viagem
          </Marcar>
        </div>
        <Campo
          classe="f12"
          id="exigencias"
          label="Outras exigências"
          opcional
          erro={campos.exigencias}
          ajuda="Ex.: lona nova, EPI completo, agendamento na portaria, foto da carga lacrada."
          controle={
            <textarea id="exigencias" name="exigencias" rows={4} maxLength={2000} defaultValue={c.exigencias ?? ""} aria-describedby="exigencias-ajuda" />
          }
        />
      </Secao>
    </>
  );

  return (
    <form id="form-faturamento" ref={form} noValidate onInput={podeEditar ? aoAlterar : undefined} onSubmit={salvar}>
      {podeEditar ? (
        corpo
      ) : (
        <fieldset disabled className="ficha-leitura">
          {corpo}
        </fieldset>
      )}
      {erro && (
        <div className="aviso aviso-bloqueado" role="alert">
          <CircleAlert size={16} strokeWidth={1.6} aria-hidden="true" />
          <span>{erro}</span>
        </div>
      )}
      {podeEditar && <BarraSalvar pendente={pendente} salvando={salvando} onDescartar={descartar} />}
    </form>
  );
}
