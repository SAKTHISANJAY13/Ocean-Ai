import React, { useState, useEffect } from "react";
import { Link, useNavigate } from "react-router-dom";
import { useAuth } from "../context/useAuth";
import { Shield, Lock, Mail, User, Eye, EyeOff, AlertCircle, ArrowRight, CheckCircle2, Compass } from "lucide-react";
import { assets } from "../data/assets";

export default function Register() {
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [localError, setLocalError] = useState<string | null>(null);

  const { register, isAuthenticated, error, clearError } = useAuth();
  const navigate = useNavigate();

  useEffect(() => {
    if (isAuthenticated) {
      navigate("/overview", { replace: true });
    }
  }, [isAuthenticated, navigate]);

  const handleNameChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    setName(e.target.value);
    if (localError) setLocalError(null);
    if (error) clearError();
  };

  const handleEmailChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    setEmail(e.target.value);
    if (localError) setLocalError(null);
    if (error) clearError();
  };

  const handlePasswordChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    setPassword(e.target.value);
    if (localError) setLocalError(null);
    if (error) clearError();
  };

  const handleConfirmPasswordChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    setConfirmPassword(e.target.value);
    if (localError) setLocalError(null);
    if (error) clearError();
  };

  // Real-time password requirement evaluations
  const hasLength = password.length >= 8;
  const hasUpper = /[A-Z]/.test(password);
  const hasLower = /[a-z]/.test(password);
  const hasNumber = /[0-9]/.test(password);
  const isMatch = password.length > 0 && password === confirmPassword;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLocalError(null);

    if (name.trim().length < 2) {
      setLocalError("Please enter your full investigator name (at least 2 characters).");
      return;
    }
    if (!email.trim() || !email.includes("@")) {
      setLocalError("Please provide a valid institutional email address.");
      return;
    }
    if (!hasLength || !hasUpper || !hasLower || !hasNumber) {
      setLocalError("Password does not meet required security criteria.");
      return;
    }
    if (password !== confirmPassword) {
      setLocalError("Passwords do not match.");
      return;
    }

    setSubmitting(true);
    try {
      await register({
        name: name.trim(),
        email: email.trim(),
        password,
      });
      navigate("/overview", { replace: true });
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : "Registration failed";
      setLocalError(msg);
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="min-h-screen w-full flex items-center justify-center bg-abyssal text-slate-100 relative overflow-hidden select-none px-4 py-8">
      {/* Background Layer 1: Ocean Texture */}
      <div
        className="absolute inset-0 z-0 bg-cover bg-center opacity-25 mix-blend-screen pointer-events-none"
        style={{ backgroundImage: `url(${assets.oceanTexture})` }}
      />

      {/* Background Layer 2: Abyssal Gradient & Radar Grid */}
      <div className="absolute inset-0 pointer-events-none bg-gradient-to-b from-abyssal/80 via-abyssal/95 to-abyssal z-0" />
      <div className="absolute inset-0 pointer-events-none opacity-[0.04] bg-[linear-gradient(rgba(255,255,255,1)_1px,transparent_1px),linear-gradient(90deg,rgba(255,255,255,1)_1px,transparent_1px)] bg-[size:50px_50px] z-0" />

      {/* Terminal Card */}
      <div className="w-full max-w-md bg-navy/80 border border-slate-700/70 rounded-2xl p-8 backdrop-blur-xl shadow-[0_20px_50px_rgba(0,0,0,0.6)] z-10 relative">
        <div className="absolute -top-px -left-px w-6 h-6 border-t-2 border-l-2 border-accent-cyan rounded-tl-2xl" />
        <div className="absolute -bottom-px -right-px w-6 h-6 border-b-2 border-r-2 border-accent-cyan rounded-br-2xl" />

        {/* Brand Header */}
        <div className="flex flex-col items-center text-center mb-6">
          <div className="w-14 h-14 rounded-2xl bg-accent-cyan/10 border border-accent-cyan/40 flex items-center justify-center text-accent-cyan mb-3 shadow-[0_0_20px_rgba(6,182,212,0.3)]">
            <Compass className="w-7 h-7" />
          </div>

          <div className="flex items-center gap-2 mb-1">
            <h1 className="text-2xl font-bold tracking-[0.25em] text-white">ORIGIN</h1>
            <span className="text-[9px] text-accent-cyan font-mono uppercase tracking-widest bg-accent-cyan/10 px-2 py-0.5 rounded border border-accent-cyan/30">
              ENROLLMENT
            </span>
          </div>

          <p className="text-[11px] font-mono text-slate-400 tracking-wider uppercase">
            Investigator Clearance Registration
          </p>
        </div>

        {/* Error Feedback */}
        {(localError || error) && (
          <div className="mb-5 p-3.5 rounded-xl bg-accent-red/10 border border-accent-red/40 flex items-start gap-3 text-accent-red animate-in fade-in slide-in-from-top-1 duration-200">
            <AlertCircle className="w-4 h-4 shrink-0 mt-0.5" />
            <div className="text-xs font-mono leading-relaxed">
              <span className="font-semibold block uppercase">Enrollment Error</span>
              <span>{localError || error}</span>
            </div>
          </div>
        )}

        {/* Registration Form */}
        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="space-y-1">
            <label
              htmlFor="reg-name"
              className="text-[11px] font-mono font-semibold text-slate-300 uppercase tracking-wider flex items-center gap-1.5"
            >
              <User className="w-3.5 h-3.5 text-accent-cyan" />
              Investigator Full Name
            </label>
            <input
              id="reg-name"
              type="text"
              value={name}
              onChange={handleNameChange}
              placeholder="Commander Elena Vance"
              autoComplete="name"
              required
              className="w-full bg-abyssal/90 border border-slate-700/80 rounded-xl px-4 py-2 text-xs text-white placeholder-slate-500 font-mono focus:outline-none focus:border-accent-cyan focus:ring-1 focus:ring-accent-cyan transition-all"
            />
          </div>

          <div className="space-y-1">
            <label
              htmlFor="reg-email"
              className="text-[11px] font-mono font-semibold text-slate-300 uppercase tracking-wider flex items-center gap-1.5"
            >
              <Mail className="w-3.5 h-3.5 text-accent-cyan" />
              Institutional Email
            </label>
            <input
              id="reg-email"
              type="email"
              value={email}
              onChange={handleEmailChange}
              placeholder="e.vance@origin-marine.org"
              autoComplete="email"
              required
              className="w-full bg-abyssal/90 border border-slate-700/80 rounded-xl px-4 py-2 text-xs text-white placeholder-slate-500 font-mono focus:outline-none focus:border-accent-cyan focus:ring-1 focus:ring-accent-cyan transition-all"
            />
          </div>

          <div className="space-y-1">
            <label
              htmlFor="reg-password"
              className="text-[11px] font-mono font-semibold text-slate-300 uppercase tracking-wider flex items-center gap-1.5"
            >
              <Lock className="w-3.5 h-3.5 text-accent-cyan" />
              Master Security Password
            </label>
            <div className="relative">
              <input
                id="reg-password"
                type={showPassword ? "text" : "password"}
                value={password}
                onChange={handlePasswordChange}
                placeholder="••••••••••••"
                autoComplete="new-password"
                required
                className="w-full bg-abyssal/90 border border-slate-700/80 rounded-xl px-4 py-2 pr-10 text-xs text-white placeholder-slate-500 font-mono focus:outline-none focus:border-accent-cyan focus:ring-1 focus:ring-accent-cyan transition-all"
              />
              <button
                type="button"
                onClick={() => setShowPassword(!showPassword)}
                className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-200"
                aria-label={showPassword ? "Hide password" : "Show password"}
              >
                {showPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
              </button>
            </div>
          </div>

          <div className="space-y-1">
            <label
              htmlFor="reg-confirm"
              className="text-[11px] font-mono font-semibold text-slate-300 uppercase tracking-wider flex items-center gap-1.5"
            >
              <Lock className="w-3.5 h-3.5 text-accent-cyan" />
              Confirm Password
            </label>
            <input
              id="reg-confirm"
              type={showPassword ? "text" : "password"}
              value={confirmPassword}
              onChange={handleConfirmPasswordChange}
              placeholder="••••••••••••"
              autoComplete="new-password"
              required
              className="w-full bg-abyssal/90 border border-slate-700/80 rounded-xl px-4 py-2 text-xs text-white placeholder-slate-500 font-mono focus:outline-none focus:border-accent-cyan focus:ring-1 focus:ring-accent-cyan transition-all"
            />
          </div>

          {/* Password Strength Checklist */}
          {password.length > 0 && (
            <div className="p-2.5 rounded-lg bg-abyssal/80 border border-slate-800 text-[10px] font-mono grid grid-cols-2 gap-1.5">
              <span className={`flex items-center gap-1 ${hasLength ? "text-emerald-400" : "text-slate-500"}`}>
                <CheckCircle2 className="w-3 h-3" /> 8+ Characters
              </span>
              <span className={`flex items-center gap-1 ${hasUpper ? "text-emerald-400" : "text-slate-500"}`}>
                <CheckCircle2 className="w-3 h-3" /> Uppercase Letter
              </span>
              <span className={`flex items-center gap-1 ${hasLower ? "text-emerald-400" : "text-slate-500"}`}>
                <CheckCircle2 className="w-3 h-3" /> Lowercase Letter
              </span>
              <span className={`flex items-center gap-1 ${hasNumber ? "text-emerald-400" : "text-slate-500"}`}>
                <CheckCircle2 className="w-3 h-3" /> Number
              </span>
              {confirmPassword.length > 0 && (
                <span className={`col-span-2 flex items-center gap-1 ${isMatch ? "text-emerald-400" : "text-accent-red"}`}>
                  <CheckCircle2 className="w-3 h-3" /> {isMatch ? "Passwords match" : "Passwords do not match"}
                </span>
              )}
            </div>
          )}

          {/* Submit */}
          <button
            type="submit"
            disabled={submitting}
            className="w-full py-2.5 px-4 rounded-xl bg-gradient-to-r from-accent-cyan to-cyan-500 text-abyssal font-mono font-bold text-xs uppercase tracking-widest flex items-center justify-center gap-2 hover:brightness-110 active:scale-[0.99] transition-all shadow-[0_0_20px_rgba(6,182,212,0.4)] disabled:opacity-50 disabled:cursor-not-allowed cursor-pointer mt-2"
          >
            {submitting ? (
              <>
                <div className="w-3.5 h-3.5 border-2 border-abyssal border-t-transparent rounded-full animate-spin" />
                <span>Hashing & Enrolling Investigator...</span>
              </>
            ) : (
              <>
                <span>Register Clearance</span>
                <ArrowRight className="w-4 h-4" />
              </>
            )}
          </button>
        </form>

        {/* Switch to Login */}
        <div className="mt-6 pt-5 border-t border-slate-800/80 text-center">
          <p className="text-xs text-slate-400 font-sans">
            Already have clearance credentials?{" "}
            <Link
              to="/login"
              className="text-accent-cyan font-mono font-semibold hover:underline inline-flex items-center gap-1"
            >
              <span>Access Terminal</span>
              <ArrowRight className="w-3 h-3" />
            </Link>
          </p>
        </div>

        <div className="mt-4 text-center">
          <span className="text-[10px] font-mono text-slate-600 flex items-center justify-center gap-1">
            <Shield className="w-3 h-3 text-slate-500" />
            Argon2id Hashing · Zero Plaintext Storage
          </span>
        </div>
      </div>
    </div>
  );
}
