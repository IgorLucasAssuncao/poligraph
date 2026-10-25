import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import type { ReactNode } from 'react';
import { obterProcedencia } from '../../nucleo/api';
import type { CargaDeProcedencia, ConsultaDeProcedencia, LinhaDaProcedencia, Procedencia } from '../../nucleo/api';
import { dataCurta, reais } from '../../nucleo/formato';
import { tourJaVisto } from '../../nucleo/tour';
import { useCarga } from './useCarga';
import { ContextoDoModoAuditoria, useModoAuditoria } from './contextoDoModoAuditoria';
import { useTour } from '../../site/componentes/contextoDoTour';
import { LinkDeFonteComponent } from './LinkDeFonte';
import { TEXTOS_DA_AUDITORIA as T } from '../textos/auditoria';
import { CHAVE_DO_MODO_AUDITORIA } from '../../nucleo/constantes';


/**
 * Modo auditoria (Pendência 73): ligado, todo número que tem procedência vira botão e abre o painel
 * com o arquivo de onde veio, o hash e a regra da conta.
 *
 * DECISÃO: É a regra que o projeto já segue (mostrar o cálculo junto do número, e o número
 * exibido ser o usado) levada até o arquivo de origem. Desligado, o site fica como está.
 *
 * ATENÇÃO: A escolha fica no navegador, não na conta: vale para quem não entrou, e não é
 * dado pessoal que precise ir ao servidor.
 *
 * O estado do modo e o painel, um para o site inteiro.
 */
export function ProvedorDoModoAuditoriaComponent({ children }: { children: ReactNode }) {
  const [ligado, setLigado] = useState(lerGuardado);
  const [aberto, setAberto] = useState<{ consulta: ConsultaDeProcedencia; rotulo: string } | null>(null);

  const alternar = useCallback(() => {
    setLigado((atual) => {
      guardar(!atual);
      return !atual;
    });
  }, []);

  const abrir = useCallback(
    (consulta: ConsultaDeProcedencia, rotulo: string) => setAberto({ consulta, rotulo }),
    [],
  );

  const estado = useMemo(() => ({ ligado, alternar, abrir }), [ligado, alternar, abrir]);

  return (
    <ContextoDoModoAuditoria.Provider value={estado}>
      {children}
      <PainelDeProcedenciaComponent aberto={aberto} aoFechar={() => setAberto(null)} />
    </ContextoDoModoAuditoria.Provider>
  );
}


/**
 * O interruptor do cabeçalho.
 *
 * DECISÃO: No cabeçalho, visível em toda tela, e não no menu: é o lugar que o sistema do vídeo
 * analisado usa (plano/10 §1), e escondido atrás de um clique ninguém descobre que existe.
 *
 * Na primeira vez que liga, abre o tour do modo (`PASSOS_DA_AUDITORIA`).
 */
export function InterruptorDoModoAuditoriaComponent() {
  const { ligado, alternar } = useModoAuditoria();
  const { iniciar } = useTour();

  const aoClicar = () => {
    alternar();
    if (!ligado && !tourJaVisto('auditoria')) iniciar('auditoria');
  };

  return (
    <button
      type="button"
      className="interruptor-auditoria"
      aria-pressed={ligado}
      title={ligado ? T.interruptor.desligar : T.interruptor.ligar}
      onClick={aoClicar}
      data-tour="modo-auditoria"
    >
      <span className="interruptor-auditoria-trilho" aria-hidden="true" />
      <span>{T.interruptor.rotulo}</span>
    </button>
  );
}

/**
 * Um número da tela com a procedência dele.
 *
 * Desligado, devolve o número como está. Ligado, o número ganha sublinhado pontilhado e
 * abre o painel.
 *
 * RISCO: `children` precisa ser conteúdo de linha: um `<div>` dentro de `<button>` é HTML
 * inválido, e leitor de tela lê o botão pela metade.
 */
export function ComProcedenciaComponent({
  consulta,
  rotulo,
  children,
}: {
  consulta: ConsultaDeProcedencia;
  rotulo: string;
  children: ReactNode;
}) {
  const { ligado, abrir } = useModoAuditoria();
  if (!ligado) return <>{children}</>;

  return (
    <button
      type="button"
      className="numero-com-procedencia"
      data-tour="numero-com-procedencia"
      aria-label={T.verDeOndeVeio(rotulo)}
      onClick={() => abrir(consulta, rotulo)}
    >
      {children}
    </button>
  );
}

/**
 * O painel lateral: como foi contado, e de que arquivos.
 *
 * DECISÃO: `<dialog>` nativo, como o tour e os modais do projeto: foco preso, Esc e papel de
 * diálogo sem biblioteca.
 */
function PainelDeProcedenciaComponent({
  aberto,
  aoFechar,
}: {
  aberto: { consulta: ConsultaDeProcedencia; rotulo: string } | null;
  aoFechar: () => void;
}) {
  const dialogo = useRef<HTMLDialogElement>(null);
  const lida = useCarga(
    ['procedencia', aberto?.consulta ?? null],
    () => obterProcedencia(aberto!.consulta),
    { ativo: aberto !== null, manter: 2 },
  );
  const procedencia = lida.atualizando ? null : (lida.dados ?? null);
  const erro = lida.erro;

  useEffect(() => {
    const elemento = dialogo.current;
    if (!elemento) return;
    if (aberto && !elemento.open) elemento.showModal?.();
    if (!aberto && elemento.open) elemento.close();
  }, [aberto]);


  return (
    <dialog
      ref={dialogo}
      className="painel-procedencia"
      aria-labelledby="titulo-procedencia"
      onClose={aoFechar}
      onClick={(e) => e.target === dialogo.current && aoFechar()}
    >
      <header className="painel-procedencia-topo">
        <div>
          <p className="painel-procedencia-sobre">{aberto?.rotulo}</p>
          <h2 id="titulo-procedencia">{T.painel.titulo}</h2>
        </div>
        <button type="button" className="botao-icone" aria-label={T.painel.fechar} onClick={aoFechar}>
          ✕
        </button>
      </header>

      <div className="painel-procedencia-corpo">
        {erro && <p className="ajuda">{T.painel.erro}</p>}
        {!erro && !procedencia && aberto && <p className="ajuda">{T.painel.lendo}</p>}
        {procedencia && <ConteudoDaProcedenciaComponent procedencia={procedencia} />}
      </div>
    </dialog>
  );
}

/** A regra, a contagem e um cartão por arquivo. */
function ConteudoDaProcedenciaComponent({ procedencia }: { procedencia: Procedencia }) {
  const comCarga = procedencia.linhas - procedencia.linhasSemCarga;

  return (
    <>
      <section>
        <h3>{T.painel.comoFoiContado}</h3>
        <p>{procedencia.regra}</p>
        <p className="ajuda">
          {T.painel.linhas(procedencia.linhas.toLocaleString('pt-BR'), procedencia.linhas, comCarga.toLocaleString('pt-BR'))}
        </p>
        {procedencia.linhasSemCarga > 0 && (
          <p className="ajuda">
            {T.painel.semCarga(procedencia.linhasSemCarga.toLocaleString('pt-BR'), procedencia.linhasSemCarga)}
          </p>
        )}
      </section>

      {procedencia.lista && procedencia.lista.length > 0 && <LinhasDaProcedenciaComponent linhas={procedencia.lista} />}

      <section>
        <h3>{T.painel.arquivos(procedencia.cargas.length)}</h3>
        {procedencia.cargas.length === 0 && <p className="ajuda">{T.painel.nenhumArquivo}</p>}
        <ul className="lista-cargas">
          {procedencia.cargas.map((carga) => (
            <li key={carga.idCarga}>
              <CartaoDaCargaComponent carga={carga} />
            </li>
          ))}
        </ul>
      </section>
    </>
  );
}

/**
 * As linhas que entraram no número, quando são poucas (plano/10 §3): quem confere vê cada uma, e não só a contagem.
 */
function LinhasDaProcedenciaComponent({ linhas }: { linhas: LinhaDaProcedencia[] }) {
  return (
    <section>
      <h3>{T.painel.asLinhas(linhas.length)}</h3>
      <ul className="lista-linhas-procedencia">
        {linhas.map((l, i) => (
          <li key={i}>
            <span className="linha-procedencia-nome">
              {l.url ? <LinkDeFonteComponent href={l.url}>{l.descricao}</LinkDeFonteComponent> : l.descricao}
              {(l.detalhe || l.data) && <small>{[l.detalhe, l.data && dataCurta(l.data)].filter(Boolean).join(' · ')}</small>}
            </span>
            {l.valor !== null && <span className="dado">{reais(l.valor)}</span>}
          </li>
        ))}
      </ul>
    </section>
  );
}

/**
 * ATENÇÃO: A data é mostrada em UTC e diz isso: o hash prova a cópia baixada naquele instante,
 * e um horário local sem fuso seria ambíguo para quem confere de outro lugar.
 */
function CartaoDaCargaComponent({ carga }: { carga: CargaDeProcedencia }) {
  return (
    <dl className="cartao-carga">
      <dt>{T.carga.orgao}</dt>
      <dd>{carga.orgao}</dd>
      <dt>{T.carga.arquivo}</dt>
      <dd className="cartao-carga-url">
        <LinkDeFonteComponent href={carga.url}>{nomeDoArquivo(carga.url)}</LinkDeFonteComponent>
      </dd>
      <dt>{T.carga.baixadoEm}</dt>
      <dd className="dado">{dataHoraUtc(carga.baixadoEm)}</dd>
      <dt>{T.carga.sha256}</dt>
      <dd className="dado cartao-carga-hash">{carga.sha256}</dd>
      <dt>{T.carga.tamanho}</dt>
      <dd className="dado">{tamanho(carga.bytes)}</dd>
      {(carga.etagDaFonte || carga.modificadoNaFonte) && (
        <>
          <dt>{T.carga.versaoNaFonte}</dt>
          <dd className="dado">
            {[carga.modificadoNaFonte && dataHoraUtc(carga.modificadoNaFonte), carga.etagDaFonte]
              .filter(Boolean)
              .join(' · ')}
          </dd>
        </>
      )}
      <dt>{T.carga.codigoQueLeu}</dt>
      <dd className="dado">{carga.versao ?? T.carga.semVersao}</dd>
      <dt>{T.carga.comando}</dt>
      <dd className="dado">{carga.comando}</dd>
      <dt>{T.carga.baseLegal}</dt>
      <dd>{carga.baseLegal}</dd>
      <dt>{T.carga.linhasDoArquivo}</dt>
      <dd className="dado">{carga.linhas.toLocaleString('pt-BR')}</dd>
    </dl>
  );
}

/**
 * O fim do caminho da URL. Quando ele é só um ano ou um código curto ("2026", "UNICO"), vem com a
 * pasta junto ("orcamento-despesa/2026"): sozinho, não diz que arquivo é.
 */
function nomeDoArquivo(url: string): string {
  try {
    const caminho = new URL(url).pathname.split('/').filter(Boolean).map(decodeURIComponent);
    const ultimo = caminho.at(-1) ?? url;
    return /^[\w-]{1,8}$/.test(ultimo) && !ultimo.includes('.') && caminho.length > 1
      ? `${caminho.at(-2)}/${ultimo}`
      : ultimo;
  } catch {
    return url;
  }
}

function dataHoraUtc(iso: string): string {
  const data = new Date(iso);
  if (Number.isNaN(data.getTime())) return iso;
  return T.carga.utc(data.toLocaleString('pt-BR', { timeZone: 'UTC', dateStyle: 'short', timeStyle: 'short' }));
}

function tamanho(bytes: number): string {
  if (bytes >= 1 << 20) return T.carga.megabytes((bytes / (1 << 20)).toLocaleString('pt-BR', { maximumFractionDigits: 1 }));
  if (bytes >= 1 << 10) return T.carga.kilobytes((bytes / (1 << 10)).toLocaleString('pt-BR', { maximumFractionDigits: 0 }));
  return T.carga.bytes(bytes);
}

function lerGuardado(): boolean {
  try {
    return localStorage.getItem(CHAVE_DO_MODO_AUDITORIA) === '1';
  } catch {
    return false;
  }
}

function guardar(ligado: boolean): void {
  try {
    localStorage.setItem(CHAVE_DO_MODO_AUDITORIA, ligado ? '1' : '0');
  } catch {
    return;
  }
}
