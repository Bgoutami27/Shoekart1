function cart1(selectElement, productName, price) {
  const quantity = Number(selectElement.value);

  const cartItem = {
    name: productName,
    quantity,
    price: Number(price),
    total: Number((price * quantity).toFixed(2))
  };

  // Get existing cart or start new one
  const cart = JSON.parse(localStorage.getItem("cart")) || [];

  // Check if item already in cart
  const existing = cart.find(item => item.name === productName);
  if (existing) {
    existing.quantity += quantity;
    existing.total = Number((existing.quantity * existing.price).toFixed(2));
  } else {
    cart.push(cartItem);
  }

  localStorage.setItem("cart", JSON.stringify(cart));
  updateCartBadge();

  console.log("Cart:", cart);
}

function showCart(buttonSelector, lineSelector) {
  const line = document.querySelector(lineSelector);
  line.textContent = "Added";
  setTimeout(() => {
    line.textContent = "";
  }, 1500);
}

for (let i = 0; i <= 13; i++) {
  window[`show${i === 0 ? '' : i}`] = () =>
    showCart(`.Add${i === 0 ? '' : i}`, `.line${i === 0 ? '' : i}`);
}

function redirectToCart() {
  window.location.href = "cart.html";
}
window.cart = redirectToCart;

// Add badge update
function updateCartBadge() {
  const cart = JSON.parse(localStorage.getItem("cart")) || [];
  const totalItems = cart.reduce((sum, item) => sum + item.quantity, 0);
  const badge = document.getElementById("cart-badge");
  if (badge) badge.textContent = totalItems;
}
window.updateCartBadge = updateCartBadge;
document.addEventListener("DOMContentLoaded", updateCartBadge);
