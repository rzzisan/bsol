# Landing Builder Postman Setup

## Import collection
- File: `backend/postman/Landing-Builder.postman_collection.json`
- Import in Postman and set variables:
  - `base_url` (e.g. `http://localhost:8000`)
  - `mobile`, `password`
  - `token` (from login response)
  - `template_id`, `product_id_1`, `landing_page_id`, `landing_slug`

## Recommended call order
1. **Auth - Login**
2. **Landing - List Templates**
3. **Landing - Create Page**
4. **Landing - List Pages**
5. **Landing - Publish Page**
6. **Public - Open Landing**
7. **Public - Submit Order**

## Quick API payload examples

### Create page
```json
{
  "template_id": 1,
  "title": "Flash Cards – Goofi World",
  "slug": "flash-cards-goofi-world",
  "status": "draft",
  "products": [
    {
      "product_id": 1,
      "title_override": "Flash Cards Set",
      "price_override": 890,
      "default_qty": 1,
      "selected_by_default": true,
      "sort_order": 1
    }
  ]
}
```

### Import JSON
```json
{
  "file_name": "Goofi_Design-2.json",
  "template_id": 1,
  "status": "draft"
}
```

### Publish page
`POST /api/landing/pages/{id}/publish`

### Public order submit (form fields)
- `customer_name`
- `customer_phone`
- `customer_address`
- `items[0][enabled]=1`
- `items[0][product_id]=<id>`
- `items[0][quantity]=1`
