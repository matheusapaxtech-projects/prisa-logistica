"use client";

import { startTransition, useActionState, useEffect, useRef, useState, type FormEvent } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { Check, CircleAlert, ExternalLink, RefreshCw } from "lucide-react";
import { Campo } from "@/components/Campo";
import { toast } from "@/components/Toast";
import { Opcoes } from "../_pessoa/partes";
import { enderecoDoLocal, type Local } from "../clientes/consultas";
import { locaisDoCliente, salvarPedido } from "./actions";
import type { OpcaoCliente } from "./consultas";
import { TIPOS_CARGA_ANTT, TIPOS_TARIFA } from "./regras";
import { SeletorCliente } from "./seletor-cliente";

type Papel = "tomador_id" | "remetente_id" | "destinatario_id";
type Locais = { estado: "carregando" } | { estado: "pronto"; locais: Local[] } | { estado: "erro"; erro: string };

const MSG_CORRIJA = "Corrija os campos marcados em vermelho para criar.";

/** "Apucarana/PR · Rod. BR-376, km 210 · Armazém 2". */
function rotuloLocal(l: Local): string {
  return [`${l.cidade}/${l.uf}`, enderecoDoLocal(l), l.ponto_referencia].filter(Boolean).join(" · ");
}

/* Novo pedido: partes (tomador, remetente e destinatário, por busca), os locais de coleta (do remetente)
   e de descarga (do destinatário), produto, peso, datas e o frete da empresa, sempre digitado nesta
   entrega. Campos não controlados; os escolhidos por busca vão em campos escondidos. */
export function FormularioPedido({ clientes }: { clientes: OpcaoCliente[] }) {
  const router = useRouter();
  const form = useRef<HTMLFormElement>(null);
  const [partes, setPartes] = useState<Record<Papel, OpcaoCliente | null>>({ tomador_id: null, remetente_id: null, destinatario_id: null });
  const [locais, setLocais] = useState<Record<string, Locais>>({});
  const [estado, enviar, gravando] = useActionState(salvarPedido, null);
  const campos: Record<string, string> = estado && !estado.ok && "campos" in estado ? estado.campos : {};
  const erro = estado && !estado.ok && !("campos" in estado) ? estado.erro : null;
  const travado = gravando || (estado?.ok ?? false);

  useEffect(() => {
    if (!estado) return;
    if (estado.ok) {
      toast("Pedido criado. Abrindo a ficha…");
      router.push(`/pedidos/${estado.dados}?criado=1`);
      return;
    }
    if ("campos" in estado) {
      toast(MSG_CORRIJA, "alert-circle");
      form.current?.querySelector<HTMLElement>(`#${Object.keys(estado.campos)[0]}`)?.focus();
    }
    // `router` não dispara: só a resposta nova do servidor.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [estado]);

  function carregarLocais(pessoaId: string) {
    setLocais((c) => ({ ...c, [pessoaId]: { estado: "carregando" } }));
    void locaisDoCliente(pessoaId).then((r) =>
      setLocais((c) => ({ ...c, [pessoaId]: r.ok ? { estado: "pronto", locais: r.dados } : { estado: "erro", erro: r.erro } })),
    );
  }

  function escolher(papel: Papel, o: OpcaoCliente | null) {
    setPartes((p) => ({ ...p, [papel]: o }));
    // Remetente e destinatário trazem os locais; o que já veio fica guardado nesta tela.
    if (o && papel !== "tomador_id" && locais[o.id]?.estado !== "pronto") carregarLocais(o.id);
  }

  function aoEnviar(e: FormEvent<HTMLFormElement>) {
    // Envio manual (sem <form action>): o React não limpa os campos depois da action.
    e.preventDefault();
    if (travado) return;
    const dados = new FormData(e.currentTarget);
    startTransition(() => enviar(dados));
  }

  const parte = (papel: Papel, label: string, ajuda: string) => (
    <Campo
      classe="f4"
      id={papel}
      label={label}
      ajuda={ajuda}
      erro={campos[papel]}
      controle={
        <SeletorCliente
          id={papel}
          nome={papel}
          opcoes={clientes}
          valor={partes[papel]}
          aoMudar={(o) => escolher(papel, o)}
          descritoPor={[`${papel}-ajuda`, campos[papel] ? `${papel}-erro` : ""].filter(Boolean).join(" ")}
          invalido={!!campos[papel]}
        />
      }
    />
  );

  /** Select do local (de coleta, do remetente; de descarga, do destinatário). */
  const local = (nome: "local_coleta_id" | "local_descarga_id", dono: OpcaoCliente | null, papel: string) => {
    const l = dono ? locais[dono.id] : undefined;
    const lista = l?.estado === "pronto" ? l.locais : [];
    const ajuda = !dono
      ? `Escolha o ${papel} primeiro.`
      : l?.estado === "carregando"
        ? "Buscando os locais…"
        : l?.estado === "pronto" && lista.length === 0
          ? `${dono.nome} não tem local de coleta ou descarga cadastrado.`
          : `Locais de ${dono.nome}.`;
    return (
      <>
        <Campo
          classe="f8"
          id={nome}
          label={nome === "local_coleta_id" ? "Local de coleta" : "Local de descarga"}
          ajuda={ajuda}
          erro={campos[nome]}
          controle={
            <select
              id={nome}
              name={nome}
              // Outro dono (ou a lista que acabou de chegar) remonta o campo: nada do anterior fica.
              key={`${dono?.id ?? "nenhum"}-${l?.estado ?? ""}`}
              defaultValue={lista.length === 1 ? lista[0].id : ""}
              disabled={!lista.length}
              aria-describedby={[`${nome}-ajuda`, campos[nome] ? `${nome}-erro` : ""].filter(Boolean).join(" ")}
              aria-invalid={campos[nome] ? true : undefined}
            >
              <option value="">{lista.length ? "Escolha o local" : "—"}</option>
              {lista.map((x) => (
                <option key={x.id} value={x.id}>
                  {rotuloLocal(x)}
                </option>
              ))}
            </select>
          }
        />
        {dono && (l?.estado === "erro" || (l?.estado === "pronto" && lista.length === 0)) && (
          <div className="f12 aviso aviso-pendente" role={l.estado === "erro" ? "alert" : undefined}>
            <CircleAlert size={16} strokeWidth={1.6} aria-hidden="true" />
            <span className="txt">
              {l.estado === "erro" ? l.erro : `Cadastre o local na ficha de ${dono.nome} (aba Locais) e busque de novo.`}
            </span>
            <span className="acoes-aviso">
              {l.estado === "pronto" && (
                <Link className="btn btn-pequeno" href={`/clientes/${dono.id}?aba=locais`} target="_blank" rel="noopener">
                  <ExternalLink size={16} strokeWidth={1.6} aria-hidden="true" />
                  Abrir a ficha
                </Link>
              )}
              <button className="btn btn-pequeno" type="button" onClick={() => carregarLocais(dono.id)}>
                <RefreshCw size={16} strokeWidth={1.6} aria-hidden="true" />
                Buscar de novo
              </button>
            </span>
          </div>
        )}
      </>
    );
  };

  return (
    <form id="form" ref={form} noValidate onSubmit={aoEnviar}>
      <section className="secao" aria-labelledby="h-partes">
        <div className="secao-rotulo">
          <h2 id="h-partes">Partes</h2>
          <p>Quem paga o frete (tomador), de quem a carga sai (remetente) e para quem vai (destinatário). Podem ser o mesmo cliente.</p>
        </div>
        <div className="campos">
          {parte("tomador_id", "Tomador", "Quem paga o frete.")}
          {parte("remetente_id", "Remetente", "De onde sai a carga.")}
          {parte("destinatario_id", "Destinatário", "Para quem vai a carga.")}
        </div>
      </section>

      <section className="secao" aria-labelledby="h-locais">
        <div className="secao-rotulo">
          <h2 id="h-locais">Coleta e descarga</h2>
          <p>O local de coleta é um local do remetente; o de descarga, do destinatário. Locais se cadastram na ficha do cliente.</p>
        </div>
        <div className="campos">
          {local("local_coleta_id", partes.remetente_id, "remetente")}
          <Campo classe="f4" id="coleta_prevista" name="coleta_prevista" type="date" label="Coleta prevista" opcional erro={campos.coleta_prevista} />
          {local("local_descarga_id", partes.destinatario_id, "destinatário")}
          <Campo classe="f4" id="entrega_prevista" name="entrega_prevista" type="date" label="Entrega prevista" opcional erro={campos.entrega_prevista} />
        </div>
      </section>

      <section className="secao" aria-labelledby="h-carga">
        <div className="secao-rotulo">
          <h2 id="h-carga">Carga e frete</h2>
          <p>O peso total é o do pedido inteiro; cada viagem leva uma parte e a ficha mostra quanto falta carregar.</p>
        </div>
        <div className="campos">
          <Campo classe="f8" id="produto" name="produto" label="Produto" maxLength={200} autoComplete="off" placeholder="Ex.: soja em grão" erro={campos.produto} />
          <Campo
            classe="f4"
            id="peso_total_kg"
            label="Peso total"
            ajuda="Em quilos, como 30.000 ou 37.000,5."
            erro={campos.peso_total_kg}
            controle={
              <span className="sufixo">
                <input
                  id="peso_total_kg"
                  name="peso_total_kg"
                  className="num"
                  inputMode="decimal"
                  autoComplete="off"
                  placeholder="30.000"
                  aria-describedby={["peso_total_kg-ajuda", campos.peso_total_kg ? "peso_total_kg-erro" : ""].filter(Boolean).join(" ")}
                  aria-invalid={campos.peso_total_kg ? true : undefined}
                />
                <span aria-hidden="true">kg</span>
              </span>
            }
          />
          <Campo
            classe="f4"
            id="frete_empresa_valor"
            label="Frete da empresa"
            ajuda="Valor digitado: a tabela de frete entra depois."
            erro={campos.frete_empresa_valor}
            controle={
              <span className="prefixo">
                <span aria-hidden="true">R$</span>
                <input
                  id="frete_empresa_valor"
                  name="frete_empresa_valor"
                  className="num"
                  inputMode="decimal"
                  autoComplete="off"
                  placeholder="0,00"
                  aria-describedby={["frete_empresa_valor-ajuda", campos.frete_empresa_valor ? "frete_empresa_valor-erro" : ""].filter(Boolean).join(" ")}
                  aria-invalid={campos.frete_empresa_valor ? true : undefined}
                />
              </span>
            }
          />
          <Campo
            classe="f4"
            id="frete_empresa_tipo"
            label="O valor é"
            erro={campos.frete_empresa_tipo}
            controle={
              <select id="frete_empresa_tipo" name="frete_empresa_tipo" defaultValue="por_tonelada">
                <Opcoes mapa={TIPOS_TARIFA} />
              </select>
            }
          />
          <Campo
            classe="f4"
            id="tipo_carga_antt"
            label="Tipo de carga (ANTT)"
            ajuda="Coluna da tabela da ANTT usada no piso do frete do motorista."
            erro={campos.tipo_carga_antt}
            controle={
              <select
                id="tipo_carga_antt"
                name="tipo_carga_antt"
                defaultValue="granel_solido"
                aria-describedby={["tipo_carga_antt-ajuda", campos.tipo_carga_antt ? "tipo_carga_antt-erro" : ""].filter(Boolean).join(" ")}
              >
                <Opcoes mapa={TIPOS_CARGA_ANTT} />
              </select>
            }
          />
          <Campo
            classe="f12"
            id="observacao"
            label="Observação"
            opcional
            erro={campos.observacao}
            controle={<textarea id="observacao" name="observacao" rows={3} maxLength={2000} />}
          />
        </div>
      </section>

      {erro && (
        <div className="aviso aviso-bloqueado" role="alert">
          <CircleAlert size={16} strokeWidth={1.6} aria-hidden="true" />
          <span>{erro}</span>
        </div>
      )}

      <div className="rodape-form" id="rodape">
        <span className="resumo">As viagens se criam na ficha do pedido, depois de criar.</span>
        <Link className="btn" href="/pedidos">
          Cancelar
        </Link>
        <button className="btn btn-primario" type="submit" id="btn-criar" disabled={travado}>
          <Check size={16} strokeWidth={1.6} aria-hidden="true" />
          {gravando ? "Gravando…" : "Criar pedido"}
        </button>
      </div>
    </form>
  );
}
