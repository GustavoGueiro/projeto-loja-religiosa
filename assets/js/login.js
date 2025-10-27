// ===== Base segura (localhost vs GitHub Pages) =====
const isGhPages = location.hostname.endsWith("github.io");
const currentDir = location.pathname.replace(/\/[^\/]*$/, ""); // ex.: /, /public, /app
const BASE_PATH = isGhPages
  ? `/${location.pathname.split("/").filter(Boolean)[0]}`
  : currentDir;

const LOGIN_URL = new URL(`${BASE_PATH}/login.html`, location.origin).pathname;
const INDEX_URL = new URL(`${BASE_PATH}/index.html`, location.origin).pathname;

// ===== Ações do formulário =====
document.getElementById("formLogin").addEventListener("submit", (e) => {
  e.preventDefault();

  const usuario = document.getElementById("usuario").value || "Visitante";
  const isAdmin = document.getElementById("souAdmin").checked;

  // Guarda dados no localStorage
  localStorage.setItem("usuario", usuario);
  localStorage.setItem("role", isAdmin ? "admin" : "cliente");

  // Feedback visual temporário
  const btn = e.target.querySelector("button");
  btn.textContent = "Entrando...";
  btn.disabled = true;

  setTimeout(() => {
    btn.disabled = false;
    btn.textContent = "Entrar";
    // Redirecionamento seguro
    if (location.pathname !== INDEX_URL) location.replace(INDEX_URL);
  }, 600);
});
