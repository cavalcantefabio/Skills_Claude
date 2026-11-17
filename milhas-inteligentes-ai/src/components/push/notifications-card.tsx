"use client";

import { useEffect, useState, useTransition } from "react";
import { BellOff, BellRing, Loader2, Send, Share, SquarePlus } from "lucide-react";
import { Button, cx } from "@/components/ui";
import { removePushSubscription, savePushSubscription, sendTestPush } from "@/server/actions/push";

type Status = "carregando" | "sem-suporte" | "ios-instalar" | "bloqueado" | "desligado" | "ligado";

function b64ToUint8(base64: string) {
  const pad = "=".repeat((4 - (base64.length % 4)) % 4);
  const raw = atob((base64 + pad).replace(/-/g, "+").replace(/_/g, "/"));
  return Uint8Array.from(raw, (c) => c.charCodeAt(0));
}

function deviceLabel() {
  const ua = navigator.userAgent;
  if (/iPhone/.test(ua)) return "iPhone";
  if (/iPad/.test(ua)) return "iPad";
  if (/Android/.test(ua)) return "Android";
  const browser = /Edg\//.test(ua) ? "Edge" : /Chrome\//.test(ua) ? "Chrome" : /Firefox\//.test(ua) ? "Firefox" : /Safari\//.test(ua) ? "Safari" : "Navegador";
  const os = /Windows/.test(ua) ? "Windows" : /Mac OS X/.test(ua) ? "Mac" : /Linux/.test(ua) ? "Linux" : "";
  return os ? `${browser} no ${os}` : browser;
}

const isIOS = () => /iPhone|iPad|iPod/.test(navigator.userAgent);
const isStandalone = () => window.matchMedia("(display-mode: standalone)").matches || (navigator as { standalone?: boolean }).standalone === true;

/**
 * Ativa ou desativa notificações neste aparelho. No iPhone, o Safari só permite
 * notificações com o app instalado na tela inicial (iOS 16.4 ou mais novo).
 */
export function NotificationsCard({ vapidPublicKey, devices, compact = false }: { vapidPublicKey: string; devices: number; compact?: boolean }) {
  const [status, setStatus] = useState<Status>("carregando");
  const [msg, setMsg] = useState<{ ok: boolean; text: string } | null>(null);
  const [pending, start] = useTransition();

  useEffect(() => {
    (async () => {
      const supported = "serviceWorker" in navigator && "PushManager" in window && "Notification" in window;
      if (!supported) return setStatus(isIOS() && !isStandalone() ? "ios-instalar" : "sem-suporte");
      if (Notification.permission === "denied") return setStatus("bloqueado");
      const reg = await navigator.serviceWorker.register("/sw.js");
      const sub = await reg.pushManager.getSubscription();
      setStatus(sub ? "ligado" : "desligado");
    })().catch(() => setStatus("sem-suporte"));
  }, []);

  const enable = () =>
    start(async () => {
      setMsg(null);
      try {
        const permission = await Notification.requestPermission();
        if (permission !== "granted") {
          setStatus(permission === "denied" ? "bloqueado" : "desligado");
          return;
        }
        const reg = await navigator.serviceWorker.register("/sw.js");
        await navigator.serviceWorker.ready;
        const sub =
          (await reg.pushManager.getSubscription()) ??
          (await reg.pushManager.subscribe({ userVisibleOnly: true, applicationServerKey: b64ToUint8(vapidPublicKey) }));
        const r = await savePushSubscription(sub.toJSON(), deviceLabel());
        setMsg({ ok: r.ok, text: r.message });
        if (r.ok) setStatus("ligado");
      } catch {
        setMsg({ ok: false, text: "Não foi possível ativar as notificações neste navegador." });
      }
    });

  const disable = () =>
    start(async () => {
      setMsg(null);
      const reg = await navigator.serviceWorker.getRegistration("/sw.js");
      const sub = await reg?.pushManager.getSubscription();
      if (sub) {
        await removePushSubscription(sub.endpoint);
        await sub.unsubscribe();
      }
      setStatus("desligado");
      setMsg({ ok: true, text: "Notificações desativadas neste aparelho." });
    });

  const test = () =>
    start(async () => {
      const r = await sendTestPush();
      setMsg({ ok: r.ok, text: r.message });
    });

  if (compact && (status === "ligado" || status === "carregando" || status === "sem-suporte")) return null;

  return (
    <div className={cx("space-y-3 text-sm", compact && "rounded-2xl border border-line bg-surface p-4")}>
      {compact && <p className="font-semibold text-ink">Receba os voos no celular</p>}
      {status === "carregando" && <p className="text-muted">Verificando este aparelho…</p>}
      {status === "sem-suporte" && <p className="text-ink-2">Este navegador não aceita notificações. No celular, use o Safari (iPhone) ou o Chrome (Android).</p>}
      {status === "ios-instalar" && (
        <div className="space-y-2 text-ink-2">
          <p>No iPhone, as notificações só funcionam com o app na tela inicial:</p>
          <ol className="list-decimal space-y-1 pl-5">
            <li>
              No Safari, toque em <Share className="inline size-4 align-text-bottom" aria-label="Compartilhar" /> (Compartilhar).
            </li>
            <li>
              Escolha <SquarePlus className="inline size-4 align-text-bottom" aria-hidden /> <strong>Adicionar à Tela de Início</strong> e confirme.
            </li>
            <li>Abra o app pelo ícone novo, entre e volte aqui para ativar.</li>
          </ol>
        </div>
      )}
      {status === "bloqueado" && (
        <p className="text-ink-2">
          As notificações estão bloqueadas para este site. Libere nas configurações do navegador (no iPhone: Ajustes → Notificações → Milhas AI) e
          recarregue a página.
        </p>
      )}
      {status === "desligado" && (
        <>
          <p className="text-ink-2">Ative para receber um aviso quando a busca automática (8h e 20h) encontrar um voo para os seus avisos de rota.</p>
          <Button onClick={enable} disabled={pending}>
            {pending ? <Loader2 className="size-4 animate-spin" aria-hidden /> : <BellRing className="size-4" aria-hidden />} Ativar notificações neste aparelho
          </Button>
        </>
      )}
      {status === "ligado" && (
        <>
          <p className="text-good-ink">Notificações ativadas neste aparelho.</p>
          <div className="flex flex-wrap gap-2">
            <Button variant="secondary" size="sm" onClick={test} disabled={pending}>
              <Send className="size-3.5" aria-hidden /> Enviar teste
            </Button>
            <Button variant="ghost" size="sm" onClick={disable} disabled={pending}>
              <BellOff className="size-3.5" aria-hidden /> Desativar neste aparelho
            </Button>
          </div>
        </>
      )}
      {!compact && <p className="text-xs text-muted">Aparelhos com notificações: {devices}.</p>}
      {msg && (
        <p role={msg.ok ? "status" : "alert"} className={cx("text-xs", msg.ok ? "text-good-ink" : "text-critical-ink")}>
          {msg.text}
        </p>
      )}
    </div>
  );
}
