import React from 'react';
import { FloatingPipPortal } from './FloatingPipPortal.jsx';

interface PipOrchestratorProps {
  /** Dashboard PiP window instance (null when docked) */
  dashboardPipWindow: Window | null;
  /** Prompt PiP window instance (null when docked) */
  promptPipWindow: Window | null;
  /** Launcher PiP window instance (null when docked) */
  launcherPipWindow: Window | null;
  /** React content to render inside the Dashboard PiP window */
  dashboardContent: React.ReactNode;
  /** React content to render inside the Prompt PiP window */
  promptContent: React.ReactNode;
  /** React content to render inside the Launcher PiP window */
  launcherContent: React.ReactNode;
}

/* ─────────────────────────────────────────────────────────────────
   PipOrchestrator — Pure presentational component that renders
   the Dashboard, Prompt, and Launcher content into their respective
   PiP windows via React portals. The PiP lifecycle is managed by the
   parent (TutorialOverlay) via useDocumentPip hooks.
───────────────────────────────────────────────────────────────── */
export function PipOrchestrator({
  dashboardPipWindow,
  promptPipWindow,
  launcherPipWindow,
  dashboardContent,
  promptContent,
  launcherContent,
}: PipOrchestratorProps) {
  return (
    <>
      <FloatingPipPortal pipWindow={dashboardPipWindow}>
        {dashboardContent}
      </FloatingPipPortal>
      <FloatingPipPortal pipWindow={promptPipWindow}>
        {promptContent}
      </FloatingPipPortal>
      <FloatingPipPortal pipWindow={launcherPipWindow}>
        {launcherContent}
      </FloatingPipPortal>
    </>
  );
}
