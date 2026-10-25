import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import type { ReactNode } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import {
  PASSOS_DA_AUDITORIA,
  PASSOS_DO_SITE,
  marcarTourVisto,
  type NomeDoTour,
  type PassoDoTour,
} from '../../nucleo/tour';
import { ContextoDoTour, type TourDaTela } from './contextoDoTour';
import { TEXTOS_DO_SITE as T } from '../textos/site';

/** Folga entre o elemento e a borda do destaque, em px. */
const FOLGA = 8;

/** Distância mínima entre o balão e a borda da janela, em px. */
const MARGEM = 12;

/** Tempo da saída; igual a `--t-medio` no CSS. */
const SAIDA_MS = 260;

/**
 * Quanto dura a viagem de um passo ao outro, em ms: cresce com a distância, dentro destes
 * limites. Abaixo de ~300 ms o olho não acompanha o destaque; acima de ~700 ms vira espera.
 */
const DURACAO_MINIMA = 320;

/** Com menos movimento: quanto destaque e balão levam para sumir antes de reaparecer no alvo. */
const FUSAO_MS = 170;
const DURACAO_MAXIMA = 700;

/** Quanto esperar um alvo aparecer depois de trocar de página. */
const ESPERA_ALVO_MS = 3000;

/**
 * Tours guiados: escurecem a tela, acendem um elemento por vez e explicam cada um.
 *
 * Feito sobre o `<dialog>` nativo, e não com biblioteca: o elemento já prende o foco,
 * fecha com Esc e é anunciado como diálogo pelos leitores de tela. As bibliotecas
 * avaliadas falhavam justamente nisso — botões sem nome, sem teclado, sem foco preso.
 *
 * Há um tour do site e um por tela. A tela anuncia o seu com `registrar`, e o "?" do
 * cabeçalho (`AjudaComponent`) o oferece junto com o do site.
 *
 * DECISÃO (autor, 2026-10-22): nenhum tour se oferece sozinho. Antes, cada página nova
 * abria uma oferta no primeiro acesso, e a pessoa tinha de dispensar uma a cada tela.
 * O único que ainda abre sem pedido é o da auditoria, na primeira vez que ela é ligada:
 * aí a pessoa acabou de pedir uma coisa nova.
 */
export function ProvedorDoTourComponent({ children }: { children: ReactNode }) {
  const [aberto, setAberto] = useState<{ nome: NomeDoTour; passos: PassoDoTour[] } | null>(null);
  const [tela, setTela] = useState<TourDaTela | null>(null);

  const telaAtual = useRef(tela);
  useEffect(() => {
    telaAtual.current = tela;
  }, [tela]);

  const iniciar = useCallback((nome: NomeDoTour = 'site') => {
    if (nome === 'site' || nome === 'auditoria') {
      setAberto({ nome, passos: nome === 'site' ? PASSOS_DO_SITE : PASSOS_DA_AUDITORIA });
      return;
    }
    const registrada = telaAtual.current;
    if (registrada?.nome === nome) setAberto({ nome, passos: registrada.passos });
  }, []);

  const registrar = useCallback((nova: TourDaTela) => {
    setTela(nova);
    return () => setTela((atual) => (atual === nova ? null : atual));
  }, []);

  const daTela = tela?.nome ?? null;
  const contexto = useMemo(() => ({ iniciar, registrar, daTela }), [iniciar, registrar, daTela]);

  return (
    <ContextoDoTour.Provider value={contexto}>
      {children}
      {aberto && (
        <TourComponent
          key={aberto.nome}
          passos={aberto.passos}
          aoFechar={() => {
            marcarTourVisto(aberto.nome);
            setAberto(null);
          }}
        />
      )}
    </ContextoDoTour.Provider>
  );
}

/**
 * O tour aberto.
 *
 * ## Por que o movimento é assim
 *
 * Cada passo é UMA viagem de câmera: a rolagem da página e o destaque andam juntos, no
 * mesmo quadro, com a mesma curva (`suavizar`) e a mesma duração. O destaque chega ao
 * elemento exatamente quando a página para de rolar.
 *
 * As duas versões anteriores falharam por não ser uma viagem só:
 *
 * - **Três tempos** — o balão sumia, a página rolava com o destaque parado, e ele saltava.
 * - **Perseguição** — a página rolava com a curva do navegador e o destaque perseguia o
 *   alvo com a dele. Duas curvas: o destaque ficava para trás e depois alcançava, como um
 *   elástico. E "20% por quadro" anda duas vezes mais rápido numa tela de 120 Hz.
 *
 * ATENÇÃO: Cada quadro LÊ tudo antes de ESCREVER. Escrever o tamanho do destaque e depois ler o
 * do balão obriga o navegador a recalcular o layout no meio do quadro — era a outra causa
 * do engasgo.
 *
 * Depois de chegar, o destaque acompanha a rolagem e o redimensionamento na hora, sem
 * animar. Se a pessoa rola durante a viagem, a viagem para e o destaque passa a acompanhar.
 *
 * ATENÇÃO: Com "menos movimento", a viagem dura zero: tudo vai direto ao lugar.
 *
 * "Passo 4 de 6" com dois opcionais ausentes prometia dois passos que não vêm. Conta o que
 * está na página, e o opcional de OUTRA página conta — não dá para saber daqui.
 *
 * Escreve destaque e balão. Só escreve — quem chama já mediu tudo.
 *
 * Abre o diálogo. A entrada (`visivel`) só liga depois do primeiro desenho: antes disso o
 * balão não tem lugar, e apareceria no canto para depois saltar.
 *
 * A cada passo: troca de página se precisar, espera o alvo e faz a viagem.
 *
 * ATENÇÃO: Na página atual, alvo ausente é passo que não se aplica (um opcional): pula já. Esperar
 * os 3 s de quem troca de página deixava o balão com o texto novo sobre o alvo antigo.
 *
 * Medir tudo de uma vez, antes de qualquer escrita.
 *
 * A área útil começa ABAIXO do cabeçalho fixo: centralizar na janela inteira deixava o
 * topo do destaque escondido atrás dele.
 *
 * ATENÇÃO: Alvo mais alto que a área útil: destaca o começo dele e deixa o espaço do balão
 * embaixo. Destacar tudo punha o balão EM CIMA do que ele explica.
 *
 * ATENÇÃO: Menos movimento não é "nenhuma transição": sai o deslizamento, fica a fusão curta.
 * Destaque e balão somem, a página se reposiciona parada, e os dois voltam no alvo.
 * Cortar seco confunde tanto quanto deslizar demais.
 *
 * Parado: o destaque acompanha rolagem e redimensionamento na hora, sem animar. Rolar
 * durante a viagem a interrompe — a pessoa assumiu o controle da página.
 *
 * A `key` refaz o bloco a cada passo, e a entrada curta do CSS roda de novo: o
 * texto novo chega junto com o balão em movimento, sem piscar para vazio.
 */
function TourComponent({ passos, aoFechar }: { passos: PassoDoTour[]; aoFechar: () => void }) {
  const dialogo = useRef<HTMLDialogElement>(null);
  const destaque = useRef<HTMLDivElement>(null);
  const balao = useRef<HTMLDivElement>(null);
  const botaoAvancar = useRef<HTMLButtonElement>(null);

  const navegar = useNavigate();
  const { pathname } = useLocation();
  const rotaAtual = useRef(pathname);
  useEffect(() => {
    rotaAtual.current = pathname;
  }, [pathname]);

  const [indice, setIndice] = useState(0);
  const [visivel, setVisivel] = useState(false);

  const direcao = useRef<1 | -1>(1);
  const fechando = useRef(false);
  const alvoAtual = useRef<HTMLElement | null>(null);
  const buraco = useRef<Retangulo | null>(null);
  const posicaoDoBalao = useRef<{ x: number; y: number } | null>(null);
  const viagem = useRef(0);
  const viajando = useRef(false);

  const passo = passos[indice];

  const contam = passos.filter(
    (p) => !p.opcional || (p.rota !== null && p.rota !== pathname) || alvoVisivel(p.alvo) !== null,
  );
  const numero = Math.max(contam.indexOf(passo) + 1, 1);
  const ultimo = numero === contam.length;

  const fechar = useCallback(() => {
    if (fechando.current) return;
    fechando.current = true;
    cancelAnimationFrame(viagem.current);
    setVisivel(false);

    window.setTimeout(() => {
      dialogo.current?.close();
      aoFechar();
    }, menosMovimento() ? 0 : SAIDA_MS);
  }, [aoFechar]);

  const desenhar = useCallback((r: Retangulo, balaoEm: { x: number; y: number }, lado: 'baixo' | 'cima') => {
    const furo = destaque.current;
    const caixa = balao.current;
    if (!furo || !caixa) return;

    furo.style.width = `${r.w}px`;
    furo.style.height = `${r.h}px`;
    furo.style.transform = `translate(${r.x}px, ${r.y}px)`;
    caixa.style.transform = `translate(${balaoEm.x}px, ${balaoEm.y}px)`;
    caixa.dataset.lado = lado;

    buraco.current = r;
    posicaoDoBalao.current = balaoEm;
  }, []);

  useEffect(() => {
    const d = dialogo.current;
    if (d && !d.open) d.showModal();
  }, []);

  useEffect(() => {
    let cancelado = false;

    const trocaDePagina = Boolean(passo.rota && passo.rota !== rotaAtual.current);
    if (trocaDePagina) void navegar(passo.rota!);

    const achado = trocaDePagina ? esperarAlvo(passo.alvo) : Promise.resolve(alvoVisivel(passo.alvo));

    achado.catch(() => null).then((alvo) => {
      if (cancelado) return;

      if (!alvo) {
        const proximo = indice + direcao.current;
        if (proximo >= 0 && proximo < passos.length) setIndice(proximo);
        else fechar();
        return;
      }

      alvoAtual.current = alvo;
      cancelAnimationFrame(viagem.current);

      const r = alvo.getBoundingClientRect();
      const largura = balao.current?.offsetWidth ?? 0;
      const altura = balao.current?.offsetHeight ?? 0;
      const topo = topoLivre();
      const rolagemInicial = window.scrollY;
      const rolagemMaxima = Math.max(document.documentElement.scrollHeight - window.innerHeight, 0);

      const util = window.innerHeight - topo;
      const cabe = r.height + FOLGA * 2 + altura + MARGEM * 3 <= util;
      const desejada = cabe
        ? rolagemInicial + r.top + r.height / 2 - (topo + util / 2)
        : rolagemInicial + r.top - FOLGA - topo - MARGEM;
      const rolagemFinal = limitar(desejada, 0, rolagemMaxima);
      const deslocamento = rolagemFinal - rolagemInicial;

      const alturaMaxima = window.innerHeight - (r.top - deslocamento - FOLGA) - altura - MARGEM * 2;
      const destino: Retangulo = {
        x: r.left - FOLGA,
        y: r.top - deslocamento - FOLGA,
        w: r.width + FOLGA * 2,
        h: cabe ? r.height + FOLGA * 2 : Math.max(Math.min(r.height + FOLGA * 2, alturaMaxima), 48),
      };
      const lugar = lugarDoBalao(destino, largura, altura, topo);

      const primeiroDesenho = buraco.current === null;
      const origem = buraco.current ?? destino;
      const origemDoBalao = posicaoDoBalao.current ?? lugar;

      const distancia = Math.max(
        Math.abs(deslocamento),
        Math.abs(destino.y - origem.y),
        Math.abs(destino.x - origem.x),
        Math.abs(destino.h - origem.h),
        Math.abs(destino.w - origem.w),
      );
      const duracao = menosMovimento() || primeiroDesenho
        ? 0
        : limitar(DURACAO_MINIMA + distancia * 0.4, DURACAO_MINIMA, DURACAO_MAXIMA);

      const inicio = performance.now();
      viajando.current = true;

      const quadro = (agora: number) => {
        const t = duracao === 0 ? 1 : Math.min((agora - inicio) / duracao, 1);
        const e = suavizar(t);

        if (deslocamento !== 0) {
          window.scrollTo({ top: rolagemInicial + deslocamento * e, behavior: 'instant' });
        }
        desenhar(
          interpolar(origem, destino, e),
          { x: origemDoBalao.x + (lugar.x - origemDoBalao.x) * e, y: origemDoBalao.y + (lugar.y - origemDoBalao.y) * e },
          lugar.lado,
        );

        if (primeiroDesenho) setVisivel(true);

        if (t < 1) {
          viagem.current = requestAnimationFrame(quadro);
          return;
        }
        viajando.current = false;
        botaoAvancar.current?.focus({ preventScroll: true });
      };

      const fundir = menosMovimento() && !primeiroDesenho && dialogo.current;
      if (fundir) {
        dialogo.current!.classList.add('tour-trocando');
        window.setTimeout(() => {
          if (cancelado) return;
          viagem.current = requestAnimationFrame((agora) => {
            quadro(agora);
            dialogo.current?.classList.remove('tour-trocando');
          });
        }, FUSAO_MS);
        return;
      }

      viagem.current = requestAnimationFrame(quadro);
    });

    return () => {
      cancelado = true;
    };
  }, [indice, passo, passos.length, navegar, fechar, desenhar]);

  useEffect(() => {
    let quadro = 0;

    const acompanhar = () => {
      cancelAnimationFrame(quadro);
      quadro = requestAnimationFrame(() => {
        const alvo = alvoAtual.current;
        const caixa = balao.current;
        if (!alvo || !caixa || viajando.current) return;

        const r = alvo.getBoundingClientRect();
        const largura = caixa.offsetWidth;
        const altura = caixa.offsetHeight;
        const agora: Retangulo = { x: r.left - FOLGA, y: r.top - FOLGA, w: r.width + FOLGA * 2, h: r.height + FOLGA * 2 };
        const lugar = lugarDoBalao(agora, largura, altura, topoLivre());
        desenhar(agora, lugar, lugar.lado);
      });
    };

    const interromper = () => {
      if (!viajando.current) return;
      cancelAnimationFrame(viagem.current);
      viajando.current = false;
      acompanhar();
    };

    window.addEventListener('scroll', acompanhar, { passive: true, capture: true });
    window.addEventListener('resize', acompanhar);
    window.addEventListener('wheel', interromper, { passive: true });
    window.addEventListener('touchmove', interromper, { passive: true });

    return () => {
      cancelAnimationFrame(quadro);
      window.removeEventListener('scroll', acompanhar, { capture: true });
      window.removeEventListener('resize', acompanhar);
      window.removeEventListener('wheel', interromper);
      window.removeEventListener('touchmove', interromper);
    };
  }, [desenhar]);

  const irPara = (proximo: number) => {
    if (proximo < 0) return;
    if (proximo >= passos.length) {
      fechar();
      return;
    }
    direcao.current = proximo > indice ? 1 : -1;
    setIndice(proximo);
  };

  return (
    <dialog
      ref={dialogo}
      className={`tour ${visivel ? 'tour-visivel' : ''}`}
      aria-labelledby="tour-titulo"
      aria-describedby="tour-texto"
      onCancel={(evento) => {
        evento.preventDefault();
        fechar();
      }}
    >
      <div ref={destaque} className="tour-destaque" aria-hidden="true" />

      <div ref={balao} className="tour-balao">
        <div key={indice} aria-live="polite" className="tour-conteudo">
          <p className="tour-passo">{T.tour.passo(numero, contam.length)}</p>
          <h2 id="tour-titulo">{passo.titulo}</h2>
          <p id="tour-texto">{passo.texto}</p>
        </div>

        <div className="tour-controles">
          <button type="button" className="botao-texto" onClick={fechar}>
            {T.tour.pular}
          </button>
          {indice > 0 && (
            <button type="button" className="botao-secundario" onClick={() => irPara(indice - 1)}>
              {T.tour.anterior}
            </button>
          )}
          <button
            ref={botaoAvancar}
            type="button"
            className="botao-destaque"
            onClick={() => irPara(indice + 1)}
          >
            {ultimo ? T.tour.concluir : T.tour.proximo}
          </button>
        </div>
      </div>
    </dialog>
  );
}

type Retangulo = { x: number; y: number; w: number; h: number };

function interpolar(de: Retangulo, para: Retangulo, e: number): Retangulo {
  return {
    x: de.x + (para.x - de.x) * e,
    y: de.y + (para.y - de.y) * e,
    w: de.w + (para.w - de.w) * e,
    h: de.h + (para.h - de.h) * e,
  };
}

/**
 * Acelera devagar e freia devagar (cúbica de entrada e saída) — a curva de uma câmera, que
 * sai do repouso e para nele. A mesma para a rolagem e para o destaque: é isso que os faz
 * chegar juntos.
 */
function suavizar(t: number): number {
  return t < 0.5 ? 4 * t * t * t : 1 - Math.pow(-2 * t + 2, 3) / 2;
}

/** Embaixo do destaque; em cima quando embaixo não cabe. Sempre dentro da janela. */
function lugarDoBalao(
  destaque: Retangulo,
  largura: number,
  altura: number,
  topo: number,
): { x: number; y: number; lado: 'baixo' | 'cima' } {
  let y = destaque.y + destaque.h + MARGEM;
  let lado: 'baixo' | 'cima' = 'baixo';
  if (y + altura > window.innerHeight - MARGEM) {
    y = destaque.y - MARGEM - altura;
    lado = 'cima';
  }

  return {
    x: limitar(destaque.x + destaque.w / 2 - largura / 2, MARGEM, window.innerWidth - largura - MARGEM),
    y: limitar(y, topo + MARGEM, window.innerHeight - altura - MARGEM),
    lado,
  };
}

/**
 * Onde a área útil da janela começa: abaixo do cabeçalho fixo, que fica por cima de tudo.
 * Sem cabeçalho na página (login, documento público), é o topo da janela.
 */
function topoLivre(): number {
  const cabecalho = document.querySelector('.cabecalho-site');
  return cabecalho ? Math.max(cabecalho.getBoundingClientRect().bottom, 0) : 0;
}

/** O alvo, se está na página e tem tamanho; `null` se não . */
function alvoVisivel(alvo: string): HTMLElement | null {
  const el = acharAlvo(alvo);
  return el && el.getBoundingClientRect().height > 0 ? el : null;
}

function acharAlvo(alvo: string): HTMLElement | null {
  return document.querySelector<HTMLElement>(`[data-tour="${alvo}"]`);
}

/** Espera o elemento existir e ter tamanho — a página pode ainda estar carregando. */
function esperarAlvo(alvo: string): Promise<HTMLElement | null> {
  const inicio = performance.now();

  return new Promise((resolver) => {
    const tentar = () => {
      const el = acharAlvo(alvo);
      if (el && el.getBoundingClientRect().height > 0) {
        resolver(el);
        return;
      }
      if (performance.now() - inicio > ESPERA_ALVO_MS) {
        resolver(null);
        return;
      }
      requestAnimationFrame(tentar);
    };
    tentar();
  });
}

function limitar(valor: number, minimo: number, maximo: number): number {
  return Math.max(minimo, Math.min(valor, Math.max(minimo, maximo)));
}

function menosMovimento(): boolean {
  return window.matchMedia?.('(prefers-reduced-motion: reduce)').matches ?? false;
}
