"use client";

import { useId, useState, useTransition, type FormEvent } from "react";
import { Plus } from "lucide-react";
import { Dialogo } from "@/components/Dialogo";
import { toast } from "@/components/Toast";
import { FORMAS } from "@/lib/contas";
import { hojeISO } from "@/lib/datas";
import { CampoDialogo } from "../pagar/dialogo-conta";
import type { CentroCusto } from "../pagar/consultas";
import { GRUPOS_PLANO, MAX_OBSERVACAO, ROTULO_GRUPO_PLANO } from "../pagar/regras";
import { editarTitulo, lancarTitulo } from "./actions";
import type { OpcaoCliente, TipoReceita, TituloReceber } from "./consultas";
import { lerTitulo, MAX_TITULO, type CampoTitulo } from "./regras";

/** Padrões do lançamento novo: o frete (CT-e) no tipo de receita e o centro "01.03". */
const PLANO_PADRAO = 1;
const CENTRO_PADRAO = "01.03";

/** "1.234,56" (para o campo de valor ao editar). */
const valorDigitado = (n: number) => n.toLocaleString("pt-BR", { minimumFractionDigits: 2, maximumFractionDigits: 2 });

type Props = {
  /** O título a editar; sem ele, o diálogo lança um novo. */
  titulo: TituloReceber | null;
  clientes: OpcaoCliente[];
  tipos: TipoReceita[];
  centros: CentroCusto[];
  aoFechar: () => void;
};

/* Diálogo "Lançar conta a receber" / "Editar conta a receber": cliente, título (ex.: CT-e 1234), tipo de receita,
   centro de custo, forma, vencimento, valor e observação. Monte o diálogo só quando for abrir (ele abre ao montar
   e fecha ao desmontar). Ao gravar, a tela recarrega sozinha. */
export function DialogoTitulo({ titulo, clientes, tipos, centros, aoFechar }: Props) {
  const id = useId();
  const [erros, setErros] = useState<Partial<Record<CampoTitulo, string>>>({});
  const [erroAcao, setErroAcao] = useState<string | null>(null);
  const [gravando, iniciar] = useTransition();

  const planoInicial = titulo ? String(titulo.planoId) : tipos.some((t) => t.id === PLANO_PADRAO) ? String(PLANO_PADRAO) : "";
  const centroInicial = titulo ? String(titulo.centroId) : String(centros.find((c) => c.codigo === CENTRO_PADRAO)?.id ?? "");
  const campo = (c: CampoTitulo) => `${id}-${c}`;
  const descrito = (c: CampoTitulo, ajuda = false) => [ajuda ? `${campo(c)}-ajuda` : null, erros[c] ? `${campo(c)}-erro` : null].filter(Boolean).join(" ") || undefined;

  function aoEnviar(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const form = e.currentTarget;
    const dados = new FormData(form);
    setErroAcao(null);
    const lido = lerTitulo(dados, hojeISO());
    if (!lido.ok) {
      setErros(lido.erros);
      const primeiro = Object.keys(lido.erros)[0];
      form.querySelector<HTMLElement>(`[name="${primeiro}"]`)?.focus();
      return;
    }
    setErros({});
    iniciar(async () => {
      const r = titulo ? await editarTitulo(titulo.id, dados) : await lancarTitulo(dados);
      if (!r.ok) {
        setErroAcao(r.erro);
        return;
      }
      toast(titulo ? "Conta alterada." : "Conta a receber lançada.");
      aoFechar();
    });
  }

  /** Qualquer edição apaga a frase de erro daquele campo. */
  function limpar(e: FormEvent<HTMLDivElement>) {
    const nome = (e.target as HTMLElement).getAttribute("name") as CampoTitulo | null;
    if (nome && erros[nome]) setErros((antes) => ({ ...antes, [nome]: undefined }));
  }

  const clienteAtualFora = titulo && !clientes.some((c) => c.id === titulo.clienteId);
  const tipoAtualFora = titulo && !tipos.some((t) => t.id === titulo.planoId);
  const centroAtualFora = titulo && !centros.some((c) => c.id === titulo.centroId);

  return (
    <Dialogo
      aberto
      aoFechar={aoFechar}
      className="dlg-conta"
      titulo={titulo ? `Editar a conta a receber ${titulo.numero}` : "Lançar conta a receber"}
      onSubmit={aoEnviar}
      pe={
        <>
          <button className="btn" type="button" data-fechar>
            Cancelar
          </button>
          <button className="btn btn-primario" type="submit" disabled={gravando} aria-busy={gravando}>
            {titulo ? "Salvar" : "Lançar"}
          </button>
        </>
      }
    >
      <div className="campos" onInput={limpar}>
        <CampoDialogo classe="f12" id={campo("cliente")} rotulo="Cliente" erro={erros.cliente}>
          <select id={campo("cliente")} name="cliente" defaultValue={titulo?.clienteId ?? ""} aria-invalid={!!erros.cliente || undefined} aria-describedby={descrito("cliente")}>
            <option value="">Escolha</option>
            {clienteAtualFora && <option value={titulo.clienteId}>{titulo.clienteNome}</option>}
            {clientes.map((c) => (
              <option key={c.id} value={c.id}>
                {c.rotulo}
              </option>
            ))}
          </select>
        </CampoDialogo>

        <CampoDialogo classe="f12" id={campo("titulo")} rotulo="Título" erro={erros.titulo} ajuda="Como o título é conhecido: o número do CT-e, da nota ou da fatura.">
          <input
            id={campo("titulo")}
            name="titulo"
            type="text"
            autoComplete="off"
            maxLength={MAX_TITULO}
            placeholder="Ex.: CT-e 1234"
            defaultValue={titulo?.titulo ?? ""}
            aria-invalid={!!erros.titulo || undefined}
            aria-describedby={descrito("titulo", true)}
          />
        </CampoDialogo>

        <CampoDialogo classe="f6" id={campo("plano")} rotulo="Tipo de receita" erro={erros.plano}>
          <select id={campo("plano")} name="plano" defaultValue={planoInicial} aria-invalid={!!erros.plano || undefined} aria-describedby={descrito("plano")}>
            <option value="">Escolha</option>
            {tipoAtualFora && <option value={titulo.planoId}>{titulo.planoNome}</option>}
            {GRUPOS_PLANO.map((g) => {
              const itens = tipos.filter((t) => t.grupo === g);
              return itens.length ? (
                <optgroup key={g} label={ROTULO_GRUPO_PLANO[g]}>
                  {itens.map((t) => (
                    <option key={t.id} value={t.id}>
                      {t.nome}
                    </option>
                  ))}
                </optgroup>
              ) : null;
            })}
          </select>
        </CampoDialogo>

        <CampoDialogo classe="f6" id={campo("centro")} rotulo="Centro de custo" erro={erros.centro}>
          <select id={campo("centro")} name="centro" defaultValue={centroInicial} aria-invalid={!!erros.centro || undefined} aria-describedby={descrito("centro")}>
            <option value="">Escolha</option>
            {centroAtualFora && <option value={titulo.centroId}>{`${titulo.centroCodigo} · ${titulo.centroNome}`}</option>}
            {centros.map((c) => (
              <option key={c.id} value={c.id}>
                {c.codigo} · {c.nome}
              </option>
            ))}
          </select>
        </CampoDialogo>

        <CampoDialogo classe="f4" id={campo("forma")} rotulo="Forma" erro={erros.forma}>
          <select id={campo("forma")} name="forma" defaultValue={titulo?.forma ?? "boleto"} aria-invalid={!!erros.forma || undefined} aria-describedby={descrito("forma")}>
            {FORMAS.map((f) => (
              <option key={f.id} value={f.id}>
                {f.rotulo}
              </option>
            ))}
          </select>
        </CampoDialogo>

        <CampoDialogo classe="f4" id={campo("vencimento")} rotulo="Vencimento" erro={erros.vencimento}>
          <input
            id={campo("vencimento")}
            name="vencimento"
            type="date"
            defaultValue={titulo?.vencimento ?? ""}
            aria-invalid={!!erros.vencimento || undefined}
            aria-describedby={descrito("vencimento")}
          />
        </CampoDialogo>

        <CampoDialogo classe="f4" id={campo("valor")} rotulo="Valor (R$)" erro={erros.valor}>
          <input
            id={campo("valor")}
            name="valor"
            type="text"
            inputMode="decimal"
            autoComplete="off"
            placeholder="0,00"
            defaultValue={titulo ? valorDigitado(titulo.valor) : ""}
            aria-invalid={!!erros.valor || undefined}
            aria-describedby={descrito("valor")}
          />
        </CampoDialogo>

        <CampoDialogo classe="f12" id={campo("observacao")} rotulo="Observação" opcional erro={erros.observacao}>
          <textarea
            id={campo("observacao")}
            name="observacao"
            rows={2}
            maxLength={MAX_OBSERVACAO}
            defaultValue={titulo?.observacao ?? ""}
            aria-invalid={!!erros.observacao || undefined}
            aria-describedby={descrito("observacao")}
          />
        </CampoDialogo>
      </div>

      {erroAcao && (
        <div className="aviso aviso-bloqueado" role="alert">
          <p>{erroAcao}</p>
        </div>
      )}
    </Dialogo>
  );
}

/** Botão "Lançar conta a receber" do topo da tela (o único botão escuro dela): abre o diálogo do título novo. */
export function BotaoLancarTitulo({ clientes, tipos, centros }: { clientes: OpcaoCliente[]; tipos: TipoReceita[]; centros: CentroCusto[] }) {
  const [aberto, setAberto] = useState(false);
  return (
    <>
      <button className="btn btn-primario" type="button" onClick={() => setAberto(true)}>
        <Plus size={16} strokeWidth={1.6} aria-hidden="true" />
        Lançar conta a receber
      </button>
      {aberto && <DialogoTitulo titulo={null} clientes={clientes} tipos={tipos} centros={centros} aoFechar={() => setAberto(false)} />}
    </>
  );
}
