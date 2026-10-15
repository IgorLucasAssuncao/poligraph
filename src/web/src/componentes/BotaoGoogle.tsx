import { useEffect, useRef, useState } from 'react';
import { BASE_DA_API, CABECALHO_DO_SITE } from '../constantes';
import { TEXTOS_DO_SITE as T } from '../textos/site';

export type UsuarioLogado = { nome: string | null; fotoUrl: string | null };

/**
 * Botão "Entrar com Google".
 *
 * DECISÃO: Depois do login não sobra token nenhum aqui: o `id_token` vai UMA vez para a API,
 * que devolve um cookie `HttpOnly`. O JavaScript nem consegue lê-lo.
 *
 * Sem `localStorage`, sem header `Authorization`, sem lógica de renovação.
 *
 * ATENÇÃO: Lido AQUI, não no escopo do módulo: no escopo, o valor congela na importação
 * e o componente fica impossível de testar sem Client ID.
 *
 * ATENÇÃO: Sem Client ID o botão não existe — e isso é esperado em desenvolvimento.
 * O resto do site funciona: login só habilita sincronia e e-mail.
 */
export function BotaoGoogleComponent({ aoEntrar }: { aoEntrar: (usuario: UsuarioLogado) => void }) {
  const clientId = import.meta.env.VITE_GOOGLE_CLIENT_ID;
  const alvo = useRef<HTMLDivElement>(null);
  const [erro, setErro] = useState<string | null>(null);

  useEffect(() => {
    if (!clientId) return;

    carregarScript()
      .then(() => {
        window.google?.accounts.id.initialize({
          client_id: clientId,
          callback: async (resposta) => {
            try {
              aoEntrar(await entrar(resposta.credential));
            } catch {
              setErro(T.google.erro);
            }
          },
        });

        if (alvo.current) {
          window.google?.accounts.id.renderButton(alvo.current, {
            theme: 'outline',
            size: 'large',
            text: 'signin_with',
            locale: 'pt-BR',
          });
        }
      })
      .catch(() => setErro(T.google.scriptFalhou));
  }, [aoEntrar, clientId]);

  if (!clientId) {
    return (
      <p className="aviso-config">{T.google.semConfiguracao}</p>
    );
  }

  return (
    <>
      <div ref={alvo} />
      {erro && <p role="alert" className="erro">{erro}</p>}
    </>
  );
}

/**
 * ATENÇÃO: O `id_token` aparece aqui e some. Vai para a API, que valida contra o Google,
 * grava o perfil e devolve o cookie. Nada é guardado no navegador por nós.
 */
async function entrar(idToken: string): Promise<UsuarioLogado> {
  const resposta = await fetch(`${BASE_DA_API}/auth/google`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', ...CABECALHO_DO_SITE },
    body: JSON.stringify({ idToken }),
    credentials: 'include',
  });

  if (!resposta.ok) throw new Error(T.google.falhou(resposta.status));

  return resposta.json();
}

/**
 * ATENÇÃO: O script do Google só entra na página quando há Client ID configurado.
 * Carregá-lo sempre significaria contato com servidor do Google mesmo para quem
 * nunca vai entrar.
 */
function carregarScript(): Promise<void> {
  const ID = 'google-gsi';
  if (document.getElementById(ID)) return Promise.resolve();

  return new Promise((resolver, rejeitar) => {
    const script = document.createElement('script');
    script.id = ID;
    script.src = 'https://accounts.google.com/gsi/client';
    script.async = true;
    script.onload = () => resolver();
    script.onerror = () => rejeitar(new Error(T.google.scriptFalhou));
    document.head.appendChild(script);
  });
}

declare global {
  interface Window {
    google?: {
      accounts: {
        id: {
          initialize: (config: {
            client_id: string;
            callback: (resposta: { credential: string }) => void;
          }) => void;
          renderButton: (alvo: HTMLElement, opcoes: Record<string, string>) => void;
        };
      };
    };
  }
}
