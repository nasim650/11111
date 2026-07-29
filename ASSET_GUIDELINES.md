# Khati Khadyo — Asset Management Standard & Image Guidelines

**Document Identifier**: `ASSET_GUIDELINES.md`  
**Version**: 1.0.0  
**Status**: Approved Production Standard  
**Target Audience**: Store Administrators, Content Managers, UI Engineers, Systems Architects  

---

## 1. Executive Overview & Smart Optimization Philosophy

Khati Khadyo employs a **Smart Non-Destructive Image Optimization System**.

### Primary Directive for Administrators
> ⚠️ **No Hard File Size Limits**: Administrators can upload high-resolution DSLR photos, raw studio exports, transparent PNGs, and modern WebP assets of any reasonable resolution. Images will **NEVER be rejected** simply because they are large.

### Automatic Background Pipeline
Upon upload through the Admin Panel or API (`/api/uploads`):
1. **Dimension & Aspect Ratio Detection**: Image dimensions, orientation (`Square / Portrait / Landscape`), and aspect ratios are calculated dynamically.
2. **Quality Warning & Non-Blocking Diagnostics**: Low-resolution images (< 600px width) trigger a friendly advisory warning in the Admin preview, but uploads are allowed to proceed.
3. **WebP Generation & Multi-Resolution Scaling**: High-resolution originals are preserved, while optimized multi-resolution WebP and progressive fallback variants (`thumb`, `sm`, `md`, `lg`) are generated dynamically for high-speed storefront serving.
4. **Zero-Distortion Storefront Rendering**: Storefront components (`ProductCard`, `CategorySection`, `HeroBanner`) wrap all images inside fixed aspect-ratio containers (`aspect-square` or `aspect-[16/5]`) using CSS `object-contain p-2` to prevent stretching, cropping, or layout shifts (CLS = 0.00).

---

## 2. Platform Visual Asset Specifications

Below is the definitive standard for every visual asset type across Khati Khadyo.

---

### A. Desktop Hero Banners

| Attribute | Specification |
|---|---|
| **Purpose** | Main homepage hero banner carousel on Desktop and Laptop viewports. |
| **Recommended Dimensions** | **1920 × 600 px** (Minimum 1440 × 450 px) |
| **Aspect Ratio** | **16:5 (3.2:1)** |
| **Recommended Max Upload Size** | 25 MB (Smart auto-optimized) |
| **Supported Formats** | WebP, PNG, JPG, JPEG |
| **Upload Hints** | Keep critical subject text centered or aligned to the left half. Avoid text in margins. |
| **Responsive Behavior** | Rendered with `fill` inside `h-64 sm:h-80 md:h-[440px] lg:h-[520px]` container. |
| **Automatic Processing** | WebP auto-compression, 1920px max-width scaling, progressive background blur placeholder. |

---

### B. Mobile Hero Banners

| Attribute | Specification |
|---|---|
| **Purpose** | Homepage hero banner carousel optimized specifically for smartphones. |
| **Recommended Dimensions** | **800 × 800 px** or **800 × 600 px** |
| **Aspect Ratio** | **1:1 (Square)** or **4:3** |
| **Recommended Max Upload Size** | 15 MB (Smart auto-optimized) |
| **Supported Formats** | WebP, PNG, JPG, JPEG |
| **Upload Hints** | High-contrast visual focus with large readable typography for small mobile screens. |
| **Responsive Behavior** | Displays on viewports < 768px in place of desktop banner. |
| **Automatic Processing** | WebP mobile conversion, 800px max-width scaling. |

---

### C. Product Catalog Images (Primary & Gallery)

| Attribute | Specification |
|---|---|
| **Purpose** | Main storefront product card grid, detail page gallery, cart previews, and wishlist. |
| **Recommended Dimensions** | **1200 × 1200 px** (Minimum 800 × 800 px) |
| **Aspect Ratio** | **1:1 (Square)** |
| **Recommended Max Upload Size** | 20 MB (Smart auto-optimized) |
| **Supported Formats** | WebP, PNG (Transparent background preferred), JPG, JPEG |
| **Upload Hints** | Center bottle/jar/package with clean margins; white or transparent PNG background. |
| **Responsive Behavior** | Displayed in `aspect-square` containers with `object-contain p-2` across grids. |
| **Automatic Processing** | Square canvas normalization, 1200px / 600px / 300px multi-variant generation. |

---

### D. Category Icons & Cards

| Attribute | Specification |
|---|---|
| **Purpose** | Homepage category grid, subcategory filters, and mega-menu navigation. |
| **Recommended Dimensions** | **800 × 800 px** (Minimum 400 × 400 px) |
| **Aspect Ratio** | **1:1 (Square)** |
| **Recommended Max Upload Size** | 10 MB (Smart auto-optimized) |
| **Supported Formats** | WebP, Transparent PNG, SVG, JPG |
| **Upload Hints** | Clean food vector icon or crisp product category photo with transparent background. |
| **Responsive Behavior** | Rendered inside 1:1 rounded square category cards (`lg:grid-cols-10`). |
| **Automatic Processing** | Fixed 400px canvas scaling, WebP conversion. |

---

### E. Brand Logo (Header & Footer)

| Attribute | Specification |
|---|---|
| **Purpose** | Main brand identity in sticky header navigation, mobile menu, and footer. |
| **Recommended Dimensions** | **600 × 200 px** (Minimum 300 × 100 px) |
| **Aspect Ratio** | **3:1** (Horizontal Landscape) |
| **Recommended Max Upload Size** | 5 MB |
| **Supported Formats** | Transparent PNG, SVG, WebP |
| **Upload Hints** | Transparent background with crisp typography for dark and light modes. |
| **Responsive Behavior** | Rendered in header at `h-7` (compact) to `h-9` (normal). |
| **Automatic Processing** | Lossless PNG/SVG optimization, header high-DPI retina scaling. |

---

### F. Promotional Section Banners & Coupons

| Attribute | Specification |
|---|---|
| **Purpose** | Mid-page promotional strips, deal-of-the-day callouts, and popup banners. |
| **Recommended Dimensions** | **1200 × 400 px** |
| **Aspect Ratio** | **3:1** |
| **Recommended Max Upload Size** | 15 MB |
| **Supported Formats** | WebP, PNG, JPG |
| **Upload Hints** | Include clear promotional message and CTA button target area. |
| **Responsive Behavior** | Scales fluidly on tablet and mobile with auto-wrap content. |
| **Automatic Processing** | Responsive scaling, WebP conversion. |

---

### G. Social Share & Open Graph (OG) Images

| Attribute | Specification |
|---|---|
| **Purpose** | Preview cards for Facebook, WhatsApp, Twitter/X, and LinkedIn sharing. |
| **Recommended Dimensions** | **1200 × 630 px** |
| **Aspect Ratio** | **1.91:1** |
| **Recommended Max Upload Size** | 10 MB |
| **Supported Formats** | JPG, PNG, WebP |
| **Upload Hints** | High-contrast brand logo, title, and key slogan visible in center. |
| **Responsive Behavior** | Consumed by social network crawler meta tags (`og:image`). |
| **Automatic Processing** | 1200x630 fixed crop recommendation, meta tag URL generation. |

---

### H. Favicon & Web App Touch Icons

| Attribute | Specification |
|---|---|
| **Purpose** | Browser tab favicon, iOS Home Screen icon, and Android PWA icon. |
| **Recommended Dimensions** | **512 × 512 px** (Minimum 192 × 192 px) |
| **Aspect Ratio** | **1:1 (Square)** |
| **Recommended Max Upload Size** | 2 MB |
| **Supported Formats** | PNG, ICO, SVG |
| **Upload Hints** | Simple high-contrast symbol or logo mark without tiny text. |
| **Responsive Behavior** | Processed into standard favicon sizes (`16x16`, `32x32`, `180x180`, `512x512`). |
| **Automatic Processing** | Multi-size ICO generation. |

---

## 3. Admin Panel Helper Text Standard

Every upload field in the Admin Panel (`AdminProductsPage`, `AdminCategoriesPage`, `AdminBannersPage`, `AdminSettingsPage`, `AdminMediaPage`) must display standardized helper callouts under the upload dropzone:

```markdown
💡 Asset Standard Recommendation:
- Recommended Resolution: [SPEC_WIDTH] × [SPEC_HEIGHT] px
- Recommended Ratio: [SPEC_RATIO]
- Preferred Formats: WebP, PNG, JPG, JPEG
- Auto-Optimization: High-resolution images of any size are accepted and automatically optimized for fast storefront loading without quality degradation.
```

---

## 4. Quality Warnings & Diagnostics Protocol

When an image file is dropped or selected in the Admin upload interface:
1. **Pre-flight Diagnostic**: Client-side `Image()` loader calculates exact `width`, `height`, and `aspectRatio`.
2. **Low-Resolution Advisory (< 600px)**: If `width < 600px`, display:
   > ⚠️ **Quality Advisory**: This image width (`${width}px`) is below 600px. It may appear soft on high-DPI displays. Upload will proceed normally.
3. **Aspect Ratio Advisory**: If aspect ratio diverges significantly from recommendation:
   > ℹ️ **Aspect Ratio Notice**: Detected ratio is `${aspectRatio}`. Storefront will center and adjust automatically with zero distortion.
