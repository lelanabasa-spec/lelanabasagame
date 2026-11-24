'use client';

import { useEffect, useRef, useState } from 'react';
import { usePathname, useRouter } from 'next/navigation';

function getCleanPath(raw: string | null): string {
  if (!raw) return '/';
  const normalized = raw.trim().replace(/\\+/g, '/').replace(/\/+$/, '');
  return normalized || '/';
}

function isGameRoute(path: string): boolean {
  return path.startsWith('/babak') || path === '/main_page' || path === '/sinopsis';
}

export default function RouteGuard({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  const router = useRouter();
  const isInitialMount = useRef(true);
  const [isAuthorized, setIsAuthorized] = useState(false);

  const cleanPath = getCleanPath(pathname);

  // Synchronous check to block /menu if user bypassed Home button during active game/sinopsis
  const isDirectMenuBlocked = () => {
    if (typeof window === 'undefined') return false;
    if (cleanPath === '/menu') {
      const isGameActive = sessionStorage.getItem('_lbas_ga') === 'true';
      const allowedViaHome = sessionStorage.getItem('_lbas_allow_menu') === 'true';
      return isGameActive && !allowedViaHome;
    }
    return false;
  };

  useEffect(() => {
    if (typeof window === 'undefined') return;

    // CASE 1: /menu access handling
    if (cleanPath === '/menu') {
      const isGameActive = sessionStorage.getItem('_lbas_ga') === 'true';
      const allowedViaHome = sessionStorage.getItem('_lbas_allow_menu') === 'true';

      if (isGameActive && !allowedViaHome) {
        // Direct address bar typing blocked! Return back to the active session page
        const savedSession = sessionStorage.getItem('_lbas_game_session_path') || sessionStorage.getItem('_lbas_rtr_st');
        const target = (savedSession && isGameRoute(savedSession)) ? savedSession : '/main_page';
        console.warn(`Direct navigation to /menu blocked during active game session. Returning to session: ${target}`);
        router.replace(target);
        return;
      }

      // Valid entry to menu (via Home confirmation button or outside game)
      sessionStorage.removeItem('_lbas_allow_menu');
      sessionStorage.setItem('_lbas_ga', 'false');
      sessionStorage.removeItem('_lbas_game_session_path');
      sessionStorage.setItem('_lbas_rtr_st', '/menu');
      isInitialMount.current = false;
      setIsAuthorized(true);
      return;
    }

    // CASE 2: Public / Auth / Ranking
    if (cleanPath === '/' || cleanPath === '/register' || cleanPath === '/rangking') {
      sessionStorage.setItem('_lbas_ga', 'false');
      sessionStorage.removeItem('_lbas_game_session_path');
      sessionStorage.setItem('_lbas_rtr_st', cleanPath);
      isInitialMount.current = false;
      setIsAuthorized(true);
      return;
    }

    // CASE 3: Content pages outside game loop (profil, panduan/caradolanan, materi)
    if (
      cleanPath === '/profil' ||
      cleanPath === '/profilpengembang' ||
      cleanPath === '/caradolanan' ||
      cleanPath.startsWith('/materi')
    ) {
      sessionStorage.setItem('_lbas_rtr_st', cleanPath);
      isInitialMount.current = false;
      setIsAuthorized(true);
      return;
    }

    // CASE 4: Starting game session from Sinopsis (/main_page or /sinopsis)
    if (cleanPath === '/main_page' || cleanPath === '/sinopsis') {
      sessionStorage.setItem('_lbas_ga', 'true');
      sessionStorage.setItem('_lbas_game_session_path', cleanPath);
      sessionStorage.setItem('_lbas_rtr_st', cleanPath);
      sessionStorage.removeItem('_lbas_allow_menu');
      isInitialMount.current = false;
      setIsAuthorized(true);
      return;
    }

    // CASE 5: In-game Babak routes (/babak*)
    if (cleanPath.startsWith('/babak')) {
      const isGameActive = sessionStorage.getItem('_lbas_ga') === 'true';

      // 5.1 If game is not active (e.g. entered babak URL directly without starting game)
      if (!isGameActive) {
        console.warn('Game session inactive. Redirecting to menu.');
        router.replace('/menu');
        return;
      }

      // 5.2 Direct URL skipping check on fresh mount/page load
      if (isInitialMount.current) {
        isInitialMount.current = false;
        const saved = sessionStorage.getItem('_lbas_rtr_st');
        if (!saved || saved !== cleanPath) {
          console.warn('Direct URL skipping detected. Returning to last valid path.');
          const target = saved && isGameRoute(saved) ? saved : '/main_page';
          router.replace(target);
          return;
        }
      }

      // Valid in-game transition
      sessionStorage.setItem('_lbas_ga', 'true');
      sessionStorage.setItem('_lbas_game_session_path', cleanPath);
      sessionStorage.setItem('_lbas_rtr_st', cleanPath);
      setIsAuthorized(true);
      return;
    }

    // Default fallback
    sessionStorage.setItem('_lbas_rtr_st', cleanPath);
    isInitialMount.current = false;
    setIsAuthorized(true);
  }, [cleanPath, router]);

  // Synchronously prevent flash of /menu if unlawfully typed while in game session
  if (isDirectMenuBlocked()) {
    return null;
  }

  // Prevent flashing of unauthorized content during redirect cycle on babak
  if (cleanPath.startsWith('/babak') && !isAuthorized) {
    return null;
  }

  return <>{children}</>;
}
