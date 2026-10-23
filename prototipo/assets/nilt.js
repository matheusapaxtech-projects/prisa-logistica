/* NILT — comportamento compartilhado do protótipo.
   Na conversão para Next.js: shell → app/(app)/layout.tsx; helpers de formato e validação → lib/;
   desenhar.* → componentes React (Placa, Sinal, ConjuntoEngatado, MarcoKm). */
(function () {
  const N = window.NILT;
  const D = N.dados;

  /* ---------- formato ---------- */
  const so = (s) => String(s ?? '').replace(/\D/g, '');
  const fmt = {
    cpf: (v) => { const d = so(v); return d.length === 11 ? d.replace(/(\d{3})(\d{3})(\d{3})(\d{2})/, '$1.$2.$3-$4') : v || ''; },
    cnpj: (v) => { const d = so(v); return d.length === 14 ? d.replace(/(\d{2})(\d{3})(\d{3})(\d{4})(\d{2})/, '$1.$2.$3/$4-$5') : v || ''; },
    doc: (p) => (p.tipo === 'pj' ? fmt.cnpj(p.cnpj) : fmt.cpf(p.cpf)),
    telefone: (v) => { const d = so(v); if (d.length === 11) return d.replace(/(\d{2})(\d{5})(\d{4})/, '($1) $2-$3'); if (d.length === 10) return d.replace(/(\d{2})(\d{4})(\d{4})/, '($1) $2-$3'); return v || ''; },
    cep: (v) => { const d = so(v); return d.length === 8 ? d.replace(/(\d{5})(\d{3})/, '$1-$2') : v || ''; },
    data: (iso) => { if (!iso) return '—'; const [a, m, d] = iso.slice(0, 10).split('-'); return `${d}/${m}/${a}`; },
    dataHora: (iso) => { const d = new Date(iso); return d.toLocaleDateString('pt-BR') + ' ' + d.toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' }); },
    relativo: (iso) => {
      const min = Math.round((Date.now() - new Date(iso)) / 60000);
      if (min < 1) return 'agora'; if (min < 60) return `há ${min} min`;
      const h = Math.round(min / 60); if (h < 24) return `há ${h} h`;
      const d = Math.round(h / 24); return d === 1 ? 'ontem' : `há ${d} dias`;
    },
    t: (n) => (n == null ? '—' : n.toLocaleString('pt-BR', { minimumFractionDigits: 1, maximumFractionDigits: 1 }) + ' t'),
    m: (n) => (n == null ? '—' : n.toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 }) + ' m'),
    kb: (b) => (b >= 1e6 ? (b / 1e6).toLocaleString('pt-BR', { maximumFractionDigits: 1 }) + ' MB' : Math.round(b / 1e3) + ' kB'),
    dias: (n) => (n === 0 ? 'vence hoje' : n > 0 ? (n === 1 ? 'vence amanhã' : `vence em ${n} dias`) : (n === -1 ? 'venceu ontem' : `venceu há ${-n} dias`)),
  };

  /* ---------- validação (espelha as funções do banco) ---------- */
  const valida = {
    cpf(v) {
      const d = so(v); if (d.length !== 11 || /^(\d)\1+$/.test(d)) return false;
      for (const n of [9, 10]) { let s = 0; for (let i = 0; i < n; i++) s += +d[i] * (n + 1 - i); const r = (s * 10) % 11; if ((r === 10 ? 0 : r) !== +d[n]) return false; }
      return true;
    },
    cnpj(v) {
      const d = so(v); if (d.length !== 14 || /^(\d)\1+$/.test(d)) return false;
      const calc = (len) => { const p = len === 12 ? [5,4,3,2,9,8,7,6,5,4,3,2] : [6,5,4,3,2,9,8,7,6,5,4,3,2]; const s = p.reduce((a, w, i) => a + w * +d[i], 0); const r = s % 11; return r < 2 ? 0 : 11 - r; };
      return calc(12) === +d[12] && calc(13) === +d[13];
    },
    placa: (v) => /^[A-Z]{3}[0-9][A-Z0-9][0-9]{2}$/.test(valida.normalizarPlaca(v)),
    normalizarPlaca: (v) => String(v || '').toUpperCase().replace(/[^A-Z0-9]/g, ''),
    mercosul: (v) => /^[A-Z]{3}[0-9][A-Z][0-9]{2}$/.test(valida.normalizarPlaca(v)),
  };

  /* ---------- máscaras de campo ---------- */
  const mascaras = {
    cpf: (d) => d.slice(0, 11).replace(/(\d{3})(\d)/, '$1.$2').replace(/(\d{3})\.(\d{3})(\d)/, '$1.$2.$3').replace(/(\d{3})\.(\d{3})\.(\d{3})(\d)/, '$1.$2.$3-$4'),
    cnpj: (d) => d.slice(0, 14).replace(/(\d{2})(\d)/, '$1.$2').replace(/(\d{2})\.(\d{3})(\d)/, '$1.$2.$3').replace(/\.(\d{3})(\d)/, '.$1/$2').replace(/(\d{4})(\d)/, '$1-$2'),
    telefone: (d) => { d = d.slice(0, 11); return d.length > 10 ? d.replace(/(\d{2})(\d{5})(\d{0,4})/, '($1) $2-$3') : d.replace(/(\d{2})(\d{4})(\d{0,4})/, '($1) $2-$3').replace(/[-\s(]+$/, ''); },
    cep: (d) => d.slice(0, 8).replace(/(\d{5})(\d)/, '$1-$2'),
    digitos: (d) => d,
  };
  function aplicarMascaras(raiz = document) {
    raiz.querySelectorAll('input[data-mascara]').forEach((el) => {
      if (el.dataset.mascaraOk) return; el.dataset.mascaraOk = '1';
      const tipo = el.dataset.mascara;
      if (tipo !== 'placa' && !mascaras[tipo]) return;
      el.setAttribute('inputmode', tipo === 'placa' ? 'text' : 'numeric');
      el.addEventListener('input', () => {
        if (tipo === 'placa') { el.value = valida.normalizarPlaca(el.value).slice(0, 7); return; }
        const d = so(el.value); el.value = d ? mascaras[tipo](d) : '';
      });
    });
  }

  /* ---------- ícones (Lucide, traço 1.6, um só conjunto) ---------- */
  const icone = (nome, attrs = '') => `<i data-lucide="${nome}" ${attrs}></i>`;
  function desenharIcones() { if (window.lucide) window.lucide.createIcons({ attrs: { 'stroke-width': 1.6 } }); }

  /* ---------- desenhos do mundo da estrada ---------- */
  const SIT = {
    normal: ['normal', 'Normal'], pendente: ['pendente', 'Pendente'], cancelado: ['bloqueado', 'Cancelado'],
    vencido: ['bloqueado', 'Vencido'], vencendo: ['vencendo', 'Vencendo'], habilitado: ['normal', 'Habilitado'],
    sem_consulta: ['neutro', 'Sem consulta'], arrendado: ['info', 'Arrendado'], ativo: ['normal', 'Ativo'],
    parado: ['neutro', 'Parado'], ag_motorista: ['pendente', 'Aguardando motorista'], sinistro: ['bloqueado', 'Sinistro'],
    apreendido: ['bloqueado', 'Apreendido'], vendido: ['neutro', 'Vendido'], a_venda: ['neutro', 'À venda'], devolvido: ['neutro', 'Devolvido'],
  };
  const desenhar = {
    sinal(situacao, texto) { const [cls, rot] = SIT[situacao] || ['neutro', situacao]; return `<span class="sinal sinal-${cls}">${texto || rot}</span>`; },
    sinalTipo(tipo, texto) { return `<span class="sinal sinal-${tipo}">${texto}</span>`; },
    placa(placa, grande) { const p = valida.normalizarPlaca(placa); return `<span class="placa${valida.mercosul(p) ? '' : ' antiga'}${grande ? ' grande' : ''}" aria-label="Placa ${p}"><b>${p}</b></span>`; },
    eixos(n) { return `<span class="peca-eixos" aria-hidden="true">${'<i></i>'.repeat(n)}</span>`; },
    peca(v, papel) {
      const ROT = { dolly: 'Dolly', carreta: 'Carreta', caminhao: 'Caminhão', outros: 'Outro' };
      const rot = v.categoria === 'cavalo' ? (v.configuracao_cavalo === 'trucado' ? 'Cavalo trucado' : 'Cavalo toco') : (ROT[v.categoria] || 'Veículo');
      return `<div class="peca ${v.categoria === 'cavalo' ? 'cavalo' : v.categoria}"><div class="peca-corpo">${rot}${v.categoria === 'carreta' ? ` <span class="muted" style="font-weight:500">${fmt.t(v.capacidade_carga_t)}</span>` : ''}</div>${desenhar.eixos(v.eixos)}<span class="peca-placa">${v.placa}</span></div>`;
    },
    engate(cavalo, itens) {
      const partes = [desenhar.peca(cavalo, 'cavalo')];
      itens.forEach((v) => { partes.push('<span class="acoplamento" aria-hidden="true"></span>'); partes.push(desenhar.peca(v)); });
      const desc = [cavalo.placa, ...itens.map((v) => v.placa)].join(', ');
      return `<div class="engate" role="img" aria-label="Conjunto ${desc}">${partes.join('')}</div>`;
    },
    capacidade(c) {
      if (c.limite_t == null) return `<div class="capacidade"><span class="small muted">CMT do cavalo não informado</span></div>`;
      const escala = Math.max(c.limite_t, c.capacidade_total_t);
      const pct = Math.min(c.capacidade_total_t, c.limite_t) / escala * 100;
      const exc = c.excede_cmt ? `<i class="excede" style="left:${pct}%;width:${(c.capacidade_total_t - c.limite_t) / escala * 100}%"></i>` : '';
      return `<div class="capacidade"><div class="trilho"><i style="width:${pct}%"></i>${exc}</div>
        <div class="legenda"><span><b>${fmt.t(c.capacidade_total_t)}</b> de carga</span><span>${c.excede_cmt ? `<b style="color:var(--vermelho-tinta)">passa ${fmt.t(+(c.capacidade_total_t - c.limite_t).toFixed(1))}</b> do CMT` : `limite ${fmt.t(c.limite_t)}`}</span></div></div>`;
    },
    marco(v, janela = 90) {
      const venc = v.dias < 0; const pct = venc ? 100 : Math.max(2, Math.min(100, (v.dias / janela) * 100));
      const cor = venc ? '' : v.dias <= 30 ? 'var(--amarelo)' : 'var(--verde)';
      return `<div class="trilho${venc ? ' vencido' : ''}" aria-hidden="true"><i style="width:${pct}%;${cor ? 'background:' + cor : ''}"></i></div>`;
    },
    avatar(nome) {
      const ini = (nome || '?').split(' ').filter(Boolean).slice(0, 2).map((s) => s[0]).join('').toUpperCase();
      let h = 0; for (const ch of nome || '') h = (h * 31 + ch.charCodeAt(0)) % 360;
      return `<span class="avatar" style="background:hsl(${h} 45% 90%);color:hsl(${h} 40% 28%)">${ini}</span>`;
    },
  };

  /* ---------- shell ---------- */
  const NAV = [
    ['index.html', 'inicio', 'Início', 'signpost'],
    ['motoristas.html', 'motoristas', 'Motoristas', 'id-card'],
    ['proprietarios.html', 'proprietarios', 'Proprietários', 'building-2'],
    ['veiculos.html', 'veiculos', 'Veículos', 'truck'],
    ['conjuntos.html', 'conjuntos', 'Conjuntos', 'link-2'],
    ['pendencias.html', 'pendencias', 'Pendências', 'triangle-alert'],
  ];
  const ADMIN = [['usuarios.html', 'usuarios', 'Usuários', 'users'], ['auditoria.html', 'auditoria', 'Auditoria', 'history']];
  const PAPEL = { admin: 'Administrador', operacao: 'Operação', financeiro: 'Financeiro', leitura: 'Leitura' };

  function montarShell() {
    const pagina = document.body.dataset.pagina;
    if (!pagina || pagina === 'login') return;
    const main = document.querySelector('main');
    const totalPend = D.pendencias.filter((p) => p.tipo_pendencia !== "arquivo_vencido").length + D.documentosVencidos.length + D.conjuntos.filter((c) => c.excede_cmt).length;
    const item = ([href, id, rot, ic]) => `<a href="${href}" ${id === pagina ? 'aria-current="page"' : ''}>${icone(ic)}<span>${rot}</span>${id === 'pendencias' && totalPend ? `<span class="contagem" aria-label="${totalPend} pendências">${totalPend}</span>` : ''}</a>`;
    const u = N.usuarioAtual;
    const shell = document.createElement('div');
    shell.className = 'shell';
    shell.innerHTML = `
      <aside class="sidebar" aria-label="Menu principal">
        <a class="marca" href="index.html" aria-label="NILT, início">
          <span class="marca-sinal" aria-hidden="true"><svg viewBox="0 0 24 24" fill="none" stroke="#fff" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round"><path d="M12 21V8"/><path d="M12 8l-4 4"/><path d="M12 8l4 4"/><path d="M5 21h14"/></svg></span>
          <span class="marca-nome"><b>NILT</b><span>Prisa Logística</span></span>
        </a>
        <nav class="nav">${NAV.map(item).join('')}
          <div class="nav-grupo">Administração</div>${ADMIN.map(item).join('')}
        </nav>
        <div class="sidebar-pe">
          <div class="usuario">${desenhar.avatar(u.nome)}<span class="usuario-nome"><b>${u.nome}</b><span>${PAPEL[u.papel]}</span></span>
            <a class="btn btn-texto btn-icone" href="login.html" aria-label="Sair" title="Sair" style="margin-left:auto">${icone('log-out')}</a></div>
        </div>
      </aside>
      <header class="topbar">
        <button class="btn btn-icone menu-btn" type="button" aria-label="Abrir menu">${icone('menu')}</button>
        <div class="busca" role="search">
          ${icone('search')}
          <input id="busca-global" type="search" autocomplete="off" placeholder="Buscar placa, CPF, CNPJ ou nome" aria-label="Buscar placa, CPF, CNPJ ou nome" aria-controls="busca-resultados" aria-expanded="false">
          <kbd>/</kbd>
          <div class="busca-resultados" id="busca-resultados" role="listbox" hidden></div>
        </div>
        <span class="ficticio" title="Todos os nomes, documentos e placas deste protótipo são inventados">Dados fictícios</span>
      </header>
      <section class="sheet"><div class="sheet-inner"></div></section>
      <div class="toasts" aria-live="polite"></div>`;
    shell.querySelector('.sheet-inner').appendChild(main);
    document.body.prepend(shell);
    shell.querySelector('.menu-btn').addEventListener('click', () => shell.classList.toggle('menu-aberto'));
    shell.addEventListener('click', (e) => { if (shell.classList.contains('menu-aberto') && !e.target.closest('.sidebar') && !e.target.closest('.menu-btn')) shell.classList.remove('menu-aberto'); });
    montarBusca();
  }

  /* ---------- busca global ---------- */
  function linkPessoa(p) { return D.motoristas.some((m) => m.pessoa_id === p.id) ? `motorista.html?id=${p.id}` : `proprietario.html?id=${p.id}`; }
  function buscar(termo) {
    const t = termo.trim().toLowerCase(); if (t.length < 2) return [];
    const dig = so(t); const pl = valida.normalizarPlaca(t);
    const res = [];
    D.veiculos.forEach((v) => { if (pl.length >= 2 && v.placa.includes(pl)) res.push({ href: `veiculo.html?id=${v.id}`, cod: desenhar.placa(v.placa), nome: `${v.marca} ${v.modelo}`, tipo: v.tipo.toLowerCase().replace(/ - \d eixos/, '') }); });
    D.pessoas.forEach((p) => {
      const doc = p.cpf || p.cnpj || "";
      if (p.nome.toLowerCase().includes(t) || (p.apelido || '').toLowerCase().includes(t) || (dig.length >= 3 && doc.includes(dig)))
        res.push({ href: linkPessoa(p), cod: `<span class="cod">${fmt.doc(p)}</span>`, nome: p.nome, tipo: D.motoristas.some((m) => m.pessoa_id === p.id) ? 'motorista' : 'proprietário' });
    });
    return res.slice(0, 8);
  }
  function montarBusca() {
    const inp = document.getElementById('busca-global'); const box = document.getElementById('busca-resultados');
    let sel = -1;
    const render = () => {
      const r = buscar(inp.value); sel = -1;
      if (!inp.value.trim()) { box.hidden = true; inp.setAttribute('aria-expanded', 'false'); return; }
      box.innerHTML = r.length ? r.map((x, i) => `<a href="${x.href}" role="option" id="br-${i}">${x.cod}<span>${x.nome}</span><span class="tipo">${x.tipo}</span></a>`).join('') : `<div class="busca-vazio">Nada encontrado para “${inp.value.replace(/</g, '&lt;')}”. Confira a placa ou o documento.</div>`;
      box.hidden = false; inp.setAttribute('aria-expanded', 'true');
    };
    inp.addEventListener('input', render);
    inp.addEventListener('keydown', (e) => {
      const links = [...box.querySelectorAll('a')];
      if (e.key === 'ArrowDown' || e.key === 'ArrowUp') { e.preventDefault(); if (!links.length) return; sel = (sel + (e.key === 'ArrowDown' ? 1 : -1) + links.length) % links.length; links.forEach((a, i) => a.setAttribute('aria-selected', i === sel)); inp.setAttribute('aria-activedescendant', links[sel].id); }
      if (e.key === 'Enter' && links.length) { e.preventDefault(); location.href = (links[sel] || links[0]).href; }
      if (e.key === 'Escape') { inp.value = ''; render(); inp.blur(); }
    });
    document.addEventListener('keydown', (e) => { if (e.key === '/' && !/input|textarea|select/i.test(document.activeElement.tagName)) { e.preventDefault(); inp.focus(); } });
    document.addEventListener('click', (e) => { if (!e.target.closest('.busca')) { box.hidden = true; inp.setAttribute('aria-expanded', 'false'); } });
  }

  /* ---------- abas por ?aba= (vira rota/segmento no Next.js) ---------- */
  function montarAbas() {
    const abas = document.querySelector('.abas[data-abas]'); if (!abas) return;
    const botoes = [...abas.querySelectorAll('[data-aba]')];
    const ativar = (id, push) => {
      botoes.forEach((b) => b.setAttribute('aria-selected', b.dataset.aba === id));
      document.querySelectorAll('[data-painel]').forEach((p) => { p.hidden = p.dataset.painel !== id; });
      const atual = botoes.find((b) => b.dataset.aba === id); if (atual && abas.scrollWidth > abas.clientWidth) atual.scrollIntoView({ block: 'nearest', inline: 'nearest' });
      if (push) { const u = new URL(location); u.searchParams.set('aba', id); history.replaceState(null, '', u); }
    };
    botoes.forEach((b) => { b.setAttribute('role', 'tab'); b.addEventListener('click', () => ativar(b.dataset.aba, true)); });
    abas.setAttribute('role', 'tablist');
    const fim = () => abas.classList.toggle('fim', abas.scrollLeft + abas.clientWidth >= abas.scrollWidth - 4);
    abas.addEventListener('scroll', fim, { passive: true }); window.addEventListener('resize', fim); requestAnimationFrame(fim);
    const pedida = new URLSearchParams(location.search).get('aba');
    ativar(botoes.some((b) => b.dataset.aba === pedida) ? pedida : botoes[0].dataset.aba, false);
  }

  /* ---------- salvar: um modelo por tela (barra aparece quando há alteração) ---------- */
  function montarSalvar() {
    const campos = (form) => [...form.querySelectorAll("input, select, textarea")].filter((el) => el.type !== "file" && el.name !== undefined);
    const foto = (form) => campos(form).map((el) => (el.type === "checkbox" || el.type === "radio" ? el.checked : el.value));
    document.querySelectorAll("form[data-salvar]").forEach((form) => {
      const barra = form.querySelector(".barra-salvar") || form.parentElement.querySelector(".barra-salvar") || document.querySelector(".barra-salvar");
      if (!barra) return;
      let inicial = foto(form);
      form.addEventListener("input", (e) => { if (e.target.type !== "file") barra.hidden = false; });
      barra.querySelector("[data-descartar]")?.addEventListener("click", () => {
        campos(form).forEach((el, i) => { if (el.type === "checkbox" || el.type === "radio") el.checked = inicial[i]; else el.value = inicial[i]; });
        form.querySelectorAll("[data-invalido],[data-valido]").forEach((c) => { c.removeAttribute("data-invalido"); c.removeAttribute("data-valido"); });
        form.querySelectorAll(".campo .erro").forEach((e) => { e.hidden = true; });
        barra.hidden = true; form.dispatchEvent(new CustomEvent("nilt:descartado"));
      });
      barra.querySelector("[data-confirmar]")?.addEventListener("click", () => {
        if (form.querySelector("[data-invalido]")) { toast("Corrija os campos marcados em vermelho antes de salvar.", "alert-circle"); form.querySelector("[data-invalido] input, [data-invalido] select")?.focus(); return; }
        inicial = foto(form); barra.hidden = true; toast("Alterações salvas"); form.dispatchEvent(new CustomEvent("nilt:salvo"));
      });
    });
  }

  /* ---------- validação ao vivo de CPF/CNPJ/placa ---------- */
  function montarValidacao(raiz = document) {
    raiz.querySelectorAll('input[data-valida]').forEach((el) => {
      if (el.dataset.validaOk) return; el.dataset.validaOk = '1';
      const campo = el.closest('.campo'); const tipo = el.dataset.valida;
      let erro = campo.querySelector('.erro');
      const msgs = { cpf: 'CPF inválido: os dois últimos dígitos não conferem. Copie de novo do documento.', cnpj: 'CNPJ inválido: os dois últimos dígitos não conferem. Copie de novo do cartão CNPJ.', placa: 'Placa inválida: use ABC1234 ou ABC1D23.' };
      const checar = () => {
        const v = el.value; const vazio = !so(v) && tipo !== 'placa' || (tipo === 'placa' && !v);
        if (vazio) { campo.removeAttribute('data-invalido'); campo.removeAttribute('data-valido'); if (erro) erro.hidden = true; return; }
        const ok = valida[tipo](v);
        campo.toggleAttribute('data-invalido', !ok); campo.toggleAttribute('data-valido', ok);
        if (!erro) { erro = document.createElement('span'); erro.className = 'erro'; campo.appendChild(erro); }
        erro.hidden = ok; erro.textContent = msgs[tipo];
        el.setAttribute('aria-invalid', !ok);
      };
      el.addEventListener('blur', checar);
      el.addEventListener('input', () => { if (campo.hasAttribute('data-invalido')) checar(); });
    });
  }

  /* ---------- BrasilAPI (CNPJ e CEP) ---------- */
  async function consultarCnpj(cnpj) {
    const r = await fetch(`https://brasilapi.com.br/api/cnpj/v1/${so(cnpj)}`);
    if (!r.ok) throw new Error(r.status === 404 ? 'CNPJ não encontrado na Receita.' : 'A consulta de CNPJ não respondeu. Tente de novo em instantes.');
    const j = await r.json();
    return {
      nome: j.razao_social, nome_fantasia: j.nome_fantasia, fundacao: j.data_inicio_atividade,
      natureza_juridica: [j.codigo_natureza_juridica, j.natureza_juridica].filter(Boolean).join(' '),
      cnae_principal: [j.cnae_fiscal, j.cnae_fiscal_descricao].filter(Boolean).join(' '),
      optante_simples: j.opcao_pelo_simples, situacao: j.descricao_situacao_cadastral,
      endereco: { cep: j.cep, logradouro: [j.descricao_tipo_de_logradouro, j.logradouro].filter(Boolean).join(' '), numero: j.numero, complemento: j.complemento, bairro: j.bairro, cidade: j.municipio, uf: j.uf },
    };
  }
  async function consultarCep(cep) {
    const r = await fetch(`https://brasilapi.com.br/api/cep/v2/${so(cep)}`);
    if (!r.ok) throw new Error('CEP não encontrado.');
    const j = await r.json();
    return { logradouro: j.street, bairro: j.neighborhood, cidade: j.city, uf: j.state };
  }

  /* ---------- avisos rápidos ---------- */
  function toast(msg, ic = 'check') {
    const box = document.querySelector('.toasts') || document.body;
    const el = document.createElement('div'); el.className = 'toast'; el.innerHTML = `${icone(ic)}<span></span>`; el.querySelector('span').textContent = msg;
    box.appendChild(el); desenharIcones();
    setTimeout(() => { el.style.opacity = '0'; el.style.transform = 'translateY(8px)'; setTimeout(() => el.remove(), 320); }, 3200);
  }

  /* ---------- utilidades de página ---------- */
  const param = (k) => new URLSearchParams(location.search).get(k);
  const esc = (s) => String(s ?? '').replace(/[&<>"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));
  const linhaClicavel = (raiz = document) => raiz.querySelectorAll('tr[data-href]:not([data-clicavel])').forEach((tr) => {
    tr.dataset.clicavel = '1';
    tr.addEventListener('click', (e) => { if (!e.target.closest('a,button,input')) location.href = tr.dataset.href; });
    tr.tabIndex = 0; tr.addEventListener('keydown', (e) => { if (e.key === 'Enter') location.href = tr.dataset.href; });
  });

  Object.assign(N, { fmt, valida, desenhar, icone, desenharIcones, aplicarMascaras, montarValidacao, consultarCnpj, consultarCep, toast, param, esc, linhaClicavel, linkPessoa, PAPEL, so });

  /* o ponto do meio da Overpass encosta na palavra seguinte: damos ar a ele */
  function separarPontos(raiz = document.body) {
    const w = document.createTreeWalker(raiz, NodeFilter.SHOW_TEXT, { acceptNode: (n) => (n.nodeValue.includes(" · ") && !n.parentElement.closest("script,style,.ponto,input,textarea,option,select,.opcao")) ? 1 : 3 });
    const nos = []; while (w.nextNode()) nos.push(w.currentNode);
    nos.forEach((n) => { const frag = document.createDocumentFragment(); n.nodeValue.split(" · ").forEach((parte, i) => { if (i) { const s = document.createElement("span"); s.className = "ponto"; s.textContent = "·"; frag.append(s); } frag.append(parte); }); n.replaceWith(frag); });
  }
  N.separarPontos = separarPontos;

  function iniciar() {
    montarShell();
    if (typeof window.pagina === 'function') window.pagina(N);
    montarAbas(); montarSalvar(); aplicarMascaras(); montarValidacao(); linhaClicavel(); separarPontos(); desenharIcones();
  }
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', iniciar); else iniciar();
})();
