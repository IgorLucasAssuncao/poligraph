import { useCarga } from '../componentes/useCarga';
import { Link, useSearchParams } from 'react-router-dom';
import { NOME_DA_CASA, obterPanorama, type Panorama } from '../api';
import { reaisCompacto } from '../formato';
import { BotaoGoogleComponent } from '../componentes/BotaoGoogle';
import { MarcaComponent } from '../componentes/Icones';
import { SeletorDeTemaComponent } from '../componentes/SeletorDeTema';
import { useSessao } from '../sessao';
import { destinoSeguro } from '../componentes/useEntrar';
import { TEXTOS_DA_CONTA } from '../textos/conta';

const T = TEXTOS_DA_CONTA.login;

/**
 * Porta de entrada.
 *
 * ## Quando ela aparece
 *
 * | Leitura pública (`Acesso:LeituraPublica`) | Esta tela |
 * |---|---|
 * | RISCO: Desligada — o padrão, e o período eleitoral (RNF-17) | Para tudo: o site exige conta |
 * | Ligada | Só para seguir alguém e para a própria conta. O resto é aberto |
 *
 * ATENÇÃO: O login foi obrigatório de 2026-08-26 a 2026-10-02. Passou a ser opcional por
 * decisão do autor: a conta só existe para a lista de quem a pessoa segue, que é dado
 * sensível (LGPD art. 5º, II). Quem não segue ninguém não precisa dar dado nenhum.
 *
 * Por isso esta tela diz, ANTES de entrar, o que vai ser guardado.
 *
 * ## RISCO: Os números são medidos, não escritos à mão
 *
 * Esta tela afirmava <i>"os 513 deputados federais"</i> — duas vezes. 513 é o número de
 * cadeiras; quem exerceu mandato e votou na 57ª legislatura são <b>643</b>, com
 * suplentes e quem assumiu no meio. E o Senado não era mencionado. Número redondo
 * escrito à mão na porta de entrada é exatamente o erro que o trabalho persegue: ele
 * não quebra nada, só fica plausível e errado.
 *
 * DECISÃO: `/api/panorama` é público de propósito — todo número dele vem de registro nominal
 * publicado, e não depende de quem está olhando.
 *
 * DECISÃO: Coluna da esquerda: a marca ocupa o espaço, sem imagem para carregar.
 *
 * ATENÇÃO: Dito ANTES de entrar, não depois.
 */
export function LoginComponent() {
  const { entrou, leituraPublica } = useSessao();
  const [parametros] = useSearchParams();
  const voltar = destinoSeguro(parametros.get('voltar'));
  const panorama = useCarga(['panorama', null], () => obterPanorama()).dados ?? null;

  return (
    <div className="tela-login">
      <Link to="/" className="login-marca" aria-label={T.paraOInicio}>
        <MarcaComponent tamanho={88} />
      </Link>

      <div className="login-conteudo">
        <div className="login-topo">
          <SeletorDeTemaComponent />
        </div>

        <h1 className="login-titulo">{T.titulo}</h1>

        <p className="login-chamada">{T.chamada}</p>

        <div className="acao-login">
          <BotaoGoogleComponent aoEntrar={entrou} />
          {leituraPublica && (
            <Link to={voltar} className="botao-sem-conta">
              {T.semConta}
            </Link>
          )}
        </div>

        {leituraPublica && <p className="login-opcional">{T.opcional}</p>}

        {panorama && panorama.porCasa.length > 0 && <BaseComponent panorama={panorama} />}

        <ul className="o-que-tem">
          {T.oQueTem.map((item) => (
            <li key={item}>{item}</li>
          ))}
        </ul>

        <p className="aviso-privacidade">{T.privacidade}</p>

        <p className="aviso-academico">
          <strong>{T.naoERecomendacao}</strong>
        </p>
      </div>
    </div>
  );
}

/**
 * O tamanho da base, antes de a pessoa entrar.
 *
 * DECISÃO: É a evidência que sustenta a chamada. "Compare com o voto registrado" é uma
 * promessa; 643 deputados e 463.994 votos são o que a torna verificável — e são o
 * argumento mais forte que esta tela tem para justificar pedir uma conta.
 */
function BaseComponent({ panorama }: { panorama: Panorama }) {
  return (
    <dl className="login-base">
      {panorama.porCasa.map((casa) => (
        <div key={casa.casa}>
          <dt>{NOME_DA_CASA[casa.casa].plural}</dt>
          <dd>{casa.parlamentares.toLocaleString('pt-BR')}</dd>
          <small>{T.base(casa.votosComPosicao.toLocaleString('pt-BR'), casa.votacoes.toLocaleString('pt-BR'))}</small>
        </div>
      ))}
      {panorama.dinheiro && (
        <div>
          <dt>{T.dinheiro}</dt>
          <dd>{reaisCompacto(panorama.dinheiro.cota + panorama.dinheiro.emendasPagas)}</dd>
          <small>
            {T.dinheiroDetalhe(
              reaisCompacto(panorama.dinheiro.cota),
              reaisCompacto(panorama.dinheiro.emendasPagas),
              panorama.dinheiro.primeiroAno,
              panorama.dinheiro.ultimoAno,
            )}
          </small>
        </div>
      )}
    </dl>
  );
}
