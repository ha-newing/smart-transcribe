# shadcn/ui + Tailwind CSS 4 Integration Guide

## Overview

This document explains how to properly configure shadcn/ui with Tailwind CSS 4. The key difference from Tailwind v3 is the new `@theme` directive syntax and how CSS variables are mapped to Tailwind utilities.

## Configuration Pattern

### 1. CSS Variables Setup (`src/index.css`)

Define your theme colors in `:root` and `.dark` selectors **OUTSIDE** of `@layer base`:

```css
@import "tailwindcss";

:root {
  /* Define colors with hsl() wrapper */
  --background: hsl(0 0% 100%);
  --foreground: hsl(222.2 47.4% 11.2%);
  --primary: hsl(237 91% 45%);
  --primary-foreground: hsl(0 0% 100%);
  --secondary: hsl(210 40% 96.1%);
  --secondary-foreground: hsl(222.2 47.4% 11.2%);
  --muted: hsl(210 40% 96.1%);
  --muted-foreground: hsl(215.4 16.3% 46.9%);
  --accent: hsl(210 40% 96.1%);
  --accent-foreground: hsl(222.2 47.4% 11.2%);
  --destructive: hsl(0 84.2% 60.2%);
  --destructive-foreground: hsl(0 0% 98%);
  --border: hsl(214.3 31.8% 91.4%);
  --input: hsl(214.3 31.8% 91.4%);
  --ring: hsl(237 91% 45%);
  --radius: 0.5rem;
  --card: hsl(0 0% 100%);
  --card-foreground: hsl(222.2 47.4% 11.2%);
  --popover: hsl(0 0% 100%);
  --popover-foreground: hsl(222.2 47.4% 11.2%);
}

.dark {
  --background: hsl(222.2 84% 4.9%);
  --foreground: hsl(210 40% 98%);
  --card: hsl(222.2 84% 4.9%);
  --card-foreground: hsl(210 40% 98%);
  --popover: hsl(222.2 84% 4.9%);
  --popover-foreground: hsl(210 40% 98%);
  --primary: hsl(237 91% 55%);
  --primary-foreground: hsl(222.2 47.4% 11.2%);
  --secondary: hsl(217.2 32.6% 17.5%);
  --secondary-foreground: hsl(210 40% 98%);
  --muted: hsl(217.2 32.6% 17.5%);
  --muted-foreground: hsl(215 20.2% 65.1%);
  --accent: hsl(217.2 32.6% 17.5%);
  --accent-foreground: hsl(210 40% 98%);
  --destructive: hsl(0 62.8% 30.6%);
  --destructive-foreground: hsl(210 40% 98%);
  --border: hsl(217.2 32.6% 17.5%);
  --input: hsl(217.2 32.6% 17.5%);
  --ring: hsl(237 91% 55%);
}
```

### 2. Theme Mapping with `@theme inline`

Map CSS variables to Tailwind color utilities:

```css
@theme inline {
  --color-background: var(--background);
  --color-foreground: var(--foreground);
  --color-card: var(--card);
  --color-card-foreground: var(--card-foreground);
  --color-popover: var(--popover);
  --color-popover-foreground: var(--popover-foreground);
  --color-primary: var(--primary);
  --color-primary-foreground: var(--primary-foreground);
  --color-secondary: var(--secondary);
  --color-secondary-foreground: var(--secondary-foreground);
  --color-muted: var(--muted);
  --color-muted-foreground: var(--muted-foreground);
  --color-accent: var(--accent);
  --color-accent-foreground: var(--accent-foreground);
  --color-destructive: var(--destructive);
  --color-destructive-foreground: var(--destructive-foreground);
  --color-border: var(--border);
  --color-input: var(--input);
  --color-ring: var(--ring);
}
```

### 3. Tailwind Config (`tailwind.config.js`)

Reference the mapped `--color-*` variables:

```javascript
/** @type {import('tailwindcss').Config} */
export default {
  darkMode: ["class"],
  content: [
    "./index.html",
    "./src/**/*.{js,ts,jsx,tsx}",
  ],
  theme: {
    extend: {
      colors: {
        border: "var(--color-border)",
        input: "var(--color-input)",
        ring: "var(--color-ring)",
        background: "var(--color-background)",
        foreground: "var(--color-foreground)",
        primary: {
          DEFAULT: "var(--color-primary)",
          foreground: "var(--color-primary-foreground)",
        },
        secondary: {
          DEFAULT: "var(--color-secondary)",
          foreground: "var(--color-secondary-foreground)",
        },
        destructive: {
          DEFAULT: "var(--color-destructive)",
          foreground: "var(--color-destructive-foreground)",
        },
        muted: {
          DEFAULT: "var(--color-muted)",
          foreground: "var(--color-muted-foreground)",
        },
        accent: {
          DEFAULT: "var(--color-accent)",
          foreground: "var(--color-accent-foreground)",
        },
        popover: {
          DEFAULT: "var(--color-popover)",
          foreground: "var(--color-popover-foreground)",
        },
        card: {
          DEFAULT: "var(--color-card)",
          foreground: "var(--color-card-foreground)",
        },
      },
      borderRadius: {
        lg: "var(--radius)",
        md: "calc(var(--radius) - 2px)",
        sm: "calc(var(--radius) - 4px)",
      },
    },
  },
  plugins: [require("tailwindcss-animate")],
}
```

### 4. PostCSS Config (`postcss.config.js`)

Use `@tailwindcss/postcss` plugin for Tailwind v4:

```javascript
export default {
  plugins: {
    '@tailwindcss/postcss': {},
    autoprefixer: {},
  },
}
```

## Key Differences from Tailwind v3

1. **No `@layer base`**: CSS variables are defined directly in `:root` and `.dark`, not wrapped in `@layer base`

2. **hsl() Wrapper Required**: All HSL colors must use `hsl()` function:
   - ✅ Correct: `--primary: hsl(237 91% 45%);`
   - ❌ Wrong: `--primary: 237 91% 45%;`

3. **@theme inline Directive**: New syntax to map CSS vars to Tailwind utilities:
   ```css
   @theme inline {
     --color-primary: var(--primary);
   }
   ```

4. **PostCSS Plugin**: Use `@tailwindcss/postcss` instead of `tailwindcss` directly

5. **Auto OKLCH Conversion**: Tailwind v4 automatically converts HSL to OKLCH color space for better color accuracy

## Working with Tailwind v4

### Color Utilities

Use standard Tailwind color utilities as before:

```tsx
<button className="bg-primary text-primary-foreground hover:bg-primary/90">
  Click me
</button>
```

### Custom Colors

Add new colors in three steps:

1. Define CSS variable in `src/index.css`:
```css
:root {
  --success: hsl(142 71% 45%);
  --success-foreground: hsl(0 0% 100%);
}
```

2. Map in `@theme inline`:
```css
@theme inline {
  --color-success: var(--success);
  --color-success-foreground: var(--success-foreground);
}
```

3. Reference in `tailwind.config.js`:
```javascript
colors: {
  success: {
    DEFAULT: "var(--color-success)",
    foreground: "var(--color-success-foreground)",
  },
}
```

### Dark Mode

Toggle dark mode with class:

```tsx
// Add/remove 'dark' class to <html> or <body>
document.documentElement.classList.toggle('dark');
```

### Installing shadcn/ui Components

```bash
npx shadcn@latest add button
npx shadcn@latest add card
npx shadcn@latest add dialog
```

Components will automatically use your theme colors via the `--color-*` variables.

## Debugging Tips

1. **Colors not showing**: Check that:
   - CSS variables use `hsl()` wrapper
   - `@theme inline` maps all variables
   - `tailwind.config.js` references `var(--color-*)`

2. **Build errors**: Ensure `@tailwindcss/postcss` is installed:
   ```bash
   npm install -D @tailwindcss/postcss
   ```

3. **Inspector shows wrong colors**: Tailwind v4 auto-converts to OKLCH. Use browser DevTools to inspect computed values.

4. **Component styles not applying**: Verify component imports from `@/components/ui/*` and that `cn()` utility is available.

## Resources

- [Tailwind CSS v4 Docs](https://tailwindcss.com/docs)
- [shadcn/ui Theming](https://ui.shadcn.com/docs/theming)
- [shadcn/ui + Tailwind v4 Support](https://ui.shadcn.com/docs/changelog)

## Our Project Setup

### Primary Brand Color
MB Bank Deep Blue: `rgb(20, 30, 210)` = `hsl(237, 91%, 45%)`

### Theme Colors
- Primary: Deep blue (`hsl(237 91% 45%)`)
- Secondary: Light gray (`hsl(210 40% 96.1%)`)
- Destructive: Red (`hsl(0 84.2% 60.2%)`)
- Muted: Light gray (`hsl(210 40% 96.1%)`)
- Accent: Light gray (`hsl(210 40% 96.1%)`)

### Usage Examples

```tsx
// Primary button (deep blue)
<Button>Send Magic Link</Button>

// Secondary button (light gray)
<Button variant="secondary">Cancel</Button>

// Destructive button (red)
<Button variant="destructive">Delete</Button>

// Outline button (white with border)
<Button variant="outline" className="bg-white">Google</Button>

// Ghost button (transparent)
<Button variant="ghost">Learn More</Button>
```
