"use client";

import { startTransition, useActionState, useEffect, useRef, useState, type FormEvent } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { CircleAlert, Info, Route } from "lucide-react";
import { Campo } from "@/components/Campo";
import { Dialogo } from "@/components/Dialogo";
import { EstadoVazio } from "@/components/EstadoVazio";
import { Placa } from "@/components/Placa";
import { toast } from "@/components/Toast";
import { dataBr } from "@/lib/calculadora/rota";
import { formato } from "@/lib/formato";
import { Opcoes } from "../../_pessoa/partes";
import { criarViagem } from "../actions";
import type { OpcaoConjunto, RotaSalvaDoPedido } from "../consultas";
import { pesoSugerido, TIPOS_TARIFA } from "../regras";

type Props = {
  pedidoId: string;
  numero: number;
  saldoKg: number;
  /** Conjuntos abertos e com motorista. */
  conjuntos: OpcaoConjunto[];
  /** Rota salva na calculadora para coleta → descarga: sugere km e pedágio (a pessoa pode mudar). */
  rotaSalva?: RotaSalvaDoPedido | null;
};

/* Botão "Nova viagem" da ficha do pedido (só pedido aberto, Ruling R4) e o diálogo: conjunto aberto
   (placa do cavalo, carretas e motorista), peso previsto, frete do motorista, km e pedágio. O peso começa no saldo
   e, ao escolher o conjunto, vira min(saldo, capacidade do conjunto). Cavalo e motorista saem do
   conjunto, no servidor. Criada a viagem, abre a ficha dela. */
export function NovaViagem(props: Props) {
  const [aberto, setAberto] = useState(false);
  // Cada abertura é um diálogo novo: sem o erro nem os campos da vez anterior.
  const [vez, setVez] = useState(0);
  return (
    <>
      <button
        className="btn btn-primario"
        type="button"
        id="btn-nova-viagem"
        onClick={() => {
          setVez((n) => n + 1);
          setAberto(true);
        }}
      >
        <Route size={16} strokeWidth={1.6} aria-hidden="true" />
        Nova viagem
      </button>
      <DialogoViagem key={vez} {...props} aberto={aberto} aoFechar={() => setAberto(false)} />
    </>
  );
}

/** Sugestão do despacho (ranking ou composição do lote): o conjunto já marcado e o peso dele. */
export type InicialViagem = { conjuntoId: string; pesoKg: number };

export function DialogoViagem({
  pedidoId,
  numero,
  saldoKg,
  conjuntos,
  rotaSalva,
  aberto,
  aoFechar,
  inicial: sugestao,
}: Props & { aberto: boolean; aoFechar: () => void; inicial?: InicialViagem }) {
  const router = useRouter();
  const peso = useRef<HTMLInputElement>(null);
  const pedagio = useRef<HTMLInputElement>(null);
  // O pedágio sugerido só é escrito enquanto a pessoa não digitou outro valor.
  const pedagioSugerido = useRef("");
  const [estado, enviar, gravando] = useActionState(criarViagem, null);
  const campos: Record<string, string> = estado && !estado.ok && "campos" in estado ? estado.campos : {};
  const erro = estado && !estado.ok && !("campos" in estado) ? estado.erro : null;
  const travado = gravando || (estado?.ok ?? false);
  const inicial = sugestao ? sugestao.pesoKg : pesoSugerido(saldoKg, null);

  useEffect(() => {
    if (!estado?.ok) return;
    toast("Viagem criada. Abrindo a ficha…");
    router.push(`/viagens/${estado.dados}`);
    // `router` não dispara: só a resposta nova do servidor.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [estado]);

  function aoEnviar(e: FormEvent<HTMLFormElement>) {
    // Envio manual: o React não limpa os campos depois da action.
    e.preventDefault();
    if (travado || !conjuntos.length) return;
    const dados = new FormData(e.currentTarget);
    startTransition(() => enviar(dados));
  }

  function aoEscolher(c: OpcaoConjunto) {
    // Campo não controlado: a sugestão é escrita nele (a pessoa pode mudar depois).
    const sugerido = pesoSugerido(saldoKg, c.capacidadeT);
    if (peso.current) peso.current.value = sugerido > 0 ? formato.numeroCampo(sugerido) : "";
    const pe = rotaSalva?.pedagioEixoKm;
    if (pedagio.current && pe && c.eixos && (pedagio.current.value === "" || pedagio.current.value === pedagioSugerido.current)) {
      pedagioSugerido.current = formato.numeroCampo(Math.round(rotaSalva.km * c.eixos * pe * 100) / 100, 2);
      pedagio.current.value = pedagioSugerido.current;
    }
  }

  useEffect(() => {
    // Veio do despacho: o pedágio da rota salva já sai pelos eixos do conjunto sugerido (o peso vem pronto).
    const c = sugestao && conjuntos.find((x) => x.id === sugestao.conjuntoId);
    const pe = rotaSalva?.pedagioEixoKm;
    if (c && pe && c.eixos && pedagio.current && pedagio.current.value === "") {
      pedagioSugerido.current = formato.numeroCampo(Math.round(rotaSalva.km * c.eixos * pe * 100) / 100, 2);
      pedagio.current.value = pedagioSugerido.current;
    }
    // Só ao abrir com a sugestão.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const descr = (nome: string, ajuda = true) => [ajuda ? `${nome}-ajuda` : "", campos[nome] ? `${nome}-erro` : ""].filter(Boolean).join(" ") || undefined;

  return (
    <Dialogo
      aberto={aberto}
      aoFechar={aoFechar}
      titulo={`Nova viagem do pedido #${numero}`}
      className="dlg-viagem"
      onSubmit={aoEnviar}
      pe={
        <>
          <button className="btn" type="button" data-fechar disabled={gravando}>
            Cancelar
          </button>
          <button className="btn btn-primario" type="submit" disabled={travado || !conjuntos.length}>
            {gravando ? "Criando…" : "Criar viagem"}
          </button>
        </>
      }
    >
      {erro && (
        <div className="aviso aviso-bloqueado" role="alert">
          <CircleAlert size={16} strokeWidth={1.6} aria-hidden="true" />
          <span>{erro}</span>
        </div>
      )}
      <p className="muted">
        Saldo a carregar: <b>{formato.kg(Math.max(0, saldoKg))}</b>. A viagem nasce Planejada; o cavalo e o motorista são os do conjunto.
      </p>
      {saldoKg <= 0 && (
        <div className="aviso aviso-info">
          <Info size={16} strokeWidth={1.6} aria-hidden="true" />
          <span>Todo o peso deste pedido já está em viagens. Uma viagem a mais deixa o saldo negativo.</span>
        </div>
      )}

      <fieldset className="ficha-leitura" aria-describedby={campos.conjunto_id ? "conjunto_id-erro" : undefined}>
        <legend className="rotulo-grupo">Conjunto</legend>
        {conjuntos.length ? (
          <div className="conjuntos" role="radiogroup" aria-label="Conjuntos abertos com motorista">
            {conjuntos.map((c, i) => (
              <label className="conjunto-opcao" key={c.id}>
                <input
                  type="radio"
                  name="conjunto_id"
                  value={c.id}
                  id={i === 0 ? "conjunto_id" : undefined}
                  defaultChecked={sugestao?.conjuntoId === c.id}
                  onChange={() => aoEscolher(c)}
                />
                <span>
                  <span className="placas">
                    <Placa placa={c.cavalo} />
                    {c.carretas.map((p) => (
                      <Placa key={p} placa={p} />
                    ))}
                  </span>
                  <span className="cap">{c.capacidadeT ? `${formato.t(c.capacidadeT)} de carga` : "capacidade não informada"}</span>
                  <span className="mot">Motorista: {c.motorista}</span>
                </span>
              </label>
            ))}
          </div>
        ) : (
          <EstadoVazio>
            Nenhum conjunto aberto com motorista. Monte um em <Link href="/conjuntos/novo">Conjuntos</Link> ou escolha o motorista de um conjunto aberto.
          </EstadoVazio>
        )}
        {campos.conjunto_id && (
          <span className="erro" id="conjunto_id-erro" style={{ display: "block", marginTop: 6 }}>
            {campos.conjunto_id}
          </span>
        )}
      </fieldset>

      <div className="campos">
        <Campo
          classe="f12"
          id="peso_previsto_kg"
          label="Peso previsto"
          ajuda="O saldo, limitado à capacidade do conjunto."
          erro={campos.peso_previsto_kg}
          controle={
            <span className="sufixo">
              <input
                ref={peso}
                id="peso_previsto_kg"
                name="peso_previsto_kg"
                className="num"
                inputMode="decimal"
                autoComplete="off"
                placeholder="25.000"
                defaultValue={inicial > 0 ? formato.numeroCampo(inicial) : ""}
                aria-describedby={descr("peso_previsto_kg")}
                aria-invalid={campos.peso_previsto_kg ? true : undefined}
              />
              <span aria-hidden="true">kg</span>
            </span>
          }
        />
        <Campo
          classe="f6"
          id="frete_motorista_valor"
          label="Frete do motorista"
          opcional
          erro={campos.frete_motorista_valor}
          controle={
            <span className="prefixo">
              <span aria-hidden="true">R$</span>
              <input
                id="frete_motorista_valor"
                name="frete_motorista_valor"
                className="num"
                inputMode="decimal"
                autoComplete="off"
                placeholder="0,00"
                aria-describedby={descr("frete_motorista_valor", false)}
                aria-invalid={campos.frete_motorista_valor ? true : undefined}
              />
            </span>
          }
        />
        <Campo
          classe="f6"
          id="frete_motorista_tipo"
          label="O valor é"
          erro={campos.frete_motorista_tipo}
          controle={
            <select id="frete_motorista_tipo" name="frete_motorista_tipo" defaultValue="por_tonelada">
              <Opcoes mapa={TIPOS_TARIFA} />
            </select>
          }
        />
        <Campo
          classe="f6"
          id="km_viagem"
          label="Km da viagem"
          opcional
          ajuda={
            rotaSalva
              ? `Da rota salva na calculadora em ${dataBr(rotaSalva.atualizada)}. Com eles, o frete é conferido com o piso da ANTT.`
              : "Conferidos no Qualp. Com eles, o frete é conferido com o piso da ANTT."
          }
          erro={campos.km_viagem}
          controle={
            <span className="sufixo">
              <input
                id="km_viagem"
                name="km_viagem"
                defaultValue={rotaSalva ? String(rotaSalva.km) : undefined}
                className="num"
                inputMode="numeric"
                autoComplete="off"
                placeholder="755"
                aria-describedby={descr("km_viagem")}
                aria-invalid={campos.km_viagem ? true : undefined}
              />
              <span aria-hidden="true">km</span>
            </span>
          }
        />
        <Campo
          classe="f6"
          id="pedagio_valor"
          label="Pedágio da viagem"
          opcional
          ajuda={
            rotaSalva?.pedagioEixoKm
              ? "Da rota salva, pelos eixos do conjunto escolhido. Total do vale-pedágio, para o resultado do CT-e."
              : "Total do vale-pedágio, para o resultado do CT-e."
          }
          erro={campos.pedagio_valor}
          controle={
            <span className="prefixo">
              <span aria-hidden="true">R$</span>
              <input
                ref={pedagio}
                id="pedagio_valor"
                name="pedagio_valor"
                className="num"
                inputMode="decimal"
                autoComplete="off"
                placeholder="0,00"
                aria-describedby={descr("pedagio_valor")}
                aria-invalid={campos.pedagio_valor ? true : undefined}
              />
            </span>
          }
        />
      </div>
      {/* Por último: o Dialogo põe o foco no primeiro input da caixa. */}
      <input type="hidden" name="pedido_id" value={pedidoId} />
    </Dialogo>
  );
}
