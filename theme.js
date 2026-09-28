const THEME_STORAGE_KEY = 'dharanirman-theme';

function applyTheme(theme) {
  document.documentElement.dataset.theme = theme;
  document.querySelectorAll('[data-theme-toggle]').forEach(button => {
    const isDark = theme === 'dark';
    button.textContent = isDark ? 'Light mode' : 'Dark mode';
    button.setAttribute('aria-pressed', String(isDark));
    button.setAttribute('aria-label', `Switch to ${isDark ? 'light' : 'dark'} mode`);
  });
}

function toggleTheme() {
  const nextTheme = document.documentElement.dataset.theme === 'dark' ? 'light' : 'dark';
  localStorage.setItem(THEME_STORAGE_KEY, nextTheme);
  applyTheme(nextTheme);
}

function initializeTheme() {
  const savedTheme = localStorage.getItem(THEME_STORAGE_KEY);
  const theme = savedTheme === 'dark' ? 'dark' : 'light';
  document.documentElement.dataset.theme = theme;

  const button = document.createElement('button');
  button.type = 'button';
  button.className = 'theme-toggle';
  button.dataset.themeToggle = '';
  button.addEventListener('click', toggleTheme);
  document.body.appendChild(button);
  applyTheme(theme);
}

if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', initializeTheme, { once: true });
} else {
  initializeTheme();
}
