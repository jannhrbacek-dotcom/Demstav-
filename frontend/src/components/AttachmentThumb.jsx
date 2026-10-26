import React, { useEffect, useState } from "react";
import { FileText, Image as ImageIcon, Loader2 } from "lucide-react";
import { http } from "@/lib/api";
import { localBlob } from "@/lib/sync";
import { ATT_KINDS } from "@/lib/format";

/** Loads attachments through the authenticated API (server enforces permissions) or from the local queue. */
export function AttachmentThumb({ att, onRemove }) {
  const [url, setUrl] = useState(null);
  const [state, setState] = useState("loading");
  useEffect(() => {
    let u = null, alive = true;
    (async () => {
      let blob = await localBlob(att.id).catch(() => null);
      let local = !!blob;
      if (!blob) { try { blob = (await http.get(`/attachments/${att.id}`, { responseType: "blob" })).data; } catch { blob = null; } }
      if (!alive) return;
      if (blob) { u = URL.createObjectURL(blob); setUrl(u); setState(local ? "local" : "server"); } else setState("missing");
    })();
    return () => { alive = false; if (u) URL.revokeObjectURL(u); };
  }, [att.id]);
  const isImg = (att.type || "").startsWith("image/");
  return (
    <div className="flex items-center gap-3 rounded-lg border border-slate-200 bg-white p-2" data-testid="attachment-item">
      <a href={url || undefined} target="_blank" rel="noreferrer" className="flex h-16 w-16 shrink-0 items-center justify-center overflow-hidden rounded-md bg-slate-100">
        {state === "loading" ? <Loader2 className="h-5 w-5 animate-spin text-slate-500" /> : isImg && url ? <img src={url} alt={att.name} className="h-full w-full object-cover" /> : isImg ? <ImageIcon className="h-6 w-6 text-slate-500" /> : <FileText className="h-6 w-6 text-slate-500" />}
      </a>
      <div className="min-w-0 flex-1">
        <div className="truncate text-sm font-semibold text-slate-900">{att.name}</div>
        <div className="text-xs text-slate-600">{ATT_KINDS[att.kind] || "Ostatní"}{att.km ? ` · km ${att.km}` : ""} · {Math.round((att.size || 0) / 1024)} kB</div>
        <div className={`text-xs font-semibold ${state === "local" ? "text-amber-800" : state === "missing" ? "text-red-700" : "text-emerald-800"}`} data-testid="attachment-state">
          {state === "local" ? "V telefonu – čeká na nahrání" : state === "server" ? "Nahráno na server" : state === "missing" ? "Nedostupné (offline nebo chybí)" : ""}</div>
      </div>
      {onRemove && <button type="button" onClick={onRemove} className="px-2 text-sm font-semibold text-red-700" data-testid="attachment-remove">Odebrat</button>}
    </div>
  );
}
