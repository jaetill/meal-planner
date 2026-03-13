export function btn(label, variant = 'secondary') {
  const el = document.createElement('button');
  el.type = 'button';
  el.className = `btn btn-${variant}`;
  el.textContent = label;
  return el;
}

export function input(placeholder = '', type = 'text') {
  const el = document.createElement('input');
  el.type = type;
  el.placeholder = placeholder;
  el.className = 'field';
  return el;
}

export function select(options = []) {
  const el = document.createElement('select');
  el.className = 'field';
  options.forEach(({ value, label }) => {
    const opt = document.createElement('option');
    opt.value = value;
    opt.textContent = label;
    el.appendChild(opt);
  });
  return el;
}
