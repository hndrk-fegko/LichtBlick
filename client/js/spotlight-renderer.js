/**
 * Spotlight Renderer
 * 
 * Gemeinsame Render-Logik für Admin und Beamer
 * 
 * Unterschiede:
 * - Admin: preview=true (80% Effekt), highlight=optional (grünes Overlay)
 * - Beamer: preview=false (100% Effekt), highlight=false
 */

const SpotlightRenderer = {
  /**
   * Rendert ein Bild mit Spotlight-Maske
   * 
   * @param {Object} options
   * @param {CanvasRenderingContext2D} options.ctx - Canvas Context zum Zeichnen
   * @param {HTMLImageElement} options.image - Das Bild
   * @param {Array} options.spotlights - Array von {x, y, size, strength?, focus?}
   * @param {Object} options.mouseSpot - Optionaler temporärer Maus-Spotlight
   * @param {boolean} options.isRevealed - Bild komplett aufgedeckt (keine Maske)
   * @param {boolean} options.preview - Admin-Vorschau (80% Effekt)
   * @param {boolean} options.highlight - Grünes Overlay für 100% transparente Bereiche
   */
  render(options) {
    const {
      ctx,
      image,
      spotlights = [],
      mouseSpot = null,
      isRevealed = false,
      preview = false,
      highlight = false
    } = options;

    if (!ctx || !image) return;

    const canvas = ctx.canvas;
    
    // Berechne Bild-Position und -Größe (zentriert, aspect ratio erhalten)
    const scale = Math.min(canvas.width / image.width, canvas.height / image.height);
    const imgX = (canvas.width - image.width * scale) / 2;
    const imgY = (canvas.height - image.height * scale) / 2;
    const imgW = image.width * scale;
    const imgH = image.height * scale;

    // Preview-Faktoren (Admin = 80%, Beamer = 100%)
    const darknessFactor = preview ? 0.8 : 1.0;
    const spotlightScale = preview ? 0.8 : 1.0;

    // 1. Schwarzer Hintergrund
    ctx.fillStyle = '#000';
    ctx.fillRect(0, 0, canvas.width, canvas.height);

    // 2. Bild zeichnen
    ctx.drawImage(image, imgX, imgY, imgW, imgH);

    // Wenn Bild komplett aufgedeckt: keine Maske
    if (isRevealed) {
      return { imgX, imgY, imgW, imgH, maskCtx: null };
    }

    // Sammle alle Spotlights (fixierte + Maus)
    const allSpots = [...spotlights];
    if (mouseSpot) {
      allSpots.push(mouseSpot);
    }

    // 3. Erstelle Offscreen-Canvas für die Maske
    const maskCanvas = document.createElement('canvas');
    maskCanvas.width = canvas.width;
    maskCanvas.height = canvas.height;
    const maskCtx = maskCanvas.getContext('2d');

    // 4. Maske mit Schwarz füllen (Abdunklungsstärke je nach Mode)
    maskCtx.fillStyle = `rgba(0, 0, 0, ${darknessFactor})`;
    maskCtx.fillRect(0, 0, maskCanvas.width, maskCanvas.height);

    // 5. Spotlights aus der Maske ausschneiden
    allSpots.forEach(spot => {
      const spotX = imgX + spot.x * imgW;
      const spotY = imgY + spot.y * imgH;
      // Spotlight-Größe mit Scale-Faktor
      const spotRadius = (spot.size * imgW * spotlightScale) / 2;

      // Stärke und Fokus aus Spot-Daten (mit Defaults)
      const strength = spot.strength ?? 1; // 0-1: wie viel Transparenz
      const focus = spot.focus ?? 0.7; // 0-1: ab welchem % des Radius beginnt der Gradient

      maskCtx.save();
      maskCtx.globalCompositeOperation = 'destination-out';

      // Gradient mit einstellbarem Fokus und Stärke
      const gradient = maskCtx.createRadialGradient(spotX, spotY, 0, spotX, spotY, spotRadius);
      gradient.addColorStop(0, `rgba(255, 255, 255, ${strength})`);
      gradient.addColorStop(focus, `rgba(255, 255, 255, ${strength})`); // Fokus-Bereich
      gradient.addColorStop(1, 'rgba(255, 255, 255, 0)'); // Rand: ausfaden

      maskCtx.fillStyle = gradient;
      maskCtx.beginPath();
      maskCtx.arc(spotX, spotY, spotRadius, 0, Math.PI * 2);
      maskCtx.fill();
      maskCtx.restore();
    });

    // 6. Maske über das Bild legen
    ctx.drawImage(maskCanvas, 0, 0);

    // 7. Optionales grünes Highlight für 100% transparente Bereiche
    if (highlight && spotlights.length > 0) {
      this.renderHighlight(ctx, maskCtx, canvas.width, canvas.height);
    }

    return { imgX, imgY, imgW, imgH, maskCtx };
  },

  /**
   * Rendert grünes Overlay für komplett transparente Bereiche
   */
  renderHighlight(ctx, maskCtx, width, height) {
    // Lese die Pixel-Daten der Maske aus
    const maskData = maskCtx.getImageData(0, 0, width, height);
    const pixels = maskData.data;

    // Erstelle grünes Overlay-Canvas
    const greenCanvas = document.createElement('canvas');
    greenCanvas.width = width;
    greenCanvas.height = height;
    const greenCtx = greenCanvas.getContext('2d');
    const greenData = greenCtx.createImageData(width, height);
    const greenPixels = greenData.data;

    // Prüfe jeden Pixel: Wenn Alpha der Maske = 0, markiere grün
    for (let i = 0; i < pixels.length; i += 4) {
      const alpha = pixels[i + 3]; // Alpha-Kanal der Maske

      // Wenn Maske komplett transparent (alpha = 0), markiere grün
      if (alpha === 0) {
        greenPixels[i] = 0;       // R
        greenPixels[i + 1] = 200; // G
        greenPixels[i + 2] = 0;   // B
        greenPixels[i + 3] = 38;  // A (15% = 38/255)
      }
    }

    greenCtx.putImageData(greenData, 0, 0);

    // Grünes Overlay auf Hauptcanvas zeichnen
    ctx.drawImage(greenCanvas, 0, 0);
  }
};

// Export für Browser (global) und Module
if (typeof window !== 'undefined') {
  window.SpotlightRenderer = SpotlightRenderer;
}
if (typeof module !== 'undefined') {
  module.exports = SpotlightRenderer;
}
