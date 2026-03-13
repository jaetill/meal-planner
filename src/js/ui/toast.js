function toast(message, type = 'info') {
  const container = document.getElementById('toast-container');
  const el = document.createElement('div');
  el.className = `toast toast-${type}`;
  el.textContent = message;
  container.appendChild(el);
  setTimeout(() => el.remove(), 3000);
}

export const toastSuccess = msg => toast(msg, 'success');
export const toastError   = msg => toast(msg, 'error');
export const toastInfo    = msg => toast(msg, 'info');
