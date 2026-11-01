import { useEffect } from 'react';

export const DEMO_YOUTUBE_EMBED_URL = "https://www.youtube.com/embed/dQw4w9WgXcQ?rel=0"; // TODO: Replace with final project demo video URL

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

export default function LandingModals({ activeModal, setActiveModal }) {
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

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center p-4 sm:p-6 bg-[rgba(28,10,8,0.45)] backdrop-blur-[10px]"
      onClick={close}
    >
      <div
        role="dialog"
        aria-modal="true"
        aria-labelledby="modal-title"
        className="relative w-full max-w-3xl max-h-[90vh] overflow-y-auto bg-[#FAF6EE] border border-[#E5DEC9] rounded-[20px] shadow-[0_25px_50px_-12px_rgba(0,0,0,0.35)] p-6 sm:p-8"
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

        {activeModal === 'demo' && <DemoModal />}
      </div>
    </div>
  );
}
