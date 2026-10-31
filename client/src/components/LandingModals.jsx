import { useEffect } from 'react';

export const DEMO_YOUTUBE_EMBED_URL = "https://www.youtube.com/embed/dQw4w9WgXcQ?rel=0"; // TODO: Replace with final project demo video URL

const inputClass =
  'w-full bg-[#F0EAE1] border border-[#DED6C8] rounded-lg px-3.5 py-2.5 text-sm text-[#1F2421] placeholder-[#8C857B] focus:outline-none focus:border-[#3A5233] focus:ring-2 focus:ring-[#3A5233]/40';

const primaryButtonClass =
  'w-full bg-[#3A5233] hover:bg-[#2D4027] text-white font-semibold text-sm py-3 rounded-full transition-colors cursor-pointer border-none';

const linkButtonClass =
  'bg-transparent border-none p-0 text-[#3A5233] font-semibold underline cursor-pointer';

function GoogleIcon() {
  return (
    <svg width="18" height="18" viewBox="0 0 48 48" aria-hidden="true">
      <path fill="#EA4335" d="M24 9.5c3.54 0 6.71 1.22 9.21 3.6l6.85-6.85C35.9 2.38 30.47 0 24 0 14.62 0 6.51 5.38 2.56 13.22l7.98 6.19C12.43 13.72 17.74 9.5 24 9.5z" />
      <path fill="#4285F4" d="M46.98 24.55c0-1.57-.15-3.09-.38-4.55H24v9.02h12.94c-.58 2.96-2.26 5.48-4.78 7.18l7.73 6c4.51-4.18 7.09-10.36 7.09-17.65z" />
      <path fill="#FBBC05" d="M10.53 28.59c-.48-1.45-.76-2.99-.76-4.59s.27-3.14.76-4.59l-7.98-6.19C.92 16.46 0 20.12 0 24c0 3.88.92 7.54 2.56 10.78l7.97-6.19z" />
      <path fill="#34A853" d="M24 48c6.48 0 11.93-2.13 15.89-5.81l-7.73-6c-2.15 1.45-4.92 2.3-8.16 2.3-6.26 0-11.57-4.22-13.47-9.91l-7.98 6.19C6.51 42.62 14.62 48 24 48z" />
    </svg>
  );
}

function GoogleButton({ onClick }) {
  return (
    <button
      type="button"
      onClick={onClick}
      className="w-full flex items-center justify-center gap-2.5 bg-white border border-[#DED6C8] hover:bg-[#F0EAE1] text-[#1F2421] font-semibold text-sm py-3 rounded-full transition-colors cursor-pointer"
    >
      <GoogleIcon />
      <span>Continue with Google</span>
    </button>
  );
}

function Field({ label, id, ...inputProps }) {
  return (
    <div>
      <label htmlFor={id} className="block text-xs font-medium text-[#5C5852] mb-1">
        {label}
      </label>
      <input id={id} required className={inputClass} {...inputProps} />
    </div>
  );
}

function Eyebrow() {
  return (
    <span className="block text-[0.75rem] uppercase tracking-[0.08em] text-[#5C5852] font-medium">
      AI-POWERED COURSE GENERATOR ✳
    </span>
  );
}

function Divider() {
  return (
    <div className="flex items-center gap-3 my-4 text-xs text-[#8C857B]">
      <span className="flex-1 h-px bg-[#DED6C8]" />
      <span>or</span>
      <span className="flex-1 h-px bg-[#DED6C8]" />
    </div>
  );
}

function LoginModal({ setActiveModal, onAuthSuccess }) {
  return (
    <div>
      <Eyebrow />
      <h2 id="modal-title" className="text-2xl sm:text-3xl font-bold tracking-tight text-[#1F2421] mt-1.5 mb-6">
        Welcome back
      </h2>
      <form
        onSubmit={(e) => {
          e.preventDefault();
          onAuthSuccess();
        }}
        className="space-y-4"
      >
        <Field label="Email Address" id="login-email" type="email" placeholder="you@example.com" autoFocus />
        <Field label="Password" id="login-password" type="password" placeholder="Enter your password" />
        <button type="submit" className={primaryButtonClass}>
          Log In
        </button>
      </form>
      <Divider />
      <GoogleButton onClick={onAuthSuccess} />
      <p className="text-sm text-[#5C5852] text-center mt-5">
        Don't have an account?{' '}
        <button type="button" onClick={() => setActiveModal('signup')} className={linkButtonClass}>
          Sign up for free
        </button>
      </p>
    </div>
  );
}

function SignupModal({ setActiveModal, onAuthSuccess }) {
  return (
    <div>
      <Eyebrow />
      <h2 id="modal-title" className="text-2xl sm:text-3xl font-bold tracking-tight text-[#1F2421] mt-1.5 mb-6">
        Create your free account
      </h2>
      <form
        onSubmit={(e) => {
          e.preventDefault();
          onAuthSuccess();
        }}
        className="space-y-4"
      >
        <Field label="Your Name" id="signup-name" type="text" placeholder="Enter your full name" autoFocus />
        <Field label="Email Address" id="signup-email" type="email" placeholder="you@example.com" />
        <Field label="Choose Password" id="signup-password" type="password" placeholder="Create a password" />
        <button type="submit" className={primaryButtonClass}>
          Create Account
        </button>
      </form>
      <Divider />
      <GoogleButton onClick={onAuthSuccess} />
      <p className="text-sm text-[#5C5852] text-center mt-5">
        Already have an account?{' '}
        <button type="button" onClick={() => setActiveModal('login')} className={linkButtonClass}>
          Log in
        </button>
      </p>
    </div>
  );
}

function DemoModal() {
  return (
    <div>
      <h2 id="modal-title" className="text-2xl sm:text-3xl font-bold tracking-tight text-[#1F2421] mb-5 pr-10">
        Demo Video
      </h2>
      <div className="aspect-video rounded-xl overflow-hidden bg-black">
        <iframe
          src={DEMO_YOUTUBE_EMBED_URL}
          title="Demo Video"
          allowFullScreen
          className="w-full h-full border-0"
        />
      </div>
    </div>
  );
}

export default function LandingModals({ activeModal, setActiveModal, onAuthSuccess }) {
  const isOpen = activeModal !== null;

  // Escape key closes the modal.
  useEffect(() => {
    if (!isOpen) return;
    const handleKeyDown = (e) => {
      if (e.key === 'Escape') setActiveModal(null);
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [isOpen, setActiveModal]);

  // Body scroll lock while a modal is open.
  useEffect(() => {
    if (!isOpen) return;
    document.body.style.overflow = 'hidden';
    return () => {
      document.body.style.overflow = 'unset';
    };
  }, [isOpen]);

  if (!isOpen) return null;

  const close = () => setActiveModal(null);
  const maxWidth = activeModal === 'demo' ? 'max-w-3xl' : 'max-w-md';

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center p-4 sm:p-6 bg-[rgba(28,10,8,0.45)] backdrop-blur-[10px]"
      onClick={close}
    >
      <div
        role="dialog"
        aria-modal="true"
        aria-labelledby="modal-title"
        className={`relative w-full ${maxWidth} max-h-[90vh] overflow-y-auto bg-[#FAF6EE] border border-[#E5DEC9] rounded-[20px] shadow-[0_25px_50px_-12px_rgba(0,0,0,0.35)] p-6 sm:p-8`}
        onClick={(e) => e.stopPropagation()}
      >
        <button
          type="button"
          aria-label="Close dialog"
          onClick={close}
          className="absolute top-4 right-4 w-8 h-8 flex items-center justify-center text-xl leading-none text-[#5C5852] hover:text-[#1F2421] bg-transparent border-none cursor-pointer transition-colors"
        >
          ✕
        </button>

        {activeModal === 'login' && <LoginModal setActiveModal={setActiveModal} onAuthSuccess={onAuthSuccess} />}
        {activeModal === 'signup' && <SignupModal setActiveModal={setActiveModal} onAuthSuccess={onAuthSuccess} />}
        {activeModal === 'demo' && <DemoModal />}
      </div>
    </div>
  );
}
