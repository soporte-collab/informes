
import React, { useState } from 'react';
import { Lock, Mail, UserPlus, AlertCircle } from 'lucide-react';
import { auth } from '../src/firebaseConfig';
import * as firebaseAuth from 'firebase/auth';

export const Login: React.FC = () => {
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
      // On success, App.tsx's onAuthStateChanged will handle the redirection/state update
    } catch (err: any) {
      // Cast to any to avoid "Property 'code' does not exist on type 'AuthError'"
      // if the environment's type definitions are incomplete.
      const firebaseError = err;
      console.error(firebaseError);
      
      let msg = 'Ocurrió un error inesperado.';
      switch (firebaseError?.code) {
        case 'auth/invalid-email':
          msg = 'El correo electrónico no es válido.';
          break;
        case 'auth/user-disabled':
          msg = 'Este usuario ha sido deshabilitado.';
          break;
        case 'auth/user-not-found':
          msg = 'No se encontró cuenta con este correo.';
          break;
        case 'auth/wrong-password':
          msg = 'Contraseña incorrecta.';
          break;
        case 'auth/email-already-in-use':
          msg = 'Ya existe una cuenta con este correo.';
          break;
        case 'auth/weak-password':
          msg = 'La contraseña debe tener al menos 6 caracteres.';
          break;
        case 'auth/invalid-credential':
          msg = 'Credenciales inválidas.';
          break;
      }
      setError(msg);
      setIsLoading(false);
    }
  };

  return (
    <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-biosalud-50 to-gray-100 px-4">
      <div className="bg-white p-8 rounded-2xl shadow-xl border border-gray-100 w-full max-w-md animate-in fade-in zoom-in duration-300">
        <div className="text-center mb-8">
          <div className="inline-flex p-4 bg-biosalud-50 rounded-full mb-4 shadow-sm">
            <Lock className="w-8 h-8 text-biosalud-600" />
          </div>
          <h1 className="text-2xl font-bold text-gray-800">
             {isRegistering ? 'Crear Cuenta' : 'Acceso a Auditoría'}
          </h1>
          <p className="text-sm text-gray-500 mt-2">BioSalud Analytics (Firebase Secure)</p>
        </div>

        <form onSubmit={handleSubmit} className="space-y-6">
          <div className="space-y-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Correo Electrónico</label>
              <div className="relative">
                <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                  <Mail className="h-5 w-5 text-gray-400" />
                </div>
                <input
                  type="email"
                  className="block w-full pl-10 pr-3 py-2.5 border border-gray-300 rounded-lg focus:ring-2 focus:ring-biosalud-500 focus:border-biosalud-500 transition-colors"
                  placeholder="ejemplo@biosalud.com"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  autoFocus
                  required
                />
              </div>
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Contraseña</label>
              <div className="relative">
                <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                  <Lock className="h-5 w-5 text-gray-400" />
                </div>
                <input
                  type="password"
                  className="block w-full pl-10 pr-3 py-2.5 border border-gray-300 rounded-lg focus:ring-2 focus:ring-biosalud-500 focus:border-biosalud-500 transition-colors"
                  placeholder={isRegistering ? "Mínimo 6 caracteres" : "Ingrese contraseña"}
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  required
                />
              </div>
            </div>
          </div>

          {error && (
            <div className="p-3 bg-red-50 border border-red-100 text-red-600 text-sm rounded-lg flex items-start gap-2 animate-in slide-in-from-top-2">
              <AlertCircle className="w-5 h-5 shrink-0 mt-0.5" />
              <span>{error}</span>
            </div>
          )}

          <button
            type="submit"
            disabled={isLoading}
            className={`w-full flex justify-center py-3 px-4 border border-transparent rounded-lg shadow-sm text-sm font-semibold text-white transition-all 
                ${isLoading ? 'bg-biosalud-400 cursor-not-allowed' : 'bg-biosalud-600 hover:bg-biosalud-700 hover:shadow-md focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-biosalud-500'}
            `}
          >
            {isLoading ? (
                <div className="flex items-center gap-2">
                    <span className="w-4 h-4 border-2 border-white/50 border-t-white rounded-full animate-spin"></span>
                    Procesando...
                </div>
            ) : (
                isRegistering ? 'Registrarse' : 'Ingresar'
            )}
          </button>
        </form>

        <div className="mt-6 text-center">
            <button 
                onClick={() => {
                    setIsRegistering(!isRegistering);
                    setError('');
                }}
                className="text-sm text-biosalud-600 hover:text-biosalud-800 font-medium flex items-center justify-center gap-2 mx-auto"
            >
                {isRegistering ? (
                    <>← Volver al Login</>
                ) : (
                    <>
                        <UserPlus className="w-4 h-4" />
                        ¿No tiene cuenta? Registrarse
                    </>
                )}
            </button>
        </div>
      </div>
    </div>
  );
};
