import { useEffect, useRef, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import LandingModals from '../components/LandingModals.jsx';

export default function LandingPage() {
  const navigate = useNavigate();
  const videoRef = useRef(null);
  const prevXRef = useRef(null);
  const targetTimeRef = useRef(0);
  const isSeekingRef = useRef(false);

  const [menuOpen, setMenuOpen] = useState(false);
  const [activeModal, setActiveModal] = useState(null); // 'login' | 'signup' | 'demo' | null

  // Background video mouse scrub logic
  useEffect(() => {
    const video = videoRef.current;
    if (!video) return;

    // Ensure video is paused
    video.pause();

    const handleLoadedMetadata = () => {
      targetTimeRef.current = video.currentTime || 0;
      // Seek slightly to ensure first frame renders
      if (video.currentTime === 0) {
        video.currentTime = 0.001;
      }
    };

    const handleSeeked = () => {
      if (!video || !video.duration || Number.isNaN(video.duration)) {
        isSeekingRef.current = false;
        return;
      }
      // If targetTime has moved while seeking was underway, queue next seek
      if (Math.abs(video.currentTime - targetTimeRef.current) > 0.02) {
        video.currentTime = targetTimeRef.current;
      } else {
        isSeekingRef.current = false;
      }
    };

    video.addEventListener('loadedmetadata', handleLoadedMetadata);
    video.addEventListener('seeked', handleSeeked);

    const handleMouseMove = (e) => {
      const currentX = e.clientX;
      if (prevXRef.current === null) {
        prevXRef.current = currentX;
        return;
      }

      const delta = currentX - prevXRef.current;
      prevXRef.current = currentX;

      if (!video.duration || Number.isNaN(video.duration)) return;

      const SENSITIVITY = 0.8;
      const timeOffset = (delta / window.innerWidth) * SENSITIVITY * video.duration;
      targetTimeRef.current = Math.max(0, Math.min(video.duration, targetTimeRef.current + timeOffset));

      if (!isSeekingRef.current) {
        isSeekingRef.current = true;
        video.currentTime = targetTimeRef.current;
      }
    };

    const handleMouseLeave = () => {
      prevXRef.current = null;
    };

    // Mobile / touch scrub support
    const handleTouchStart = (e) => {
      if (e.touches.length > 0) {
        prevXRef.current = e.touches[0].clientX;
      }
    };

    const handleTouchMove = (e) => {
      if (e.touches.length === 0) return;
      const currentX = e.touches[0].clientX;
      if (prevXRef.current === null) {
        prevXRef.current = currentX;
        return;
      }

      const delta = currentX - prevXRef.current;
      prevXRef.current = currentX;

      if (!video.duration || Number.isNaN(video.duration)) return;

      const SENSITIVITY = 0.8;
      const timeOffset = (delta / window.innerWidth) * SENSITIVITY * video.duration;
      targetTimeRef.current = Math.max(0, Math.min(video.duration, targetTimeRef.current + timeOffset));

      if (!isSeekingRef.current) {
        isSeekingRef.current = true;
        video.currentTime = targetTimeRef.current;
      }
    };

    const handleTouchEnd = () => {
      prevXRef.current = null;
    };

    window.addEventListener('mousemove', handleMouseMove);
    window.addEventListener('mouseleave', handleMouseLeave);
    window.addEventListener('touchstart', handleTouchStart, { passive: true });
    window.addEventListener('touchmove', handleTouchMove, { passive: true });
    window.addEventListener('touchend', handleTouchEnd);

    return () => {
      video.removeEventListener('loadedmetadata', handleLoadedMetadata);
      video.removeEventListener('seeked', handleSeeked);
      window.removeEventListener('mousemove', handleMouseMove);
      window.removeEventListener('mouseleave', handleMouseLeave);
      window.removeEventListener('touchstart', handleTouchStart);
      window.removeEventListener('touchmove', handleTouchMove);
      window.removeEventListener('touchend', handleTouchEnd);
    };
  }, []);

  // Escape closes the mobile menu (LandingModals handles its own Escape)
  useEffect(() => {
    const handleKeyDown = (e) => {
      if (e.key === 'Escape') setMenuOpen(false);
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, []);

  // Mock auth: no backend yet, so Login / Sign Up / Google all go straight to /profile
  const handleAuthSuccess = () => {
    setActiveModal(null);
    navigate('/profile');
  };

  return (
    <div className="relative w-screen h-screen overflow-hidden select-text text-white bg-black">
      {/* Background Video (Mouse Scrub Controlled) */}
      <video
        ref={videoRef}
        src="/assets/aistudio/final_ff9ef33e.mp4"
        muted
        playsInline
        preload="auto"
        className="pointer-events-none"
        style={{
          position: 'fixed',
          inset: 0,
          zIndex: 0,
          objectFit: 'cover',
          objectPosition: '70% center',
          width: '100%',
          height: '100%',
        }}
      />

      {/* NAVBAR (fixed, z-index: 10) */}
      <header className="fixed top-0 left-0 w-full z-10 px-6 sm:px-10 md:px-14 lg:px-16 py-5 sm:py-6 flex justify-between items-center">
        {/* Logo (left) */}
        <div className="flex items-center gap-2.5 select-none cursor-pointer">
          <span className="text-[19px] sm:text-[22px] font-bold tracking-tight text-white leading-tight">
            AI-Powered<br className="hidden sm:inline" /> Course Generator
          </span>
          <span className="text-[22px] sm:text-[26px] text-white leading-none font-light">
            ✳
          </span>
        </div>

        {/* Desktop nav links (center-left) */}
        <nav
          aria-label="Desktop Navigation"
          className="hidden md:flex items-center gap-8 lg:gap-10 text-[15px] sm:text-[16px] text-white font-medium"
        >
          <a
            href="/project_working.html"
            className="hover:opacity-75 transition-opacity cursor-pointer text-white font-medium text-[15px] no-underline"
          >
            How it works
          </a>
          <button
            type="button"
            onClick={() => setActiveModal('demo')}
            className="hover:opacity-75 transition-opacity cursor-pointer bg-transparent border-none p-0 text-white font-medium text-[15px]"
          >
            Demo
          </button>
        </nav>

        {/* Desktop CTA (right) */}
        <div className="hidden md:flex items-center gap-6">
          <button
            type="button"
            onClick={() => setActiveModal('login')}
            className="text-[15px] text-white hover:opacity-75 transition-opacity cursor-pointer bg-transparent border-none p-0 font-medium"
          >
            Log in
          </button>
          <button
            type="button"
            onClick={() => setActiveModal('signup')}
            className="bg-white text-neutral-900 hover:bg-neutral-100 transition-colors font-semibold text-[14px] sm:text-[15px] px-5 py-2 sm:py-2.5 rounded-full cursor-pointer shadow-sm"
          >
            Sign up free
          </button>
        </div>

        {/* Mobile hamburger (visible below md) */}
        <button
          type="button"
          aria-label="Toggle navigation menu"
          aria-expanded={menuOpen}
          onClick={() => setMenuOpen(!menuOpen)}
          className="md:hidden flex flex-col justify-center items-center w-8 h-8 gap-[5px] focus:outline-none z-20 cursor-pointer bg-transparent border-none p-0"
        >
          <span
            className={`w-6 h-[2px] bg-white transition-all duration-300 origin-center ${
              menuOpen ? 'rotate-45 translate-y-[7px]' : ''
            }`}
          />
          <span
            className={`w-6 h-[2px] bg-white transition-all duration-300 ${
              menuOpen ? 'opacity-0' : 'opacity-100'
            }`}
          />
          <span
            className={`w-6 h-[2px] bg-white transition-all duration-300 origin-center ${
              menuOpen ? '-rotate-45 -translate-y-[7px]' : ''
            }`}
          />
        </button>
      </header>

      {/* Mobile overlay (z-index: 9) */}
      <div
        className={`fixed inset-0 bg-neutral-950/95 backdrop-blur-md z-[9] flex flex-col justify-center px-8 gap-8 transition-opacity duration-300 md:hidden ${
          menuOpen ? 'opacity-100 pointer-events-auto' : 'opacity-0 pointer-events-none'
        }`}
      >
        <a
          href="/project_working.html"
          className="text-[30px] font-medium text-white text-left hover:opacity-75 transition-opacity cursor-pointer no-underline"
        >
          How it works
        </a>
        <button
          type="button"
          onClick={() => {
            setMenuOpen(false);
            setActiveModal('demo');
          }}
          className="text-[30px] font-medium text-white text-left hover:opacity-75 transition-opacity cursor-pointer bg-transparent border-none p-0"
        >
          Demo
        </button>
        <button
          type="button"
          onClick={() => {
            setMenuOpen(false);
            setActiveModal('login');
          }}
          className="text-[30px] font-medium text-white text-left hover:opacity-75 transition-opacity cursor-pointer bg-transparent border-none p-0"
        >
          Log in
        </button>
        <button
          type="button"
          onClick={() => {
            setMenuOpen(false);
            setActiveModal('signup');
          }}
          className="text-[20px] font-semibold bg-white text-neutral-900 text-center py-3.5 rounded-full hover:bg-neutral-100 transition-colors cursor-pointer border-none mt-2"
        >
          Sign up free
        </button>
      </div>

      {/* HERO SECTION (z-index: 1) */}
      <main className="relative z-[1] w-full min-h-screen flex flex-col justify-center px-6 sm:px-10 md:px-14 lg:px-20 select-text">
        <div className="max-w-xl md:max-w-2xl py-24 md:py-0">
          {/* 1. Eyebrow label */}
          <div className="text-white/80 uppercase tracking-widest text-xs sm:text-[13px] md:text-sm font-semibold mb-4 sm:mb-5 select-none">
            YOUR IDEAS, TURNED INTO LEARNING.
          </div>

          {/* 2. Main Headline */}
          <h1 className="text-5xl sm:text-6xl md:text-7xl lg:text-[76px] font-bold text-white tracking-tight leading-[1.05] mb-5 sm:mb-6">
            Turn your text
            <br />
            into a course.
          </h1>

          {/* 3. Description Paragraph */}
          <p className="text-base sm:text-lg md:text-[19px] text-white/90 font-normal leading-relaxed mb-8 sm:mb-10 max-w-lg">
            From rough notes to structured lessons, turn your existing content into a course with AI. Spend less time organizing and more time creating something worth learning.
          </p>

          {/* 4. Call to Action Button */}
          <div>
            <button
              type="button"
              onClick={() => setActiveModal('login')}
              className="inline-flex items-center gap-3 bg-white text-[#8B1E17] font-semibold text-base sm:text-[17px] px-7 sm:px-8 py-3.5 sm:py-4 rounded-full shadow-xl hover:bg-neutral-100 hover:scale-[1.02] active:scale-[0.99] transition-all duration-200 cursor-pointer select-none"
            >
              <span>Get started for free</span>
              <span className="text-lg leading-none font-bold">→</span>
            </button>
          </div>
        </div>
      </main>

      <LandingModals activeModal={activeModal} setActiveModal={setActiveModal} onAuthSuccess={handleAuthSuccess} />
    </div>
  );
}

