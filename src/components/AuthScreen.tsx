import { auth, googleProvider, isPlaceholderConfig } from '../firebase';
import { signInWithPopup } from 'firebase/auth';
import { Shield, Brain, Heart, LogIn } from 'lucide-react';
import { useState } from 'react';

interface AuthScreenProps {
  onLocalDemo: () => void;
  isLoading: boolean;
}

export default function AuthScreen({ onLocalDemo, isLoading }: AuthScreenProps) {
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [isSigningIn, setIsSigningIn] = useState(false);
  const placeholder = isPlaceholderConfig();

  const handleGoogleSignIn = async () => {
    if (placeholder) {
      setErrorMsg('Firebase está com credenciais temporárias do AI Studio. Utilize o "Modo de Demonstração Local" abaixo para utilizar o aplicativo de forma offline enquanto finaliza a sincronização.');
      return;
    }
    setErrorMsg(null);
    setIsSigningIn(true);
    try {
      await signInWithPopup(auth, googleProvider);
    } catch (err: any) {
      console.error(err);
      setErrorMsg(err?.message || 'Falha ao autenticar com o Google. Verifique a conexão.');
    } finally {
      setIsSigningIn(false);
    }
  };

  return (
    <div className="min-h-screen bg-slate-50 flex flex-col justify-between p-4" id="auth-screen">
      {/* Header Info */}
      <div className="max-w-md mx-auto w-full pt-12 flex-1 flex flex-col justify-center items-center">
        <div className="bg-rose-50 p-4 rounded-full text-rose-500 mb-6 border border-rose-100 shadow-sm animate-pulse">
          <Heart className="h-10 w-10 fill-current" />
        </div>
        
        <h1 className="text-3xl font-extrabold text-slate-800 tracking-tight text-center">
          Monitor de Crises
        </h1>
        <p className="text-slate-500 text-sm mt-2 text-center max-w-sm">
          Acompanhamento diário do sono, convulsões e rotina médica de forma simples, segura e acolhedora.
        </p>

        {/* Auth Panel */}
        <div className="bg-white mt-8 p-6 rounded-2xl border border-slate-100 shadow-md w-full">
          {errorMsg && (
            <div className="mb-4 p-3 bg-amber-50 text-amber-800 rounded-lg text-xs border border-amber-200">
              {errorMsg}
            </div>
          )}

          {placeholder ? (
            <div className="mb-5 p-3.5 bg-sky-50 border border-sky-100 text-slate-700 text-xs rounded-xl flex items-start gap-3">
              <Shield className="h-5 w-5 text-sky-500 flex-shrink-0 mt-0.5" />
              <div>
                <p className="font-semibold text-slate-800 mb-0.5">Sincronização pendente</p>
                <p className="leading-relaxed">A integração com o Firebase requer a aprovação dos termos na barra lateral se for o primeiro boot. Em seguida, o banco de dados estará ativo.</p>
              </div>
            </div>
          ) : null}

          {isLoading || isSigningIn ? (
            <div className="flex flex-col items-center justify-center py-6">
              <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-rose-500 mb-3"></div>
              <p className="text-xs text-slate-400">Verificando status de segurança...</p>
            </div>
          ) : (
            <div className="space-y-4">
              <button
                id="btn-google-login"
                onClick={handleGoogleSignIn}
                className="w-full flex items-center justify-center gap-3 bg-rose-500 hover:bg-rose-600 text-white font-medium py-3 px-4 rounded-xl transition duration-150 shadow-sm select-none cursor-pointer"
              >
                <LogIn className="h-5 w-5" />
                Continuar com o Google
              </button>

              <div className="relative flex py-2 items-center">
                <div className="flex-grow border-t border-slate-200"></div>
                <span className="flex-shrink mx-4 text-xs text-slate-400">ou experimentar</span>
                <div className="flex-grow border-t border-slate-200"></div>
              </div>

              <button
                id="btn-demo"
                onClick={onLocalDemo}
                className="w-full flex items-center justify-center bg-slate-100 hover:bg-slate-200 text-slate-700 font-medium py-2.5 px-4 rounded-xl transition duration-150 text-sm select-none cursor-pointer border border-slate-200"
              >
                Modo de Demonstração Local (Offline)
              </button>
            </div>
          )}
        </div>

        {/* Visual Info Grid Cards */}
        <div className="grid grid-cols-2 gap-3 mt-8 w-full max-w-sm">
          <div className="p-3 bg-white/60 rounded-xl border border-slate-100 flex items-center gap-2">
            <div className="p-1.5 bg-indigo-50 text-indigo-500 rounded-lg">
              <Brain className="h-4 w-4" />
            </div>
            <span className="text-[11px] font-medium text-slate-600 leading-tight">Mapeamento de Crises</span>
          </div>

          <div className="p-3 bg-white/60 rounded-xl border border-slate-100 flex items-center gap-2">
            <div className="p-1.5 bg-emerald-50 text-emerald-500 rounded-lg">
              <Shield className="h-4 w-4" />
            </div>
            <span className="text-[11px] font-medium text-slate-600 leading-tight">Relatórios Protegidos</span>
          </div>
        </div>
      </div>

      {/* Footer Info */}
      <div className="text-center text-[10px] text-slate-400 max-w-md mx-auto w-full py-4 leading-normal">
        Protegido pela autenticação do Google e diretrizes de criptografia do Firestore. Suas informações médicas são estritamente confidenciais.
      </div>
    </div>
  );
}
