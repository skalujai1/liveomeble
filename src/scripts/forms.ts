// Walidacja i wysyłka formularzy (kontakt, zgłoszenie partnera).
// Błędy przy polach (aria-invalid + aria-describedby) i podsumowanie z linkami do pól.
// Pole-pułapka: wypełnione → udajemy sukces i niczego nie wysyłamy.
// Bez FORM_ENDPOINT: po poprawnej walidacji komunikat wersji demonstracyjnej (nic nie jest wysyłane).

type Texts = {
  messages: Record<string, string>;
  success: { title: string; text: string };
};

const RX = {
  email: /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/,
  phone: /^\+?[\d\s()-]{9,20}$/,
  postcode: /^\d{2}-?\d{3}$/,
  url: /^https?:\/\/[^\s.]+\.[^\s]{2,}$/i,
};

function validNip(v: string) {
  const d = v.replace(/[\s-]/g, '');
  if (!/^\d{10}$/.test(d)) return false;
  const w = [6, 5, 7, 2, 3, 4, 5, 6, 7];
  const sum = w.reduce((a, x, i) => a + x * Number(d[i]), 0);
  return sum % 11 === Number(d[9]);
}

function setupForm(form: HTMLFormElement) {
  const t: Texts = JSON.parse(form.querySelector('[data-form-texts]')?.textContent || '{}');
  const m = t.messages;
  const summary = form.querySelector<HTMLElement>('[data-form-summary]')!;
  const result = form.querySelector<HTMLElement>('[data-form-result]')!;
  const endpoint = form.dataset.endpoint || '';

  const errorEl = (name: string) => form.querySelector<HTMLElement>(`[data-field="${name}"] .field__error`);
  const setError = (name: string, msg: string | null) => {
    const box = form.querySelector<HTMLElement>(`[data-field="${name}"]`);
    const err = errorEl(name);
    if (err) { err.textContent = msg ?? ''; err.hidden = !msg; }
    box?.querySelectorAll<HTMLElement>('input, select, textarea').forEach(c => {
      if (msg) c.setAttribute('aria-invalid', 'true');
      else c.removeAttribute('aria-invalid');
    });
  };

  const checkField = (box: HTMLElement): string | null => {
    const name = box.dataset.field!;
    const controls = [...box.querySelectorAll<HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement>('input, select, textarea')];
    if (name === 'consent') return (controls[0] as HTMLInputElement).checked ? null : m.consent;
    if (box.tagName === 'FIELDSET') {
      const any = controls.some(c => (c as HTMLInputElement).checked);
      return box.dataset.required && !any ? m.required : null;
    }
    const c = controls[0];
    const v = c.value.trim();
    if (!v) return c.required ? m.required : null;
    const max = Number(c.getAttribute('maxlength'));
    if (max && v.length > max) return m.tooLong.replace('{max}', String(max));
    const kind = c.dataset.validate;
    if (kind === 'nip') return validNip(v) ? null : m.nip;
    if (kind && kind in RX && !RX[kind as keyof typeof RX].test(v)) return m[kind];
    return null;
  };

  const boxes = () => [...form.querySelectorAll<HTMLElement>('[data-field]')];

  // Po pierwszej próbie wysyłki pole sprawdza się na bieżąco przy opuszczeniu.
  let tried = false;
  form.addEventListener('focusout', e => {
    if (!tried) return;
    const box = (e.target as Element).closest<HTMLElement>('[data-field]');
    if (box) setError(box.dataset.field!, checkField(box));
  });

  form.addEventListener('submit', async e => {
    e.preventDefault();
    tried = true;
    result.hidden = true;
    const errors: { name: string; label: string; msg: string; id: string }[] = [];
    for (const box of boxes()) {
      const msg = checkField(box);
      setError(box.dataset.field!, msg);
      if (msg) {
        const control = box.querySelector<HTMLElement>('input, select, textarea')!;
        const label = (box.querySelector('.field__label, legend')?.textContent || box.querySelector('label span')?.textContent || '').trim();
        errors.push({ name: box.dataset.field!, label, msg, id: control.id });
      }
    }
    const list = summary.querySelector('ul')!;
    list.replaceChildren(...errors.map(er => {
      const li = document.createElement('li');
      const a = document.createElement('a');
      a.href = `#${er.id}`;
      a.textContent = `${er.label}: ${er.msg}`;
      a.addEventListener('click', ev => { ev.preventDefault(); document.getElementById(er.id)?.focus(); });
      li.append(a);
      return li;
    }));
    summary.hidden = errors.length === 0;
    if (errors.length) {
      summary.focus();
      return;
    }

    const data = Object.fromEntries(
      [...new FormData(form).entries()].reduce((map, [k, v]) => {
        const prev = map.get(k);
        map.set(k, prev === undefined ? String(v) : ([] as string[]).concat(prev, String(v)));
        return map;
      }, new Map<string, string | string[]>()),
    );
    const email = String(data.email ?? '');
    const showResult = (ok: boolean, text: string, title?: string) => {
      result.classList.toggle('form__result--error', !ok);
      result.replaceChildren();
      if (title) {
        const p = document.createElement('p');
        const s = document.createElement('strong');
        s.textContent = title;
        p.append(s);
        result.append(p);
      }
      const p2 = document.createElement('p');
      p2.textContent = text;
      result.append(p2);
      result.hidden = false;
      result.focus();
    };
    const successText = t.success.text.replace('{email}', email);

    if (data.fax_number) { // pole-pułapka: bot
      form.reset();
      showResult(true, successText, t.success.title);
      return;
    }
    delete data.fax_number;
    if (!endpoint) {
      // Wersja demonstracyjna: dane poprawne, ale nic nie wysyłamy — tytuł nie może mówić „wysłana”.
      showResult(true, m.demo, 'Dane są poprawne (DEMO)');
      return;
    }
    const btn = form.querySelector<HTMLButtonElement>('button[type="submit"]');
    const label = btn?.textContent ?? '';
    if (btn) { btn.disabled = true; btn.textContent = m.sending; }
    try {
      const res = await fetch(endpoint, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(data) });
      if (res.status === 422) {
        const j = await res.json().catch(() => ({}));
        for (const [name, msg] of Object.entries<string>(j.errors || {})) setError(name, msg);
        throw new Error('walidacja');
      }
      if (!res.ok) throw new Error(String(res.status));
      form.reset();
      showResult(true, successText, t.success.title);
    } catch {
      showResult(false, m.error);
    } finally {
      if (btn) { btn.disabled = false; btn.textContent = label; }
    }
  });
}

export function initForms() {
  document.querySelectorAll<HTMLFormElement>('form[data-form]').forEach(setupForm);
}
