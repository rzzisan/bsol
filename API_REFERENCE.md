# GrapesJS Landing Page Builder - Complete API Reference

**Version:** 1.0.0  
**Base URL:** `https://bsol.zyrotechbd.com/api`  
**Authentication:** Sanctum Bearer Token  
**Content-Type:** `application/json`

---

## 🔑 Authentication

All protected endpoints require:
```
Authorization: Bearer {access_token}
```

Get token from login endpoint:
```
POST /login
{
  "email": "user@example.com",
  "password": "password"
}
```

---

## 📚 API Endpoints

### 1. Get Editor Draft

**Endpoint:** `GET /landing/editor/{pageId}`

**Authentication:** Required ✅

**Parameters:**
- `pageId` (URL param, integer): The landing page ID

**Headers:**
```
Authorization: Bearer {token}
Content-Type: application/json
```

**Success Response (200):**
```json
{
  "success": true,
  "data": {
    "id": 1,
    "landing_page_id": 1,
    "user_id": 5,
    "components_json": "[{\"type\":\"text\",\"content\":\"Hello\"}]",
    "styles_json": "[{\"selectors\":[\"body\"],\"style\":{}}]",
    "html_output": "<div>Hello</div>",
    "css_output": "body { font-size: 16px; }",
    "metadata": {
      "lastModifiedBy": "John Doe",
      "deviceType": "desktop"
    },
    "last_edited_at": "2026-06-02T10:30:00Z",
    "created_at": "2026-06-01T08:00:00Z",
    "updated_at": "2026-06-02T10:30:00Z"
  }
}
```

**Error Response (404):**
```json
{
  "message": "No query results found for model [App\\Models\\LandingPage]",
  "exception": "ModelNotFoundException"
}
```

**Error Response (401):**
```json
{
  "message": "Unauthenticated",
  "exception": "AuthenticationException"
}
```

---

### 2. Save Draft (Auto-save)

**Endpoint:** `POST /landing/editor/{pageId}/save`

**Authentication:** Required ✅

**Parameters:**
- `pageId` (URL param, integer): The landing page ID

**Request Body:**
```json
{
  "components_json": "[{\"type\":\"text\"}]",
  "styles_json": "[]",
  "html_output": "<div>Content</div>",
  "css_output": "body { margin: 0; }",
  "metadata": {
    "editorVersion": "1.0",
    "lastAction": "component_added"
  }
}
```

**Validation Rules:**
- `components_json`: nullable, string, max 5MB
- `styles_json`: nullable, string
- `html_output`: nullable, string
- `css_output`: nullable, string
- `metadata`: nullable, array

**Success Response (200):**
```json
{
  "success": true,
  "message": "Draft saved successfully",
  "data": {
    "id": 1,
    "landing_page_id": 1,
    "user_id": 5,
    "last_edited_at": "2026-06-02T10:35:00Z",
    "updated_at": "2026-06-02T10:35:00Z"
  }
}
```

**Error Response (422):**
```json
{
  "message": "The given data was invalid.",
  "errors": {
    "components_json": ["The components json must not be greater than 5242880 characters."]
  }
}
```

---

### 3. Publish Page

**Endpoint:** `POST /landing/editor/{pageId}/publish`

**Authentication:** Required ✅

**Parameters:**
- `pageId` (URL param, integer): The landing page ID

**Headers:**
```
Authorization: Bearer {token}
Content-Type: application/json
```

**Request Body:**
```json
{}
```

**Success Response (200):**
```json
{
  "success": true,
  "message": "Page published successfully",
  "data": {
    "id": 1,
    "title": "My Landing Page",
    "slug": "my-landing-page",
    "status": "published",
    "published_at": "2026-06-02T10:40:00Z",
    "editor_state": {
      "components": "[...]",
      "styles": "[...]",
      "html": "<div>...</div>",
      "css": "..."
    }
  }
}
```

**Effect:**
- Creates version in `landing_page_versions`
- Updates page status to "published"
- Clears Redis cache
- Updates `published_at` timestamp

---

### 4. Get Version History

**Endpoint:** `GET /landing/editor/{pageId}/versions`

**Authentication:** Required ✅

**Parameters:**
- `pageId` (URL param, integer): The landing page ID

**Query Parameters:**
- `limit` (optional, default: 10): Number of versions to return

**Headers:**
```
Authorization: Bearer {token}
Content-Type: application/json
```

**Success Response (200):**
```json
{
  "success": true,
  "data": [
    {
      "id": 3,
      "landing_page_id": 1,
      "created_by": 5,
      "version_number": 3,
      "version_name": "Version 3",
      "change_notes": "Updated hero section",
      "components_json": "[...]",
      "styles_json": "[...]",
      "created_at": "2026-06-02T10:40:00Z"
    },
    {
      "id": 2,
      "landing_page_id": 1,
      "created_by": 5,
      "version_number": 2,
      "version_name": "Version 2",
      "change_notes": "Initial design",
      "created_at": "2026-06-01T15:20:00Z"
    },
    {
      "id": 1,
      "landing_page_id": 1,
      "created_by": 5,
      "version_number": 1,
      "version_name": "Version 1",
      "created_at": "2026-06-01T08:00:00Z"
    }
  ]
}
```

---

### 5. Rollback to Version

**Endpoint:** `POST /landing/editor/{pageId}/rollback/{versionNumber}`

**Authentication:** Required ✅

**Parameters:**
- `pageId` (URL param, integer): The landing page ID
- `versionNumber` (URL param, integer): The version to rollback to

**Headers:**
```
Authorization: Bearer {token}
Content-Type: application/json
```

**Request Body:**
```json
{}
```

**Success Response (200):**
```json
{
  "success": true,
  "message": "Rolled back to version 2",
  "data": {
    "id": 4,
    "landing_page_id": 1,
    "user_id": 5,
    "version_number": 2,
    "components_json": "[...]",
    "styles_json": "[...]",
    "last_edited_at": "2026-06-02T10:45:00Z"
  }
}
```

**Effect:**
- Creates new draft from version content
- Does NOT delete current version
- Updates draft with version data
- Clears Redis cache

---

### 6. Get Elements (Public)

**Endpoint:** `GET /landing/elements`

**Authentication:** Not Required ❌

**Query Parameters:**
- `category` (optional): Filter by category (basic, sections, advanced)

**Success Response (200):**
```json
{
  "success": true,
  "data": {
    "basic": [
      {
        "id": 1,
        "element_key": "text",
        "name_en": "Text / Paragraph",
        "name_bn": "টেক্সট / অনুচ্ছেদ",
        "description": "Add text content to your page",
        "category": "basic",
        "component_definition": "<p>Your text here</p>",
        "traits_definition": [
          {
            "type": "text",
            "name": "content",
            "label": "Text Content"
          }
        ],
        "is_active": true,
        "sort_order": 1
      },
      {
        "id": 2,
        "element_key": "heading",
        "name_en": "Heading",
        "name_bn": "শিরোনাম",
        "description": "Add a heading element",
        "category": "basic",
        "component_definition": "<h1>Your Heading</h1>",
        "traits_definition": [
          {
            "type": "text",
            "name": "text",
            "label": "Heading Text"
          }
        ],
        "is_active": true,
        "sort_order": 2
      }
    ],
    "sections": [
      {
        "id": 4,
        "element_key": "hero",
        "name_en": "Hero Section",
        "name_bn": "হিরো সেকশন",
        "description": "Add a hero section with title and CTA",
        "category": "sections",
        "is_active": true,
        "sort_order": 2
      }
    ]
  }
}
```

---

### 7. Get Single Element (Public)

**Endpoint:** `GET /landing/elements/{key}`

**Authentication:** Not Required ❌

**Parameters:**
- `key` (URL param, string): Element key (e.g., "hero", "button")

**Success Response (200):**
```json
{
  "success": true,
  "data": {
    "id": 4,
    "element_key": "hero",
    "name_en": "Hero Section",
    "name_bn": "হিরো সেকশন",
    "description": "Add a hero section with title and CTA",
    "category": "sections",
    "component_definition": "<section style=\"...\">...</section>",
    "traits_definition": [
      {
        "type": "text",
        "name": "title",
        "label": "Title",
        "default": "Welcome"
      },
      {
        "type": "text",
        "name": "subtitle",
        "label": "Subtitle",
        "default": "Your subtitle here"
      },
      {
        "type": "color",
        "name": "bgColor",
        "label": "Background Color",
        "default": "#667eea"
      }
    ],
    "is_active": true,
    "sort_order": 2,
    "created_at": "2026-06-02T08:00:00Z",
    "updated_at": "2026-06-02T08:00:00Z"
  }
}
```

**Error Response (404):**
```json
{
  "message": "No query results found for model [App\\Models\\LandingPageElement]",
  "exception": "ModelNotFoundException"
}
```

---

## 🔄 Request/Response Flow

### Auto-save Flow
```
1. User makes change in editor
2. Editor marks page as dirty
3. Every 30 seconds, auto-save triggers
4. Components & styles sent to API
5. Backend saves to database + Redis
6. Frontend shows "Saved at" timestamp
7. Page marked as clean (not dirty)
```

### Publish Flow
```
1. User clicks "Publish" button
2. Auto-save triggered first
3. Draft data sent to /publish endpoint
4. Backend creates version
5. Page status updated to "published"
6. Redis cache cleared
7. Frontend shows success message
8. User can view published page
```

### Rollback Flow
```
1. User selects version from history
2. Rollback request sent with version number
3. Backend fetches version data
4. New draft created from version
5. Draft returned to frontend
6. Editor loads with old content
7. User can make further edits
```

---

## 📊 Database Schema

### landing_page_editor_drafts
```
- id (primary key)
- landing_page_id (foreign key)
- user_id (foreign key)
- components_json (text)
- styles_json (text)
- html_output (text)
- css_output (text)
- metadata (json)
- last_edited_at (timestamp)
- created_at (timestamp)
- updated_at (timestamp)
- Unique(landing_page_id, user_id)
```

### landing_page_versions
```
- id (primary key)
- landing_page_id (foreign key)
- created_by (foreign key → users)
- version_number (integer)
- components_json (text)
- styles_json (text)
- version_name (string)
- change_notes (text)
- created_at (timestamp)
- updated_at (timestamp)
- Unique(landing_page_id, version_number)
```

### landing_page_elements
```
- id (primary key)
- element_key (string, unique)
- name_en (string)
- name_bn (string)
- description (text)
- component_definition (text)
- traits_definition (json)
- category (string)
- is_active (boolean)
- sort_order (integer)
- created_at (timestamp)
- updated_at (timestamp)
```

---

## 🚨 Error Handling

### Common HTTP Status Codes

| Code | Meaning | Example |
|------|---------|---------|
| 200 | Success | Draft saved successfully |
| 201 | Created | New version created |
| 400 | Bad Request | Invalid JSON in request |
| 401 | Unauthorized | Missing or invalid token |
| 403 | Forbidden | User cannot access page |
| 404 | Not Found | Page ID doesn't exist |
| 422 | Validation Error | Invalid data format |
| 429 | Too Many Requests | Rate limit exceeded |
| 500 | Server Error | Database error |

### Error Response Format

```json
{
  "success": false,
  "message": "Error description",
  "errors": {
    "field_name": ["Error message 1", "Error message 2"]
  }
}
```

---

## 🔐 Rate Limiting

- **Limit:** 60 requests per minute
- **Headers:**
  ```
  X-RateLimit-Limit: 60
  X-RateLimit-Remaining: 45
  X-RateLimit-Reset: 1654162800
  ```

---

## 📝 Examples

### cURL Examples

**Get Draft:**
```bash
curl -X GET https://bsol.zyrotechbd.com/api/landing/editor/1 \
  -H "Authorization: Bearer YOUR_TOKEN" \
  -H "Content-Type: application/json"
```

**Save Draft:**
```bash
curl -X POST https://bsol.zyrotechbd.com/api/landing/editor/1/save \
  -H "Authorization: Bearer YOUR_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{
    "components_json": "[]",
    "styles_json": "[]",
    "html_output": "<div></div>",
    "css_output": ""
  }'
```

**Publish:**
```bash
curl -X POST https://bsol.zyrotechbd.com/api/landing/editor/1/publish \
  -H "Authorization: Bearer YOUR_TOKEN" \
  -H "Content-Type: application/json"
```

---

**Version:** 1.0.0  
**Last Updated:** June 2, 2026

