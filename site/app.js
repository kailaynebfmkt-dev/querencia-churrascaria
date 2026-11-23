(() => {
  "use strict";
  const S = window.SITE || {};
  const reduzir = matchMedia("(prefers-reduced-motion: reduce)").matches;
  const celular = matchMedia("(max-width: 760px)").matches;
  const mouse = matchMedia("(hover: hover) and (pointer: fine)").matches;
  const clamp = (v, a, b) => Math.min(b, Math.max(a, v));
  const um = (s, r = document) => r.querySelector(s);
  const todos = (s, r = document) => [...r.querySelectorAll(s)];

  /* ══════════════════════════════════════════════════════════════════════════
     DESEMPENHO: um único laço de animação (requestAnimationFrame) e medidas em cache.
     Posições dos elementos são medidas só quando a tela muda (resize/carregamento) e,
     a cada quadro, só se faz conta com scrollY. Nada de getBoundingClientRect no laço:
     isso evitava recálculo de layout forçado a cada quadro.
     ══════════════════════════════════════════════════════════════════════════ */
  let vh = innerHeight, docAltura = 0;
  // Conexão lenta ou "economia de dados": baixa só metade dos quadros dos filmes
  const lento = !!(navigator.connection && (navigator.connection.saveData || /(^|-)[23]g/.test(navigator.connection.effectiveType || "")));
  let modoLeve = false;          // liga sozinho se a página perceber que está travando (veja o laço)
  const medidores = [];
  let timerMedida = 0;
  const topoDoc = (el) => el.getBoundingClientRect().top + scrollY;
  const medirTudo = () => { vh = innerHeight; docAltura = document.documentElement.scrollHeight; medidores.forEach((f) => f()); };
  const pedirMedida = () => { clearTimeout(timerMedida); timerMedida = setTimeout(medirTudo, 150); };
  let ultimaLargura = innerWidth;
  addEventListener("resize", () => {
    vh = innerHeight;
    if (innerWidth !== ultimaLargura || !celular) { ultimaLargura = innerWidth; pedirMedida(); }
  });
  addEventListener("load", medirTudo);
  if (document.fonts && document.fonts.ready) document.fonts.ready.then(medirTudo);
  if ("ResizeObserver" in window) new ResizeObserver(pedirMedida).observe(document.body);

  /* ── Filmes que tocam sozinhos pelo tempo (hero e cenas dos capítulos) ───
     Nada aqui depende da rolagem: o hero começa quando a cortina sobe; cada cena começa
     quando aparece na tela e toca até o fim, parando no último quadro. ─────────────── */
  const filmes = [];
  function criarFilme({ secao, palco, canvas, total, src, momentos, barras, deslocar, imediato, fps }) {
    const ctx = canvas.getContext("2d");
    const quadros = new Array(total);
    const passo = lento ? 2 : 1;                       // conexão lenta: só quadros pares (o resto é mesclado)
    const alvos = Math.ceil(total / passo);
    const dur = (total - 1) / fps;
    const f = { top: 0, altura: 0, t: 0, prog: 0, tocando: false, fim: false, carga: false, nCarga: 0, pronto: false, visivel: !!imediato, chave: "", ativos: [], b: -1, w: 0, h: 0 };

    const pronto = (i) => quadros[i] && quadros[i].complete && quadros[i].naturalWidth;
    const disponivel = (i) => pronto(i) || (quadros[i] && quadros[i].falhou);
    const maisProximo = (i) => {
      for (let d = 0; d < total; d++) {
        if (pronto(i - d)) return i - d;
        if (pronto(i + d)) return i + d;
      }
      return -1;
    };
    const pintar = (img, alfa, k) => {
      const cw = canvas.width, ch = canvas.height;
      // "cover". No desktop, no começo do hero a picanha é deslocada para a direita (leve zoom), liberando a esquerda para o texto.
      const s = Math.max(cw / img.naturalWidth, ch / img.naturalHeight) * (1 + 0.14 * k);
      const w = img.naturalWidth * s, h = img.naturalHeight * s;
      const x = k ? cw * (0.51 + 0.09 * k) - 0.51 * w : (cw - w) / 2;
      ctx.globalAlpha = alfa;
      ctx.drawImage(img, Math.min(0, x), (ch - h) / 2, w, h);
    };
    // Desenha a posição (fracionária) do filme: mescla o quadro atual com o próximo, para o movimento ficar contínuo
    const desenhar = (pos, forcar) => {
      const i = Math.floor(pos), fr = Math.round((pos - i) * 40) / 40;
      const chave = `${i}:${fr}:${canvas.width}`;
      if (chave === f.chave && !forcar) return;
      const j = maisProximo(i);
      if (j < 0) return;
      const k = deslocar && canvas.width > canvas.height * 1.2 ? Math.max(0, 1 - f.prog / 0.3) : 0;
      pintar(quadros[j], 1, k);
      if (fr > 0 && i + 1 < total && pronto(i + 1)) pintar(quadros[i + 1], fr, k);
      ctx.globalAlpha = 1;
      f.chave = chave;
    };
    const carregar = (i) => {
      if (quadros[i]) return;
      const img = new Image();
      img.decoding = "async";
      const fim = () => {
        f.nCarga++;
        if (!f.pronto && f.nCarga >= Math.max(3, Math.ceil(alvos * 0.35))) {
          f.pronto = true;
          if (imediato) document.dispatchEvent(new Event("hero-pronto"));
        }
        if (i === 0 || !f.tocando) desenhar(f.t * fps, true);
      };
      img.onload = fim;
      img.onerror = () => { img.falhou = true; fim(); };
      img.src = src(i);
      quadros[i] = img;
    };
    // Baixa em ordem (é a ordem em que o filme toca), em lotes pequenos para não travar a página
    const iniciarCarga = () => {
      if (f.carga) return;
      f.carga = true;
      let k = 0;
      const lote = () => { for (let n = 0; n < (celular ? 3 : 6) && k < total; n++, k += passo) carregar(k); if (k < total) setTimeout(lote, celular ? 60 : 30); };
      lote();
    };
    if (imediato) { carregar(0); if (!reduzir) iniciarCarga(); }
    else if ("IntersectionObserver" in window) {
      new IntersectionObserver(([e]) => { if (e.isIntersecting) iniciarCarga(); }, { rootMargin: "150% 0px" }).observe(secao);
    } else iniciarCarga();

    // Visibilidade: o filme só é desenhado enquanto aparece; a cena só começa quando ~40% dela está na tela
    let naTela = false;
    new IntersectionObserver(([e]) => { f.visivel = e.isIntersecting; naTela = e.intersectionRatio >= 0.4; }, { threshold: [0, 0.4] }).observe(secao);

    f.pode = () => f.pronto && (imediato ? !document.body.classList.contains("carregando") : naTela);
    f.medir = () => {
      f.top = topoDoc(secao);
      f.altura = secao.offsetHeight;
      const dpr = Math.min(devicePixelRatio || 1, 1.5);
      const w = Math.round(canvas.clientWidth * dpr), h = Math.round(canvas.clientHeight * dpr);
      if (w !== f.w || h !== f.h) { f.w = canvas.width = w; f.h = canvas.height = h; f.chave = ""; desenhar(f.t * fps, true); }
    };
    f.quadro = (dt) => {
      if (!f.tocando) { if (f.pode()) f.tocando = true; else return; }
      if (!f.fim) {
        // Se o quadro da vez ainda não chegou pela rede, o relógio espera (nada de pular quadros)
        const idx = Math.min(total - 1, Math.floor(f.t * fps));
        if (disponivel(idx - (idx % passo)) || disponivel(idx)) f.t += dt;
        if (f.t >= dur) { f.t = dur; f.fim = true; secao.classList.add("fim"); }
        f.prog = f.t / dur;
      }
      if (!f.visivel) return;
      desenhar(f.t * fps);
      const prog = f.prog;
      for (let i = 0; i < momentos.length; i++) {
        const m = momentos[i];
        const on = prog >= m.de && (prog < m.ate || (m.ate >= 1 && prog >= 1));
        if (on !== f.ativos[i]) { f.ativos[i] = on; m.el.classList.toggle("ativo", on); }
      }
      if (barras) {                                             // barras de cinema entram nos 8% iniciais e ficam
        const b = Math.round(clamp(prog / 0.08, 0, 1) * 100) / 100;
        if (b !== f.b) { f.b = b; palco.style.setProperty("--b", b); }
      }
    };
    medidores.push(f.medir);
    filmes.push(f);
    return f;
  }
  const lerMomentos = (raiz) => todos(".momento", raiz).map((el) => ({ el, de: parseFloat(el.dataset.de || 0), ate: parseFloat(el.dataset.ate || 1) }));

  // Hero
  let filmeHero = null;
  const cine = um(".cine");
  const cineCanvas = cine && um(".cine-canvas", cine);
  if (cine && cineCanvas && S.frames && S.frames.total) {
    const padrao = celular ? S.frames.mobile : S.frames.desktop;
    filmeHero = criarFilme({
      secao: cine, palco: um(".cine-palco", cine), canvas: cineCanvas, total: celular ? (S.frames.totalMobile || S.frames.total) : S.frames.total,
      src: (i) => padrao.replace("{n}", String(i + 1).padStart(4, "0")),
      momentos: lerMomentos(cine), barras: false, deslocar: true, imediato: true, fps: S.frames.fps || 14,
    });
    if (reduzir) cine.querySelector(".momento").classList.add("ativo");
  }
  // Cenas dos capítulos (só baixam quando se aproximam; tocam quando aparecem)
  if (!reduzir) {
    todos(".cena").forEach((cena) => {
      const canvas = um(".cena-canvas", cena), palco = um(".cena-palco", cena);
      const total = parseInt(cena.dataset.total || "0", 10);
      if (!canvas || !palco || !total) return;
      criarFilme({
        secao: cena, palco, canvas, total,
        src: (i) => `${cena.dataset.pasta}/${celular ? "m" : "d"}/f_${String(i + 1).padStart(4, "0")}.webp`,
        momentos: lerMomentos(cena), barras: true, deslocar: false, imediato: false, fps: parseFloat(cena.dataset.fps || 12),
      });
    });
  }

  /* ── Cabeçalho, WhatsApp, revelar e ano ───────────────────────────────── */
  const topo = um(".topo");
  const whats = um(".whats");
  const formEl = um(".form");
  let formNaTela = false, topoRolou = false, whatsVisivel = false;
  if (formEl) new IntersectionObserver(([e]) => { formNaTela = e.isIntersecting; }).observe(formEl);

  const io = new IntersectionObserver((es) => es.forEach((e) => {
    if (e.isIntersecting) { e.target.classList.add("visto"); io.unobserve(e.target); }
  }), { threshold: 0.12 });
  todos(".revelar").forEach((el) => io.observe(el));
  todos("[data-ano]").forEach((el) => (el.textContent = new Date().getFullYear()));

  /* ── Menu de celular (hambúrguer) ─────────────────────────────────────── */
  const botaoMenu = um(".menu-toggle");
  if (topo && botaoMenu) {
    const definir = (abrir) => {
      topo.classList.toggle("menu-aberto", abrir);
      document.body.classList.toggle("menu-aberto", abrir);
      botaoMenu.setAttribute("aria-expanded", String(abrir));
      botaoMenu.setAttribute("aria-label", abrir ? "Fechar menu" : "Abrir menu");
    };
    botaoMenu.addEventListener("click", () => definir(!topo.classList.contains("menu-aberto")));
    todos(".menu a", topo).forEach((a) => a.addEventListener("click", () => definir(false)));
    addEventListener("keydown", (e) => { if (e.key === "Escape") definir(false); });
    matchMedia("(min-width: 1101px)").addEventListener("change", (e) => { if (e.matches) definir(false); });
  }
  /* ── Links: WhatsApp e pedido (fonte única em config.js) ──────────────── */
  const numero = String((S.whatsapp && S.whatsapp.numero) || "").replace(/\D/g, "");
  const linkWhats = (texto) => `https://wa.me/${numero}?text=${encodeURIComponent(texto || "")}`;
  const urlWhats = linkWhats(S.whatsapp && S.whatsapp.mensagem);
  if (whats) whats.href = urlWhats;
  todos(".link-whats").forEach((a) => (a.href = urlWhats));
  if (S.pedido && S.pedido.url) todos("[data-pedido]").forEach((a) => (a.href = S.pedido.url));

  /* ── Ilha do dia em destaque ──────────────────────────────────────────── */
  const hoje = um(`.semana [data-dia="${new Date().getDay()}"]`);
  if (hoje) hoje.classList.add("hoje");

  /* ── Galeria: foto ampliada ───────────────────────────────────────────── */
  const lb = um(".lightbox");
  if (lb && typeof lb.showModal === "function") {
    const lbImg = um("img", lb);
    todos(".galeria-item").forEach((b) => b.addEventListener("click", () => {
      const img = um("img", b);
      lbImg.src = img.currentSrc || img.src;
      lbImg.alt = img.alt;
      lb.showModal();
    }));
    lb.addEventListener("click", (ev) => { if (ev.target !== lbImg) lb.close(); });
  }

  /* ── Mapa sob demanda ─────────────────────────────────────────────────── */
  const mapa = um(".mapa");
  const btnMapa = mapa && um(".mapa-carregar", mapa);
  if (btnMapa) btnMapa.addEventListener("click", () => {
    const f = document.createElement("iframe");
    f.title = "Mapa: Churrascaria Querência, Rua 24 de Agosto, 188, Esteio/RS";
    f.referrerPolicy = "no-referrer-when-downgrade";
    f.src = mapa.dataset.mapa;
    mapa.replaceChildren(f);
  });
  /* ── Formulário → WhatsApp (sem e-mail) ───────────────────────────────── */
  if (formEl) {
    const status = um(".form-status", formEl);
    const avisar = (txt, tipo) => { status.textContent = txt; status.className = `form-status campo--inteiro ${tipo || ""}`; };
    const marcar = (campo, ok) => { campo.closest(".campo").classList.toggle("erro", !ok); return ok; };
    formEl.addEventListener("submit", (ev) => {
      ev.preventDefault();
      if (formEl.elements._honey.value) return; // robô
      const f = formEl.elements;
      const nome = f.nome.value.trim(), tel = f.telefone.value.trim();
      const email = f.email.value.trim(), assunto = f.assunto.value.trim(), msg = f.mensagem.value.trim();
      let valido = true;
      valido = marcar(f.nome, nome.length > 1) && valido;
      valido = marcar(f.telefone, tel.replace(/\D/g, "").length >= 10) && valido;
      valido = marcar(f.email, !email || /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) && valido;
      if (!valido) return avisar("Confira os campos destacados.", "falha");
      const linhas = [
        "Olá! Vim pelo site da Churrascaria Querência.",
        `Nome: ${nome}`,
        `Telefone/WhatsApp: ${tel}`,
        email && `E-mail: ${email}`,
        assunto && `Assunto: ${assunto}`,
        msg && `Mensagem: ${msg}`,
      ].filter(Boolean);
      avisar("Abrindo o WhatsApp com a sua mensagem…", "ok");
      const janela = window.open(linkWhats(linhas.join("\n")), "_blank", "noopener");
      if (!janela) avisar("Seu navegador bloqueou a nova aba. Use o botão verde de WhatsApp.", "falha");
    });
  }

  /* ══════════════════════════════════════════════════════════════════════════
     Brasas e faíscas (canvas). Duas camadas: atrás das seções e sobre o hero.
     ══════════════════════════════════════════════════════════════════════════ */
  const motoresBrasa = [];
  let faixasClarasDoc = [];     // [topo, base] das seções claras, em coordenadas do documento
  if (!reduzir) {
    const fazerSprite = (paradas) => {
      const c = document.createElement("canvas");
      c.width = c.height = 64;
      const g = c.getContext("2d");
      const gr = g.createRadialGradient(32, 32, 0, 32, 32, 32);
      paradas.forEach(([pos, cor]) => gr.addColorStop(pos, cor));
      g.fillStyle = gr;
      g.fillRect(0, 0, 64, 64);
      return c;
    };
    // Sobre fundo escuro: núcleo claro e halo laranja. Sobre bege: laranja/vermelho saturado (o brilho sumiria).
    const spriteEscuro = fazerSprite([[0, "rgba(255,244,200,1)"], [0.14, "rgba(255,190,80,1)"], [0.4, "rgba(240,115,30,.6)"], [0.7, "rgba(210,70,12,.22)"], [1, "rgba(190,50,8,0)"]]);
    const spriteClaro = fazerSprite([[0, "rgba(255,120,30,1)"], [0.22, "rgba(226,92,18,.95)"], [0.5, "rgba(185,55,12,.5)"], [0.8, "rgba(150,35,8,.14)"], [1, "rgba(141,45,19,0)"]]);
    const fundos = todos(".secao--clara, .rodape");
    medidores.push(() => { faixasClarasDoc = fundos.map((el) => [topoDoc(el), topoDoc(el) + el.offsetHeight]); });

    const criarBrasas = (canvas, fator, principal) => {
      const ctx = canvas.getContext("2d");
      // Brasas são pontos macios: desenhadas em resolução menor e esticadas pelo CSS (bem menos pixels por quadro)
      const m = { canvas, ctx, ps: [], ativo: true, w: 0, h: 0, esc: principal ? 0.6 : 0.8, principal };
      const novo = (inicial) => {
        const grande = Math.random() < 0.18;                       // algumas brasas grandes e desfocadas, ao fundo
        return {
          x0: Math.random() * m.w, y: inicial ? Math.random() * m.h : m.h + 20 + Math.random() * 60,
          r: grande ? 6 + Math.random() * 5 : 1.5 + Math.random() * 2.9,
          vy: (grande ? 14 : 22) + Math.random() * (grande ? 22 : 62),
          sway: 8 + Math.random() * 34, vel: 0.5 + Math.random() * 1.5, fase: Math.random() * 6.283,
          vida: inicial ? Math.random() * 6 : 0, dur: 5 + Math.random() * 8, pisca: 3 + Math.random() * 7,
          alfa: grande ? 0.3 : 0.55 + Math.random() * 0.45,
          prof: grande ? 0.15 + Math.random() * 0.15 : 0.35 + Math.random() * 0.65,
        };
      };
      m.faisca = () => ({
        x0: Math.random() * m.w, y: m.h + 10, r: 0.9 + Math.random() * 0.9, vy: 170 + Math.random() * 190,
        sway: 6 + Math.random() * 16, vel: 2 + Math.random() * 3, fase: Math.random() * 6.283,
        vida: 0, dur: 1.4 + Math.random() * 1.4, pisca: 12 + Math.random() * 10, alfa: 1, prof: 0.9, faisca: true,
      });
      m.medir = () => {
        const w = canvas.clientWidth, h = canvas.clientHeight;
        if (w !== m.w || h !== m.h) { m.w = w; m.h = h; canvas.width = Math.round(w * m.esc); canvas.height = Math.round(h * m.esc); }
        const alvo = Math.max(24, Math.min(60, Math.round((m.w * m.h) / 24000 * fator * (modoLeve ? 0.5 : celular ? 0.7 : 1))));
        while (m.ps.length < alvo) m.ps.push(novo(true));
        if (m.ps.length > alvo) m.ps.length = alvo;
      };
      m.passo = (dt, dy, t, sy) => {
        const { ps } = m;
        ctx.setTransform(m.esc, 0, 0, m.esc, 0, 0);
        ctx.clearRect(0, 0, m.w, m.h);
        for (let i = 0; i < ps.length; i++) {
          const p = ps[i];
          p.vida += dt;
          p.y -= p.vy * dt + dy * p.prof * 0.45;                    // sobe sozinha; a rolagem puxa com paralaxe
          if (p.vida > p.dur || p.y < -30 || p.y > m.h + 140) {
            if (p.faisca) { ps[i] = ps[ps.length - 1]; ps.pop(); i--; }   // faísca some; brasa renasce
            else ps[i] = novo(false);
            continue;
          }
          const a = p.alfa * Math.sin((Math.PI * p.vida) / p.dur) * (0.72 + 0.28 * Math.sin(t * p.pisca + p.fase * 3));
          if (a < 0.02) continue;
          let claro = false;
          if (m.principal) { const yd = p.y + sy; for (const f of faixasClarasDoc) if (yd >= f[0] && yd < f[1]) { claro = true; break; } }
          const s = p.r * 4;
          ctx.globalAlpha = Math.min(1, a * (claro ? 1.0 : 1.25));
          ctx.drawImage(claro ? spriteClaro : spriteEscuro, p.x0 + Math.sin(t * p.vel + p.fase) * p.sway - s, p.y - s, s * 2, s * 2);
        }
        ctx.globalAlpha = 1;
      };
      medidores.push(m.medir);
      motoresBrasa.push(m);
      return m;
    };
    const cvPrincipal = um(".brasas:not(.brasas--hero)"), cvHero = um(".brasas--hero");
    if (cvPrincipal) criarBrasas(cvPrincipal, 1, true);
    if (cvHero) criarBrasas(cvHero, 1.25, false);
  }

  /* ══════════════════════════════════════════════════════════════════════════
     Efeitos de página inteira: cortina, títulos, cascatas, contadores, faixas, paralaxe, luz do cursor
     ══════════════════════════════════════════════════════════════════════════ */
  let faixasTexto = [], pares = [], luz = null;
  const alvoMouse = { x: innerWidth / 2, y: innerHeight / 2, cx: innerWidth / 2, cy: innerHeight / 2 };

  if (!reduzir) {
    // 1) Cortina de abertura: some quando a página carregou (mínimo ~0,7 s para ver a logo)
    const abertura = um(".abertura");
    if (abertura) {
      document.body.classList.add("carregando");
      const inicio = performance.now();
      let encerrada = false;
      const encerrar = () => {
        if (encerrada) return;
        encerrada = true;
        setTimeout(() => {
          abertura.classList.add("some");
          document.body.classList.remove("carregando");
          setTimeout(() => abertura.remove(), 1000);
        }, Math.max(0, 700 - (performance.now() - inicio)));
      };
      // Sobe assim que o filme de abertura tem quadros suficientes para tocar sem engasgar
      if (filmeHero) {
        if (filmeHero.pronto) encerrar(); else document.addEventListener("hero-pronto", encerrar, { once: true });
      } else if (document.readyState === "complete") encerrar();
      else addEventListener("load", encerrar, { once: true });
      setTimeout(encerrar, 3500); // nunca prende o visitante
    }

    // 2) Títulos: cada palavra sobe de uma máscara
    todos("h2, .h-grande").forEach((h) => {
      if (h.closest(".cine") || h.hasAttribute("data-sem-divisao")) return;
      const texto = h.textContent.trim();
      h.setAttribute("aria-label", texto);
      h.classList.add("split");
      h.innerHTML = texto.split(/\s+/).map((w, i) => `<span class="pal" aria-hidden="true"><span style="--w:${i}">${w}</span></span>`).join(" ");
    });

    // 3) Índices para as entradas em cascata
    todos(".painel.revelar, .pedido.revelar").forEach((p) => [...p.children].forEach((c, i) => c.style.setProperty("--i", i)));
    todos(".lista-cardapio, .semana, .etiquetas").forEach((ul) => [...ul.children].forEach((li, i) => li.style.setProperty("--j", i)));
    todos(".galeria-item, .faixa .foto").forEach((el, i) => el.style.setProperty("--k", i));

    // 4) Contadores: números sobem ao aparecer
    const formatar = (v, dec) => v.toFixed(dec).replace(".", ",");
    const contadores = todos("[data-contar]");
    contadores.forEach((el) => { el.textContent = formatar(parseFloat(el.dataset.de || 0), parseInt(el.dataset.dec || 0, 10)); });
    const ioContar = new IntersectionObserver((es) => es.forEach((e) => {
      if (!e.isIntersecting) return;
      ioContar.unobserve(e.target);
      const el = e.target, alvo = parseFloat(el.dataset.contar), de = parseFloat(el.dataset.de || 0), dec = parseInt(el.dataset.dec || 0, 10);
      const t0 = performance.now(), dur = 1500;
      const passo = (n) => {
        const k = clamp((n - t0) / dur, 0, 1);
        el.textContent = formatar(de + (alvo - de) * (1 - Math.pow(1 - k, 3)), dec);
        if (k < 1) requestAnimationFrame(passo);
      };
      requestAnimationFrame(passo);
    }), { threshold: 0.6 });
    contadores.forEach((el) => ioContar.observe(el));

    // 5) Faixas de texto: montadas por JS a partir de data-itens
    faixasTexto = todos(".faixa-texto").map((el, i) => {
      const trilho = um(".faixa-trilho", el);
      const unidade = el.dataset.itens.split("|").map((t) => `<span>${t}</span><i>✦</i>`).join("");
      trilho.innerHTML = unidade + unidade + unidade + unidade; // duas metades iguais, cada uma mais larga que a tela
      const o = { el, trilho, dir: i % 2 ? 1 : -1, x: 0, larg: 0, top: 0, h: 0 };
      medidores.push(() => { o.top = topoDoc(el); o.h = el.offsetHeight; const l = trilho.scrollWidth / 2; if (l && l !== o.larg) { o.larg = l; o.x = o.dir > 0 ? -l : 0; } });
      return o;
    });

    // 6) (sem paralaxe: nenhum efeito depende da rolagem)
    const velocidades = [1, 1.5, 0.8, 1.25];
    pares = [].map((img, i) => {
      const p = { img, caixa: img.parentElement, vel: img.closest(".galeria-item") ? velocidades[i % 4] : 1, top: 0, h: 0, vivo: false };
      medidores.push(() => { p.top = topoDoc(p.caixa); p.h = p.caixa.offsetHeight; });
      return p;
    });

    // 7) Luz de brasa que segue o cursor e botões com imã (só mouse)
    luz = um(".luz-cursor");
    if (mouse && luz) {
      addEventListener("pointermove", (e) => { alvoMouse.x = e.clientX; alvoMouse.y = e.clientY; luz.classList.add("on"); }, { passive: true });
      document.documentElement.addEventListener("pointerleave", () => luz.classList.remove("on"));
    } else if (luz) { luz.remove(); luz = null; }
    if (mouse) {
      todos(".botao, .menu-cta").forEach((b) => {
        b.addEventListener("pointermove", (e) => {
          const r = b.getBoundingClientRect();
          b.style.setProperty("--mx", `${((e.clientX - r.left) / r.width - 0.5) * 12}px`);
          b.style.setProperty("--my", `${((e.clientY - r.top) / r.height - 0.5) * 10}px`);
        });
        b.addEventListener("pointerleave", () => { b.style.setProperty("--mx", "0px"); b.style.setProperty("--my", "0px"); });
      });
    }
    const barra = um(".progresso"); if (barra) barra.remove();
  }

  /* ══════════════════════════════════════════════════════════════════════════
     LAÇO ÚNICO. Ordem: ler (scrollY) → calcular → escrever. Nunca mede layout aqui.
     ══════════════════════════════════════════════════════════════════════════ */
  medirTudo();
  let tAnt = performance.now(), yAnt = scrollY, tempo = 0, nQuadro = 0;
  const amostras = [];
  const laco = (agora) => {
    const dt = Math.min(0.05, (agora - tAnt) / 1000) || 0.016;
    tAnt = agora; tempo += dt; nQuadro++;
    const sy = scrollY, dy = sy - yAnt;
    yAnt = sy;

    // MODO LEVE automático: mede o tempo dos quadros depois da abertura. Se a mediana passar de ~34 ms
    // (menos de ~30 quadros/s), desliga os efeitos caros (brilho de calor, luz do cursor, paralaxe, metade das brasas).
    if (!modoLeve && tempo > 3 && !document.hidden && !document.body.classList.contains("carregando")) {
      amostras.push(dt);
      if (amostras.length >= 60) {
        amostras.sort((a, b) => a - b);
        if (amostras[30] > 0.034) {
          modoLeve = true;
          document.documentElement.classList.add("leve");
          motoresBrasa.forEach((m) => { m.ps.length = Math.ceil(m.ps.length / 2); });
        }
        amostras.length = 0;
      }
    }

    // cabeçalho escuro depois de rolar e botão de WhatsApp (só troca classe quando muda)
    const rolou = sy > 40;
    if (rolou !== topoRolou) { topoRolou = rolou; topo && topo.classList.toggle("rolou", rolou); }
    const quer = sy > vh * 0.6 && !formNaTela;
    if (quer !== whatsVisivel) { whatsVisivel = quer; whats && whats.classList.toggle("visivel", quer); }

    // filmes (hero e cenas)
    let cobreTela = false, heroVisivel = false;
    for (const f of filmes) {
      f.quadro(dt);
      if (f.visivel && f.top <= sy + 2 && f.top + f.altura >= sy + vh - 2) cobreTela = true;   // filme ocupando a tela inteira
      if (f === filmeHero) heroVisivel = f.visivel;
    }

    // brasas: a camada de fundo para quando um filme cobre a tela; a do hero só roda com o hero à vista
    if (motoresBrasa.length) {
      const principal = motoresBrasa.find((m) => m.principal);
      if (principal && principal.w && !cobreTela) {
        if (nQuadro % 90 === 0 && principal.ps.length < 120) principal.ps.push(principal.faisca());   // faíscas ocasionais, sozinhas
        const economia = modoLeve || celular;                           // celular e modo leve: brasas em metade dos quadros
        if (!economia || (nQuadro & 1)) principal.passo(dt * (economia ? 2 : 1), 0, tempo, sy);
      }
      const heroB = motoresBrasa.find((m) => !m.principal);
      if (heroB && heroB.w && heroVisivel && (!(modoLeve || celular) || (nQuadro & 1))) heroB.passo(dt * ((modoLeve || celular) ? 2 : 1), 0, tempo, sy);
    }

    if (!reduzir) {
      // faixas de texto (aceleram com a rolagem)
      for (const f of faixasTexto) {
        if (!f.larg || f.top > sy + vh || f.top + f.h < sy) continue;
        f.x += f.dir * 70 * dt;
        if (f.dir < 0 && f.x <= -f.larg) f.x += f.larg;
        if (f.dir > 0 && f.x >= 0) f.x -= f.larg;
        f.trilho.style.transform = `translate3d(${f.x.toFixed(1)}px,0,0)`;
      }
      // paralaxe das fotos (só as que estão na tela; will-change só enquanto visíveis)
      for (const p of pares) {
        if (modoLeve) { if (p.vivo) { p.vivo = false; p.img.style.willChange = ""; p.img.style.translate = ""; } continue; }
        const visivel = p.top + p.h > sy - 60 && p.top < sy + vh + 60;
        if (visivel !== p.vivo) { p.vivo = visivel; p.img.style.willChange = visivel ? "translate" : ""; }
        if (!visivel) continue;
        const c = clamp((p.top + p.h / 2 - sy - vh / 2) / vh, -1, 1);
        p.img.style.translate = `0 ${(-c * 4.5 * p.vel).toFixed(2)}%`;
      }
      // luz do cursor
      if (luz) {
        alvoMouse.cx += (alvoMouse.x - alvoMouse.cx) * 0.14;
        alvoMouse.cy += (alvoMouse.y - alvoMouse.cy) * 0.14;
        luz.style.transform = `translate3d(${(alvoMouse.cx - 280).toFixed(1)}px,${(alvoMouse.cy - 280).toFixed(1)}px,0)`;
      }
    }
    requestAnimationFrame(laco);
  };
  requestAnimationFrame(laco);
})();
