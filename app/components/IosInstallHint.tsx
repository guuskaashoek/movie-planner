"use client";

import { useEffect, useState, useSyncExternalStore } from "react";

const STORAGE_KEY = "mp-ios-install-dismissed";

function isIosSafari() {
  const ua = navigator.userAgent;
  const iOS = /iPad|iPhone|iPod/.test(ua) || (navigator.platform === "MacIntel" && navigator.maxTouchPoints > 1);
  const webkit = /WebKit/.test(ua);
  const notOther = !/CriOS|FxiOS|EdgiOS|OPiOS|DuckDuckGo/.test(ua);
  return iOS && webkit && notOther;
}

function isStandalone() {
  return window.matchMedia("(display-mode: standalone)").matches || ("standalone" in navigator && Boolean((navigator as Navigator & { standalone?: boolean }).standalone));
}

function shouldOfferInstall() {
  if (isStandalone() || !isIosSafari()) return false;
  try {
    if (localStorage.getItem(STORAGE_KEY) === "1") return false;
  } catch {
    // Private mode can block localStorage; still show the hint.
  }
  return true;
}

// The browser facts we read never change while the page is open, so there is nothing to subscribe to.
const subscribe = () => () => {};

export function IosInstallHint() {
  // Server render and hydration see `false`; the client then re-renders with the real value.
  const eligible = useSyncExternalStore(subscribe, shouldOfferInstall, () => false);
  const [dismissed, setDismissed] = useState(false);
  const show = eligible && !dismissed;

  useEffect(() => {
    document.documentElement.classList.toggle("has-ios-install-hint", show);
    return () => document.documentElement.classList.remove("has-ios-install-hint");
  }, [show]);

  if (!show) return null;

  return (
    <aside className="ios-install-hint" role="note">
      <p>
        <strong>Use as an app.</strong> Tap Share, then <em>Add to Home Screen</em>.
      </p>
      <button
        type="button"
        className="ios-install-dismiss"
        onClick={() => {
          try {
            localStorage.setItem(STORAGE_KEY, "1");
          } catch {
            /* ignore */
          }
          setDismissed(true);
        }}
      >
        Dismiss
      </button>
    </aside>
  );
}