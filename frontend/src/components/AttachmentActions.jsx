import React from 'react';
export const ACCEPT = 'image/*,.pdf,.doc,.docx,.xls,.xlsx,.csv,.txt,.odt,.ods';
export default function AttachmentActions({prefix,onChange}) {
 return <div className="flex flex-wrap gap-2">{[['camera','Vyfotit','image/*','environment',false],['gallery','Vybrat fotografie','image/*',undefined,true],['files','Přidat soubor',ACCEPT,undefined,true]].map(([key,label,accept,capture,multiple]) => <label key={key} className="flex min-h-12 cursor-pointer items-center rounded-lg border-2 border-slate-900 bg-white px-3 py-2 font-semibold focus-within:ring-2"><span>{label}</span><input className="sr-only" aria-label={label} type="file" accept={accept} capture={capture} multiple={multiple} onChange={onChange} data-testid={`${prefix}-${key}-input`} /></label>)}</div>;
}
