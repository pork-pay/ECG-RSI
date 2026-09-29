const themeButton = document.querySelector('#theme');
let savedTheme; try { savedTheme = localStorage.getItem('ecg-rsi-theme'); } catch {}
function setTheme(dark) { document.body.classList.toggle('dark', dark); themeButton.textContent = dark ? 'Light' : 'Dark'; themeButton.setAttribute('aria-label', `Switch to ${dark ? 'light' : 'dark'} theme`); }
setTheme(savedTheme === 'dark');
themeButton.addEventListener('click', () => { const dark = !document.body.classList.contains('dark'); setTheme(dark); try { localStorage.setItem('ecg-rsi-theme', dark ? 'dark' : 'light'); } catch {} });
