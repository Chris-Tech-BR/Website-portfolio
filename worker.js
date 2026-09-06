const PRODUCTS_URL =
  "https://docs.google.com/spreadsheets/d/e/2PACX-1vRBT6G9F5gMctKLGKoFYXGZpfGvcN2g89zn0fX3zApi5d07Ac4OxKVrt5o669BV5mdyi6vVUWK2j9Uv/pub?gid=0&single=true&output=csv";

const SITE_URL = "https://loja.christech-sm.workers.dev";

export default {
  async fetch(request) {
    const url = new URL(request.url);

    // Only handle product pages
    if (!url.pathname.startsWith("/produto/")) {
      return fetch(request);
    }

    const id = url.pathname.split("/produto/")[1];

    if (!id) {
      return new Response("Produto não encontrado", { status: 404 });
    }

    try {
      const response = await fetch(PRODUCTS_URL);

      if (!response.ok) {
        throw new Error("Google Sheet unavailable");
      }

      const csv = await response.text();
      const products = parseCSV(csv);

      const product = products.find(
        p => String(p.id).trim() === String(id).trim()
      );

      if (!product || String(product.active).toLowerCase() !== "true") {
        return new Response("Produto não encontrado", {
          status: 404,
          headers: {
            "Content-Type": "text/html; charset=UTF-8"
          }
        });
      }

      const name = escapeHTML(product.name);
      const description = escapeHTML(product.description);
      const image = product.image;
      const price = normalizePrice(product.price);

      const html = createProductPage({
        id,
        name,
        description,
        image,
        price
      });

      return new Response(html, {
        status: 200,
        headers: {
          "Content-Type": "text/html; charset=UTF-8",
          "Cache-Control": "public, max-age=300"
        }
      });

    } catch (error) {
      console.error(error);

      return new Response(
        "<h1>Erro ao carregar produto</h1>",
        {
          status: 500,
          headers: {
            "Content-Type": "text/html; charset=UTF-8"
          }
        }
      );
    }
  }
};


// -------------------------
// CSV PARSER
// -------------------------

function parseCSV(csv) {
  const rows = [];
  let row = [];
  let value = "";
  let insideQuotes = false;

  for (let i = 0; i < csv.length; i++) {
    const char = csv[i];
    const next = csv[i + 1];

    if (char === '"' && insideQuotes && next === '"') {
      value += '"';
      i++;
    }

    else if (char === '"') {
      insideQuotes = !insideQuotes;
    }

    else if (char === "," && !insideQuotes) {
      row.push(value);
      value = "";
    }

    else if (
      (char === "\n" || char === "\r") &&
      !insideQuotes
    ) {
      if (char === "\r" && next === "\n") {
        i++;
      }

      row.push(value);
      rows.push(row);

      row = [];
      value = "";
    }

    else {
      value += char;
    }
  }

  if (value !== "" || row.length > 0) {
    row.push(value);
    rows.push(row);
  }

  if (rows.length < 2) {
    return [];
  }

  const headers = rows[0].map(h =>
    h.trim().toLowerCase()
  );

  return rows
    .slice(1)
    .filter(row => row.length > 0)
    .map(row => {
      const product = {};

      headers.forEach((header, index) => {
        product[header] =
          row[index] ? row[index].trim() : "";
      });

      return product;
    });
}


// -------------------------
// PRODUCT PAGE
// -------------------------

function createProductPage(product) {

  const productURL =
    `${SITE_URL}/produto/${product.id}`;

  const jsonLD = {
    "@context": "https://schema.org",
    "@type": "Product",

    "name": product.name,

    "description": product.description,

    "image": [
      product.image
    ],

    "category": "Acessórios para celular",

    "offers": {
      "@type": "Offer",

      "url": productURL,

      "priceCurrency": "BRL",

      "price": product.price,

      "availability":
        "https://schema.org/InStock",

      "itemCondition":
        "https://schema.org/NewCondition"
    },

    "brand": {
      "@type": "Brand",
      "name": "Chris Tech"
    }
  };

  return `<!DOCTYPE html>

<html lang="pt-BR">

<head>

<meta charset="UTF-8">

<meta name="viewport"
      content="width=device-width, initial-scale=1.0">

<title>
${product.name} | Chris Tech
</title>

<meta
  name="description"
  content="${product.description}"
>

<link
  rel="canonical"
  href="${productURL}"
>

<script type="application/ld+json">
${JSON.stringify(jsonLD)}
</script>

<style>

body {
  font-family: Arial, sans-serif;
  background: #f5f5f5;
  margin: 0;
  color: #222;
}

.container {
  max-width: 900px;
  margin: 40px auto;
  padding: 30px;
  background: white;
  border-radius: 20px;
  box-shadow: 0 5px 25px rgba(0,0,0,.08);
}

img {
  width: 100%;
  max-width: 500px;
  display: block;
  margin: auto;
  border-radius: 15px;
}

h1 {
  font-size: 32px;
}

.description {
  color: #666;
  font-size: 18px;
  line-height: 1.6;
}

.price {
  font-size: 28px;
  font-weight: bold;
  margin: 20px 0;
}

.button {
  display: inline-block;
  padding: 15px 25px;
  background: #25D366;
  color: white;
  text-decoration: none;
  border-radius: 10px;
  font-weight: bold;
}

</style>

</head>

<body>

<main class="container">

<img
  src="${product.image}"
  alt="${product.name}"
>

<h1>
${product.name}
</h1>

<p class="description">
${product.description}
</p>

<div class="price">
R$ ${formatBRL(product.price)}
</div>

<a
  class="button"
  href="https://wa.me/5555996689852?text=${encodeURIComponent(
    "Olá! Tenho interesse no produto: " + product.name
  )}"
>
Comprar pelo WhatsApp
</a>

</main>

</body>

</html>`;
}


// -------------------------
// HELPERS
// -------------------------

function normalizePrice(value) {
  if (!value) return "0.00";

  let price = String(value)
    .trim()
    .replace("R$", "")
    .trim();

  // Brazilian format: 89,90
  if (price.includes(",")) {
    price = price.replace(/\./g, "");
    price = price.replace(",", ".");
  }

  const number = Number(price);

  return Number.isFinite(number)
    ? number.toFixed(2)
    : "0.00";
}

function formatBRL(value) {
  return Number(value)
    .toFixed(2)
    .replace(".", ",");
}

function escapeHTML(value) {
  return String(value || "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#039;");
}
