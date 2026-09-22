/**
 * Voice-control styles, appended as a SECOND <style> element by
 * ui/voice-widget-element.ts only — never imported by ui/styles.ts or
 * entry.text.ts, so the Phase-1 text bundle ships zero bytes of
 * voice-related CSS (see entry.text.ts's IP-protection note). Reuses the
 * `--zello-primary`/`--zello-ink-soft` custom properties already defined
 * on `:host` by the base stylesheet — both <style> tags live in the same
 * shadow root, so the cascade still applies normally.
 */
export function buildVoiceStyles(): string {
  return `
    .zello-mic-button,
    .zello-pause-button {
      flex: 0 0 auto;
      display: inline-flex;
      align-items: center;
      justify-content: center;
      width: 40px;
      height: 40px;
      border-radius: 50%;
      border: none;
      background: transparent;
      color: var(--zello-ink-soft);
      cursor: pointer;
      transition: background 0.15s ease, color 0.15s ease;
    }
    .zello-mic-button:hover:not(:disabled),
    .zello-pause-button:hover:not(:disabled) {
      background: var(--zello-surface-alt);
    }
    .zello-mic-button:disabled {
      opacity: 0.4;
      cursor: not-allowed;
    }
    .zello-mic-button svg,
    .zello-pause-button svg {
      width: 20px;
      height: 20px;
    }

    .zello-mic-listening {
      color: #ffffff;
      background: #d64545;
      animation: zello-mic-pulse 1.4s ease-in-out infinite;
    }
    .zello-mic-listening:hover { background: #c23b3b; }

    .zello-mic-processing svg {
      animation: zello-mic-spin 1s linear infinite;
    }

    .zello-mic-speaking {
      color: #ffffff;
      background: var(--zello-primary);
    }

    .zello-mic-error {
      color: #d64545;
    }

    @keyframes zello-mic-pulse {
      0%, 100% { box-shadow: 0 0 0 0 rgba(214, 69, 69, 0.35); }
      50% { box-shadow: 0 0 0 8px rgba(214, 69, 69, 0); }
    }
    @keyframes zello-mic-spin {
      from { transform: rotate(0deg); }
      to { transform: rotate(360deg); }
    }

    .zello-voice-status {
      display: none;
      align-items: center;
      gap: 6px;
      padding: 2px 16px 8px;
      font-size: 12px;
      color: var(--zello-ink-soft);
      flex: 0 0 auto;
    }
    .zello-voice-status-visible {
      display: flex;
    }
    .zello-voice-status-error {
      color: #d64545;
    }
    .zello-voice-disclosure {
      padding: 4px 16px 2px;
      font-size: 10px;
      color: var(--zello-ink-soft);
      text-align: center;
      flex: 0 0 auto;
    }

    .zello-header-icon-button {
      background: transparent;
      border: none;
      color: var(--zello-primary-ink);
      cursor: pointer;
      padding: 4px;
      opacity: 0.85;
      display: inline-flex;
      align-items: center;
      justify-content: center;
      flex: 0 0 auto;
    }
    .zello-header-icon-button:hover {
      opacity: 1;
    }
    .zello-header-icon-button svg {
      width: 18px;
      height: 18px;
    }

    .zello-launcher-attention {
      animation: zello-launcher-bounce 1.8s ease-in-out infinite;
    }
    @keyframes zello-launcher-bounce {
      0%, 100% { transform: scale(1); }
      50% { transform: scale(1.08); }
    }

    .zello-proactive-bubble {
      position: fixed;
      bottom: 92px;
      z-index: 2147483000;
      width: 240px;
      max-width: calc(100vw - 40px);
      background: var(--zello-surface);
      color: var(--zello-ink);
      border-radius: 14px;
      box-shadow: 0 8px 28px rgba(0, 0, 0, 0.18);
      padding: 14px 18px 12px 16px;
      cursor: pointer;
      animation: zello-proactive-in 0.25s ease;
    }
    .zello-proactive-bubble.zello-position-bottom-right { right: 20px; }
    .zello-proactive-bubble.zello-position-bottom-left { left: 20px; }
    @keyframes zello-proactive-in {
      from { opacity: 0; transform: translateY(8px); }
      to { opacity: 1; transform: translateY(0); }
    }
    .zello-proactive-dismiss {
      position: absolute;
      top: 6px;
      right: 6px;
      width: 22px;
      height: 22px;
      background: transparent;
      border: none;
      color: var(--zello-ink-soft);
      cursor: pointer;
      font-size: 12px;
      border-radius: 50%;
    }
    .zello-proactive-dismiss:hover {
      background: var(--zello-surface-alt);
    }
    .zello-proactive-text {
      font-size: 13px;
      line-height: 1.45;
      color: var(--zello-ink);
      padding-right: 12px;
    }
    .zello-proactive-hint {
      margin-top: 8px;
      font-size: 12px;
      font-weight: 600;
      color: var(--zello-primary);
    }
  `;
}
