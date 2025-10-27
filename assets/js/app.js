console.log('[app] boot ok');

/* ===== Paths base (para GitHub Pages ou local) ===== */
const isGhPages = location.hostname.endsWith("github.io");
const currentDir = location.pathname.replace(/\/[^\/]*$/, "");
const BASE_PATH = isGhPages
  ? `/${location.pathname.split("/").filter(Boolean)[0]}`
  : currentDir;

const LOGIN_URL = new URL(`${BASE_PATH}/login.html`, location.origin).pathname;
const INDEX_URL = new URL(`${BASE_PATH}/index.html`, location.origin).pathname;

/* ===== API base por ambiente ===== */
const isLocal = location.hostname === "localhost" || location.hostname === "127.0.0.1";
const API_BASE = isLocal
  ? "http://127.0.0.1:8080"         // back local
  : "https://api-loja-religiosa.onrender.com";

/* ===== Utilitários ===== */
const show = el => el?.classList.remove("hidden");
const hide = el => el?.classList.add("hidden");
const formatBRL = n => n.toLocaleString("pt-BR", { style: "currency", currency: "BRL" });

function toast(msg, ms = 1800) {
  const t = document.createElement("div");
  t.textContent = msg;
  t.style.cssText = `
    position:fixed;left:50%;bottom:22px;transform:translateX(-50%);
    background:#0ea5e9;color:#fff;padding:10px 14px;border-radius:10px;
    box-shadow:0 10px 20px rgba(2,6,23,.2);z-index:9999;font-weight:700
  `;
  document.body.appendChild(t);
  setTimeout(() => t.remove(), ms);
}

/* ============================================================
   CARRINHO
=============================================================== */
const CART_KEY = "carrinho";

function readCart() {
  try { return JSON.parse(localStorage.getItem(CART_KEY)) || []; }
  catch { return []; }
}
function saveCart(cart) {
  localStorage.setItem(CART_KEY, JSON.stringify(cart));
  updateCartCount();
}
function cartCount() {
  return readCart().reduce((acc, it) => acc + it.qtd, 0);
}
function updateCartCount() {
  const el = document.getElementById("cart-count");
  if (el) el.textContent = String(cartCount());
}
function addToCart(prod, qtd = 1) {
  const cart = readCart();
  const idx = cart.findIndex(i => String(i.id) === String(prod.id));
  if (idx >= 0) cart[idx].qtd += qtd;
  else cart.push({ id: String(prod.id), nome: prod.nome, preco: Number(prod.preco), imagem: prod.imagem || "", qtd });
  saveCart(cart);
  renderCartTable();
  toast("Adicionado ao carrinho ✓");
}
function setQty(id, qtd) {
  const cart = readCart().map(i => String(i.id) === String(id) ? { ...i, qtd: Math.max(1, qtd) } : i);
  saveCart(cart);
  renderCartTable();
}
function incQty(id, delta) {
  const cart = readCart().map(i => String(i.id) === String(id) ? { ...i, qtd: Math.max(1, i.qtd + delta) } : i);
  saveCart(cart);
  renderCartTable();
}
function removeItem(id) {
  const cart = readCart().filter(i => String(i.id) !== String(id));
  saveCart(cart);
  renderCartTable();
  toast("Removido do carrinho 🗑️");
}
function cartTotal() {
  return readCart().reduce((acc, it) => acc + it.preco * it.qtd, 0);
}

/* ============================================================
   CUPOM DE DESCONTO
=============================================================== */
const CUPONS = { BEMVINDO10: 0.10, FIDELIDADE20: 0.20 };

function totalComDesconto() {
  const subtotal = cartTotal();
  const code = (localStorage.getItem("cupom") || "").toUpperCase();
  const off = CUPONS[code] || 0;
  return { subtotal, desconto: subtotal * off, total: subtotal * (1 - off), code };
}

/* ============================================================
   CATÁLOGO + BUSCA / FILTRO
=============================================================== */
function normalize(s) {
  return (s || "").toString().toLowerCase().normalize("NFD").replace(/\p{Diacritic}/gu, "");
}


function resolveImgPath(raw) {
  const val = String(raw || '').trim();
  if (!val) return `${BASE_PATH}/assets/img/placeholder-600x450.png`; // opcional

  
  if (/^https?:\/\//i.test(val)) return val;

  
  if (val.startsWith('/')) return val;

  
  if (val.startsWith('assets/')) return `${BASE_PATH}/${val}`;

  
  return `${BASE_PATH}/assets/img/produtos/${val}`;
}

async function carregarProdutos() {
  console.log('[catalog] fetching:', `${API_BASE}/produtos`);

  try {
    const res = await fetch(`${API_BASE}/produtos`, {
      cache: "no-store",
      headers: { "Accept": "application/json" }
    });

    console.log('[catalog] status:', res.status);

    if (!res.ok) throw new Error(`HTTP ${res.status}`);

    const data = await res.json();
    console.log('[catalog] resposta bruta:', data);

    // Corrige o formato (para aceitar tanto [array] quanto { produtos: [...] })
    const produtos = Array.isArray(data)
      ? data
      : (data && Array.isArray(data.produtos) ? data.produtos : null);

    if (!produtos) throw new Error("Formato inesperado de resposta da API");

    // Guarda global para busca, filtros e carrinho
    window.__produtos = produtos;

    console.log('[catalog] produtos recebidos:', produtos.length);
    renderCatalog(produtos);

  } catch (err) {
    console.error('[catalog] falha ao carregar produtos:', err);

    const el = document.getElementById("produtos");
    if (el) {
      el.innerHTML = `
        <p class="error">
          ❌ Erro ao carregar produtos.<br>
          Verifique se a API está rodando em <code>${API_BASE}</code>.<br>
          <small>${err.message}</small>
        </p>`;
    }
  }
}

window.carregarProdutos = carregarProdutos;

function renderCatalog(list) {
  const el = document.getElementById("produtos");
  if (!el) return;

  const q = normalize(document.getElementById("q")?.value);
  const ord = document.getElementById("ord")?.value || "nome-asc";

  let produtos = Array.isArray(list) ? [...list] : [];

  if (q) {
    produtos = produtos.filter(p =>
      normalize(`${p.nome} ${p.descricao || ""}`).includes(q)
    );
  }

  if (ord === "nome-asc")  produtos.sort((a, b) => a.nome.localeCompare(b.nome));
  if (ord === "preco-asc") produtos.sort((a, b) => a.preco - b.preco);
  if (ord === "preco-desc")produtos.sort((a, b) => b.preco - a.preco);

  if (!produtos.length) {
    el.innerHTML = `<p class="muted">Nenhum produto encontrado.</p>`;
    return;
  }

  el.innerHTML = produtos.map(p => {
    const imgSrc = resolveImgPath(p.imagem);
    const alt    = p.nome || 'Produto';

    return `
      <div class="card" data-id="${p.id}">
        <div class="thumb">
          <img loading="lazy"
               src="${imgSrc}"
               alt="${alt}"
               onerror="this.onerror=null; this.src='https://picsum.photos/seed/erro/600/450'">
        </div>
        <h3>${p.nome}</h3>
        <p>${p.descricao ?? ""}</p>
        <div class="meta">
          <span class="price">${formatBRL(Number(p.preco))}</span>
          <button class="btn btn-add" type="button" data-id="${p.id}">Adicionar</button>
        </div>
      </div>`;
  }).join("");
}


/* ============================================================
   MODAL DE DETALHES
=============================================================== */
function openProductModal(p) {
  const wrap = document.createElement("div");
  wrap.innerHTML = `
    <div style="position:fixed;inset:0;background:rgba(0,0,0,.4)"></div>
    <div style="position:fixed;inset:0;display:grid;place-items:center">
      <div style="background:#fff;padding:18px;border-radius:16px;max-width:560px;width:90%;box-shadow:0 10px 30px rgba(2,6,23,.25)">
        <h3>${p.nome}</h3>
        <img src="${p.imagem}" alt="${p.nome}" style="width:100%;border-radius:12px;object-fit:cover;max-height:260px"/>
        <p style="color:#475569">${p.descricao ?? ""}</p>
        <div style="display:flex;justify-content:space-between;align-items:center">
          <strong>${formatBRL(p.preco)}</strong>
          <button class="btn" id="modalAdd">Adicionar ao carrinho</button>
        </div>
      </div>
    </div>`;
  wrap.onclick = e => { if (e.target === wrap.firstChild) wrap.remove(); };
  wrap.querySelector("#modalAdd").onclick = () => { addToCart(p, 1); wrap.remove(); };
  document.body.appendChild(wrap);
}

/* ============================================================
   CARRINHO + CUPOM
=============================================================== */
function renderCartTable() {
  const tbody = document.getElementById("cart-body");
  const empty = document.getElementById("cart-empty");
  const totalEl = document.getElementById("cart-total");
  if (!tbody || !empty || !totalEl) return;

  const cart = readCart();
  if (cart.length === 0) {
    show(empty);
    tbody.innerHTML = "";
    totalEl.textContent = formatBRL(0);
    updateCartCount();
    return;
  }
  hide(empty);

  tbody.innerHTML = cart.map(item => `
    <tr>
      <td class="cell-product">
        <img src="${item.imagem}" alt="${item.nome}" class="thumb-sm">
        <strong>${item.nome}</strong>
      </td>
      <td>${formatBRL(item.preco)}</td>
      <td>
        <div class="qty">
          <button class="btn btn-qtd" data-act="dec" data-id="${item.id}">−</button>
          <input type="number" min="1" value="${item.qtd}" data-id="${item.id}" class="inp-qtd">
          <button class="btn btn-qtd" data-act="inc" data-id="${item.id}">+</button>
        </div>
      </td>
      <td>${formatBRL(item.preco * item.qtd)}</td>
      <td><button class="btn btn-danger" data-act="rm" data-id="${item.id}">Remover</button></td>
    </tr>`).join("");

  const t = totalComDesconto();
  totalEl.textContent = t.desconto > 0
    ? `${formatBRL(t.total)} (−${formatBRL(t.desconto)} com ${t.code})`
    : formatBRL(cartTotal());
  updateCartCount();
}

/* ============================================================
   DASHBOARD
=============================================================== */
function desenharGraficoVendas() {
  const ctx = document.getElementById("chartVendas");
  if (!ctx) return;
  if (window.__graficoVendas) window.__graficoVendas.destroy();
  window.__graficoVendas = new Chart(ctx, {
    type: "bar",
    data: {
      labels: ["Jan","Fev","Mar","Abr","Mai","Jun"],
      datasets: [{ label: "Vendas (R$)", data: [1200,1750,1600,2100,1950,2500], backgroundColor: "#0ea5e9" }]
    },
    options: { responsive: true, scales: { y: { beginAtZero: true } } }
  });
}

/* ============================================================
   ROTAS (HASH ROUTER)
=============================================================== */
function go(path) { location.hash = `#/${path}`; }

function mostrarCatalogo(){
  show(document.getElementById('toolbar'));
  show(document.getElementById('produtos'));
  hide(document.getElementById('sec-carrinho'));
  hide(document.getElementById('sec-dashboard'));
}

function mostrarCarrinho(){
  hide(document.getElementById('toolbar'));
  hide(document.getElementById('produtos'));
  show(document.getElementById('sec-carrinho'));
  hide(document.getElementById('sec-dashboard'));
  renderCartTable();
}

function mostrarDashboard(){
  hide(document.getElementById('toolbar'));
  hide(document.getElementById('produtos'));
  hide(document.getElementById('sec-carrinho'));
  show(document.getElementById('sec-dashboard'));
  desenharGraficoVendas();
}

function handleRoute() {
  const r = location.hash.replace(/^#\//, "");
  if (r === "carrinho") return mostrarCarrinho();
  if (r === "dashboard") return mostrarDashboard();
  return mostrarCatalogo();
}
window.addEventListener("hashchange", handleRoute);

// ============================================================
// INICIALIZAÇÃO (executa quando o DOM termina de carregar)
// ============================================================
document.addEventListener('DOMContentLoaded', () => {
  console.log('[boot] DOM pronto; carregando catálogo…');

  // Atualiza o contador do carrinho (se existir)
  if (typeof updateCartCount === 'function') {
    updateCartCount();
  }

  // Chama o catálogo assim que a página carrega
  if (typeof carregarProdutos === 'function') {
    carregarProdutos()
      .then(() => console.log('[catalog] carregado:', (window.__produtos || []).length, 'itens'))
      .catch(err => console.error('[catalog] erro ao carregar:', err))
      .finally(() => console.log('[boot] carregarProdutos() terminou'));
  } else {
    console.error('[boot] Função carregarProdutos não encontrada!');
  }

  // Aplica a rota inicial (caso tenha hash routing)
  if (typeof handleRoute === 'function') {
    handleRoute();
  }
});


/* ============================================================
   INICIALIZAÇÃO
=============================================================== */
document.addEventListener("DOMContentLoaded", () => {
  // Bem-vindo
  const usuario = localStorage.getItem("usuario");
  const role = localStorage.getItem("role") || "cliente";
  if (!usuario) {
    const w = document.getElementById("welcome-name");
    const r = document.getElementById("role-label");
    if (w) w.textContent = "Visitante";
    if (r) r.textContent = "Cliente";
  } else {
    document.getElementById("welcome-name").textContent = usuario;
    document.getElementById("role-label").textContent = role === "admin" ? "Administrador" : "Cliente";
  }

  // Botões laterais
  document.getElementById("btnSair").onclick = () => {
    localStorage.clear();
    location.replace(LOGIN_URL);
  };
  document.getElementById("btnInicio")?.addEventListener("click", () => go("catalogo"));
  document.getElementById("btnCatalogo")?.addEventListener("click", () => go("catalogo"));
  document.getElementById("btnCarrinho")?.addEventListener("click", () => go("carrinho"));

  const btnDash = document.getElementById("btnDashboard");
  if (btnDash) {
    if (usuario && role === "admin") { btnDash.style.display = ""; btnDash.onclick = () => go("dashboard"); }
    else btnDash.style.display = "none";
  }

  // Eventos catálogo (clique em card e botão "Adicionar")
  document.getElementById("produtos")?.addEventListener("click", ev => {
    const btn = ev.target.closest(".btn-add");
    if (btn) {
      const id = btn.dataset.id;
      const prod = (window.__produtos || []).find(p => String(p.id) === String(id));
      if (!prod) return alert("Produto não encontrado.");
      addToCart(prod, 1);
      btn.textContent = "Adicionado ✓";
      setTimeout(() => (btn.textContent = "Adicionar"), 900);
      return;
    }
    const card = ev.target.closest(".card");
    if (card && !ev.target.closest(".btn-add")) {
      const p = (window.__produtos || []).find(x => String(x.id) === card.dataset.id);
      if (p) openProductModal(p);
    }
  });

  // Busca/ordenação
  document.getElementById("q")?.addEventListener("input", () => {
    if (Array.isArray(window.__produtos)) renderCatalog(window.__produtos);
  });
  document.getElementById("ord")?.addEventListener("change", () => {
    if (Array.isArray(window.__produtos)) renderCatalog(window.__produtos);
  });

  // Carrinho
  document.getElementById("btnContinuar")?.addEventListener("click", () => go("catalogo"));
  document.getElementById("btnCheckout")?.addEventListener("click", () => {
    const t = totalComDesconto();
    alert(`Checkout 🤍\nTotal: ${formatBRL(t.total)}`);
  });
  document.getElementById("sec-carrinho")?.addEventListener("click", ev => {
    const b = ev.target.closest("button");
    if (!b) return;
    const id = b.dataset.id;
    if (b.dataset.act === "inc") incQty(id, +1);
    if (b.dataset.act === "dec") incQty(id, -1);
    if (b.dataset.act === "rm") removeItem(id);
  });
  document.getElementById("sec-carrinho")?.addEventListener("change", ev => {
    const inp = ev.target.closest(".inp-qtd");
    if (!inp) return;
    const id = inp.dataset.id;
    setQty(id, Math.max(1, Number(inp.value || 1)));
  });
  document.getElementById("btnCupom")?.addEventListener("click", () => {
    const code = document.getElementById("cupom").value.trim().toUpperCase();
    if (!CUPONS[code]) return toast("Cupom inválido 😕");
    localStorage.setItem("cupom", code);
    toast("Cupom aplicado 🎉");
    renderCartTable();
  });

  // Boot
  updateCartCount();
  carregarProdutos();   // agora a chamada à API sempre dispara
  handleRoute();        // aplica a rota inicial (mostra catálogo por padrão)
});
