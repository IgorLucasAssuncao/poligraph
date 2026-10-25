import { marcarConviteRespondido } from './respostaAoConvite';
import { TEXTO_CONSENTIMENTO_AVISOS } from '../../nucleo/textos-legais';
import { PedidoDeConsentimentoComponent } from './PedidoDeConsentimento';
import { useAvisosNoNavegador } from './useAvisosNoNavegador';

/**
 * O convite para receber avisos, logo depois de seguir alguém (Pendência 89).
 *
 * DECISÃO do autor (2026-10-18): a pergunta vem no momento em que faz sentido, ao seguir, como os
 * sites costumam fazer; depois disso o controle fica na página da conta. Era um bloco fixo no
 * sininho, longe do gesto que dá motivo ao aviso.
 *
 * ATENÇÃO: Só pergunta a quem pode receber: navegador com suporte, servidor com chave, permissão
 * ainda não decidida e este navegador ainda não inscrito. Em qualquer outro caso, não aparece.
 *
 * RISCO: O texto é o próprio consentimento: "Quero receber" pede a permissão do navegador e grava o
 * consentimento junto, sem um segundo pedido.
 */
export function ConviteDeAvisosComponent({ aoFechar }: { aoFechar: () => void }) {
  const avisos = useAvisosNoNavegador();

  if (avisos.situacao !== 'desligado' || Notification.permission !== 'default') return null;

  return (
    <PedidoDeConsentimentoComponent
      texto={TEXTO_CONSENTIMENTO_AVISOS}
      aoAceitar={() => {
        marcarConviteRespondido();
        aoFechar();
        void avisos.ligar(true);
      }}
      aoRecusar={() => {
        marcarConviteRespondido();
        aoFechar();
      }}
    />
  );
}
