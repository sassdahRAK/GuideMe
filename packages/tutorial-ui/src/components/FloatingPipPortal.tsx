import React, { useEffect, useState } from 'react';
import ReactDOM from 'react-dom';

interface FloatingPipPortalProps {
  pipWindow: Window | null;
  children: React.ReactNode;
}

/* ─────────────────────────────────────────────────────────────────
   FloatingPipPortal — Renders React children into an external
   Picture-in-Picture window's DOM via ReactDOM.createPortal.
   The children remain part of the same React tree (same memory
   heap), so state updates automatically propagate.
───────────────────────────────────────────────────────────────── */
export const FloatingPipPortal: React.FC<FloatingPipPortalProps> = ({ pipWindow, children }) => {
  const [container, setContainer] = useState<HTMLElement | null>(null);

  useEffect(() => {
    if (!pipWindow) {
      setContainer(null);
      return;
    }

    const doc = pipWindow.document;
    let mountPoint = doc.getElementById('pip-root');

    if (!mountPoint) {
      mountPoint = doc.createElement('div');
      mountPoint.id = 'pip-root';
      mountPoint.className = 'w-full h-screen flex flex-col antialiased';
      doc.body.appendChild(mountPoint);
    }

    setContainer(mountPoint);
  }, [pipWindow]);

  if (!pipWindow || !container) return null;

  // Render React subtree directly into the external PiP DOM node
  return ReactDOM.createPortal(children, container);
};
