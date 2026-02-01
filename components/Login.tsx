
import React, { useState } from 'react';
import { Lock, Mail, UserPlus, AlertCircle, LayoutGrid } from 'lucide-react';
import { auth } from '../src/firebaseConfig';
import * as firebaseAuth from 'firebase/auth';

interface LoginProps {
  onGuestAccess: () => void;
}

export const Login: React.FC<LoginProps> = ({ onGuestAccess }) => {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [isRegistering, setIsRegistering] = useState(false);
  const [isLoading, setIsLoading] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setIsLoading(true);

    try {
      if (isRegistering) {
        await firebaseAuth.createUserWithEmailAndPassword(auth, email, password);
      } else {
        await firebaseAuth.signInWithEmailAndPassword(auth, email, password);
      }
    } catch (err: any) {
      const firebaseError = err;
      console.error(firebaseError);

      let msg = 'Ocurrió un error inesperado.';
      switch (firebaseError?.code) {
        case 'auth/invalid-email': msg = 'El correo electrónico no es válido.'; break;
        case 'auth/user-disabled': msg = 'Este usuario ha sido deshabilitado.'; break;
        case 'auth/user-not-found': msg = 'No se encontró cuenta con este correo.'; break;
        case 'auth/wrong-password': msg = 'Contraseña incorrecta.'; break;
        case 'auth/email-already-in-use': msg = 'Ya existe una cuenta con este correo.'; break;
        case 'auth/weak-password': msg = 'La contraseña debe tener al menos 6 caracteres.'; break;
        case 'auth/invalid-credential': msg = 'Credenciales inválidas.'; break;
      }
      setError(msg);
      setIsLoading(false);
    }
  };

  return (
    <div className="min-h-screen flex items-center justify-center bg-slate-50 px-4">
      <div className="bg-white p-8 rounded-[2.5rem] shadow-2xl border border-slate-100 w-full max-w-md animate-in fade-in zoom-in duration-500 relative overflow-hidden group">
        {/* Decorative element */}
        <div className="absolute -top-24 -right-24 w-48 h-48 bg-biosalud-50 rounded-full blur-3xl group-hover:bg-biosalud-100 transition-colors duration-700"></div>

        <div className="relative z-10">
          <div className="text-center mb-10">
            <div className="inline-flex p-5 bg-biosalud-600 rounded-3xl mb-6 shadow-xl shadow-biosalud-200">
              <Lock className="w-8 h-8 text-white" />
            </div>
            <h1 className="text-4xl font-black text-slate-800 tracking-tighter">
              {isRegistering ? 'Crear Cuenta' : (
                <>
                  BioSalud <span className="text-biosalud-600">Analytics</span>
                </>
              )}
            </h1>
            <p className="text-sm text-slate-400 font-bold uppercase tracking-widest mt-3">Panel de Auditoría Central</p>
          </div>

          <form onSubmit={handleSubmit} className="space-y-6">
            <div className="space-y-4">
              <div className="space-y-1.5">
                <label className="text-[10px] font-black uppercase tracking-widest text-slate-500 ml-1">Correo Electrónico</label>
                <div className="relative">
                  <div className="absolute inset-y-0 left-0 pl-4 flex items-center pointer-events-none">
                    <Mail className="h-5 w-5 text-slate-400" />
                  </div>
                  <input
                    type="email"
                    className="block w-full pl-12 pr-4 py-4 bg-slate-50 border-none rounded-2xl focus:ring-2 focus:ring-biosalud-500 transition-all font-bold text-slate-700 placeholder:text-slate-300"
                    placeholder="usuario@biosalud.com"
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    autoFocus
                    required
                  />
                </div>
              </div>

              <div className="space-y-1.5">
                <label className="text-[10px] font-black uppercase tracking-widest text-slate-500 ml-1">Contraseña</label>
                <div className="relative">
                  <div className="absolute inset-y-0 left-0 pl-4 flex items-center pointer-events-none">
                    <Lock className="h-5 w-5 text-slate-400" />
                  </div>
                  <input
                    type="password"
                    className="block w-full pl-12 pr-4 py-4 bg-slate-50 border-none rounded-2xl focus:ring-2 focus:ring-biosalud-500 transition-all font-bold text-slate-700 placeholder:text-slate-300"
                    placeholder="••••••••"
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    required
                  />
                </div>
              </div>
            </div>

            {error && (
              <div className="p-4 bg-red-50 border border-red-100 text-red-600 text-[10px] font-black uppercase tracking-widest rounded-2xl flex items-center gap-3 animate-in slide-in-from-top-2">
                <AlertCircle className="w-5 h-5 shrink-0" />
                <span>{error}</span>
              </div>
            )}

            <button
              type="submit"
              disabled={isLoading}
              className={`w-full flex justify-center py-5 rounded-2xl shadow-xl font-black text-sm uppercase tracking-widest text-white transition-all 
                  ${isLoading ? 'bg-slate-400 cursor-not-allowed' : 'bg-slate-900 hover:bg-black hover:-translate-y-1 shadow-slate-200'}
              `}
            >
              {isLoading ? 'PROCESANDO...' : (isRegistering ? 'CREAR MI CUENTA' : 'ENTRAR AL SISTEMA')}
            </button>
          </form>

          <div className="mt-8 space-y-4">
            <button
              onClick={() => {
                setIsRegistering(!isRegistering);
                setError('');
              }}
              className="w-full py-4 text-[10px] font-black uppercase tracking-widest text-slate-400 hover:text-biosalud-600 transition-colors flex items-center justify-center gap-2"
            >
              {isRegistering ? '← VOLVER AL INGRESO' : '¿NO TIENE CUENTA? REGISTRARSE AQUÍ'}
            </button>

            <div className="relative py-4">
              <div className="absolute inset-0 flex items-center"><div className="w-full border-t border-slate-100"></div></div>
              <div className="relative flex justify-center text-[10px] font-black uppercase tracking-tighter"><span className="bg-white px-4 text-slate-300">O Alternativamente</span></div>
            </div>

            <button
              onClick={onGuestAccess}
              className="w-full py-5 rounded-2xl bg-biosalud-50 text-biosalud-600 font-black text-xs uppercase tracking-widest hover:bg-biosalud-100 transition-all flex items-center justify-center gap-3 border border-biosalud-100"
            >
              <LayoutGrid className="w-5 h-5" />
              ACCEDER COMO INVITADO (LOCAL)
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};
