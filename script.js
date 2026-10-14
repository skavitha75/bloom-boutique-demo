const menuToggle = document.querySelector(".menu-toggle");
const navLinks = document.querySelector(".nav-links");
const productCards = [...document.querySelectorAll(".product-card")];
const productGrid = document.querySelector(".product-grid");
const productDialog = document.querySelector(".product-dialog");
const cartDialog = document.querySelector(".cart-dialog");
const toast = document.querySelector(".toast");
const currency = new Intl.NumberFormat("en-US", {
  style: "currency",
  currency: "USD",
});
const whatsappContact = document.querySelector(".button-light[href^='https://wa.me/']");
const whatsappPhone = whatsappContact?.dataset.whatsappPhone || "15551234567";
let activeCard = null;
let activeCategory = "all";
let showSavedOnly = false;
let toastTimeout;

function showToast(message) {
  if (!toast) return;
  toast.textContent = message;
  toast.classList.add("is-visible");
  window.clearTimeout(toastTimeout);
  toastTimeout = window.setTimeout(() => toast.classList.remove("is-visible"), 2600);
}

function readStoredValue(key, fallback, isValid) {
  try {
    const storedValue = localStorage.getItem(key);
    if (storedValue === null) return fallback;
    const parsedValue = JSON.parse(storedValue);
    if (!isValid(parsedValue)) throw new Error("Stored shopping data has an unexpected format.");
    return parsedValue;
  } catch (error) {
    console.error(`Could not load ${key} from browser storage.`, error);
    showToast("Your saved demo shopping data could not be loaded.");
    return fallback;
  }
}

let cart = readStoredValue(
  "bloom-boutique-cart",
  [],
  (value) =>
    Array.isArray(value) &&
    value.every(
      (item) =>
        item &&
        typeof item.id === "string" &&
        typeof item.name === "string" &&
        typeof item.price === "number" &&
        Number.isFinite(item.price) &&
        Number.isInteger(item.quantity) &&
        item.quantity > 0,
    ),
);
let wishlist = readStoredValue(
  "bloom-boutique-wishlist",
  [],
  (value) => Array.isArray(value) && value.every((item) => typeof item === "string"),
);

function saveStoredValue(key, value) {
  try {
    localStorage.setItem(key, JSON.stringify(value));
    return true;
  } catch (error) {
    console.error(`Could not save ${key} in browser storage.`, error);
    showToast("Changes are temporary because browser storage is unavailable.");
    return false;
  }
}

function productId(card) {
  return card.querySelector("h3").textContent.trim().toLowerCase().replace(/[^a-z0-9]+/g, "-");
}

function syncSavedButtons() {
  productCards.forEach((card) => {
    const saved = wishlist.includes(productId(card));
    const button = card.querySelector("[data-action='toggle-wishlist']");
    button.setAttribute("aria-pressed", String(saved));
    button.setAttribute("aria-label", `${saved ? "Remove" : "Save"} ${card.querySelector("h3").textContent}`);
    button.textContent = saved ? "♥" : "♡";
  });

  document.querySelector(".saved-count").textContent = String(wishlist.length);
  document.querySelector(".wishlist-filter").setAttribute("aria-pressed", String(showSavedOnly));
}

function updateCartCount() {
  const count = cart.reduce((total, item) => total + item.quantity, 0);
  const countLabel = document.querySelector(".bag-count");
  countLabel.textContent = String(count);
  countLabel.setAttribute("aria-label", `${count} ${count === 1 ? "item" : "items"} in bag`);
  document.querySelector(".cart-title-count").textContent = count ? `(${count})` : "";
}

function makeCartItem(item) {
  const row = document.createElement("article");
  row.className = "cart-item";

  const image = document.createElement("img");
  image.src = item.image;
  image.alt = "";
  image.loading = "lazy";
  row.append(image);

  const details = document.createElement("div");
  details.className = "cart-item-details";

  const name = document.createElement("h3");
  name.textContent = item.name;
  const variants = document.createElement("p");
  variants.textContent = [item.size, item.color].filter(Boolean).join(" · ");
  const price = document.createElement("strong");
  price.textContent = currency.format(item.price * item.quantity);
  details.append(name, variants, price);

  const quantity = document.createElement("div");
  quantity.className = "quantity-control";
  quantity.setAttribute("aria-label", `Quantity for ${item.name}`);
  const decrease = document.createElement("button");
  decrease.type = "button";
  decrease.dataset.cartAction = "decrease";
  decrease.dataset.id = item.id;
  decrease.setAttribute("aria-label", `Remove one ${item.name}`);
  decrease.textContent = "−";
  const quantityLabel = document.createElement("span");
  quantityLabel.textContent = String(item.quantity);
  const increase = document.createElement("button");
  increase.type = "button";
  increase.dataset.cartAction = "increase";
  increase.dataset.id = item.id;
  increase.setAttribute("aria-label", `Add one ${item.name}`);
  increase.textContent = "+";
  const remove = document.createElement("button");
  remove.type = "button";
  remove.className = "remove-item";
  remove.dataset.cartAction = "remove";
  remove.dataset.id = item.id;
  remove.setAttribute("aria-label", `Remove ${item.name} from bag`);
  remove.textContent = "Remove";
  quantity.append(decrease, quantityLabel, increase, remove);

  row.append(details, quantity);
  return row;
}

function renderCart() {
  const itemsContainer = document.querySelector("#cart-items");
  const hasItems = cart.length > 0;
  itemsContainer.replaceChildren(...cart.map(makeCartItem));
  document.querySelector("#cart-empty").hidden = hasItems;
  document.querySelector("#cart-footer").hidden = !hasItems;
  document.querySelector("#cart-subtotal").textContent = currency.format(
    cart.reduce((total, item) => total + item.price * item.quantity, 0),
  );
  updateCartCount();
}

function applyProductControls() {
  const search = document.querySelector("#product-search").value.trim().toLowerCase();
  const sort = document.querySelector("#product-sort").value;
  const visibleCards = [];

  productCards.forEach((card) => {
    const searchableText = `${card.querySelector("h3").textContent} ${card.querySelector(".product-type").textContent}`.toLowerCase();
    const matchesSearch = searchableText.includes(search);
    const matchesCategory = activeCategory === "all" || card.dataset.category === activeCategory;
    const matchesSaved = !showSavedOnly || wishlist.includes(productId(card));
    const visible = matchesSearch && matchesCategory && matchesSaved;
    card.hidden = !visible;
    if (visible) visibleCards.push(card);
  });

  visibleCards.sort((first, second) => {
    if (sort === "price-low") return Number(first.dataset.price) - Number(second.dataset.price);
    if (sort === "price-high") return Number(second.dataset.price) - Number(first.dataset.price);
    if (sort === "name") {
      return first.querySelector("h3").textContent.localeCompare(second.querySelector("h3").textContent);
    }
    return productCards.indexOf(first) - productCards.indexOf(second);
  });
  visibleCards.forEach((card) => productGrid.append(card));

  const count = visibleCards.length;
  document.querySelector(".results-count").textContent =
    count === 0 ? "No lovely finds match just yet" : `Showing ${count} ${count === 1 ? "lovely find" : "lovely finds"}`;
  document.querySelector(".empty-products").hidden = count > 0;
}

function updateProductEnquiry() {
  if (!activeCard || !whatsappContact) return;
  const name = activeCard.querySelector("h3").textContent.trim();
  const size = document.querySelector("#product-size").value;
  const color = document.querySelector("#product-color").value;
  const price = currency.format(Number(activeCard.dataset.price));
  const details = [size !== "One size" ? `Size: ${size}` : "", `Color: ${color}`].filter(Boolean);
  const message = `Hi Bloom Boutique! I'm interested in the ${name} (${details.join(", ")}). Listed price: ${price}. Is it available?`;
  document.querySelector("#product-enquiry").href =
    `https://wa.me/${whatsappPhone}?text=${encodeURIComponent(message)}`;
}

function openProductDialog(card) {
  activeCard = card;
  const image = card.querySelector("img");
  const name = card.querySelector("h3").textContent.trim();
  const colors = card.dataset.colors.split(",").map((color) => color.trim());
  const isAccessory = card.dataset.category === "accessories";
  const sizeField = document.querySelector("#size-field");
  const sizeSelect = document.querySelector("#product-size");
  const colorSelect = document.querySelector("#product-color");

  document.querySelector("#dialog-product-name").textContent = name;
  document.querySelector("#dialog-product-price").textContent = currency.format(Number(card.dataset.price));
  document.querySelector("#dialog-product-description").textContent = card.querySelector(".product-type").textContent;
  document.querySelector("#dialog-product-image").src = image.src;
  document.querySelector("#dialog-product-image").alt = image.alt;
  sizeField.hidden = isAccessory;
  sizeSelect.replaceChildren();
  (isAccessory ? ["One size"] : ["XS", "S", "M", "L", "XL"]).forEach((size) => {
    const option = document.createElement("option");
    option.value = size;
    option.textContent = size;
    sizeSelect.append(option);
  });
  colorSelect.replaceChildren();
  colors.forEach((color) => {
    const option = document.createElement("option");
    option.value = color;
    option.textContent = color;
    colorSelect.append(option);
  });

  if (typeof productDialog.showModal === "function") {
    productDialog.showModal();
    updateProductEnquiry();
  } else {
    showToast("Product details are not supported by this browser.");
  }
}

function openCart() {
  if (menuToggle && navLinks) {
    menuToggle.setAttribute("aria-expanded", "false");
    menuToggle.setAttribute("aria-label", "Open navigation menu");
    navLinks.classList.remove("is-open");
  }
  renderCart();
  if (typeof cartDialog.showModal === "function") cartDialog.showModal();
  else showToast("The shopping bag is not supported by this browser.");
}

if (menuToggle && navLinks) {
  menuToggle.addEventListener("click", () => {
    const isExpanded = menuToggle.getAttribute("aria-expanded") === "true";
    menuToggle.setAttribute("aria-expanded", String(!isExpanded));
    menuToggle.setAttribute("aria-label", isExpanded ? "Open navigation menu" : "Close navigation menu");
    navLinks.classList.toggle("is-open", !isExpanded);
  });

  navLinks.addEventListener("click", (event) => {
    if (event.target instanceof HTMLAnchorElement) {
      menuToggle.setAttribute("aria-expanded", "false");
      menuToggle.setAttribute("aria-label", "Open navigation menu");
      navLinks.classList.remove("is-open");
    }
  });
}

document.querySelectorAll("[data-close-dialog]").forEach((button) => {
  button.addEventListener("click", () => button.closest("dialog").close());
});

document.querySelectorAll("[data-open-cart]").forEach((button) => button.addEventListener("click", openCart));

document.querySelector(".product-grid").addEventListener("click", (event) => {
  const button = event.target.closest("button[data-action]");
  if (!button) return;
  const card = button.closest(".product-card");

  if (button.dataset.action === "quick-view") {
    openProductDialog(card);
    return;
  }

  const id = productId(card);
  wishlist = wishlist.includes(id) ? wishlist.filter((savedId) => savedId !== id) : [...wishlist, id];
  saveStoredValue("bloom-boutique-wishlist", wishlist);
  syncSavedButtons();
  applyProductControls();
  showToast(wishlist.includes(id) ? "Saved to your little list." : "Removed from your saved list.");
});

document.querySelector("[data-add-to-bag]").addEventListener("click", () => {
  if (!activeCard) return;
  const name = activeCard.querySelector("h3").textContent.trim();
  const size = activeCard.dataset.category === "accessories" ? "" : document.querySelector("#product-size").value;
  const color = document.querySelector("#product-color").value;
  const id = [productId(activeCard), size, color].join("|");
  const existingItem = cart.find((item) => item.id === id);

  if (existingItem) existingItem.quantity += 1;
  else {
    cart.push({
      id,
      name,
      price: Number(activeCard.dataset.price),
      size,
      color,
      quantity: 1,
      image: activeCard.querySelector("img").src,
    });
  }

  saveStoredValue("bloom-boutique-cart", cart);
  renderCart();
  productDialog.close();
  showToast(`${name} added to your demo bag.`);
});

document.querySelector("#cart-items").addEventListener("click", (event) => {
  const button = event.target.closest("button[data-cart-action]");
  if (!button) return;
  const item = cart.find((cartItem) => cartItem.id === button.dataset.id);
  if (!item) return;

  if (button.dataset.cartAction === "remove") cart = cart.filter((cartItem) => cartItem.id !== item.id);
  if (button.dataset.cartAction === "decrease") {
    item.quantity -= 1;
    if (item.quantity <= 0) cart = cart.filter((cartItem) => cartItem.id !== item.id);
  }
  if (button.dataset.cartAction === "increase") item.quantity += 1;
  saveStoredValue("bloom-boutique-cart", cart);
  renderCart();
});

document.querySelectorAll(".filter-chip").forEach((button) => {
  button.addEventListener("click", () => {
    activeCategory = button.dataset.category;
    document.querySelectorAll(".filter-chip").forEach((chip) => {
      const active = chip === button;
      chip.classList.toggle("is-active", active);
      chip.setAttribute("aria-pressed", String(active));
    });
    applyProductControls();
  });
});

document.querySelector("#product-search").addEventListener("input", applyProductControls);
document.querySelector("#product-sort").addEventListener("change", applyProductControls);
document.querySelector("[data-toggle-saved]").addEventListener("click", (event) => {
  showSavedOnly = !showSavedOnly;
  event.currentTarget.setAttribute("aria-pressed", String(showSavedOnly));
  applyProductControls();
});

document.querySelector("[data-reset-products]").addEventListener("click", () => {
  activeCategory = "all";
  showSavedOnly = false;
  document.querySelector("#product-search").value = "";
  document.querySelector("#product-sort").value = "featured";
  document.querySelectorAll(".filter-chip").forEach((chip) => {
    const active = chip.dataset.category === "all";
    chip.classList.toggle("is-active", active);
    chip.setAttribute("aria-pressed", String(active));
  });
  syncSavedButtons();
  applyProductControls();
});

document.querySelector("#product-size").addEventListener("change", updateProductEnquiry);
document.querySelector("#product-color").addEventListener("change", updateProductEnquiry);

if (whatsappContact) {
  whatsappContact.href = `https://wa.me/${whatsappPhone}?text=${encodeURIComponent("Hi Bloom Boutique! I'd love to know more.")}`;
}

syncSavedButtons();
renderCart();
applyProductControls();

const year = document.querySelector("#year");
if (year) year.textContent = String(new Date().getFullYear());