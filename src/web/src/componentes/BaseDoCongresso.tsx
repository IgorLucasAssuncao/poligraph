import { NOME_DA_CASA, type Panorama, type PanoramaDaCasa } from '../api';
import { dataCurta, periodoDaLegislatura } from '../formato';
import { TEXTOS_DO_INICIO as T } from '../textos/inicio';
import { ComProcedenciaComponent } from './ModoAuditoria';
import { PainelComponent } from './Painel';

/**
 * O tamanho da base, por casa — o que sustenta tudo o que a tela afirma.
 *
 * DECISÃO: Estado honesto do primeiro dia: não inventa número nenhum.
 *
 * ATENÇÃO: "55ª legislatura" aqui, e "2015–2019 · 55ª" no seletor logo acima, diziam a
 * mesma coisa duas vezes. O título diz o período; o número fica no seletor.
 */
export function BaseComponent({ panorama }: { panorama: Panorama }) {
  if (panorama.porCasa.length === 0) {
    return (
      <section className="painel-secao">
        <p className="vazio">{T.base.vazio}</p>
      </section>
    );
  }

  return (
    <section className="painel-secao">
      <h2>
        {T.base.titulo}{' '}
        {panorama.legislatura != null && <small>{periodoDaLegislatura(panorama.legislatura)}</small>}
      </h2>

      <div className="painel-casas">
        {panorama.porCasa.map((casa) => (
          <CartaoDaCasaComponent key={casa.casa} casa={casa} legislatura={panorama.legislatura ?? undefined} />
        ))}
      </div>
    </section>
  );
}

/**
 * ATENÇÃO: Pendência 68 — o painel contava toda votação registrada, e a 51ª da Câmara afirmava
 * 1.548 com 7 de voto nominal. O número acima é o que o cálculo usa; o resto é
 * dito aqui, não somado calado.
 *
 * RISCO: O sigilo muda o que a figura daquela casa pode afirmar, e omiti-lo faria as
 * duas parecerem comparáveis. É achado do trabalho, não rodapé.
 */
function CartaoDaCasaComponent({ casa, legislatura }: { casa: PanoramaDaCasa; legislatura?: number }) {
  const nome = NOME_DA_CASA[casa.casa];
  const abertas = casa.votacoes - casa.votacoesSecretas;

  return (
    <article className="cartao-casa">
      <h3>{nome.nome}</h3>

      <dl>
        <div>
          <dt>{nome.plural}</dt>
          <dd>{casa.parlamentares.toLocaleString('pt-BR')}</dd>
        </div>
        <div>
          <dt>{T.base.votacoes}</dt>
          <dd>
            <ComProcedenciaComponent
              consulta={{ contexto: 'painel', casa: casa.casa, legislatura }}
              rotulo={T.base.rotuloDaProcedencia(nome.nome)}
            >
              {casa.votacoes.toLocaleString('pt-BR')}
            </ComProcedenciaComponent>
          </dd>
        </div>
        <div>
          <dt>{T.base.votosComPosicao}</dt>
          <dd>{casa.votosComPosicao.toLocaleString('pt-BR')}</dd>
        </div>
        <div>
          <dt>{T.base.grupos}</dt>
          <dd>{casa.comunidades.toLocaleString('pt-BR')}</dd>
        </div>
      </dl>

      {casa.votacoesSemVotoNominal > 0 && (
        <p className="cartao-ressalva">{T.base.semVotoNominal(casa.votacoesSemVotoNominal.toLocaleString('pt-BR'))}</p>
      )}

      {casa.votacoesSecretas > 0 && (
        <p className="cartao-ressalva">
          {T.base.secretas(
            casa.votacoesSecretas,
            casa.votacoes.toLocaleString('pt-BR'),
            abertas.toLocaleString('pt-BR'),
            casa.votacoesSecretas.toLocaleString('pt-BR'),
          )}
        </p>
      )}

      {casa.votacoesSimbolicas != null && (
        <ComoODecidiuComponent
          nominais={casa.votacoes + casa.votacoesSemVotoNominal}
          simbolicas={casa.votacoesSimbolicas}
        />
      )}

      {casa.ultima && (
        <figure className="cartao-ultima">
          <figcaption>{T.base.ultima(dataCurta(casa.ultima.data), casa.ultima.materia)}</figcaption>
          <PainelComponent posicionados={casa.ultima.posicionados} total={casa.ultima.cadeiras} />
        </figure>
      )}
    </article>
  );
}

/**
 * Quanto do plenário decidiu com voto de cada um, e quanto por votação simbólica.
 *
 * DECISÃO (2026-10-03, pedido do autor): o site compara só votação nominal, e a maioria das
 * decisões do plenário é simbólica (MEDIDO: 1.612 contra 429 na Câmara em 2025). Dizer isso no
 * Início mostra o tamanho do que fica de fora, com a dica de cada termo.
 */
export function ComoODecidiuComponent({ nominais, simbolicas }: { nominais: number; simbolicas: number }) {
  const total = nominais + simbolicas;
  if (total === 0) return null;
  const parteNominal = (nominais / total) * 100;

  return (
    <div className="cartao-forma">
      <p className="cartao-forma-titulo">{T.comoDecidiu.titulo}</p>
      <span className="barra-dividida" role="img" aria-label={T.comoDecidiu.rotulo(nominais, simbolicas)}>
        <span className="parte-nominal" style={{ width: `${parteNominal}%` }} />
        <span className="parte-simbolica" style={{ width: `${100 - parteNominal}%` }} />
      </span>
      <p className="cartao-forma-legenda">
        <span>
          <span className="amostra-cor" aria-hidden="true" />
          {T.comoDecidiu.nominais(nominais.toLocaleString('pt-BR'))}
        </span>
        <span>
          <span className="amostra-cor amostra-simbolica" aria-hidden="true" />
          {T.comoDecidiu.simbolicas(simbolicas.toLocaleString('pt-BR'))}
        </span>
      </p>
      <p className="cartao-ressalva">{T.comoDecidiu.ressalva}</p>
    </div>
  );
}
