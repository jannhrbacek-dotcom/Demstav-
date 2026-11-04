import React, {act} from "react";
import {createRoot} from "react-dom/client";
import {Section} from "./Section";
test("collapsible section exposes its state and preserves controlled parent data", () => {
  global.IS_REACT_ACT_ENVIRONMENT = true;
  const el = document.createElement("div"); document.body.appendChild(el);
  const root = createRoot(el);
  act(() => root.render(<Section title="Servis"><input value="Zapsaný servis" readOnly /></Section>));
  const button = el.querySelector("button");
  expect(button.getAttribute("aria-expanded")).toBe("true");
  act(() => button.click());
  expect(button.getAttribute("aria-expanded")).toBe("false");
  act(() => button.click());
  expect(el.querySelector("input").value).toBe("Zapsaný servis");
  act(() => root.unmount()); el.remove();
});
test('explanatory help starts collapsed while field errors remain visible',()=>{
 const {Field,Help}=require('./Section');const el=document.createElement('div'),root=createRoot(el);
 act(()=>root.render(<><Field label="Stroj" hint="Vyberte stroj"><input /></Field><Field label="Čas" hint="Nápověda" error="Vyplňte čas"><input /></Field></>));
 expect(el.querySelector('details').open).toBe(false);expect(el.querySelector('summary').getAttribute('aria-label')).toBe('Nápověda');expect(el.textContent).toContain('Vyplňte čas');
 act(()=>el.querySelector('summary').click());expect(el.querySelector('details').open).toBe(true);act(()=>root.unmount());
});
