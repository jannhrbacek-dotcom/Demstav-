{
  "product": {
    "name": "DEMSTAV OPERATIONS",
    "type": "mobile-first web app + installable PWA + desktop manager dashboard",
    "primary_language": "cs-CZ",
    "core_users": [
      "Obsluha strojů (včetně starších zaměstnanců, práce venku, rukavice)",
      "Stavbyvedoucí / vedoucí směny",
      "Majitel / technický admin (desktop)"
    ],
    "north_star_actions": [
      "Zadat směnu jednou → automaticky se promítne do Provozního deníku + Šichtovnice + Přehledu",
      "Rychlá docházka (QR/GPS/ručně) i bez signálu",
      "Bezpečné potvrzení a schvalování (revize, důvody oprav, STOP závady)"
    ]
  },

  "brand_personality": {
    "keywords": [
      "průmyslové",
      "odolné",
      "čitelné na slunci",
      "bez zbytečných menu",
      "jednoznačné stavy",
      "rychlé ovládání v rukavicích"
    ],
    "visual_metaphor": "Rugged industrial UI: tmavá navigace jako palubní deska stroje + bezpečnostní žlutá pro akce + bílé pracovní plochy pro čitelnost.",
    "anti_patterns": [
      "průhledné/glasové pozadí",
      "jemné šedé texty",
      "malé ikonky bez popisku",
      "skryté akce v overflow menu",
      "gesta jako primární ovládání (swipe/pinch)",
      "příliš mnoho filtrů na mobilu"
    ]
  },

  "inspiration_sources": {
    "web_references": [
      {
        "title": "Construction worker mobile UX (touch targets, gloves, sunlight)",
        "url": "https://weareaffective.com/learning-centre/how-should-i-design-apps-for-construction-workers",
        "takeaways": [
          "Velké dotykové cíle (min 60px), rozestupy mezi tlačítky",
          "Vyhnout se multi-touch gestům",
          "Silné ohraničení prvků místo jemných stínů"
        ]
      },
      {
        "title": "Field service mobile app patterns (offline, job-centric screens)",
        "url": "https://team400.ai/blog/2025-07-field-service-mobile-apps",
        "takeaways": [
          "Job-centric obrazovky: jedna obrazovka = jeden úkol",
          "Viditelný offline/sync stav",
          "Guardrails: jasné kroky, minimum rozhodování"
        ]
      }
    ],
    "dribbble_queries_to_use": [
      "field service app high contrast",
      "industrial dashboard dark sidebar yellow accent",
      "offline sync status chips mobile"
    ]
  },

  "design_tokens": {
    "notes": [
      "Zachovat: DARK navigace + YELLOW akční tlačítka.",
      "Pracovní plochy (forms, lists) držet světlé pro čitelnost na slunci.",
      "Žádné velké gradienty; max dekorativní pruh v hero/header (<=20% viewportu)."
    ],

    "css_custom_properties": {
      "file": "/app/frontend/src/index.css",
      "strategy": "Upravit :root a .dark tokeny tak, aby odpovídaly DEMSTAV brandu. Navigace bude používat dark theme, obsahové plochy light theme.",
      "tokens": {
        "--background": "0 0% 100%",
        "--foreground": "222 47% 11%",

        "--card": "0 0% 100%",
        "--card-foreground": "222 47% 11%",

        "--popover": "0 0% 100%",
        "--popover-foreground": "222 47% 11%",

        "--primary": "45 100% 50%",
        "--primary-foreground": "222 47% 11%",

        "--secondary": "210 20% 96%",
        "--secondary-foreground": "222 47% 11%",

        "--muted": "210 20% 96%",
        "--muted-foreground": "215 16% 35%",

        "--accent": "45 100% 50%",
        "--accent-foreground": "222 47% 11%",

        "--destructive": "0 84% 55%",
        "--destructive-foreground": "0 0% 98%",

        "--border": "214 20% 88%",
        "--input": "214 20% 88%",
        "--ring": "45 100% 45%",

        "--radius": "0.75rem",

        "--demstav-nav": "222 47% 8%",
        "--demstav-nav-foreground": "0 0% 98%",
        "--demstav-surface": "0 0% 100%",
        "--demstav-surface-2": "210 20% 97%",
        "--demstav-warning": "45 100% 50%",
        "--demstav-ok": "142 72% 35%",
        "--demstav-info": "205 90% 40%",
        "--demstav-danger": "0 84% 55%",
        "--demstav-stop": "0 0% 0%"
      },
      "dark_tokens_for_nav_only": {
        "usage": "Použít na wrapper navigace (sidebar/bottom bar) přes className=\"dark\"; obsahové stránky zůstanou ve světlém režimu.",
        "tokens": {
          "--background": "222 47% 8%",
          "--foreground": "0 0% 98%",
          "--card": "222 47% 10%",
          "--card-foreground": "0 0% 98%",
          "--popover": "222 47% 10%",
          "--popover-foreground": "0 0% 98%",
          "--primary": "45 100% 50%",
          "--primary-foreground": "222 47% 11%",
          "--secondary": "222 30% 14%",
          "--secondary-foreground": "0 0% 98%",
          "--muted": "222 30% 14%",
          "--muted-foreground": "215 20% 75%",
          "--accent": "222 30% 14%",
          "--accent-foreground": "0 0% 98%",
          "--border": "222 30% 18%",
          "--input": "222 30% 18%",
          "--ring": "45 100% 45%"
        }
      }
    },

    "palette": {
      "core": {
        "nav_black": "#0B0F14",
        "nav_black_2": "#111827",
        "surface_white": "#FFFFFF",
        "surface_gray": "#F5F7FA",
        "text_ink": "#0F172A",
        "text_muted": "#334155",
        "border": "#D7DEE8",
        "action_yellow": "#FFD200",
        "action_yellow_hover": "#FFC400",
        "focus_ring_yellow": "#FFCC00"
      },
      "status": {
        "saved_local": { "bg": "#E2E8F0", "fg": "#0F172A", "label": "Uloženo v telefonu" },
        "queued": { "bg": "#FEF3C7", "fg": "#92400E", "label": "Čeká na odeslání" },
        "received": { "bg": "#DBEAFE", "fg": "#1D4ED8", "label": "Přijato serverem" },
        "confirmed": { "bg": "#DCFCE7", "fg": "#166534", "label": "Potvrzeno" },
        "approved": { "bg": "#BBF7D0", "fg": "#14532D", "label": "Schváleno" },
        "conflict": { "bg": "#FFE4E6", "fg": "#9F1239", "label": "Konflikt" },
        "stop_fault": { "bg": "#000000", "fg": "#FFD200", "label": "STOP" }
      },
      "gradient_usage": {
        "allowed": [
          "Jemný dekorativní pruh v horní části obrazovky (např. header background) max 12–16vh",
          "Dekorativní divider v loginu"
        ],
        "safe_gradients": [
          "linear-gradient(90deg, #0B0F14 0%, #111827 55%, #0B0F14 100%)",
          "linear-gradient(90deg, #FFD200 0%, #FFE066 100%) (pouze velké CTA plochy, ne malé prvky)"
        ]
      }
    },

    "typography": {
      "font_pairing": {
        "headings": "Space Grotesk",
        "body": "Inter"
      },
      "google_fonts": [
        "https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600;700&display=swap",
        "https://fonts.googleapis.com/css2?family=Space+Grotesk:wght@500;600;700&display=swap"
      ],
      "scale": {
        "h1": "text-4xl sm:text-5xl lg:text-6xl font-semibold tracking-tight",
        "h2": "text-base md:text-lg font-medium text-slate-700",
        "section_title": "text-lg font-semibold",
        "body": "text-sm md:text-base",
        "small": "text-xs md:text-sm"
      },
      "czech_support": "Inter i Space Grotesk podporují českou diakritiku; nepoužívat kondenzované fonty s tenkými řezy."
    },

    "spacing_and_layout": {
      "mobile_first": {
        "page_padding": "px-4 pt-4 pb-24",
        "card_padding": "p-4",
        "section_gap": "space-y-4",
        "touch_targets": "min-h-[56px] min-w-[56px] (primární CTA min-h-[64px])",
        "button_spacing": "gap-3 (min 12px), u kritických akcí gap-4"
      },
      "desktop": {
        "layout": "Sidebar (dark) + content (light). Max width content: max-w-5xl, ale ne centrovat textově; používat přirozené zarovnání vlevo.",
        "tables": "Použít shadcn Table + sticky header pro dlouhé seznamy."
      },
      "grid": {
        "forms": "Mobile: single column. Desktop: 2 columns pro méně kritická pole (např. MTH start/end vedle sebe).",
        "bento": "Na /prehled použít bento grid 2–3 sloupce na desktopu, 1 sloupec na mobilu."
      }
    },

    "elevation_and_borders": {
      "rule": "Preferovat ohraničení a jemné stíny; žádné průhlednosti.",
      "shadows": {
        "card": "shadow-sm",
        "floating_bar": "shadow-md",
        "focus": "focus-visible:ring-2 focus-visible:ring-[hsl(var(--ring))] focus-visible:ring-offset-2"
      },
      "borders": {
        "default": "border border-[hsl(var(--border))]",
        "critical": "border-2"
      }
    }
  },

  "component_system": {
    "component_path": {
      "shadcn_ui": "/app/frontend/src/components/ui",
      "primary_components": [
        { "name": "Button", "path": "button.jsx" },
        { "name": "Card", "path": "card.jsx" },
        { "name": "Badge", "path": "badge.jsx" },
        { "name": "Tabs", "path": "tabs.jsx" },
        { "name": "Dialog", "path": "dialog.jsx" },
        { "name": "Drawer", "path": "drawer.jsx" },
        { "name": "Sheet", "path": "sheet.jsx" },
        { "name": "Form", "path": "form.jsx" },
        { "name": "Input", "path": "input.jsx" },
        { "name": "Textarea", "path": "textarea.jsx" },
        { "name": "Select", "path": "select.jsx" },
        { "name": "Switch", "path": "switch.jsx" },
        { "name": "Checkbox", "path": "checkbox.jsx" },
        { "name": "RadioGroup", "path": "radio-group.jsx" },
        { "name": "Calendar", "path": "calendar.jsx" },
        { "name": "Table", "path": "table.jsx" },
        { "name": "ScrollArea", "path": "scroll-area.jsx" },
        { "name": "Separator", "path": "separator.jsx" },
        { "name": "Tooltip", "path": "tooltip.jsx" },
        { "name": "Sonner", "path": "sonner.jsx" }
      ]
    },

    "button_design": {
      "style": "Professional / Industrial",
      "variants": {
        "primary": {
          "use_for": ["Příchod", "Odchod", "Uložit a potvrdit", "Schválit"],
          "tailwind": "bg-[#FFD200] text-slate-900 hover:bg-[#FFC400] active:bg-[#FFB800] focus-visible:ring-2 focus-visible:ring-[#FFCC00] focus-visible:ring-offset-2",
          "shape": "rounded-xl",
          "size": "min-h-[64px] px-5 text-base font-semibold",
          "motion": "transition-colors duration-150"
        },
        "secondary": {
          "use_for": ["Uložit koncept", "Zkusit odeslat"],
          "tailwind": "bg-white text-slate-900 border border-slate-300 hover:bg-slate-50 active:bg-slate-100",
          "size": "min-h-[56px] px-5 text-base font-semibold",
          "motion": "transition-colors duration-150"
        },
        "danger": {
          "use_for": ["Zamítnout", "Smazat koncept"],
          "tailwind": "bg-red-600 text-white hover:bg-red-700 active:bg-red-800",
          "size": "min-h-[56px] px-5 text-base font-semibold",
          "motion": "transition-colors duration-150"
        },
        "ghost": {
          "use_for": ["Detail", "Historie", "Nápověda"],
          "tailwind": "bg-transparent hover:bg-slate-100 text-slate-900",
          "size": "min-h-[48px] px-3 text-sm font-medium",
          "motion": "transition-colors duration-150"
        }
      },
      "press_feedback": "active:scale-[0.99] pouze na velkých CTA; nepoužívat transition-all."
    },

    "status_badges": {
      "component": "Badge",
      "rules": [
        "Badge vždy obsahuje textový label + případně ikonku (lucide-react).",
        "Nikdy nepoužívat jen barvu bez textu.",
        "Konflikt a STOP musí být vizuálně nejvýraznější."
      ],
      "mapping": [
        { "status": "local", "label": "Uloženo v telefonu", "classes": "bg-slate-200 text-slate-900 border border-slate-300" },
        { "status": "queued", "label": "Čeká na odeslání", "classes": "bg-amber-100 text-amber-900 border border-amber-200" },
        { "status": "received", "label": "Přijato serverem", "classes": "bg-blue-100 text-blue-900 border border-blue-200" },
        { "status": "confirmed", "label": "Potvrzeno", "classes": "bg-emerald-100 text-emerald-900 border border-emerald-200" },
        { "status": "approved", "label": "Schváleno", "classes": "bg-green-200 text-green-950 border border-green-300" },
        { "status": "conflict", "label": "Konflikt", "classes": "bg-rose-100 text-rose-900 border border-rose-200" },
        { "status": "stop", "label": "STOP", "classes": "bg-black text-[#FFD200] border border-black" }
      ]
    }
  },

  "navigation_patterns": {
    "mobile": {
      "pattern": "Bottom navigation (max 4–5 položek) + prominentní Today CTA.",
      "items": [
        { "label": "Dnes", "route": "/dnes" },
        { "label": "Zápisy", "route": "/zapisy" },
        { "label": "Docházka", "route": "/dochazka" },
        { "label": "Fronta", "route": "/fronta" },
        { "label": "Více", "route": "/more" }
      ],
      "design": {
        "wrapper": "className=\"dark\" bg-[hsl(var(--background))] border-t border-[hsl(var(--border))]",
        "height": "min-h-[72px]",
        "tap_targets": "each item min-h-[56px]",
        "active_state": "text-[#FFD200] + subtle underline bar"
      }
    },
    "desktop_manager": {
      "pattern": "Left sidebar (dark) + top header in content area.",
      "items": [
        { "label": "Přehled", "route": "/prehled" },
        { "label": "Kontrola", "route": "/kontrola" },
        { "label": "Všechny zápisy", "route": "/vsechny-zapisy" },
        { "label": "Pracoviště", "route": "/pracoviste" },
        { "label": "Uživatelé", "route": "/uzivatele" },
        { "label": "Stroje", "route": "/stroje" }
      ]
    }
  },

  "page_blueprints": {
    "login": {
      "layout": "Single column, velké inputy, jasná CTA.",
      "components": ["Card", "Form", "Input", "Button", "Alert"],
      "details": [
        "Header s jemným tmavým pruhem (max 12vh) + logo DEMSTAV.",
        "Email + Heslo, CTA: Přihlásit.",
        "Chyby zobrazit v Alert (destructive) s konkrétním textem."
      ],
      "testids": [
        "login-email-input",
        "login-password-input",
        "login-submit-button",
        "login-error-alert"
      ]
    },

    "forced_password_change": {
      "route": "/zmena-hesla",
      "components": ["Card", "Form", "Input", "Button"],
      "details": [
        "Vysvětlit proč: dočasné heslo.",
        "Pole: Nové heslo + Potvrzení.",
        "CTA: Uložit nové heslo (primary)."
      ],
      "testids": [
        "password-change-new-input",
        "password-change-confirm-input",
        "password-change-submit-button"
      ]
    },

    "dnes": {
      "route": "/dnes",
      "layout": "Thumb-first: nahoře stav + dnes odpracováno, dole 2x2 grid velkých tlačítek.",
      "components": ["Card", "Button", "Badge", "Separator", "Progress"],
      "key_blocks": [
        "Stav směny: Pryč / Pracuji / Přestávka (velký text + barevný chip)",
        "Dnes odpracováno: hh:mm + mini timeline",
        "Primární akce: Příchod, Přestávka, Konec přestávky, Odchod (velké CTA)",
        "Rychlá akce: Nový denní záznam",
        "Offline banner: počet neodeslaných položek + tlačítko Fronta"
      ],
      "testids": [
        "today-shift-state",
        "today-hours-total",
        "today-arrival-button",
        "today-break-start-button",
        "today-break-end-button",
        "today-departure-button",
        "today-new-record-button",
        "today-unsent-count"
      ]
    },

    "zapis_form": {
      "routes": ["/zapis/novy", "/zapis/:id"],
      "layout": "Wizard-like sections (Collapsible) + sticky bottom action bar.",
      "components": [
        "Form",
        "Input",
        "Textarea",
        "Select",
        "Switch",
        "Checkbox",
        "RadioGroup",
        "Collapsible",
        "Card",
        "Badge",
        "Dialog",
        "Drawer"
      ],
      "structure": [
        "1) Základ: Datum, Stroj, Objednatel, Pracoviště, Zakázka, Jízda číslo",
        "2) Časy: Směna, Servis, Prostoje + live součet (Card s velkým číslem)",
        "3) MTH: Start/End + rozdíl (2-col na desktopu)",
        "4) Kontroly před směnou (checkbox list)",
        "5) Závady: seznam + přidat závadu; severity Normal/STOP; STOP zvýraznit černá/žlutá",
        "6) Kapaliny: Nafta/Hydraulika/Olej (Input + jednotky)",
        "7) Servis/oprava: popis + kdo provedl",
        "8) Poznámky + Předání dalšímu obsluhujícímu",
        "9) Přílohy: foto účtenek, faktur, fotky stroje"
      ],
      "sticky_actions": {
        "pattern": "Bottom sticky bar (white) se 2–3 tlačítky.",
        "buttons": [
          "Uložit koncept",
          "Uložit a potvrdit",
          "Odeslat (pokud offline → zařadit do fronty)"
        ]
      },
      "revision_rule_ui": "Oprava potvrzeného záznamu vždy přes Dialog: důvod opravy + vytvořit novou revizi; historie revizí v Drawer/Sheet.",
      "testids": [
        "record-save-draft-button",
        "record-confirm-button",
        "record-sync-queue-button",
        "record-revision-reason-input",
        "record-add-attachment-button"
      ]
    },

    "zapisy_list": {
      "route": "/zapisy",
      "components": ["Tabs", "Card", "Badge", "ScrollArea", "Button"],
      "details": [
        "Tabs: Moje / Ke schválení (pro vedoucí) / Konflikty.",
        "Každý záznam jako Card row: datum + stroj + pracoviště + status badge + CTA Detail.",
        "Filtry na mobilu schovat do Sheet (ne dropdown)."
      ],
      "testids": [
        "records-tab-my",
        "records-filter-open-button",
        "records-item-card",
        "records-item-status-badge"
      ]
    },

    "dochazka": {
      "route": "/dochazka",
      "components": ["Card", "Button", "Tabs", "Dialog"],
      "details": [
        "Rychlé ověření: QR sken / GPS / Ručně.",
        "QR sken spustit jedním tlačítkem (přímý přístup ke kameře).",
        "GPS: zobrazit přesnost + poslední fix; pokud slabé, nabídnout ruční režim.",
        "Historie docházky jako list s badge stavy + možnost požádat o opravu (Dialog)."
      ],
      "testids": [
        "attendance-qr-start-button",
        "attendance-gps-capture-button",
        "attendance-manual-entry-button",
        "attendance-history-item"
      ]
    },

    "fronta": {
      "route": "/fronta",
      "components": ["Table", "Badge", "Button", "Alert"],
      "details": [
        "Seznam položek čekajících na sync.",
        "CTA: Odeslat vše / Zkusit znovu / Zobrazit chybu.",
        "Každá položka: typ (docházka/zápis), čas, status, poslední chyba."
      ],
      "testids": [
        "queue-send-all-button",
        "queue-item-row",
        "queue-item-retry-button",
        "queue-item-error"
      ]
    },

    "manager_prehled": {
      "route": "/prehled",
      "components": ["Card", "Table", "Badge", "Tabs"],
      "bento_cards": [
        "Přítomní teď",
        "Chybí šichtovnice",
        "Výjimky docházky ke schválení",
        "STOP závady otevřené",
        "Docházka vs šichtovnice (porovnání hodin)"
      ],
      "charts": {
        "library": "recharts",
        "use_cases": [
          "Stacked bar: docházka vs šichtovnice po dnech",
          "Small sparkline: počet konfliktů"
        ],
        "install": "npm i recharts",
        "notes": "Grafy jen na desktop/tablet; na mobilu zobrazit jako jednoduché metriky + tabulka."
      },
      "testids": [
        "manager-present-now-card",
        "manager-missing-timesheets-card",
        "manager-stop-faults-card"
      ]
    }
  },

  "motion_and_microinteractions": {
    "principles": [
      "Motion má potvrzovat akci (stav), ne dekorovat.",
      "Preferovat krátké transitions (150–200ms) pouze pro barvy/opacity.",
      "Žádné parallax heavy efekty (pracovní app), jen jemné entrance pro karty."
    ],
    "recommended_library": {
      "name": "framer-motion",
      "install": "npm i framer-motion",
      "usage": [
        "AnimatePresence pro Dialog/Drawer transitions",
        "Jemný slide-up pro sticky action bar při scrollu"
      ]
    },
    "patterns": [
      "CTA press: active:scale-[0.99] bez transition-all",
      "Sync banner: jemné pulsing tečky pouze když je něco ve frontě (prefers-reduced-motion respektovat)",
      "List items: hover na desktopu (bg-slate-50), na mobilu bez hover reliance"
    ]
  },

  "offline_and_sync_ux": {
    "must_have": [
      "Persistentní indikátor offline režimu + počet čekajících položek (na /dnes i v navigaci)",
      "Stavy záznamů vždy viditelné jako Badge",
      "Akce nikdy nesmí tvrdit 'odesláno', pokud je jen lokálně uložené"
    ],
    "copy_cs": {
      "offline_banner": "Jste offline. Položky se odešlou automaticky po připojení.",
      "queued": "Čeká na odeslání",
      "local": "Uloženo v telefonu",
      "retry": "Zkusit odeslat"
    }
  },

  "accessibility": {
    "targets": [
      "WCAG AA kontrast (cílit spíš na AAA pro text na slunci)",
      "Min touch target 56px; kritické CTA 64–72px",
      "Viditelný focus ring (žlutý) na klávesnici",
      "Text nikdy nesmí být jen světle šedý na bílém"
    ],
    "forms": [
      "Každé pole má Label + helper text (pokud je potřeba)",
      "Chyby zobrazit přímo pod polem + sumarizace nahoře"
    ],
    "reduced_motion": "Respektovat prefers-reduced-motion: vypnout pulsing a entrance animace."
  },

  "data_testid_convention": {
    "rule": "Všechny interaktivní prvky a klíčové info musí mít data-testid (kebab-case, role-based).",
    "examples": [
      "today-arrival-button",
      "record-confirm-button",
      "queue-send-all-button",
      "manager-stop-faults-card",
      "records-item-status-badge"
    ]
  },

  "image_urls": {
    "note": "Aplikace je primárně utilitární; obrázky používat minimálně (login/empty states).",
    "categories": [
      {
        "category": "login_header_texture",
        "description": "Jemná industriální textura (beton/asfalt) jako malý header background (<=12vh), bez rušení čitelnosti.",
        "urls": []
      },
      {
        "category": "empty_state_illustrations",
        "description": "Jednoduché monochromatické ilustrace (SVG/Lottie) pro prázdné seznamy (žádné emoji).",
        "urls": [
          "https://lottiefiles.com/featured"
        ]
      }
    ]
  },

  "instructions_to_main_agent": [
    "Upravit /app/frontend/src/App.css: odstranit demo styly CRA (App-logo, App-header). Nenechávat centrovaný layout.",
    "Upravit /app/frontend/src/index.css tokeny dle design_tokens.css_custom_properties.tokens.",
    "Navigaci (bottom bar + desktop sidebar) obalit do div s className=\"dark\" aby byla tmavá, zatímco obsah zůstane světlý.",
    "Všechny primární akce (Příchod/Odchod/Schválit) použít žluté CTA dle button_design.primary.",
    "Všechny formuláře dělat jako sekce v Collapsible + sticky bottom action bar.",
    "Používat shadcn komponenty z /src/components/ui (žádné HTML dropdown/calendar/toast).",
    "Používat sonner pro toasty (/components/ui/sonner.jsx).",
    "Všude přidat data-testid na interaktivní prvky a klíčové info.",
    "Žádné průhledné pozadí; karty bílé s border + shadow-sm.",
    "Statusy syncu zobrazovat jako Badge s mapováním ze status_badges.mapping."
  ],

  "general_ui_ux_design_guidelines_appendix": "<General UI UX Design Guidelines>  \n    - You must **not** apply universal transition. Eg: `transition: all`. This results in breaking transforms. Always add transitions for specific interactive elements like button, input excluding transforms\n    - You must **not** center align the app container, ie do not add `.App { text-align: center; }` in the css file. This disrupts the human natural reading flow of text\n   - NEVER: use AI assistant Emoji characters like`🤖🧠💭💡🔮🎯📚🎭🎬🎪🎉🎊🎁🎀🎂🍰🎈🎨🎰💰💵💳🏦💎🪙💸🤑📊📈📉💹🔢🏆🥇 etc for icons. Always use **FontAwesome cdn** or **lucid-react** library already installed in the package.json\n\n **GRADIENT RESTRICTION RULE**\nNEVER use dark/saturated gradient combos (e.g., purple/pink) on any UI element.  Prohibited gradients: blue-500 to purple 600, purple 500 to pink-500, green-500 to blue-500, red to pink etc\nNEVER use dark gradients for logo, testimonial, footer etc\nNEVER let gradients cover more than 20% of the viewport.\nNEVER apply gradients to text-heavy content or reading areas.\nNEVER use gradients on small UI elements (<100px width).\nNEVER stack multiple gradient layers in the same viewport.\n\n**ENFORCEMENT RULE:**\n    • Id gradient area exceeds 20% of viewport OR affects readability, **THEN** use solid colors\n\n**How and where to use:**\n   • Section backgrounds (not content backgrounds)\n   • Hero section header content. Eg: dark to light to dark color\n   • Decorative overlays and accent elements only\n   • Hero section with 2-3 mild color\n   • Gradients creation can be done for any angle say horizontal, vertical or diagonal\n\n- For AI chat, voice application, **do not use purple color. Use color like light green, ocean blue, peach orange etc**\n\n</Font Guidelines>\n\n- Every interaction needs micro-animations - hover states, transitions, parallax effects, and entrance animations. Static = dead. \n   \n- Use 2-3x more spacing than feels comfortable. Cramped designs look cheap.\n\n- Subtle grain textures, noise overlays, custom cursors, selection states, and loading animations: separates good from extraordinary.\n   \n- Before generating UI, infer the visual style from the problem statement (palette, contrast, mood, motion) and immediately instantiate it by setting global design tokens (primary, secondary/accent, background, foreground, ring, state colors), rather than relying on any library defaults. Don't make the background dark as a default step, always understand problem first and define colors accordingly\n    Eg: - if it implies playful/energetic, choose a colorful scheme\n           - if it implies monochrome/minimal, choose a black–white/neutral scheme\n\n**Component Reuse:**\n\t- Prioritize using pre-existing components from src/components/ui when applicable\n\t- Create new components that match the style and conventions of existing components when needed\n\t- Examine existing components to understand the project's component patterns before creating new ones\n\n**IMPORTANT**: Do not use HTML based component like dropdown, calendar, toast etc. You **MUST** always use `/app/frontend/src/components/ui/ ` only as a primary components as these are modern and stylish component\n\n**Best Practices:**\n\t- Use Shadcn/UI as the primary component library for consistency and accessibility\n\t- Import path: ./components/[component-name]\n\n**Export Conventions:**\n\t- Components MUST use named exports (export const ComponentName = ...)\n\t- Pages MUST use default exports (export default function PageName() {...})\n\n**Toasts:**\n  - Use `sonner` for toasts\"\n  - Sonner component are located in `/app/src/components/ui/sonner.tsx`\n\nUse 2–4 color gradients, subtle textures/noise overlays, or CSS-based noise to avoid flat visuals.\n</General UI UX Design Guidelines>"
}
