import React, { useState } from "react";
import { useAuth } from "../context/AuthContext";
import { motion, AnimatePresence } from "motion/react";
import { 
  Lock, 
  Mail, 
  User, 
  ShieldAlert, 
  AlertCircle,
  HelpCircle,
  KeyRound,
  FileCheck2,
  Database
} from "lucide-react";

export function AuthInterface() {
  const { 
    signInWithGoogle, 
    loginWithEmail, 
    registerWithEmail, 
    resetPassword,
    loading 
  } = useAuth();

  const [isLogin, setIsLogin] = useState(true);
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [name, setName] = useState("");
  const [role, setRole] = useState<"Auditor" | "Supervisor" | "Viewer">("Auditor");
  const [errorText, setErrorText] = useState("");
  const [infoText, setInfoText] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [showForgot, setShowForgot] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setErrorText("");
    setInfoText("");
    setSubmitting(true);

    if (!email || !password) {
      setErrorText("Por favor, ingrese todos los campos obligatorios.");
      setSubmitting(false);
      return;
    }

    try {
      if (isLogin) {
        await loginWithEmail(email, password);
      } else {
        if (!name) {
          setErrorText("El nombre es requerido para completar el registro corporativo.");
          setSubmitting(false);
          return;
        }
        await registerWithEmail(email, password, name, role);
      }
    } catch (err: any) {
      console.error(err);
      let translate = err.message || String(err);
      if (translate.includes("auth/invalid-credential") || translate.includes("wrong-password")) {
        translate = "Credenciales incorrectas. Verifique correo o clave.";
      } else if (translate.includes("auth/email-already-in-use")) {
        translate = "Este correo ya está registrado en la base de datos de socios.";
      } else if (translate.includes("auth/weak-password")) {
        translate = "La contraseña debe tener un mínimo de 6 caracteres corporativos.";
      }
      setErrorText(translate);
    } finally {
      setSubmitting(false);
    }
  };

  const handleForgotPassword = async () => {
    if (!email) {
      setErrorText("Escriba su correo primero para enviar el enlace de recuperación.");
      return;
    }
    setErrorText("");
    try {
      await resetPassword(email);
      setInfoText("Enlace de restablecimiento enviado. Revise su bandeja de entrada.");
    } catch (err: any) {
      setErrorText(err.message || String(err));
    }
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-slate-950 flex flex-col items-center justify-center text-slate-200">
        <motion.div 
          animate={{ rotate: 360 }}
          transition={{ repeat: Infinity, duration: 1, ease: "linear" }}
          className="w-10 h-10 border-4 border-indigo-500 border-t-transparent rounded-full mb-4"
        />
        <span className="text-xs uppercase tracking-widest font-mono text-slate-400">
          Validando credenciales en la nube...
        </span>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-slate-950 flex relative overflow-hidden items-center justify-center p-4">
      {/* Dynamic ambient backgrounds */}
      <div className="absolute top-[-20%] left-[-10%] w-[500px] h-[500px] rounded-full bg-indigo-900/10 blur-[130px]" />
      <div className="absolute bottom-[-20%] right-[-10%] w-[500px] h-[500px] rounded-full bg-emerald-900/10 blur-[130px]" />

      <div className="w-full max-w-md z-10">
        <motion.div 
          initial={{ opacity: 0, y: 15 }}
          animate={{ opacity: 1, y: 0 }}
          className="bg-slate-900/80 border border-slate-800 backdrop-blur-md rounded-2xl shadow-2xl p-6 space-y-6"
        >
          {/* Header */}
          <div className="text-center space-y-1.5">
            <div className="inline-flex items-center gap-1.5 bg-indigo-500/10 border border-indigo-500/20 text-indigo-400 text-[10px] font-black uppercase tracking-widest px-3 py-1 rounded-full mb-2">
              <Database className="w-3 h-3" />
              <span>Firebase Enterprise Edition</span>
            </div>
            <h1 className="text-xl font-black text-white uppercase tracking-tight flex items-center justify-center gap-2">
              <FileCheck2 className="w-6 h-6 text-emerald-400 shrink-0" />
              <span>AuditConciliador Pro</span>
            </h1>
            <p className="text-xs text-slate-400">
              Sistema Cloud de Reconciliación y Auditoría Física de Inventarios
            </p>
          </div>

          <AnimatePresence mode="wait">
            {errorText && (
              <motion.div 
                initial={{ opacity: 0, height: 0 }}
                animate={{ opacity: 1, height: "auto" }}
                exit={{ opacity: 0, height: 0 }}
                className="bg-red-950/40 border border-red-900/60 p-3 rounded-lg flex items-start gap-2.5 text-xs text-red-300"
              >
                <AlertCircle className="w-4 h-4 text-red-400 shrink-0 mt-0.5" />
                <span className="leading-relaxed">{errorText}</span>
              </motion.div>
            )}

            {infoText && (
              <motion.div 
                initial={{ opacity: 0, height: 0 }}
                animate={{ opacity: 1, height: "auto" }}
                exit={{ opacity: 0, height: 0 }}
                className="bg-emerald-950/40 border border-emerald-900/60 p-3 rounded-lg flex items-start gap-2.5 text-xs text-emerald-300"
              >
                <FileCheck2 className="w-4 h-4 text-emerald-400 shrink-0 mt-0.5" />
                <span className="leading-relaxed">{infoText}</span>
              </motion.div>
            )}
          </AnimatePresence>

          {showForgot ? (
            <div className="space-y-4">
              <h3 className="text-xs uppercase font-extrabold tracking-wider text-slate-300">
                Recuperación de Contraseña
              </h3>
              <p className="text-xs text-slate-400 leading-relaxed font-sans">
                Escriba debajo su correo registrado. Le despacharemos de forma automática un link seguro para restablecer sus accesos.
              </p>
              <div className="space-y-1">
                <label className="text-[10px] text-slate-300 font-bold uppercase tracking-wider block">Correo Electrónico</label>
                <div className="relative">
                  <Mail className="absolute left-3 top-2.5 text-slate-500 w-4 h-4" />
                  <input 
                    type="email" 
                    placeholder="ejemplo@empresa.com"
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    className="w-full text-xs bg-slate-950 border border-slate-700 rounded-lg p-2.5 pl-10 text-white placeholder-slate-600 focus:outline-none focus:border-indigo-500 transition-colors"
                  />
                </div>
              </div>
              <div className="flex gap-2 pt-2">
                <button
                  onClick={handleForgotPassword}
                  className="flex-1 bg-indigo-600 hover:bg-indigo-700 text-white font-bold py-2 rounded-lg text-xs transition-colors cursor-pointer"
                >
                  Enviar Enlace
                </button>
                <button
                  onClick={() => {
                    setShowForgot(false);
                    setErrorText("");
                    setInfoText("");
                  }}
                  className="px-3 bg-slate-800 hover:bg-slate-700 text-slate-300 font-bold py-2 rounded-lg text-xs transition-colors cursor-pointer"
                >
                  Volver
                </button>
              </div>
            </div>
          ) : (
            <form onSubmit={handleSubmit} className="space-y-4">
              {/* Form fields */}
              {!isLogin && (
                <motion.div 
                  initial={{ opacity: 0, y: -5 }}
                  animate={{ opacity: 1, y: 0 }}
                  className="space-y-4"
                >
                  <div className="space-y-1">
                    <label className="text-[10px] text-slate-300 font-bold uppercase tracking-wider block">Nombre Completo</label>
                    <div className="relative">
                      <User className="absolute left-3 top-2.5 text-slate-500 w-4 h-4" />
                      <input 
                        type="text" 
                        placeholder="Ing. Carlos Mendoza"
                        value={name}
                        onChange={(e) => setName(e.target.value)}
                        className="w-full text-xs bg-slate-950 border border-slate-700 rounded-lg p-2.5 pl-10 text-white placeholder-slate-600 focus:outline-none focus:border-indigo-500 transition-colors"
                      />
                    </div>
                  </div>

                  <div className="space-y-1">
                    <label className="text-[10px] text-slate-300 font-bold uppercase tracking-wider block">Rol Requerido</label>
                    <select
                      value={role}
                      onChange={(e) => setRole(e.target.value as any)}
                      className="w-full text-xs bg-slate-950 border border-slate-700 rounded-lg p-2.5 text-white focus:outline-none focus:border-indigo-500"
                    >
                      <option value="Auditor">Auditor (Carga & Conciliación)</option>
                      <option value="Supervisor">Supervisor de Patio (Auditorías & KPI)</option>
                      <option value="Viewer">Viewer (Solo lectura e informes)</option>
                    </select>
                  </div>
                </motion.div>
              )}

              <div className="space-y-1">
                <label className="text-[10px] text-slate-300 font-bold uppercase tracking-wider block">Correo Electrónico</label>
                <div className="relative">
                  <Mail className="absolute left-3 top-2.5 text-slate-500 w-4 h-4" />
                  <input 
                    type="email" 
                    placeholder="auditor@empresa.com"
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    className="w-full text-xs bg-slate-950 border border-slate-700 rounded-lg p-2.5 pl-10 text-white placeholder-slate-600 focus:outline-none focus:border-indigo-500 transition-colors"
                  />
                </div>
              </div>

              <div className="space-y-1">
                <div className="flex items-center justify-between">
                  <label className="text-[10px] text-slate-300 font-bold uppercase tracking-wider block">Contraseña</label>
                  {isLogin && (
                    <button
                      type="button"
                      onClick={() => setShowForgot(true)}
                      className="text-[10px] text-indigo-400 hover:underline cursor-pointer font-sans"
                    >
                      ¿Olvidó contraseña?
                    </button>
                  )}
                </div>
                <div className="relative">
                  <Lock className="absolute left-3 top-2.5 text-slate-500 w-4 h-4" />
                  <input 
                    type="password" 
                    placeholder="******"
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    className="w-full text-xs bg-slate-950 border border-slate-700 rounded-lg p-2.5 pl-10 text-white placeholder-slate-600 focus:outline-none focus:border-indigo-500 transition-colors"
                  />
                </div>
              </div>

              <button
                type="submit"
                disabled={submitting}
                className="w-full bg-emerald-600 hover:bg-emerald-500 text-white font-extrabold py-2.5 rounded-lg text-xs uppercase tracking-wider cursor-pointer transition-all flex items-center justify-center gap-1.5 shadow-md disabled:bg-slate-800 disabled:text-slate-500"
              >
                <span>{isLogin ? (submitting ? "Accediendo..." : "Ingresar Con Credenciales") : (submitting ? "Registrando..." : "Crear Cuenta Nueva")}</span>
              </button>
            </form>
          )}

          {/* Separator / Google section */}
          <div className="relative my-4 flex items-center justify-center">
            <span className="absolute bg-slate-900 px-3 text-[10px] uppercase text-slate-500 font-bold tracking-widest font-sans">o conéctese vía</span>
            <div className="w-full border-t border-slate-800" />
          </div>

          <button
            onClick={signInWithGoogle}
            disabled={submitting}
            className="w-full flex items-center justify-center gap-2 bg-slate-950 hover:bg-slate-900 border border-slate-800 text-slate-200 font-bold py-2.5 rounded-lg text-xs transition-colors cursor-pointer"
          >
            <svg className="w-4 h-4" viewBox="0 0 24 24">
              <path fill="#EA4335" d="M12.24 10.285V14.4h6.887c-.275 1.565-1.88 4.604-6.887 4.604-4.33 0-7.859-3.579-7.859-8s3.529-8 7.859-8c2.46 0 4.105 1.025 5.047 1.926l3.227-3.116C18.224 1.155 15.46 0 12.24 0c-6.627 0-12 5.373-12 12s5.373 12 12 12c6.914 0 11.5-4.86 11.5-11.7 0-.788-.085-1.39-.188-2.015H12.24z"/>
            </svg>
            <span>Iniciar Sesión con Google</span>
          </button>

          {/* Toggle Register/Login footer */}
          <div className="text-center pt-2">
            <button
              onClick={() => {
                setIsLogin(!isLogin);
                setErrorText("");
                setInfoText("");
              }}
              className="text-xs text-slate-400 hover:text-white transition-colors cursor-pointer font-sans"
            >
              {isLogin ? "¿No tiene cuenta corporativa? Regístrese aquí" : "¿Ya tiene cuenta activa? Inicie sesión"}
            </button>
          </div>
        </motion.div>
      </div>
    </div>
  );
}
