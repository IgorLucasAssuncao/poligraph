import { useCallback, useEffect, useState } from 'react';
import {
  ConsentimentoNecessarioError,
  inscreverNavegador,
  obterChaveDosAvisos,
  obterEstadoDosAvisos,
  tirarNavegador,
} from '../api';
import type { EstadoDosAvisos, InscricaoDoNavegador } from '../api';

/**
 * Em que pé estão os avisos neste navegador.
 *
 * - `indisponivel`: o servidor não tem chave, e a tela não oferece nada.
 * - `sem-suporte`: o navegador não tem push (iPhone fora da tela de início, navegador antigo).
 * - `bloqueado`: a pessoa negou a permissão; só ela desfaz, nas configurações do site.
 */
export type SituacaoDosAvisos = 'carregando' | 'indisponivel' | 'sem-suporte' | 'bloqueado' | 'desligado' | 'ligado';

/**
 * Os avisos no navegador (Pendência 89): pede a permissão, inscreve no serviço de push do
 * fabricante e entrega o endereço à API.
 *
 * DECISÃO: O que vale é o que o navegador diz (`getSubscription`) e o que a API tem. Inscrição
 * que só existe de um lado é refeita ou desfeita ao ligar e desligar.
 *
 * RISCO: Sem consentimento vivo, a API responde 428 e `pedindoConsentimento` fica verdadeiro: a
 * tela mostra o pedido e chama `aceitar`. A permissão do navegador já foi dada nesse ponto, e o
 * endereço fica guardado no estado até a resposta.
 *
 * ATENÇÃO: Fica fora do cache de leituras, como o "O que mudou": diz que a pessoa segue alguém.
 */
export function useAvisosNoNavegador() {
  const [situacao, setSituacao] = useState<SituacaoDosAvisos>('carregando');
  const [estado, setEstado] = useState<EstadoDosAvisos | null>(null);
  const [ocupado, setOcupado] = useState(false);
  const [erro, setErro] = useState(false);
  const [pendente, setPendente] = useState<InscricaoDoNavegador | null>(null);

  const atualizar = useCallback(async () => {
    const lido = await lerSituacao();
    setSituacao(lido.situacao);
    setEstado(lido.estado);
  }, []);

  useEffect(() => {
    let atual = true;
    lerSituacao().then((lido) => {
      if (!atual) return;
      setSituacao(lido.situacao);
      setEstado(lido.estado);
    });
    return () => {
      atual = false;
    };
  }, []);

  return { situacao, estado, ocupado, erro, pedindoConsentimento: pendente !== null, ligar, aceitar, recusar, desligar, atualizar };

  /**
   * Pede a permissão do navegador e inscreve. Com `aceite`, o consentimento foi dado na própria
   * pergunta (o convite depois de seguir), e a API grava junto.
   *
   * ATENÇÃO: A permissão é pedida antes de qualquer espera: o navegador só a mostra durante o clique.
   */
  async function ligar(aceite = false) {
    await executar(async () => {
      if ((await Notification.requestPermission()) !== 'granted') {
        setSituacao(Notification.permission === 'denied' ? 'bloqueado' : 'desligado');
        return;
      }
      const chave = await obterChaveDosAvisos();
      if (!chave) return;
      const inscricao = await inscrever(chave);
      try {
        await inscreverNavegador(inscricao, aceite);
      } catch (falha) {
        if (falha instanceof ConsentimentoNecessarioError) {
          setPendente(inscricao);
          return;
        }
        throw falha;
      }
      await atualizar();
    });
  }

  async function aceitar() {
    const inscricao = pendente;
    setPendente(null);
    if (!inscricao) return;
    await executar(async () => {
      await inscreverNavegador(inscricao, true);
      await atualizar();
    });
  }

  async function recusar() {
    setPendente(null);
    await executar(async () => {
      await (await inscricaoAtual())?.unsubscribe();
      await atualizar();
    });
  }

  async function desligar() {
    await executar(async () => {
      const inscricao = await inscricaoAtual();
      if (inscricao) {
        await tirarNavegador(inscricao.endpoint);
        await inscricao.unsubscribe();
      }
      await atualizar();
    });
  }

  async function executar(acao: () => Promise<void>) {
    setOcupado(true);
    setErro(false);
    try {
      await acao();
    } catch {
      setErro(true);
    } finally {
      setOcupado(false);
    }
  }
}

/** A situação deste navegador e o que a API sabe dele. Erro de rede vira `indisponivel`: a tela some, sem quebrar o cabeçalho. */
async function lerSituacao(): Promise<{ situacao: SituacaoDosAvisos; estado: EstadoDosAvisos | null }> {
  try {
    const chave = await obterChaveDosAvisos();
    if (!chave) return { situacao: 'indisponivel', estado: null };
    if (!avisosSuportados()) return { situacao: 'sem-suporte', estado: null };
    if (Notification.permission === 'denied') return { situacao: 'bloqueado', estado: null };

    const inscricao = await inscricaoAtual();
    const estado = await obterEstadoDosAvisos(inscricao?.endpoint ?? null);
    return { situacao: inscricao && estado.esteNavegador ? 'ligado' : 'desligado', estado };
  } catch {
    return { situacao: 'indisponivel', estado: null };
  }
}

/** Se este navegador tem o que os avisos precisam. */
export function avisosSuportados(): boolean {
  return typeof window !== 'undefined' && 'serviceWorker' in navigator && 'PushManager' in window && 'Notification' in window;
}

async function inscricaoAtual(): Promise<PushSubscription | null> {
  const registro = await navigator.serviceWorker.getRegistration();
  return registro ? registro.pushManager.getSubscription() : null;
}

/** Inscreve no serviço de push do fabricante com a chave pública do servidor. */
async function inscrever(chavePublica: string): Promise<InscricaoDoNavegador> {
  const registro = (await navigator.serviceWorker.getRegistration()) ?? (await navigator.serviceWorker.register('/sw.js'));
  await navigator.serviceWorker.ready;
  const existente = await registro.pushManager.getSubscription();
  const inscricao =
    existente ??
    (await registro.pushManager.subscribe({ userVisibleOnly: true, applicationServerKey: deBase64Url(chavePublica) }));
  return paraInscricao(inscricao);
}

/** O que a API guarda: o endereço e as duas chaves, em base64url, como o navegador entrega. */
export function paraInscricao(inscricao: PushSubscription): InscricaoDoNavegador {
  const json = inscricao.toJSON();
  return { endereco: json.endpoint ?? inscricao.endpoint, p256dh: json.keys?.p256dh ?? '', auth: json.keys?.auth ?? '' };
}

/** base64url para bytes, o formato que `applicationServerKey` aceita em todo navegador. */
export function deBase64Url(texto: string): Uint8Array<ArrayBuffer> {
  const base64 = texto.replace(/-/g, '+').replace(/_/g, '/').padEnd(Math.ceil(texto.length / 4) * 4, '=');
  const binario = atob(base64);
  const bytes = new Uint8Array(new ArrayBuffer(binario.length));
  for (let i = 0; i < binario.length; i++) bytes[i] = binario.charCodeAt(i);
  return bytes;
}
