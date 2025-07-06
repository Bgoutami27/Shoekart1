const productList = document.getElementById('product-list');
const addForm = document.getElementById('addForm');

async function fetchProducts() {
  const res = await fetch('/admin/products');
  const products = await res.json();

  productList.innerHTML = '';
  products.forEach(product => {
    const div = document.createElement('div');
    div.className = 'card';
    div.innerHTML = `
      <img src="${product.image}" width="100%" />
      <h3>${product.name}</h3>
      <p>₹${product.price}</p>
      <button onclick="deleteProduct('${product._id}')">Delete</button>
    `;
    productList.appendChild(div);
  });
}

async function deleteProduct(id) {
  await fetch(`/admin/products/${id}`, { method: 'DELETE' });
  fetchProducts();
}

addForm.addEventListener('submit', async (e) => {
  e.preventDefault();
  const name = document.getElementById('name').value;
  const price = document.getElementById('price').value;
  const image = document.getElementById('image').value;

  await fetch('/admin/products', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ name, price, image })
  });

  addForm.reset();
  fetchProducts();
});

window.onload = fetchProducts;
