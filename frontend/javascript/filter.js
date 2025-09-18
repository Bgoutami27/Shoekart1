async function applyFilters() {
  const priceMin = document.getElementById("priceMin").value;
  const priceMax = document.getElementById("priceMax").value;
  const size = document.getElementById("size").value;
  const rating = document.getElementById("rating").value;
  const brand = document.getElementById("brand").value;
  const color = document.getElementById("color").value;

  let url = `http://localhost:3000/products?category=women`;

  if (priceMin) url += `&priceMin=${priceMin}`;
  if (priceMax) url += `&priceMax=${priceMax}`;
  if (size) url += `&size=${size}`;
  if (rating) url += `&rating=${rating}`;
  if (brand) url += `&brand=${brand}`;
  if (color) url += `&color=${color}`;

  try {
    const res = await fetch(url);
    if (!res.ok) throw new Error("Failed to fetch products");
    const products = await res.json();
    displayProducts(products);
  } catch (error) {
    console.error("Error fetching filtered products:", error);
  }
}


function displayProducts(products) {
  // ✅ update same grid used for normal products
  const container = document.getElementById("productGrid");
  container.innerHTML = "";

  if (products.length === 0) {
    container.innerHTML = "<p>No products found.</p>";
    return;
  }

  products.forEach((p) => {
    const card = document.createElement("div");
    card.className = "product-card";
    card.innerHTML = `
      <img src="http://localhost:3000${p.image}" alt="${p.name}" />
      <h3>${p.name}</h3>
      <div class="price">₹${p.price}</div>
      <p>Rating: ${p.rating || 'N/A'} ★</p>
    `;
    container.appendChild(card);
  });
}
