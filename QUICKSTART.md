# Quick Start Guide

## 🚀 Get Started in 3 Steps

### Step 1: Open the Website
Simply open `index.html` in your browser, or use a local server:

```bash
# Option 1: Using Python (if installed)
python -m http.server 8000

# Option 2: Using Node.js
npx serve .

# Option 3: Using PHP (if installed)
php -S localhost:8000
```

Then visit `http://localhost:8000` in your browser.

### Step 2: Explore the Features

1. **Watch the Terminal Animation** - The hero section terminal animates on page load
2. **Scroll Down** - See smooth fade-in animations as you scroll
3. **Try the Tabs** - Click JavaScript/Rust/Python tabs to see different code examples
4. **Copy Code** - Click "Copy" buttons on code blocks
5. **Click Buttons** - See ripple effects on button clicks

### Step 3: Customize (Optional)

- Edit `styles.css` to change colors (CSS variables at the top)
- Edit `index.html` to update content
- Edit `script.js` to modify animations

## 🎯 Key Sections

- **Hero**: Animated terminal with protocol initialization
- **Protocol Flow**: 4-step process with code examples
- **Proof Section**: Technical proof of concept
- **Code Examples**: Integration examples in 3 languages
- **Features**: Why choose this protocol

## 📱 Test Responsive Design

Resize your browser window or use developer tools to test:
- Desktop (1200px+)
- Tablet (768px - 1199px)
- Mobile (< 768px)

## 🎨 Customization Tips

### Change Colors
Edit CSS variables in `styles.css`:
```css
:root {
    --accent-primary: #00d4ff;  /* Change this */
    --bg-primary: #0a0e27;      /* And this */
}
```

### Modify Terminal Text
Edit the `initTerminalAnimation()` function in `script.js`:
```javascript
const lines = [
    { text: 'Your custom command', type: 'command', delay: 500 },
    // Add more lines...
];
```

### Update Content
All content is in `index.html` - just search and replace!

## 🐛 Troubleshooting

**Animations not working?**
- Make sure JavaScript is enabled
- Check browser console for errors

**Styles not loading?**
- Ensure `styles.css` is in the same directory as `index.html`
- Check file paths are correct

**Copy button not working?**
- Requires HTTPS or localhost (browser security)
- Check browser console for clipboard API errors

## 📚 Learn More

- See `README.md` for full documentation
- See `PROOF.md` for implementation details
- Check browser console for debug messages

---

**Ready to go!** 🎉

