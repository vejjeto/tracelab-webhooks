"use client";

import * as React from "react";

export type Locale = "es" | "en";

export const LOCALE_STORAGE_KEY = "tracelab-lang";
export const LOCALE_CHANGE_EVENT = "tracelab-lang-change";

export interface Messages {
  headerSubtitle: string;
  selectBinAria: string;
  newBin: string;
  apiDocs: string;
  copyUrl: string;
  copiedUrl: string;
  sseConnected: string;
  sseConnecting: string;
  sseReconnecting: string;
  simulateStripe: string;
  simulateGithub: string;
  simulateCustom: string;
  requestsTitle: string;
  waitingWebhooks: string;
  emptyBody: string;
  emptyBodyShort: string;
  selectOrSimulate: string;
  tabHeadersQuery: string;
  tabHmac: string;
  tabSnippets: string;
  tabReplay: string;
  tabMcp: string;
  payloadBody: string;
  viewRaw: string;
  prettyJson: string;
  sanitizedHeaders: string;
  queryParamsJson: string;
}

export const messages: Record<Locale, Messages> = {
  es: {
    headerSubtitle:
      "Inspector de Webhooks en Vivo, Verificador HMAC y Replay API",
    selectBinAria: "Seleccionar Bin",
    newBin: "Nuevo Bin",
    apiDocs: "API Docs",
    copyUrl: "Copiar URL",
    copiedUrl: "URL Copiada",
    sseConnected: "SSE Conectado",
    sseConnecting: "Conectando SSE...",
    sseReconnecting: "SSE Reconectando",
    simulateStripe: "Disparar Webhook Stripe",
    simulateGithub: "Disparar Webhook GitHub",
    simulateCustom: "Disparar JSON Custom",
    requestsTitle: "Requests",
    waitingWebhooks: "Esperando webhooks entrantes en",
    emptyBody: "(cuerpo vacío)",
    emptyBodyShort: "(sin cuerpo)",
    selectOrSimulate: "Selecciona o simula un webhook para inspeccionarlo.",
    tabHeadersQuery: "Headers y Query",
    tabHmac: "HMAC Verifier",
    tabSnippets: "Snippets",
    tabReplay: "Replay & Diff",
    tabMcp: "MCP Inspector",
    payloadBody: "Payload Body",
    viewRaw: "Ver Raw",
    prettyJson: "Pretty JSON",
    sanitizedHeaders: "Headers Sanitizados",
    queryParamsJson: "Query Params JSON",
  },
  en: {
    headerSubtitle: "Live Webhook Inspector, HMAC Verifier & API Replay",
    selectBinAria: "Select Bin",
    newBin: "New Bin",
    apiDocs: "API Docs",
    copyUrl: "Copy URL",
    copiedUrl: "URL Copied",
    sseConnected: "SSE Connected",
    sseConnecting: "Connecting SSE...",
    sseReconnecting: "SSE Reconnecting",
    simulateStripe: "Trigger Stripe Webhook",
    simulateGithub: "Trigger GitHub Webhook",
    simulateCustom: "Trigger Custom JSON",
    requestsTitle: "Requests",
    waitingWebhooks: "Waiting for incoming webhooks at",
    emptyBody: "(empty body)",
    emptyBodyShort: "(no body)",
    selectOrSimulate: "Select or simulate a webhook to inspect it.",
    tabHeadersQuery: "Headers & Query",
    tabHmac: "HMAC Verifier",
    tabSnippets: "Snippets",
    tabReplay: "Replay & Diff",
    tabMcp: "MCP Inspector",
    payloadBody: "Payload Body",
    viewRaw: "View Raw",
    prettyJson: "Pretty JSON",
    sanitizedHeaders: "Sanitized Headers",
    queryParamsJson: "Query Params JSON",
  },
};

function isLocale(value: unknown): value is Locale {
  return value === "es" || value === "en";
}

export function useLocale() {
  const [locale, setLocaleState] = React.useState<Locale>("es");

  React.useEffect(() => {
    try {
      const stored = localStorage.getItem(LOCALE_STORAGE_KEY);
      if (isLocale(stored)) {
        setLocaleState(stored);
        document.documentElement.lang = stored;
      }
    } catch {
      // Ignore storage errors
    }

    const onLocaleChange = (event: Event) => {
      const next = (event as CustomEvent<unknown>).detail;
      if (isLocale(next)) {
        setLocaleState(next);
        document.documentElement.lang = next;
      }
    };

    window.addEventListener(LOCALE_CHANGE_EVENT, onLocaleChange);
    return () => {
      window.removeEventListener(LOCALE_CHANGE_EVENT, onLocaleChange);
    };
  }, []);

  const setLocale = React.useCallback((next: Locale) => {
    setLocaleState(next);
    document.documentElement.lang = next;
    try {
      localStorage.setItem(LOCALE_STORAGE_KEY, next);
    } catch {
      // Ignore storage errors
    }
    window.dispatchEvent(
      new CustomEvent<Locale>(LOCALE_CHANGE_EVENT, { detail: next }),
    );
  }, []);

  const toggleLocale = React.useCallback(() => {
    setLocale(locale === "es" ? "en" : "es");
  }, [locale, setLocale]);

  return {
    locale,
    setLocale,
    toggleLocale,
    t: messages[locale],
  };
}
