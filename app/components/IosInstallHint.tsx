"use client";

import { useEffect, useState } from "react";

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

export function IosInstallHint() {
  const [show, setShow] = useState(false);

  useEffect(() => {
    if (isStandalone() || !isIosSafari()) return;
    try {
      if (localStorage.getItem(STORAGE_KEY) === "1") return;
    } catch {
      // Private mode can block localStorage; still show the hint.
    }
    setShow(true);
  }, []);

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
          setShow(false);
        }}
      >
        Dismiss
      </button>
    </aside>
  );
}