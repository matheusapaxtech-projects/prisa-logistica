"use client";

import { useRef, useState, useTransition, type FormEvent, type ReactNode } from "react";
import { useRouter } from "next/navigation";
import { CircleAlert } from "lucide-react";
import { BarraSalvar, useAlteracoes } from "@/components/BarraSalvar";
import { toast } from "@/components/Toast";
import type { OpcaoPessoa } from "../pessoas-tipos";
import { lerNum, num, type TipoVeiculo } from "../rotulos";
import { PainelCrlv, PainelFrota, PainelRastreamento, PainelTag } from "./paineis";
import { PainelCaracteristicas, PainelProprietarios, type Foto } from "./paineis-vivos";
import { salvarVeiculo } from "./actions";
import type { VeiculoFicha } from "./tipos";

type Props = {
  v: VeiculoFicha;
  /** Aba aberta (`?aba=`): só o painel dela aparece, mas os outros ficam no formulário, para o que foi
     digitado numa aba não se perder ao passar para outra. */
  ativa: string;
  tipos: TipoVeiculo[];
  marcas: { id: number; nome: string }[];
  operadoras: { id: number; nome: string }[];
  unidades: { id: number; nome: string }[];
  tipo: TipoVeiculo;
  posse: OpcaoPessoa | null;
  documento: OpcaoPessoa | null;
  motorista: OpcaoPessoa | null;
  crlv: { nome: string; validade: string | null } | null;
  contrato: { nome: string; validade: string | null } | null;
  /** Tara das outras peças do conjunto aberto (só cavalo); nulo = livre. */
  taraPecas: number | null;
  podeEditar: boolean;
  verDocumentosHref: string;
  anexarHref: string | null;
};

const arred = (n: number) => +n.toFixed(1);

/* A ficha editável do veículo (`#form-ficha` de veiculo.html): seis abas num formulário só, uma barra
   "Salvar alterações". Campos não controlados; o que reage na hora (cartões de posse e ANTT, réguas de
   peso, marco do seguro) lê o formulário a cada alteração. */
export function FichaForm(p: Props) {
  const { v } = p;
  const router = useRouter();
  const form = useRef<HTMLFormElement>(null);
  const { pendente, aoAlterar, limpar } = useAlteracoes();
  const [salvando, iniciar] = useTransition();
  const [erros, setErros] = useState<Record<string, string>>({});
  const [erroGeral, setErroGeral] = useState<string | null>(null);
  const [posse, setPosse] = useState(p.posse);
  const [documento, setDocumento] = useState(p.documento);
  const [motorista, setMotorista] = useState(p.motorista);
  const autoInicial = v.capacidade_carga_t == null;
  const calcInicial = v.pbt_t != null && v.tara_t != null ? arred(v.pbt_t - v.tara_t) : null;
  const [foto, setFoto] = useState<Foto>({
    pbt: v.pbt_t,
    tara: v.tara_t,
    cmt: v.cmt_t,
    auto: autoInicial,
    cap: autoInicial ? calcInicial : v.capacidade_carga_t,
  });
  const [seguro, setSeguro] = useState(v.seguro_validade ?? "");

  const campo = (nome: string) => form.current?.elements.namedItem(nome) as HTMLInputElement | null;

  function lerForm(): { foto: Foto; seguro: string } {
    const pbt = lerNum(campo("pbt_t")?.value);
    const tara = lerNum(campo("tara_t")?.value);
    const auto = campo("cap_auto")?.checked ?? autoInicial;
    const calc = pbt != null && tara != null ? arred(pbt - tara) : null;
    const capEl = campo("capacidade_carga_t");
    // Calculada: o campo mostra o cálculo e fica só leitura (o React troca o `readOnly`).
    if (capEl && auto) capEl.value = calc == null ? "" : num(calc);
    return {
      foto: { pbt, tara, cmt: lerNum(campo("cmt_t")?.value), auto, cap: auto ? calc : lerNum(capEl?.value) },
      seguro: campo("seguro_validade")?.value ?? "",
    };
  }

  function aoMudar(e: FormEvent<HTMLFormElement>) {
    aoAlterar(e);
    const l = lerForm();
    setFoto(l.foto);
    setSeguro(l.seguro);
  }

  /** Escolha de proprietário/motorista não gera evento de formulário: avisa a barra à mão. */
  function marcarAlterado() {
    form.current?.dispatchEvent(new Event("input", { bubbles: true }));
  }
  function trocarPosse(o: OpcaoPessoa | null) {
    setPosse(o);
    marcarAlterado();
  }
  function trocarDocumento(o: OpcaoPessoa | null) {
    setDocumento(o);
    marcarAlterado();
  }
  function trocarMotorista(o: OpcaoPessoa | null) {
    setMotorista(o);
    marcarAlterado();
  }

  function descartar() {
    form.current?.reset();
    // O reset do navegador acontece depois: relê o formulário no quadro seguinte.
    setTimeout(() => {
      const l = lerForm();
      setFoto(l.foto);
      setSeguro(l.seguro);
    });
    setPosse(p.posse);
    setDocumento(p.documento);
    setMotorista(p.motorista);
    setErros({});
    setErroGeral(null);
    limpar();
  }

  function aoSalvar(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setErroGeral(null);
    setErros({});
    const dados = new FormData(e.currentTarget);
    iniciar(async () => {
      const r = await salvarVeiculo(v.id, dados);
      if (!r.ok) {
        setErroGeral(r.erro);
        const campos = r.campos ?? {};
        setErros(campos);
        // Leva a pessoa à aba do primeiro campo com erro, se não for a que está aberta.
        for (const nome of Object.keys(campos)) {
          const aba = document.getElementById(nome)?.closest("[data-painel]")?.getAttribute("data-painel");
          if (aba) {
            if (aba !== p.ativa) router.replace(`?aba=${aba}`, { scroll: false });
            break;
          }
        }
        return;
      }
      toast("Alterações salvas");
      limpar();
    });
  }

  const painel = (id: string, corpo: ReactNode) => (
    <div data-painel={id} hidden={p.ativa !== id}>
      {corpo}
    </div>
  );

  return (
    <form id="form-ficha" ref={form} noValidate onInput={aoMudar} onSubmit={aoSalvar}>
      {erroGeral && (
        <div className="aviso aviso-bloqueado" role="alert" style={{ marginBottom: 16 }}>
          <CircleAlert size={18} strokeWidth={1.6} aria-hidden="true" />
          <div>{erroGeral}</div>
        </div>
      )}
      <fieldset disabled={!p.podeEditar} className="ficha-campos">
        {painel(
          "crlv",
          <PainelCrlv v={v} erros={erros} tipos={p.tipos} marcas={p.marcas} tipo={p.tipo} crlv={p.crlv} />,
        )}
        {painel(
          "proprietarios",
          <PainelProprietarios
            v={v}
            erros={erros}
            posse={posse}
            documento={documento}
            motorista={motorista}
            aoPosse={trocarPosse}
            aoDocumento={trocarDocumento}
            aoMotorista={trocarMotorista}
            contrato={p.contrato}
            situacaoOperacional={v.situacao_operacional}
            verDocumentosHref={p.verDocumentosHref}
            anexarHref={p.anexarHref}
          />,
        )}
        {painel(
          "caracteristicas",
          <PainelCaracteristicas
            v={v}
            erros={erros}
            categoria={p.tipo.categoria}
            foto={foto}
            taraPecas={p.taraPecas}
            daqui={autoInicial ? calcInicial : v.capacidade_carga_t}
          />,
        )}
        {painel("tag", <PainelTag v={v} erros={erros} operadoras={p.operadoras} seguroValidade={seguro} />)}
        {painel("rastreamento", <PainelRastreamento v={v} erros={erros} />)}
        {painel("frota", <PainelFrota v={v} erros={erros} unidades={p.unidades} />)}
      </fieldset>
      {p.podeEditar && (
        <BarraSalvar pendente={pendente} salvando={salvando} onDescartar={descartar} texto={`Alterações não salvas em ${v.placa}`} />
      )}
    </form>
  );
}
