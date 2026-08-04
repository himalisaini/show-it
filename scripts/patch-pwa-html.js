// Post-processes the output of `expo export -p web` before it's deployed.
// Three problems this fixes:
//
// 1. Expo (Metro bundler, output: "single") doesn't inject a
//    <link rel="manifest"> or Apple home-screen meta tags into the generated
//    index.html, even though public/manifest.json ships correctly. Without
//    this, browsers won't show an "Add to Home Screen" / install prompt.
//
// 2. Expo emits font assets under dist/assets/node_modules/... (mirroring
//    each package's real path). Static hosts like Vercel silently exclude
//    any path containing a "node_modules" segment, anywhere in the tree —
//    so those fonts 404 in production and the whole app fails to render.
//    We rename that folder and rewrite the matching string literals in the
//    bundle (Metro's web asset registry stores them as plain path strings).
//
// 3. Expo's html/body CSS reset sets height but no background-color, so the
//    page is white until JS paints the dark app UI (visible as a flash, and
//    permanently visible under the iOS status bar in standalone PWA mode,
//    since apple-mobile-web-app-status-bar-style: black-translucent makes
//    that area show the page's own background, not the app's).
const fs = require("fs");
const path = require("path");

const distDir = path.join(__dirname, "..", "dist");
const indexPath = path.join(distDir, "index.html");

// --- Fix 1: PWA manifest + Apple meta tags ---
const html = fs.readFileSync(indexPath, "utf8");

if (html.includes('rel="manifest"')) {
  console.log("PWA tags already present, skipping.");
} else {
  const tags = [
    '<link rel="manifest" href="/manifest.json">',
    '<link rel="apple-touch-icon" href="/icons/apple-touch-icon.png">',
    '<meta name="apple-mobile-web-app-capable" content="yes">',
    '<meta name="apple-mobile-web-app-status-bar-style" content="black-translucent">',
    '<meta name="apple-mobile-web-app-title" content="Show-It">',
  ].join("\n");

  const patchedHtml = html.replace(
    '<link rel="icon" href="/favicon.ico"/>',
    `<link rel="icon" href="/favicon.ico"/>\n${tags}`
  );
  fs.writeFileSync(indexPath, patchedHtml);
  console.log("Patched dist/index.html with PWA manifest + Apple meta tags.");
}

// --- Fix 2: rename assets/node_modules so hosts stop excluding it ---
const oldAssetsDir = path.join(distDir, "assets", "node_modules");
const newAssetsDir = path.join(distDir, "assets", "vendor");

if (fs.existsSync(oldAssetsDir)) {
  fs.renameSync(oldAssetsDir, newAssetsDir);

  const bundleDir = path.join(distDir, "_expo", "static", "js", "web");
  const bundleFiles = fs.readdirSync(bundleDir).filter((f) => f.endsWith(".js"));

  for (const file of bundleFiles) {
    const bundlePath = path.join(bundleDir, file);
    const bundle = fs.readFileSync(bundlePath, "utf8");
    const rewritten = bundle.split("assets/node_modules").join("assets/vendor");
    if (rewritten !== bundle) {
      fs.writeFileSync(bundlePath, rewritten);
      console.log(`Rewrote asset paths in ${file} (assets/node_modules -> assets/vendor).`);
    }
  }
  console.log("Renamed dist/assets/node_modules -> dist/assets/vendor.");
} else {
  console.log("No assets/node_modules directory found, skipping rename.");
}

// --- Fix 3: dark background on html/body so there's no white flash / status bar gap ---
const currentHtml = fs.readFileSync(indexPath, "utf8");
const darkBg = "html,body{background-color:#0f0f13;}";

if (currentHtml.includes(darkBg)) {
  console.log("Dark background style already present, skipping.");
} else {
  const patchedHtml = currentHtml.replace(
    '<style id="expo-reset">',
    `<style id="expo-reset">\n      ${darkBg}`
  );
  fs.writeFileSync(indexPath, patchedHtml);
  console.log("Patched dist/index.html with dark html/body background-color.");
}
