import React, { useState, useCallback, useEffect } from "react";
import { motion } from "framer-motion";
import { Link } from "react-router-dom";
import * as Vibrant from "node-vibrant";
import { FastAverageColor } from "fast-average-color";
import toast from "react-hot-toast";

const ImageColorAnalyzer = () => {
  const [selectedImage, setSelectedImage] = useState(null);
  const [colorPalette, setColorPalette] = useState([]);
  const [colorAnalysis, setColorAnalysis] = useState(null);
  const [extractionMethod, setExtractionMethod] = useState('perceptual');
  const [isProcessing, setIsProcessing] = useState(false);
  const [loadingProgress, setLoadingProgress] = useState(0);
  const [showControls, setShowControls] = useState(true);
  const [isDragOver, setIsDragOver] = useState(false);
  const [colorFormat, setColorFormat] = useState('hex');
  const [showHexCodes, setShowHexCodes] = useState(true);
  const [preprocessingOptions, setPreprocessingOptions] = useState({
    resize: true,
    blur: false,
    contrast: false
  });
  const [showColorAnalysis, setShowColorAnalysis] = useState(false);
  const [colorHistory, setColorHistory] = useState([]);

  // New feature states
  const [showUIPreview, setShowUIPreview] = useState(false);
  const [previewMode, setPreviewMode] = useState('light'); // 'light' or 'dark'
  const [showPaletteTools, setShowPaletteTools] = useState(false);
  const [selectedColorForTools, setSelectedColorForTools] = useState(null);
  const [paletteAdjustments, setPaletteAdjustments] = useState({ saturation: 0, brightness: 0 });
  const [urlInput, setUrlInput] = useState('');
  const [isExtractingUrl, setIsExtractingUrl] = useState(false);
  const [isPasting, setIsPasting] = useState(false);

  // Color conversion utilities
  const hexToRgb = (hex) => {
    const r = parseInt(hex.slice(1, 3), 16);
    const g = parseInt(hex.slice(3, 5), 16);
    const b = parseInt(hex.slice(5, 7), 16);
    return { r, g, b };
  };

  const rgbToHsl = (r, g, b) => {
    r /= 255;
    g /= 255;
    b /= 255;
    const max = Math.max(r, g, b);
    const min = Math.min(r, g, b);
    let h, s, l = (max + min) / 2;

    if (max === min) {
      h = s = 0;
    } else {
      const d = max - min;
      s = l > 0.5 ? d / (2 - max - min) : d / (max + min);
      switch (max) {
        case r: h = (g - b) / d + (g < b ? 6 : 0); break;
        case g: h = (b - r) / d + 2; break;
        case b: h = (r - g) / d + 4; break;
      }
      h /= 6;
    }
    return {
      h: Math.round(h * 360),
      s: Math.round(s * 100),
      l: Math.round(l * 100)
    };
  };

  const formatColor = (hex, format) => {
    const { r, g, b } = hexToRgb(hex);
    switch (format) {
      case 'rgb':
        return `rgb(${r}, ${g}, ${b})`;
      case 'hsl':
        const hsl = rgbToHsl(r, g, b);
        return `hsl(${hsl.h}, ${hsl.s}%, ${hsl.l}%)`;
      case 'hex':
      default:
        return hex;
    }
  };

  // Color analysis functions
  const getComplementaryColor = (hex) => {
    const { r, g, b } = hexToRgb(hex);
    const compR = 255 - r;
    const compG = 255 - g;
    const compB = 255 - b;
    return `#${compR.toString(16).padStart(2, '0')}${compG.toString(16).padStart(2, '0')}${compB.toString(16).padStart(2, '0')}`;
  };

  const getAnalogousColors = (hex) => {
    const { r, g, b } = hexToRgb(hex);
    const hsl = rgbToHsl(r, g, b);
    const h = hsl.h;
    
    const color1 = hslToHex((h + 30) % 360, hsl.s, hsl.l);
    const color2 = hslToHex((h - 30 + 360) % 360, hsl.s, hsl.l);
    
    return [color1, color2];
  };

  const hslToHex = (h, s, l) => {
    l /= 100;
    const a = s * Math.min(l, 1 - l) / 100;
    const f = n => {
      const k = (n + h / 30) % 12;
      const color = l - a * Math.max(Math.min(k - 3, 9 - k, 1), -1);
      return Math.round(255 * color).toString(16).padStart(2, '0');
    };
    return `#${f(0)}${f(8)}${f(4)}`;
  };

  const getTriadicColors = (hex) => {
    const { r, g, b } = hexToRgb(hex);
    const hsl = rgbToHsl(r, g, b);
    const h = hsl.h;

    const color1 = hslToHex((h + 120) % 360, hsl.s, hsl.l);
    const color2 = hslToHex((h + 240) % 360, hsl.s, hsl.l);

    return [color1, color2];
  };

  // ============ PALETTE MANIPULATION FUNCTIONS ============

  // Generate tints (lighter versions) of a color
  const generateTints = (hex, count = 5) => {
    const { r, g, b } = hexToRgb(hex);
    const hsl = rgbToHsl(r, g, b);
    const tints = [];

    for (let i = 1; i <= count; i++) {
      const newL = Math.min(95, hsl.l + (95 - hsl.l) * (i / count));
      tints.push(hslToHex(hsl.h, hsl.s, newL));
    }
    return tints;
  };

  // Generate shades (darker versions) of a color
  const generateShades = (hex, count = 5) => {
    const { r, g, b } = hexToRgb(hex);
    const hsl = rgbToHsl(r, g, b);
    const shades = [];

    for (let i = 1; i <= count; i++) {
      const newL = Math.max(5, hsl.l - hsl.l * (i / count));
      shades.push(hslToHex(hsl.h, hsl.s, newL));
    }
    return shades;
  };

  // Generate full tint/shade scale for a color
  const generateColorScale = (hex) => {
    const shades = generateShades(hex, 4).reverse();
    const tints = generateTints(hex, 4);
    return [...shades, hex, ...tints];
  };

  // Create gradient CSS between two colors
  const createGradient = (color1, color2, direction = 'to right') => {
    return `linear-gradient(${direction}, ${color1}, ${color2})`;
  };

  // Create multi-color gradient from palette
  const createPaletteGradient = (colors, direction = 'to right') => {
    return `linear-gradient(${direction}, ${colors.join(', ')})`;
  };

  // Adjust color saturation
  const adjustSaturation = (hex, amount) => {
    const { r, g, b } = hexToRgb(hex);
    const hsl = rgbToHsl(r, g, b);
    const newS = Math.max(0, Math.min(100, hsl.s + amount));
    return hslToHex(hsl.h, newS, hsl.l);
  };

  // Adjust color brightness/lightness
  const adjustBrightness = (hex, amount) => {
    const { r, g, b } = hexToRgb(hex);
    const hsl = rgbToHsl(r, g, b);
    const newL = Math.max(0, Math.min(100, hsl.l + amount));
    return hslToHex(hsl.h, hsl.s, newL);
  };

  // Apply adjustments to entire palette
  const getAdjustedPalette = () => {
    return colorPalette.map(color => {
      let adjusted = color;
      if (paletteAdjustments.saturation !== 0) {
        adjusted = adjustSaturation(adjusted, paletteAdjustments.saturation);
      }
      if (paletteAdjustments.brightness !== 0) {
        adjusted = adjustBrightness(adjusted, paletteAdjustments.brightness);
      }
      return adjusted;
    });
  };

  // ============ PASTE FROM CLIPBOARD ============

  const pasteFromClipboard = async () => {
    setIsPasting(true);

    try {
      const clipboardItems = await navigator.clipboard.read();

      for (const item of clipboardItems) {
        // Check for image types
        const imageType = item.types.find(type => type.startsWith('image/'));

        if (imageType) {
          const blob = await item.getType(imageType);
          const file = new File([blob], 'pasted-image.png', { type: imageType });

          // Process the pasted image
          await processImageFile(file);

          toast.success('Image pasted from clipboard!', {
            icon: '📋',
            style: { borderRadius: '10px', background: '#333', color: '#fff' },
          });
          return;
        }
      }

      // No image found in clipboard
      toast.error('No image found in clipboard. Try copying an image first!', {
        icon: '📋',
        style: { borderRadius: '10px', background: '#333', color: '#fff' },
      });

    } catch (error) {
      console.error('Paste error:', error);

      if (error.name === 'NotAllowedError') {
        toast.error('Clipboard access denied. Please allow clipboard permissions.', {
          icon: '🔒',
          style: { borderRadius: '10px', background: '#333', color: '#fff' },
        });
      } else {
        toast.error('Could not paste from clipboard. Try drag & drop instead.', {
          icon: '❌',
          style: { borderRadius: '10px', background: '#333', color: '#fff' },
        });
      }
    } finally {
      setIsPasting(false);
    }
  };

  const analyzeColorPalette = (colors) => {
    if (colors.length === 0) return null;
    
    const analysis = {
      dominantColor: colors[0],
      complementary: getComplementaryColor(colors[0]),
      analogous: getAnalogousColors(colors[0]),
      triadic: getTriadicColors(colors[0]),
      colorCount: colors.length,
      isWarm: false,
      isCool: false,
      isGrayscale: false,
      averageSaturation: 0,
      averageLightness: 0
    };

    // Check if image is grayscale
    const isGrayscale = colors.every(color => {
      const { r, g, b } = hexToRgb(color);
      return Math.abs(r - g) < 10 && Math.abs(g - b) < 10 && Math.abs(r - b) < 10;
    });
    
    analysis.isGrayscale = isGrayscale;

    // Analyze color temperature and properties
    let totalSaturation = 0;
    let totalLightness = 0;
    let warmCount = 0;
    let coolCount = 0;

    colors.forEach(color => {
      const { r, g, b } = hexToRgb(color);
      const hsl = rgbToHsl(r, g, b);
      
      totalSaturation += hsl.s;
      totalLightness += hsl.l;
      
      // For grayscale images, determine temperature based on lightness
      if (isGrayscale) {
        if (hsl.l > 60) warmCount++; // Light grays are "warm"
        else if (hsl.l < 40) coolCount++; // Dark grays are "cool"
      } else {
        // Determine if warm or cool for colored images
        if (hsl.h >= 0 && hsl.h <= 60) warmCount++; // Red to Yellow
        if (hsl.h >= 180 && hsl.h <= 240) coolCount++; // Cyan to Blue
      }
    });

    analysis.averageSaturation = Math.round(totalSaturation / colors.length);
    analysis.averageLightness = Math.round(totalLightness / colors.length);
    analysis.isWarm = warmCount > coolCount;
    analysis.isCool = coolCount > warmCount;

    return analysis;
  };

  // Image preprocessing
  const preprocessImage = (imageSrc) => {
    return new Promise((resolve) => {
      const img = new Image();
      img.onload = () => {
        const canvas = document.createElement('canvas');
        const ctx = canvas.getContext('2d');
        
        // Resize for better performance
        const maxSize = preprocessingOptions.resize ? 800 : img.width;
        const scale = Math.min(maxSize / img.width, maxSize / img.height);
        canvas.width = img.width * scale;
        canvas.height = img.height * scale;
        
        ctx.drawImage(img, 0, 0, canvas.width, canvas.height);
        
        // Apply blur if enabled
        if (preprocessingOptions.blur) {
          ctx.filter = 'blur(1px)';
          ctx.drawImage(canvas, 0, 0);
        }
        
        // Apply contrast if enabled
        if (preprocessingOptions.contrast) {
          const imageData = ctx.getImageData(0, 0, canvas.width, canvas.height);
          const data = imageData.data;
          for (let i = 0; i < data.length; i += 4) {
            data[i] = Math.min(255, data[i] * 1.2);     // Red
            data[i + 1] = Math.min(255, data[i + 1] * 1.2); // Green
            data[i + 2] = Math.min(255, data[i + 2] * 1.2); // Blue
          }
          ctx.putImageData(imageData, 0, 0);
        }
        
        resolve(canvas.toDataURL());
      };
      img.src = imageSrc;
    });
  };

  // Advanced color distance calculation using CIEDE2000 (most perceptually accurate)
  const colorDistance = (color1, color2, useCiede2000 = true) => {
    const rgb1 = hexToRgb(color1);
    const rgb2 = hexToRgb(color2);

    if (useCiede2000) {
      // Use CIEDE2000 for most accurate perceptual distance
      const lab1 = rgbToLab(rgb1.r, rgb1.g, rgb1.b);
      const lab2 = rgbToLab(rgb2.r, rgb2.g, rgb2.b);
      return ciede2000(lab1, lab2);
    } else {
      // Use OKLab for faster but still accurate distance
      return oklabDistance(rgb1, rgb2) * 100; // Scale to similar range as CIEDE2000
    }
  };

  // Convert RGB to LAB color space for perceptual accuracy
  const rgbToLab = (r, g, b) => {
    // Normalize RGB values
    let red = r / 255;
    let green = g / 255;
    let blue = b / 255;

    // Apply gamma correction
    red = red > 0.04045 ? Math.pow((red + 0.055) / 1.055, 2.4) : red / 12.92;
    green = green > 0.04045 ? Math.pow((green + 0.055) / 1.055, 2.4) : green / 12.92;
    blue = blue > 0.04045 ? Math.pow((blue + 0.055) / 1.055, 2.4) : blue / 12.92;

    // Convert to XYZ color space
    let x = (red * 0.4124 + green * 0.3576 + blue * 0.1805) / 0.95047;
    let y = (red * 0.2126 + green * 0.7152 + blue * 0.0722) / 1.00000;
    let z = (red * 0.0193 + green * 0.1192 + blue * 0.9505) / 1.08883;

    // Convert to LAB
    x = x > 0.008856 ? Math.pow(x, 1/3) : (7.787 * x + 16/116);
    y = y > 0.008856 ? Math.pow(y, 1/3) : (7.787 * y + 16/116);
    z = z > 0.008856 ? Math.pow(z, 1/3) : (7.787 * z + 16/116);

    const l = (116 * y) - 16;
    const a = 500 * (x - y);
    const labB = 200 * (y - z);

    return { l, a, b: labB };
  };

  // Convert RGB to OKLab color space (more perceptually uniform than LAB)
  const rgbToOklab = (r, g, b) => {
    // Convert to linear RGB
    const toLinear = (c) => {
      c = c / 255;
      return c <= 0.04045 ? c / 12.92 : Math.pow((c + 0.055) / 1.055, 2.4);
    };

    const lr = toLinear(r);
    const lg = toLinear(g);
    const lb = toLinear(b);

    // Convert to LMS
    const l = Math.cbrt(0.4122214708 * lr + 0.5363325363 * lg + 0.0514459929 * lb);
    const m = Math.cbrt(0.2119034982 * lr + 0.6806995451 * lg + 0.1073969566 * lb);
    const s = Math.cbrt(0.0883024619 * lr + 0.2817188376 * lg + 0.6299787005 * lb);

    // Convert to OKLab
    return {
      L: 0.2104542553 * l + 0.7936177850 * m - 0.0040720468 * s,
      a: 1.9779984951 * l - 2.4285922050 * m + 0.4505937099 * s,
      b: 0.0259040371 * l + 0.7827717662 * m - 0.8086757660 * s
    };
  };

  // CIEDE2000 color difference - most accurate perceptual color distance
  const ciede2000 = (lab1, lab2) => {
    const { l: L1, a: a1, b: b1 } = lab1;
    const { l: L2, a: a2, b: b2 } = lab2;

    const kL = 1, kC = 1, kH = 1;

    const C1 = Math.sqrt(a1 * a1 + b1 * b1);
    const C2 = Math.sqrt(a2 * a2 + b2 * b2);
    const Cab = (C1 + C2) / 2;

    const G = 0.5 * (1 - Math.sqrt(Math.pow(Cab, 7) / (Math.pow(Cab, 7) + Math.pow(25, 7))));

    const a1p = a1 * (1 + G);
    const a2p = a2 * (1 + G);

    const C1p = Math.sqrt(a1p * a1p + b1 * b1);
    const C2p = Math.sqrt(a2p * a2p + b2 * b2);

    const h1p = Math.atan2(b1, a1p) * 180 / Math.PI;
    const h2p = Math.atan2(b2, a2p) * 180 / Math.PI;

    const h1pAdj = h1p < 0 ? h1p + 360 : h1p;
    const h2pAdj = h2p < 0 ? h2p + 360 : h2p;

    const dLp = L2 - L1;
    const dCp = C2p - C1p;

    let dhp;
    if (C1p * C2p === 0) {
      dhp = 0;
    } else if (Math.abs(h2pAdj - h1pAdj) <= 180) {
      dhp = h2pAdj - h1pAdj;
    } else if (h2pAdj - h1pAdj > 180) {
      dhp = h2pAdj - h1pAdj - 360;
    } else {
      dhp = h2pAdj - h1pAdj + 360;
    }

    const dHp = 2 * Math.sqrt(C1p * C2p) * Math.sin(dhp * Math.PI / 360);

    const Lp = (L1 + L2) / 2;
    const Cp = (C1p + C2p) / 2;

    let Hp;
    if (C1p * C2p === 0) {
      Hp = h1pAdj + h2pAdj;
    } else if (Math.abs(h1pAdj - h2pAdj) <= 180) {
      Hp = (h1pAdj + h2pAdj) / 2;
    } else if (h1pAdj + h2pAdj < 360) {
      Hp = (h1pAdj + h2pAdj + 360) / 2;
    } else {
      Hp = (h1pAdj + h2pAdj - 360) / 2;
    }

    const T = 1 - 0.17 * Math.cos((Hp - 30) * Math.PI / 180)
              + 0.24 * Math.cos(2 * Hp * Math.PI / 180)
              + 0.32 * Math.cos((3 * Hp + 6) * Math.PI / 180)
              - 0.20 * Math.cos((4 * Hp - 63) * Math.PI / 180);

    const dTheta = 30 * Math.exp(-Math.pow((Hp - 275) / 25, 2));
    const RC = 2 * Math.sqrt(Math.pow(Cp, 7) / (Math.pow(Cp, 7) + Math.pow(25, 7)));
    const SL = 1 + (0.015 * Math.pow(Lp - 50, 2)) / Math.sqrt(20 + Math.pow(Lp - 50, 2));
    const SC = 1 + 0.045 * Cp;
    const SH = 1 + 0.015 * Cp * T;
    const RT = -Math.sin(2 * dTheta * Math.PI / 180) * RC;

    const dE = Math.sqrt(
      Math.pow(dLp / (kL * SL), 2) +
      Math.pow(dCp / (kC * SC), 2) +
      Math.pow(dHp / (kH * SH), 2) +
      RT * (dCp / (kC * SC)) * (dHp / (kH * SH))
    );

    return dE;
  };

  // OKLab color distance (simpler and faster than CIEDE2000, still perceptually accurate)
  const oklabDistance = (rgb1, rgb2) => {
    const ok1 = rgbToOklab(rgb1.r, rgb1.g, rgb1.b);
    const ok2 = rgbToOklab(rgb2.r, rgb2.g, rgb2.b);

    const dL = ok1.L - ok2.L;
    const da = ok1.a - ok2.a;
    const db = ok1.b - ok2.b;

    return Math.sqrt(dL * dL + da * da + db * db);
  };

  // Advanced color validation with grayscale support
  const isValidColor = (hex) => {
    const { r, g, b } = hexToRgb(hex);
    const hsl = rgbToHsl(r, g, b);
    
    // Filter out very dark or very light colors that might be noise
    if (hsl.l < 5 || hsl.l > 95) return false;
    
    // For grayscale images, allow desaturated colors
    // For colored images, filter out very desaturated colors
    const isGrayscale = Math.abs(r - g) < 10 && Math.abs(g - b) < 10 && Math.abs(r - b) < 10;
    
    if (!isGrayscale && hsl.s < 10) return false;
    
    // Filter out colors that are too close to pure black/white
    const distanceFromBlack = Math.sqrt(r*r + g*g + b*b);
    const distanceFromWhite = Math.sqrt((255-r)*(255-r) + (255-g)*(255-g) + (255-b)*(255-b));
    
    if (distanceFromBlack < 30 || distanceFromWhite < 30) return false;
    
    return true;
  };

  // Helper function to remove exact duplicates first
  const removeExactDuplicates = (colors) => {
    return [...new Set(colors)];
  };

  // Advanced color filtering with perceptual accuracy
  const filterSimilarColors = (colors, threshold = 15) => {
    // First remove exact duplicates
    const uniqueColors = removeExactDuplicates(colors);
    
    // Filter out invalid colors (noise, grays, etc.)
    const validColors = uniqueColors.filter(color => isValidColor(color));
    
    // Sort by color importance (saturation and lightness)
    const sortedColors = validColors.sort((a, b) => {
      const hslA = rgbToHsl(...Object.values(hexToRgb(a)));
      const hslB = rgbToHsl(...Object.values(hexToRgb(b)));
      
      // Prioritize colors with good saturation and mid-range lightness
      const scoreA = hslA.s * (1 - Math.abs(hslA.l - 50) / 50);
      const scoreB = hslB.s * (1 - Math.abs(hslB.l - 50) / 50);
      
      return scoreB - scoreA;
    });
    
    const filtered = [];
    for (const color of sortedColors) {
      const isSimilar = filtered.some(existingColor => 
        colorDistance(color, existingColor) < threshold
      );
      if (!isSimilar) {
        filtered.push(color);
      }
    }
    return filtered;
  };

  // Helper function to ensure no duplicates in final palette
  const ensureUniquePalette = (colors, targetCount = 6) => {
    // Remove exact duplicates first
    let uniqueColors = removeExactDuplicates(colors);
    
    // Filter similar colors
    uniqueColors = filterSimilarColors(uniqueColors);
    
    // If we have enough unique colors, return them
    if (uniqueColors.length >= targetCount) {
      return uniqueColors.slice(0, targetCount);
    }
    
    // If we don't have enough, generate additional unique colors
    const result = [...uniqueColors];
    const usedColors = new Set(uniqueColors);
    
    // Generate additional colors by slightly varying existing ones
    while (result.length < targetCount) {
      const baseColor = uniqueColors[result.length % uniqueColors.length] || "#808080";
      const { r, g, b } = hexToRgb(baseColor);
      
      // Create variations by adjusting RGB values
      const variation = Math.floor(Math.random() * 60) - 30; // -30 to +30
      const newR = Math.max(0, Math.min(255, r + variation));
      const newG = Math.max(0, Math.min(255, g + variation));
      const newB = Math.max(0, Math.min(255, b + variation));
      
      const newColor = `#${newR.toString(16).padStart(2, '0')}${newG.toString(16).padStart(2, '0')}${newB.toString(16).padStart(2, '0')}`;
      
      // Only add if it's not already used
      if (!usedColors.has(newColor)) {
        result.push(newColor);
        usedColors.add(newColor);
      } else {
        // If we can't generate a unique color, break to avoid infinite loop
        break;
      }
    }
    
    return result;
  };

  // Enhanced Vibrant extraction with advanced settings
  const extractWithVibrant = async (imageSrc) => {
    return new Promise((resolve, reject) => {
      Vibrant.from(imageSrc)
          .quality(1)
        .maxColorCount(24) // Increased for more color options
          .getPalette((err, palette) => {
            if (err) {
              console.error('Vibrant error:', err);
              reject(err);
              return;
            }
            if (palette) {
              let extractedColors = Object.entries(palette)
                .filter(([_, swatch]) => swatch)
                .sort((a, b) => b[1].population - a[1].population)
              .map(([_, swatch]) => swatch.getHex())
              .filter(color => isValidColor(color)); // Filter out invalid colors
            
            // Enhanced sorting by color importance
            extractedColors = extractedColors.sort((a, b) => {
              const hslA = rgbToHsl(...Object.values(hexToRgb(a)));
              const hslB = rgbToHsl(...Object.values(hexToRgb(b)));
              
              // Score based on saturation, lightness, and population
              const scoreA = hslA.s * (1 - Math.abs(hslA.l - 50) / 50);
              const scoreB = hslB.s * (1 - Math.abs(hslB.l - 50) / 50);
              
              return scoreB - scoreA;
            });
            
            // Ensure unique palette with no duplicates
            const uniquePalette = ensureUniquePalette(extractedColors, 6);
            resolve(uniquePalette);
          } else {
            console.warn('No palette returned from Vibrant');
            resolve([]);
          }
        });
    });
  };

  // Simple fallback color extraction
  const extractSimpleColors = async (imageSrc) => {
    return new Promise((resolve) => {
      const img = new Image();
      img.onload = () => {
        const canvas = document.createElement('canvas');
        const ctx = canvas.getContext('2d');
        canvas.width = 100;
        canvas.height = 100;
        ctx.drawImage(img, 0, 0, 100, 100);
        
        const imageData = ctx.getImageData(0, 0, 100, 100);
        const pixels = imageData.data;
        const colors = [];
        
        // Sample colors from the image
        for (let i = 0; i < pixels.length; i += 16) {
          const r = pixels[i];
          const g = pixels[i + 1];
          const b = pixels[i + 2];
          const hex = `#${r.toString(16).padStart(2, '0')}${g.toString(16).padStart(2, '0')}${b.toString(16).padStart(2, '0')}`;
          colors.push(hex);
        }
        
        // Get unique colors and limit to 6
        const uniqueColors = [...new Set(colors)].slice(0, 6);
        resolve(uniqueColors);
      };
      img.src = imageSrc;
    });
  };

  // Fast Average Color extraction
  const extractWithFastAverage = async (imageSrc) => {
    try {
      const fac = new FastAverageColor();
      const color = await fac.getColorAsync(imageSrc);
      if (!color || !color.hex) {
        console.warn('No color returned from Fast Average Color');
        return [];
      }
      const uniquePalette = ensureUniquePalette([color.hex], 6);
      return uniquePalette;
    } catch (error) {
      console.error('Fast Average Color extraction failed:', error);
      return [];
    }
  };

  // Median-cut algorithm for better color quantization
  const extractWithMedianCut = async (imageSrc) => {
    return new Promise((resolve) => {
      const img = new Image();
      img.onload = () => {
        const canvas = document.createElement('canvas');
        const ctx = canvas.getContext('2d');
        
        const maxSize = 300;
        const scale = Math.min(maxSize / img.width, maxSize / img.height);
        canvas.width = img.width * scale;
        canvas.height = img.height * scale;
        ctx.drawImage(img, 0, 0, canvas.width, canvas.height);
        
        const imageData = ctx.getImageData(0, 0, canvas.width, canvas.height);
        const data = imageData.data;
        const pixels = [];
        
        // Collect all pixels
        for (let i = 0; i < data.length; i += 4) {
          if (data[i + 3] > 128) { // Skip transparent pixels
            pixels.push([data[i], data[i + 1], data[i + 2]]);
          }
        }
        
        // Median-cut algorithm
        const buckets = [pixels];
        const targetBuckets = 6;
        
        while (buckets.length < targetBuckets && buckets.length < pixels.length) {
          let maxRange = 0;
          let bucketIndex = 0;
          
          // Find bucket with largest range
          buckets.forEach((bucket, index) => {
            if (bucket.length > 1) {
              const ranges = [0, 0, 0]; // R, G, B ranges
              for (let channel = 0; channel < 3; channel++) {
                const values = bucket.map(pixel => pixel[channel]);
                ranges[channel] = Math.max(...values) - Math.min(...values);
              }
              const maxChannelRange = Math.max(...ranges);
              if (maxChannelRange > maxRange) {
                maxRange = maxChannelRange;
                bucketIndex = index;
              }
            }
          });
          
          if (maxRange === 0) break;
          
          // Find channel with largest range
          const bucket = buckets[bucketIndex];
          const ranges = [0, 0, 0];
          for (let channel = 0; channel < 3; channel++) {
            const values = bucket.map(pixel => pixel[channel]);
            ranges[channel] = Math.max(...values) - Math.min(...values);
          }
          const maxChannel = ranges.indexOf(Math.max(...ranges));
          
          // Sort by the channel with largest range
          bucket.sort((a, b) => a[maxChannel] - b[maxChannel]);
          
          // Split at median
          const median = Math.floor(bucket.length / 2);
          const bucket1 = bucket.slice(0, median);
          const bucket2 = bucket.slice(median);
          
          buckets.splice(bucketIndex, 1, bucket1, bucket2);
        }
        
        // Calculate average color for each bucket
        const colors = buckets
          .filter(bucket => bucket.length > 0)
          .map(bucket => {
            const avgR = Math.round(bucket.reduce((sum, p) => sum + p[0], 0) / bucket.length);
            const avgG = Math.round(bucket.reduce((sum, p) => sum + p[1], 0) / bucket.length);
            const avgB = Math.round(bucket.reduce((sum, p) => sum + p[2], 0) / bucket.length);
            return `#${avgR.toString(16).padStart(2, '0')}${avgG.toString(16).padStart(2, '0')}${avgB.toString(16).padStart(2, '0')}`;
          })
          .filter(color => isValidColor(color));
        
        const uniquePalette = ensureUniquePalette(colors, 6);
        resolve(uniquePalette);
      };
      img.src = imageSrc;
    });
  };

  // Octree quantization for efficient color reduction
  const extractWithOctree = async (imageSrc) => {
    return new Promise((resolve) => {
      const img = new Image();
      img.onload = () => {
        const canvas = document.createElement('canvas');
        const ctx = canvas.getContext('2d');
        
        const maxSize = 200;
        const scale = Math.min(maxSize / img.width, maxSize / img.height);
        canvas.width = img.width * scale;
        canvas.height = img.height * scale;
        ctx.drawImage(img, 0, 0, canvas.width, canvas.height);
        
        const imageData = ctx.getImageData(0, 0, canvas.width, canvas.height);
        const data = imageData.data;
        
        // Build octree
        class OctreeNode {
          constructor(level = 0) {
            this.level = level;
            this.children = new Array(8).fill(null);
            this.pixelCount = 0;
            this.red = 0;
            this.green = 0;
            this.blue = 0;
            this.isLeaf = false;
          }
          
          addColor(r, g, b) {
            this.pixelCount++;
            this.red += r;
            this.green += g;
            this.blue += b;
          }
          
          getAverageColor() {
            if (this.pixelCount === 0) return null;
            return {
              r: Math.round(this.red / this.pixelCount),
              g: Math.round(this.green / this.pixelCount),
              b: Math.round(this.blue / this.pixelCount)
            };
          }
        }
        
        const root = new OctreeNode();
        const maxLevel = 6;
        const maxColors = 6;
        
        // Add colors to octree
        for (let i = 0; i < data.length; i += 4) {
          if (data[i + 3] > 128) {
            const r = data[i];
            const g = data[i + 1];
            const b = data[i + 2];
            
            let node = root;
            for (let level = 0; level < maxLevel; level++) {
              const index = ((r >> (7 - level)) & 1) << 2 | 
                          ((g >> (7 - level)) & 1) << 1 | 
                          ((b >> (7 - level)) & 1);
              
              if (!node.children[index]) {
                node.children[index] = new OctreeNode(level + 1);
              }
              node = node.children[index];
            }
            node.addColor(r, g, b);
            node.isLeaf = true;
          }
        }
        
        // Reduce colors
        const leafNodes = [];
        const collectLeaves = (node) => {
          if (node.isLeaf) {
            leafNodes.push(node);
          } else {
            node.children.forEach(child => {
              if (child) collectLeaves(child);
            });
          }
        };
        collectLeaves(root);
        
        // Sort by pixel count and take top colors
        leafNodes.sort((a, b) => b.pixelCount - a.pixelCount);
        const topNodes = leafNodes.slice(0, maxColors);
        
        const colors = topNodes
          .map(node => {
            const avg = node.getAverageColor();
            if (avg) {
              return `#${avg.r.toString(16).padStart(2, '0')}${avg.g.toString(16).padStart(2, '0')}${avg.b.toString(16).padStart(2, '0')}`;
            }
            return null;
          })
          .filter(color => color && isValidColor(color));
        
        const uniquePalette = ensureUniquePalette(colors, 6);
        resolve(uniquePalette);
      };
      img.src = imageSrc;
    });
  };

  // Weighted K-means with spatial awareness
  const extractWithWeightedKMeans = async (imageSrc) => {
    return new Promise((resolve) => {
      const img = new Image();
      img.onload = () => {
        const canvas = document.createElement('canvas');
        const ctx = canvas.getContext('2d');
        
        const maxSize = 300;
        const scale = Math.min(maxSize / img.width, maxSize / img.height);
        canvas.width = img.width * scale;
        canvas.height = img.height * scale;
        ctx.drawImage(img, 0, 0, canvas.width, canvas.height);
        
        const imageData = ctx.getImageData(0, 0, canvas.width, canvas.height);
        const data = imageData.data;
        const pixels = [];
        
        // Sample pixels with spatial weighting
        for (let i = 0; i < data.length; i += 4) {
          if (data[i + 3] > 128) {
            const x = (i / 4) % canvas.width;
            const y = Math.floor((i / 4) / canvas.width);
            
            // Weight pixels by distance from center (center pixels are more important)
            const centerX = canvas.width / 2;
            const centerY = canvas.height / 2;
            const distance = Math.sqrt((x - centerX) ** 2 + (y - centerY) ** 2);
            const maxDistance = Math.sqrt(centerX ** 2 + centerY ** 2);
            const weight = 1 - (distance / maxDistance) * 0.5; // Center pixels get higher weight
            
            pixels.push({
              r: data[i],
              g: data[i + 1],
              b: data[i + 2],
              weight: weight
            });
          }
        }
        
        // Weighted K-means
        const k = 6;
        const centroids = [];
        
        // Initialize with weighted random selection
        const totalWeight = pixels.reduce((sum, p) => sum + p.weight, 0);
        let random = Math.random() * totalWeight;
        let currentWeight = 0;
        let selectedPixel = pixels[0];
        
        for (const pixel of pixels) {
          currentWeight += pixel.weight;
          if (currentWeight >= random) {
            selectedPixel = pixel;
            break;
          }
        }
        centroids.push([selectedPixel.r, selectedPixel.g, selectedPixel.b]);
        
        // Initialize remaining centroids
        for (let i = 1; i < k; i++) {
          const distances = pixels.map(pixel => {
            let minDist = Infinity;
            centroids.forEach(centroid => {
              const dist = Math.sqrt(
                Math.pow(pixel.r - centroid[0], 2) +
                Math.pow(pixel.g - centroid[1], 2) +
                Math.pow(pixel.b - centroid[2], 2)
              );
              minDist = Math.min(minDist, dist);
            });
            return minDist * minDist * pixel.weight; // Weight by distance and pixel importance
          });
          
          const sum = distances.reduce((a, b) => a + b, 0);
          random = Math.random() * sum;
          currentWeight = 0;
          selectedPixel = pixels[0];
          
          for (const pixel of pixels) {
            currentWeight += distances[pixels.indexOf(pixel)];
            if (currentWeight >= random) {
              selectedPixel = pixel;
              break;
            }
          }
          centroids.push([selectedPixel.r, selectedPixel.g, selectedPixel.b]);
        }
        
        // Weighted K-means iterations
        for (let iter = 0; iter < 15; iter++) {
          const clusters = Array(k).fill().map(() => []);
          const weights = Array(k).fill(0);
          
          pixels.forEach(pixel => {
            let minDist = Infinity;
            let closestCentroid = 0;
            
            centroids.forEach((centroid, i) => {
              const dist = Math.sqrt(
                Math.pow(pixel.r - centroid[0], 2) +
                Math.pow(pixel.g - centroid[1], 2) +
                Math.pow(pixel.b - centroid[2], 2)
              );
              if (dist < minDist) {
                minDist = dist;
                closestCentroid = i;
              }
            });
            
            clusters[closestCentroid].push(pixel);
            weights[closestCentroid] += pixel.weight;
          });
          
          // Update centroids with weighted average
          let converged = true;
          centroids.forEach((centroid, i) => {
            if (clusters[i].length > 0) {
              const totalWeight = weights[i];
              const avgR = clusters[i].reduce((sum, p) => sum + p.r * p.weight, 0) / totalWeight;
              const avgG = clusters[i].reduce((sum, p) => sum + p.g * p.weight, 0) / totalWeight;
              const avgB = clusters[i].reduce((sum, p) => sum + p.b * p.weight, 0) / totalWeight;
              
              const newCentroid = [Math.round(avgR), Math.round(avgG), Math.round(avgB)];
              const distance = Math.sqrt(
                Math.pow(centroid[0] - newCentroid[0], 2) +
                Math.pow(centroid[1] - newCentroid[1], 2) +
                Math.pow(centroid[2] - newCentroid[2], 2)
              );
              
              if (distance > 1) converged = false;
              centroid[0] = newCentroid[0];
              centroid[1] = newCentroid[1];
              centroid[2] = newCentroid[2];
            }
          });
          
          if (converged) break;
        }
        
        const colors = centroids
          .filter(centroid => !isNaN(centroid[0]))
          .map(centroid => {
            return `#${centroid[0].toString(16).padStart(2, '0')}${centroid[1].toString(16).padStart(2, '0')}${centroid[2].toString(16).padStart(2, '0')}`;
          })
          .filter(color => isValidColor(color));
        
        const uniquePalette = ensureUniquePalette(colors, 6);
        resolve(uniquePalette);
      };
      img.src = imageSrc;
    });
  };

  // Advanced K-means clustering with improved accuracy
  const extractWithKMeans = async (imageSrc) => {
    return new Promise((resolve) => {
      const img = new Image();
      img.onload = () => {
        const canvas = document.createElement('canvas');
        const ctx = canvas.getContext('2d');
        
        // Use higher resolution for better accuracy
        const maxSize = 400;
        const scale = Math.min(maxSize / img.width, maxSize / img.height);
        canvas.width = img.width * scale;
        canvas.height = img.height * scale;
        ctx.drawImage(img, 0, 0, canvas.width, canvas.height);
        
        const imageData = ctx.getImageData(0, 0, canvas.width, canvas.height);
        const data = imageData.data;
        const pixels = [];
        
        // Sample pixels with better distribution
        for (let i = 0; i < data.length; i += 8) {
          const r = data[i];
          const g = data[i + 1];
          const b = data[i + 2];
          const a = data[i + 3];
          
          // Skip transparent pixels
          if (a > 128) {
            pixels.push([r, g, b]);
          }
        }
        
        // Advanced K-means with better initialization
        const k = 8; // Start with more clusters
        const centroids = [];
        
        // K-means++ initialization for better starting points
        centroids.push(pixels[Math.floor(Math.random() * pixels.length)]);
        
        for (let i = 1; i < k; i++) {
          const distances = pixels.map(pixel => {
            let minDist = Infinity;
            centroids.forEach(centroid => {
              const dist = Math.sqrt(
                Math.pow(pixel[0] - centroid[0], 2) +
                Math.pow(pixel[1] - centroid[1], 2) +
                Math.pow(pixel[2] - centroid[2], 2)
              );
              minDist = Math.min(minDist, dist);
            });
            return minDist * minDist;
          });
          
          const sum = distances.reduce((a, b) => a + b, 0);
          let random = Math.random() * sum;
          let index = 0;
          while (random > distances[index]) {
            random -= distances[index];
            index++;
          }
          centroids.push([...pixels[index]]);
        }
        
        // Enhanced K-means with more iterations
        for (let iter = 0; iter < 20; iter++) {
          const clusters = Array(k).fill().map(() => []);
          
          // Assign pixels to closest centroid using perceptual distance
          pixels.forEach(pixel => {
            let minDist = Infinity;
            let closestCentroid = 0;
            
            centroids.forEach((centroid, i) => {
              const pixelHex = `#${pixel[0].toString(16).padStart(2, '0')}${pixel[1].toString(16).padStart(2, '0')}${pixel[2].toString(16).padStart(2, '0')}`;
              const centroidHex = `#${centroid[0].toString(16).padStart(2, '0')}${centroid[1].toString(16).padStart(2, '0')}${centroid[2].toString(16).padStart(2, '0')}`;
              const dist = colorDistance(pixelHex, centroidHex);
              
              if (dist < minDist) {
                minDist = dist;
                closestCentroid = i;
              }
            });
            
            clusters[closestCentroid].push(pixel);
          });
          
          // Update centroids with weighted average
          let converged = true;
          centroids.forEach((centroid, i) => {
            if (clusters[i].length > 0) {
              const avgR = clusters[i].reduce((sum, p) => sum + p[0], 0) / clusters[i].length;
              const avgG = clusters[i].reduce((sum, p) => sum + p[1], 0) / clusters[i].length;
              const avgB = clusters[i].reduce((sum, p) => sum + p[2], 0) / clusters[i].length;
              
              const newCentroid = [Math.round(avgR), Math.round(avgG), Math.round(avgB)];
              const distance = Math.sqrt(
                Math.pow(centroid[0] - newCentroid[0], 2) +
                Math.pow(centroid[1] - newCentroid[1], 2) +
                Math.pow(centroid[2] - newCentroid[2], 2)
              );
              
              if (distance > 1) converged = false;
              centroid[0] = newCentroid[0];
              centroid[1] = newCentroid[1];
              centroid[2] = newCentroid[2];
            }
          });
          
          if (converged) break;
        }
        
        // Convert centroids to hex and filter
        const colors = centroids
          .filter(centroid => !isNaN(centroid[0]) && isValidColor(`#${centroid[0].toString(16).padStart(2, '0')}${centroid[1].toString(16).padStart(2, '0')}${centroid[2].toString(16).padStart(2, '0')}`))
          .map(centroid => {
            return `#${centroid[0].toString(16).padStart(2, '0')}${centroid[1].toString(16).padStart(2, '0')}${centroid[2].toString(16).padStart(2, '0')}`;
          });
        
        // Ensure unique palette with no duplicates
        const uniquePalette = ensureUniquePalette(colors, 6);
        resolve(uniquePalette);
      };
      img.src = imageSrc;
    });
  };

  // Combined extraction method with all algorithms
  const extractWithCombined = async (imageSrc) => {
    const [vibrantColors, averageColor, kmeansColors, medianCutColors, octreeColors, weightedKmeansColors] = await Promise.all([
      extractWithVibrant(imageSrc),
      extractWithFastAverage(imageSrc),
      extractWithKMeans(imageSrc),
      extractWithMedianCut(imageSrc),
      extractWithOctree(imageSrc),
      extractWithWeightedKMeans(imageSrc)
    ]);

    // Combine all colors and ensure unique palette
    const combined = [...vibrantColors, ...averageColor, ...kmeansColors, ...medianCutColors, ...octreeColors, ...weightedKmeansColors];
    const uniquePalette = ensureUniquePalette(combined, 6);

    return uniquePalette;
  };

  // Highly accurate perceptual extraction using OKLab clustering with histogram analysis
  const extractWithPerceptual = async (imageSrc) => {
    return new Promise((resolve) => {
      const img = new Image();
      img.onload = () => {
        const canvas = document.createElement('canvas');
        const ctx = canvas.getContext('2d');

        // Use higher resolution for accuracy
        const maxSize = 500;
        const scale = Math.min(maxSize / img.width, maxSize / img.height, 1);
        canvas.width = Math.round(img.width * scale);
        canvas.height = Math.round(img.height * scale);
        ctx.drawImage(img, 0, 0, canvas.width, canvas.height);

        const imageData = ctx.getImageData(0, 0, canvas.width, canvas.height);
        const data = imageData.data;

        // Build color histogram in OKLab space with spatial weighting
        const colorMap = new Map();
        const centerX = canvas.width / 2;
        const centerY = canvas.height / 2;
        const maxDist = Math.sqrt(centerX * centerX + centerY * centerY);

        for (let i = 0; i < data.length; i += 4) {
          const r = data[i];
          const g = data[i + 1];
          const b = data[i + 2];
          const a = data[i + 3];

          // Skip transparent pixels
          if (a < 128) continue;

          // Calculate spatial weight (center pixels more important)
          const pixelIndex = i / 4;
          const x = pixelIndex % canvas.width;
          const y = Math.floor(pixelIndex / canvas.width);
          const distFromCenter = Math.sqrt((x - centerX) ** 2 + (y - centerY) ** 2);
          const spatialWeight = 1 - (distFromCenter / maxDist) * 0.3;

          // Quantize to reduce unique colors (in OKLab space for perceptual uniformity)
          const oklab = rgbToOklab(r, g, b);
          // Quantize OKLab values
          const qL = Math.round(oklab.L * 20) / 20;
          const qa = Math.round(oklab.a * 40) / 40;
          const qb = Math.round(oklab.b * 40) / 40;
          const key = `${qL},${qa},${qb}`;

          if (colorMap.has(key)) {
            const entry = colorMap.get(key);
            entry.count += spatialWeight;
            entry.sumR += r * spatialWeight;
            entry.sumG += g * spatialWeight;
            entry.sumB += b * spatialWeight;
          } else {
            colorMap.set(key, {
              count: spatialWeight,
              sumR: r * spatialWeight,
              sumG: g * spatialWeight,
              sumB: b * spatialWeight,
              oklab: oklab
            });
          }
        }

        // Convert to array and sort by frequency
        let colorEntries = Array.from(colorMap.values())
          .map(entry => ({
            r: Math.round(entry.sumR / entry.count),
            g: Math.round(entry.sumG / entry.count),
            b: Math.round(entry.sumB / entry.count),
            count: entry.count,
            oklab: entry.oklab
          }))
          .sort((a, b) => b.count - a.count);

        // K-means++ in OKLab space for final clustering
        const k = 8;
        const centroids = [];

        // Initialize first centroid with highest frequency color
        if (colorEntries.length > 0) {
          centroids.push({ ...colorEntries[0].oklab });
        }

        // K-means++ initialization
        for (let i = 1; i < k && i < colorEntries.length; i++) {
          const distances = colorEntries.map(entry => {
            let minDist = Infinity;
            centroids.forEach(centroid => {
              const dL = entry.oklab.L - centroid.L;
              const da = entry.oklab.a - centroid.a;
              const db = entry.oklab.b - centroid.b;
              const dist = Math.sqrt(dL * dL + da * da + db * db);
              minDist = Math.min(minDist, dist);
            });
            return minDist * minDist * entry.count; // Weight by frequency
          });

          const totalDist = distances.reduce((a, b) => a + b, 0);
          let random = Math.random() * totalDist;
          let idx = 0;
          while (random > 0 && idx < distances.length - 1) {
            random -= distances[idx];
            idx++;
          }
          centroids.push({ ...colorEntries[idx].oklab });
        }

        // K-means iterations in OKLab space
        for (let iter = 0; iter < 25; iter++) {
          const clusters = Array(centroids.length).fill(null).map(() => ({
            sumL: 0, suma: 0, sumb: 0, sumR: 0, sumG: 0, sumB: 0, totalWeight: 0
          }));

          // Assign colors to nearest centroid
          colorEntries.forEach(entry => {
            let minDist = Infinity;
            let nearest = 0;

            centroids.forEach((centroid, i) => {
              const dL = entry.oklab.L - centroid.L;
              const da = entry.oklab.a - centroid.a;
              const db = entry.oklab.b - centroid.b;
              const dist = Math.sqrt(dL * dL + da * da + db * db);
              if (dist < minDist) {
                minDist = dist;
                nearest = i;
              }
            });

            const weight = entry.count;
            clusters[nearest].sumL += entry.oklab.L * weight;
            clusters[nearest].suma += entry.oklab.a * weight;
            clusters[nearest].sumb += entry.oklab.b * weight;
            clusters[nearest].sumR += entry.r * weight;
            clusters[nearest].sumG += entry.g * weight;
            clusters[nearest].sumB += entry.b * weight;
            clusters[nearest].totalWeight += weight;
          });

          // Update centroids
          let converged = true;
          centroids.forEach((centroid, i) => {
            if (clusters[i].totalWeight > 0) {
              const newL = clusters[i].sumL / clusters[i].totalWeight;
              const newa = clusters[i].suma / clusters[i].totalWeight;
              const newb = clusters[i].sumb / clusters[i].totalWeight;

              const change = Math.sqrt(
                (centroid.L - newL) ** 2 +
                (centroid.a - newa) ** 2 +
                (centroid.b - newb) ** 2
              );

              if (change > 0.001) converged = false;

              centroid.L = newL;
              centroid.a = newa;
              centroid.b = newb;
              centroid.r = Math.round(clusters[i].sumR / clusters[i].totalWeight);
              centroid.g = Math.round(clusters[i].sumG / clusters[i].totalWeight);
              centroid.b_rgb = Math.round(clusters[i].sumB / clusters[i].totalWeight);
              centroid.weight = clusters[i].totalWeight;
            }
          });

          if (converged) break;
        }

        // Convert to hex and filter
        const colors = centroids
          .filter(c => c.weight > 0 && !isNaN(c.r))
          .sort((a, b) => b.weight - a.weight)
          .map(c => {
            const r = Math.max(0, Math.min(255, c.r));
            const g = Math.max(0, Math.min(255, c.g));
            const b = Math.max(0, Math.min(255, c.b_rgb));
            return `#${r.toString(16).padStart(2, '0')}${g.toString(16).padStart(2, '0')}${b.toString(16).padStart(2, '0')}`;
          })
          .filter(color => isValidColor(color));

        // Use CIEDE2000 for final deduplication
        const finalColors = [];
        for (const color of colors) {
          const isTooSimilar = finalColors.some(existing =>
            colorDistance(color, existing, true) < 8
          );
          if (!isTooSimilar) {
            finalColors.push(color);
          }
          if (finalColors.length >= 6) break;
        }

        const uniquePalette = ensureUniquePalette(finalColors, 6);
        resolve(uniquePalette);
      };
      img.src = imageSrc;
    });
  };

  const handleImageUpload = useCallback(async (event) => {
    const file = event.target.files[0];
    if (file && file.type.substr(0, 5) === "image") {
      await processImageFile(file);
    }
  }, [extractionMethod, preprocessingOptions, colorHistory]);

  const handleDragOver = useCallback((e) => {
    e.preventDefault();
    e.stopPropagation();
    setIsDragOver(true);
  }, []);

  const handleDragLeave = useCallback((e) => {
    e.preventDefault();
    e.stopPropagation();
    setIsDragOver(false);
  }, []);

  const processImageFile = useCallback(async (file) => {
    if (file && file.type.substr(0, 5) === "image") {
      setIsProcessing(true);
      const reader = new FileReader();
      reader.onload = async (e) => {
        setSelectedImage(e.target.result);
        
        try {
          console.log('Starting image processing...');
          
          // Preprocess image if options are enabled
          const processedImage = await preprocessImage(e.target.result);
          console.log('Image preprocessed successfully');
          
          // Extract colors based on selected method
          let extractedColors = [];
          console.log('Extracting colors with method:', extractionMethod);
          
          try {
            switch (extractionMethod) {
              case 'perceptual':
                extractedColors = await extractWithPerceptual(processedImage);
                break;
              case 'vibrant':
                extractedColors = await extractWithVibrant(processedImage);
                break;
              case 'fast-average':
                extractedColors = await extractWithFastAverage(processedImage);
                break;
              case 'kmeans':
                extractedColors = await extractWithKMeans(processedImage);
                break;
              case 'median-cut':
                extractedColors = await extractWithMedianCut(processedImage);
                break;
              case 'octree':
                extractedColors = await extractWithOctree(processedImage);
                break;
              case 'weighted-kmeans':
                extractedColors = await extractWithWeightedKMeans(processedImage);
                break;
              case 'combined':
                extractedColors = await extractWithCombined(processedImage);
                break;
              default:
                extractedColors = await extractWithPerceptual(processedImage);
                }
          } catch (extractionError) {
            console.error('Extraction method failed, trying fallback:', extractionError);
            // Fallback to simple color extraction
            extractedColors = await extractSimpleColors(processedImage);
          }
              
          console.log('Colors extracted:', extractedColors);

              setColorPalette(extractedColors);

          // Hide controls after successful extraction
          setShowControls(false);
          setShowPaletteTools(true); // Auto-show tools
          
          // Save to color history
          const historyEntry = {
            id: Date.now(),
            colors: extractedColors,
            method: extractionMethod,
            timestamp: new Date().toLocaleString(),
          };
          setColorHistory(prev => [historyEntry, ...prev.slice(0, 9)]);

          // Analyze colors
          const analysis = analyzeColorPalette(extractedColors);
          setColorAnalysis(analysis);

          toast.success(`Successfully extracted ${extractedColors.length} colors!`, {
            icon: "🎨",
            style: {
              borderRadius: "10px",
              background: "#333",
              color: "#fff",
            },
          });
        } catch (error) {
          console.error('Error processing image:', error);
          toast.error('Failed to process image. Please try again.', {
            icon: "❌",
            style: {
              borderRadius: "10px",
              background: "#333",
              color: "#fff",
            },
          });
        } finally {
          setIsProcessing(false);
        }
      };
      reader.readAsDataURL(file);
    }
  }, [extractionMethod, preprocessingOptions, colorHistory]);

  const handleDrop = useCallback(async (e) => {
    e.preventDefault();
    e.stopPropagation();
    setIsDragOver(false);
    
    const files = e.dataTransfer.files;
    if (files.length > 0) {
      const file = files[0];
      if (file.type.substr(0, 5) === "image") {
        await processImageFile(file);
      }
    }
  }, [processImageFile]);

  // Listen for Ctrl+V paste anywhere on page
  useEffect(() => {
    const handlePaste = async (e) => {
      // Only handle if we're in the upload state
      if (!showControls || selectedImage || colorPalette.length > 0) return;

      const items = e.clipboardData?.items;
      if (!items) return;

      for (const item of items) {
        if (item.type.startsWith('image/')) {
          e.preventDefault();
          const file = item.getAsFile();
          if (file) {
            await processImageFile(file);
            toast.success('Image pasted!', {
              icon: '📋',
              style: { borderRadius: '10px', background: '#333', color: '#fff' },
            });
          }
          return;
        }
      }
    };

    document.addEventListener('paste', handlePaste);
    return () => document.removeEventListener('paste', handlePaste);
  }, [showControls, selectedImage, colorPalette.length, processImageFile]);

  const copyToClipboard = (color) => {
    const formattedColor = formatColor(color, colorFormat);
    navigator.clipboard
      .writeText(formattedColor)
      .then(() => {
        toast(`${formattedColor} copied to clipboard!`, {
          icon: "📋",
          style: {
            borderRadius: "10px",
            background: "#333",
            color: "#fff",
          },
        });
      })
      .catch((err) => {
        console.error("Failed to copy: ", err);
      });
  };

  const copyAllColors = () => {
    const allColors = colorPalette.map(color => formatColor(color, colorFormat)).join('\n');
    navigator.clipboard
      .writeText(allColors)
      .then(() => {
        toast("All colors copied to clipboard!", {
          icon: "📋",
          style: {
            borderRadius: "10px",
            background: "#333",
            color: "#fff",
          },
        });
      })
      .catch((err) => {
        console.error("Failed to copy: ", err);
      });
  };

  const exportPalette = () => {
    const paletteData = {
      colors: colorPalette,
      method: extractionMethod,
      timestamp: new Date().toISOString(),
      analysis: analyzeColorPalette(colorPalette)
    };
    
    const dataStr = JSON.stringify(paletteData, null, 2);
    const dataBlob = new Blob([dataStr], { type: 'application/json' });
    const url = URL.createObjectURL(dataBlob);
    
    const link = document.createElement('a');
    link.href = url;
    link.download = `color-palette-${Date.now()}.json`;
    link.click();
    
    URL.revokeObjectURL(url);
    
    toast("Palette exported successfully!", {
      icon: "📥",
      style: {
        borderRadius: "10px",
        background: "#333",
        color: "#fff",
      },
      });
  };

  return (
    <div className="color-extractor-page">
      {/* Back to Home Button - Top Left */}
      <div className="fixed top-4 left-4 z-50">
        <Link
          to="/"
          className="bg-white/20 backdrop-blur-md text-white hover:text-indigo-300 font-medium flex items-center gap-2 px-4 py-2 rounded-lg transition-all duration-200 hover:bg-white/30"
        >
          ← Back to Home
        </Link>
      </div>

    <div className="image-color-analyzer">
      {/* Header */}
      <div className="flex items-center justify-between mb-6 pb-4 border-b border-gray-200">
        <h1 className="title mb-0">Color Extractor</h1>
        {colorPalette.length > 0 && (
          <button
            onClick={() => { setShowControls(true); setSelectedImage(null); setColorPalette([]); setColorAnalysis(null); setShowPaletteTools(false); setShowUIPreview(false); }}
            className="inline-flex items-center gap-2 text-xs sm:text-sm bg-indigo-600 text-white px-3 py-2 rounded-lg font-medium hover:bg-indigo-500 transition-colors duration-200"
            title="Extract another image"
          >
            <svg className="w-4 h-4" fill="currentColor" viewBox="0 0 24 24"><path d="M12,4V1L8,5L12,9V6A6,6 0 0,1 18,12A6,6 0 0,1 12,18A6,6 0 0,1 6,12H4A8,8 0 0,0 12,20A8,8 0 0,0 20,12A8,8 0 0,0 12,4Z"/></svg>
            New Extraction
          </button>
        )}
      </div>

      {/* Two Column Layout */}
      <div className={`flex flex-col ${colorPalette.length > 0 ? 'lg:flex-row' : ''} gap-6`}>

        {/* ============ LEFT COLUMN: Extraction ============ */}
        <div className={`${colorPalette.length > 0 ? 'lg:w-2/5 lg:flex-shrink-0' : 'w-full max-w-xl mx-auto'}`}>

      {/* ============ CLEAN UPLOAD STATE ============ */}
      {showControls && !selectedImage && (
        <div className="space-y-6">
          {/* Hero Upload Area */}
          <motion.div
            className={`upload-area ${isDragOver ? 'drag-over' : ''}`}
            whileHover={{ scale: 1.01 }}
            whileTap={{ scale: 0.99 }}
            onDragOver={handleDragOver}
            onDragLeave={handleDragLeave}
            onDrop={handleDrop}
          >
            <input
              type="file"
              accept="image/*"
              onChange={handleImageUpload}
              className="hidden"
              id="imageUpload"
              disabled={isProcessing}
            />
            <label htmlFor="imageUpload" className="upload-label cursor-pointer">
              <div className="text-5xl mb-4">
                {isProcessing ? "⏳" : "🎨"}
              </div>
              <p className="text-gray-700 font-medium text-lg mb-1">
                {isProcessing ? "Extracting colors..." : isDragOver ? "Drop it here!" : "Drop an image here"}
              </p>
              <p className="text-gray-400 text-sm">or click to browse</p>
              {isProcessing && (
                <div className="w-48 bg-gray-200 rounded-full h-1.5 mt-4">
                  <div
                    className="bg-indigo-600 h-1.5 rounded-full transition-all duration-300"
                    style={{ width: `${loadingProgress}%` }}
                  />
                </div>
              )}
            </label>
          </motion.div>

          {/* Paste Button */}
          <button
            onClick={pasteFromClipboard}
            disabled={isPasting}
            className="w-full py-3 px-4 bg-gray-50 hover:bg-gray-100 border border-gray-200 rounded-xl text-gray-600 font-medium transition-all flex items-center justify-center gap-2 disabled:opacity-50"
          >
            {isPasting ? (
              <>
                <svg className="w-4 h-4 animate-spin" fill="none" viewBox="0 0 24 24">
                  <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                  <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z"></path>
                </svg>
                Pasting...
              </>
            ) : (
              <>
                <span>📋</span>
                Paste from clipboard
                <span className="text-xs text-gray-400 ml-1">(Ctrl+V)</span>
              </>
            )}
          </button>

          {/* Minimal Settings Row */}
          <div className="flex items-center justify-between p-3 bg-gray-50 rounded-xl">
            <div className="flex items-center gap-4">
              <select
                value={extractionMethod}
                onChange={(e) => setExtractionMethod(e.target.value)}
                className="text-sm bg-white border border-gray-200 rounded-lg px-3 py-1.5 text-gray-600 focus:outline-none focus:ring-2 focus:ring-indigo-500"
              >
                <option value="perceptual">Perceptual</option>
                <option value="vibrant">Vibrant</option>
                <option value="kmeans">K-Means</option>
                <option value="combined">Combined</option>
              </select>
              <select
                value={colorFormat}
                onChange={(e) => setColorFormat(e.target.value)}
                className="text-sm bg-white border border-gray-200 rounded-lg px-3 py-1.5 text-gray-600 focus:outline-none focus:ring-2 focus:ring-indigo-500"
              >
                <option value="hex">HEX</option>
                <option value="rgb">RGB</option>
                <option value="hsl">HSL</option>
              </select>
            </div>
            <span className="text-xs text-gray-400">JPG, PNG, SVG</span>
          </div>
        </div>
      )}

      {/* Image Preview */}
      {selectedImage && (
        <motion.img
          src={selectedImage}
          alt="Uploaded"
          className="uploaded-image"
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.3 }}
        />
      )}
      {colorPalette.length > 0 ? (
        <div className="color-palette-container">
          <div className="palette-header">
            <h3 className="palette-title">Extracted Colors</h3>
            <div className="palette-actions">
              <button
                className="export-btn"
                onClick={() => exportPalette()}
                title="Export palette"
              >
                <svg className="w-4 h-4 mr-2" fill="currentColor" viewBox="0 0 24 24">
                  <path d="M14,2H6A2,2 0 0,0 4,4V20A2,2 0 0,0 6,22H18A2,2 0 0,0 20,20V8L14,2M18,20H6V4H13V9H18V20Z" />
                </svg>
                Export
              </button>
              <button
                className="copy-all-btn"
                onClick={() => copyAllColors()}
                title="Copy all colors"
              >
                <svg className="w-4 h-4 mr-2" fill="currentColor" viewBox="0 0 24 24">
                  <path d="M19,21H8V7H19M19,5H8A2,2 0 0,0 6,7V21A2,2 0 0,0 8,23H19A2,2 0 0,0 21,21V7A2,2 0 0,0 19,5M16,1H4A2,2 0 0,0 2,3V17H4V3H16V1Z" />
                </svg>
                Copy All
              </button>
            </div>
          </div>
        <div className="color-palette">
          {colorPalette.map((color, index) => (
            <motion.div
              key={index}
                className="color-swatch-container"
                whileHover={{ scale: 1.05 }}
                whileTap={{ scale: 0.95 }}
              >
                <div
              className="color-swatch"
              style={{ backgroundColor: color }}
              onClick={() => copyToClipboard(color)}
                ></div>
                {showHexCodes && (
                  <div className="color-code">
                    {formatColor(color, colorFormat)}
                  </div>
                )}
              </motion.div>
          ))}
        </div>
          
          {showColorAnalysis && (
            <div className="color-analysis">
              <h4 className="analysis-title">Color Analysis</h4>
              {analyzeColorPalette(colorPalette) && (
                <div className="analysis-content">
                  <div className="analysis-row">
                    <span className="analysis-label">Dominant Color:</span>
                    <div className="analysis-color" style={{ backgroundColor: analyzeColorPalette(colorPalette).dominantColor }}>
                      {formatColor(analyzeColorPalette(colorPalette).dominantColor, colorFormat)}
                    </div>
                  </div>
                  <div className="analysis-row">
                    <span className="analysis-label">Complementary:</span>
                    <div className="analysis-color" style={{ backgroundColor: analyzeColorPalette(colorPalette).complementary }}>
                      {formatColor(analyzeColorPalette(colorPalette).complementary, colorFormat)}
                    </div>
                  </div>
                  <div className="analysis-row">
                    <span className="analysis-label">Image Type:</span>
                    <span className="analysis-value">
                      {analyzeColorPalette(colorPalette).isGrayscale ? '⚫ Grayscale' : analyzeColorPalette(colorPalette).isWarm ? '🔥 Warm' : analyzeColorPalette(colorPalette).isCool ? '❄️ Cool' : '⚖️ Neutral'}
                    </span>
                  </div>
                  <div className="analysis-row">
                    <span className="analysis-label">Saturation:</span>
                    <span className="analysis-value">{analyzeColorPalette(colorPalette).averageSaturation}%</span>
                  </div>
                  <div className="analysis-row">
                    <span className="analysis-label">Lightness:</span>
                    <span className="analysis-value">{analyzeColorPalette(colorPalette).averageLightness}%</span>
                  </div>
                </div>
              )}
            </div>
          )}
        </div>
      ) : selectedImage && !isProcessing ? (
        <div className="text-center py-12">
          <div className="text-6xl mb-4">🎨</div>
          <h3 className="text-xl font-semibold text-gray-700 mb-2">No Colors Found</h3>
          <p className="text-gray-500 mb-4">Try a different image or extraction method</p>
          <button
            onClick={() => {
              setSelectedImage(null);
              setColorPalette([]);
              setColorAnalysis(null);
              setShowControls(true);
            }}
            className="bg-indigo-600 text-white px-4 py-2 rounded-lg hover:bg-indigo-500 transition-colors"
          >
            Try Another Image
          </button>
        </div>
      ) : null}

        </div>
        {/* ============ END LEFT COLUMN ============ */}

        {/* ============ RIGHT COLUMN: Tools & Preview ============ */}
        {colorPalette.length > 0 && (
        <div className="lg:w-3/5 lg:flex-grow tools-panel-sticky space-y-4">

          {/* Feature Toggle Tabs */}
          <div className="bg-gray-100 p-1 rounded-xl inline-flex gap-1">
            <button
              onClick={() => { setShowPaletteTools(true); setShowUIPreview(false); }}
              className={`px-5 py-2.5 rounded-lg text-sm font-semibold transition-all duration-200 ${showPaletteTools ? 'bg-white text-indigo-600 shadow-sm' : 'text-gray-600 hover:text-gray-900'}`}
            >
              🎛️ Palette Tools
            </button>
            <button
              onClick={() => { setShowUIPreview(true); setShowPaletteTools(false); }}
              className={`px-5 py-2.5 rounded-lg text-sm font-semibold transition-all duration-200 ${showUIPreview ? 'bg-white text-indigo-600 shadow-sm' : 'text-gray-600 hover:text-gray-900'}`}
            >
              👁️ UI Preview
            </button>
          </div>

          {/* ============ PALETTE MANIPULATION TOOLS ============ */}
          {showPaletteTools && (
            <motion.div
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: 10 }}
              transition={{ duration: 0.2 }}
              className="space-y-4"
            >
              {/* Palette Adjustments */}
              <div className="tool-card">
                <h5 className="text-gray-800 font-semibold text-sm mb-4 flex items-center gap-2">
                  <span className="w-6 h-6 rounded-md bg-indigo-100 flex items-center justify-center text-xs">🎚️</span>
                  Adjust Palette
                </h5>
                <div className="grid gap-5">
                  <div>
                    <label className="text-gray-600 text-sm font-medium flex justify-between mb-2">
                      <span>Saturation</span>
                      <span className="text-indigo-600 font-semibold">{paletteAdjustments.saturation > 0 ? '+' : ''}{paletteAdjustments.saturation}%</span>
                    </label>
                    <input
                      type="range"
                      min="-50"
                      max="50"
                      value={paletteAdjustments.saturation}
                      onChange={(e) => setPaletteAdjustments(prev => ({ ...prev, saturation: parseInt(e.target.value) }))}
                      className="w-full accent-indigo-600 h-2 rounded-lg"
                    />
                  </div>
                  <div>
                    <label className="text-gray-600 text-sm font-medium flex justify-between mb-2">
                      <span>Brightness</span>
                      <span className="text-indigo-600 font-semibold">{paletteAdjustments.brightness > 0 ? '+' : ''}{paletteAdjustments.brightness}%</span>
                    </label>
                    <input
                      type="range"
                      min="-50"
                      max="50"
                      value={paletteAdjustments.brightness}
                      onChange={(e) => setPaletteAdjustments(prev => ({ ...prev, brightness: parseInt(e.target.value) }))}
                      className="w-full accent-indigo-600 h-2 rounded-lg"
                    />
                  </div>
                </div>

                {/* Adjusted Palette Preview */}
                {(paletteAdjustments.saturation !== 0 || paletteAdjustments.brightness !== 0) && (
                  <div className="mt-5 pt-4 border-t border-gray-100">
                    <p className="text-gray-600 text-sm font-medium mb-3">Adjusted Preview:</p>
                    <div className="flex gap-2">
                      {getAdjustedPalette().map((color, i) => (
                        <div
                          key={i}
                          className="w-10 h-10 rounded-lg cursor-pointer hover:scale-110 transition-transform shadow-sm"
                          style={{ backgroundColor: color }}
                          onClick={() => copyToClipboard(color)}
                          title={color}
                        />
                      ))}
                    </div>
                    <button
                      onClick={() => {
                        setColorPalette(getAdjustedPalette());
                        setPaletteAdjustments({ saturation: 0, brightness: 0 });
                        toast.success('Adjustments applied!', { icon: '✅' });
                      }}
                      className="mt-3 px-4 py-2 bg-green-600 text-white text-sm font-medium rounded-lg hover:bg-green-500 transition-colors shadow-sm"
                    >
                      Apply Adjustments
                    </button>
                  </div>
                )}
              </div>

              {/* Tints & Shades */}
              <div className="tool-card">
                <h5 className="text-gray-800 font-semibold text-sm mb-3 flex items-center gap-2">
                  <span className="w-6 h-6 rounded-md bg-purple-100 flex items-center justify-center text-xs">🎨</span>
                  Tints & Shades
                </h5>
                <p className="text-gray-500 text-xs mb-3">Click a color to generate its scale</p>
                <div className="flex gap-2 flex-wrap">
                  {colorPalette.map((color, index) => (
                    <button
                      key={index}
                      onClick={() => setSelectedColorForTools(selectedColorForTools === color ? null : color)}
                      className={`w-12 h-12 rounded-lg transition-all shadow-sm ${selectedColorForTools === color ? 'ring-2 ring-indigo-500 ring-offset-2 scale-110' : 'hover:scale-105'}`}
                      style={{ backgroundColor: color }}
                      title={`Generate tints/shades for ${color}`}
                    />
                  ))}
                </div>

                {selectedColorForTools && (
                  <motion.div
                    initial={{ opacity: 0, y: -10 }}
                    animate={{ opacity: 1, y: 0 }}
                    className="mt-4 p-4 bg-gray-50 rounded-lg border border-gray-200"
                  >
                    <p className="text-gray-600 text-sm font-medium mb-3">Color Scale for <span className="font-mono text-indigo-600">{selectedColorForTools}</span></p>
                    <div className="flex gap-1">
                      {generateColorScale(selectedColorForTools).map((scaleColor, i) => (
                        <div
                          key={i}
                          className={`flex-1 h-12 cursor-pointer hover:scale-y-110 transition-transform rounded ${i === 4 ? 'ring-2 ring-indigo-500' : ''}`}
                          style={{ backgroundColor: scaleColor }}
                          onClick={() => copyToClipboard(scaleColor)}
                          title={scaleColor}
                        />
                      ))}
                    </div>
                    <p className="text-gray-400 text-xs mt-2 text-center font-medium">← Darker | Original | Lighter →</p>
                  </motion.div>
                )}
              </div>

              {/* Gradient Generator */}
              <div className="tool-card">
                <h5 className="text-gray-800 font-semibold text-sm mb-3 flex items-center gap-2">
                  <span className="w-6 h-6 rounded-md bg-gradient-to-r from-pink-100 to-purple-100 flex items-center justify-center text-xs">🌈</span>
                  Gradients
                </h5>
                <div
                  className="h-16 rounded-lg cursor-pointer hover:scale-[1.02] transition-transform shadow-sm"
                  style={{ background: createPaletteGradient(colorPalette) }}
                  onClick={() => {
                    navigator.clipboard.writeText(createPaletteGradient(colorPalette));
                    toast.success('Gradient CSS copied!', { icon: '🎨' });
                  }}
                  title="Click to copy gradient CSS"
                />
                <p className="text-gray-400 text-xs mt-2">Click to copy CSS</p>

                {/* Individual Gradients */}
                <div className="grid grid-cols-2 sm:grid-cols-3 gap-2 mt-3">
                  {colorPalette.slice(0, -1).map((color, i) => (
                    <div
                      key={i}
                      className="h-8 rounded-lg cursor-pointer hover:scale-105 transition-transform"
                      style={{ background: createGradient(color, colorPalette[i + 1]) }}
                      onClick={() => {
                        navigator.clipboard.writeText(createGradient(color, colorPalette[i + 1]));
                        toast.success('Gradient copied!', { icon: '🎨' });
                      }}
                      title={`${color} → ${colorPalette[i + 1]}`}
                    />
                  ))}
                </div>
              </div>

            </motion.div>
          )}

          {/* ============ LIVE UI PREVIEW ============ */}
          {showUIPreview && (
            <motion.div
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: 10 }}
              transition={{ duration: 0.2 }}
              className="tool-card !p-0 overflow-hidden"
            >
              <div className="flex items-center justify-between p-4 border-b border-gray-100">
                <h4 className="text-gray-800 font-semibold text-sm flex items-center gap-2">
                  <span className="w-6 h-6 rounded-md bg-blue-100 flex items-center justify-center text-xs">👁️</span>
                  Live Preview
                </h4>
                <div className="flex gap-1 bg-gray-100 rounded-lg p-0.5">
                  <button
                    onClick={() => setPreviewMode('light')}
                    className={`px-3 py-1.5 rounded-md text-xs font-semibold transition-all ${previewMode === 'light' ? 'bg-white text-gray-900 shadow-sm' : 'text-gray-500 hover:text-gray-700'}`}
                  >
                    ☀️ Light
                  </button>
                  <button
                    onClick={() => setPreviewMode('dark')}
                    className={`px-3 py-1.5 rounded-md text-xs font-semibold transition-all ${previewMode === 'dark' ? 'bg-gray-800 text-white shadow-sm' : 'text-gray-500 hover:text-gray-700'}`}
                  >
                    🌙 Dark
                  </button>
                </div>
              </div>

              {/* UI Preview Container */}
              <div
                className="ui-preview-container"
                style={{
                  backgroundColor: previewMode === 'light' ? '#ffffff' : '#1a1a2e',
                  color: previewMode === 'light' ? '#1a1a2e' : '#ffffff'
                }}
              >
                {/* Mock Navbar */}
                <nav
                  className="px-4 py-3 flex items-center justify-between"
                  style={{ backgroundColor: colorPalette[0] || '#6366f1' }}
                >
                  <div className="flex items-center gap-2">
                    <div className="w-8 h-8 rounded-lg" style={{ backgroundColor: colorPalette[1] || '#ffffff' }}></div>
                    <span className="font-bold text-white">Brand</span>
                  </div>
                  <div className="flex gap-4">
                    <span className="text-white/80 text-sm cursor-pointer hover:text-white">Home</span>
                    <span className="text-white/80 text-sm cursor-pointer hover:text-white">About</span>
                    <span className="text-white/80 text-sm cursor-pointer hover:text-white">Contact</span>
                  </div>
                </nav>

                {/* Content Area */}
                <div className="p-6">
                  {/* Hero Section */}
                  <div className="text-center mb-6">
                    <h2 className="text-2xl font-bold mb-2" style={{ color: colorPalette[0] || '#6366f1' }}>
                      Welcome to Your Site
                    </h2>
                    <p className="text-sm opacity-70 mb-4">
                      This is a preview of how your palette looks on a real UI
                    </p>
                    <div className="flex gap-2 justify-center">
                      <button
                        className="px-4 py-2 rounded-lg text-white font-medium text-sm"
                        style={{ backgroundColor: colorPalette[0] || '#6366f1' }}
                      >
                        Primary Button
                      </button>
                      <button
                        className="px-4 py-2 rounded-lg font-medium text-sm border-2"
                        style={{
                          borderColor: colorPalette[1] || '#6366f1',
                          color: colorPalette[1] || '#6366f1',
                          backgroundColor: 'transparent'
                        }}
                      >
                        Secondary
                      </button>
                    </div>
                  </div>

                  {/* Cards */}
                  <div className="grid grid-cols-3 gap-3">
                    {colorPalette.slice(0, 3).map((color, i) => (
                      <div
                        key={i}
                        className="rounded-lg overflow-hidden"
                        style={{
                          backgroundColor: previewMode === 'light' ? '#f8f9fa' : '#2a2a3e',
                          border: `1px solid ${previewMode === 'light' ? '#e5e7eb' : '#3a3a4e'}`
                        }}
                      >
                        <div className="h-16" style={{ backgroundColor: color }}></div>
                        <div className="p-3">
                          <div className="text-xs font-semibold mb-1" style={{ color: color }}>
                            Card {i + 1}
                          </div>
                          <div className="text-xs opacity-60">
                            Sample card content
                          </div>
                        </div>
                      </div>
                    ))}
                  </div>

                  {/* Tags/Badges */}
                  <div className="flex gap-2 mt-4 justify-center flex-wrap">
                    {colorPalette.map((color, i) => (
                      <span
                        key={i}
                        className="px-2 py-1 rounded text-xs font-medium text-white"
                        style={{ backgroundColor: color }}
                      >
                        Tag {i + 1}
                      </span>
                    ))}
                  </div>

                  {/* Form Elements */}
                  <div className="mt-4 max-w-xs mx-auto">
                    <input
                      type="text"
                      placeholder="Sample input..."
                      className="w-full px-3 py-2 rounded-lg text-sm mb-2"
                      style={{
                        backgroundColor: previewMode === 'light' ? '#ffffff' : '#2a2a3e',
                        border: `2px solid ${colorPalette[2] || '#e5e7eb'}`,
                        color: previewMode === 'light' ? '#1a1a2e' : '#ffffff'
                      }}
                    />
                    <div className="flex gap-2">
                      <button
                        className="flex-1 px-3 py-2 rounded-lg text-white text-sm font-medium"
                        style={{ backgroundColor: colorPalette[0] || '#6366f1' }}
                      >
                        Submit
                      </button>
                      <button
                        className="flex-1 px-3 py-2 rounded-lg text-sm font-medium"
                        style={{
                          backgroundColor: colorPalette[3] || '#e5e7eb',
                          color: previewMode === 'light' ? '#1a1a2e' : '#ffffff'
                        }}
                      >
                        Cancel
                      </button>
                    </div>
                  </div>
                </div>

                {/* Footer */}
                <footer
                  className="px-4 py-3 text-center text-xs"
                  style={{
                    backgroundColor: colorPalette[5] || colorPalette[0] || '#6366f1',
                    color: '#ffffff'
                  }}
                >
                  © 2024 Your Brand. Built with your color palette.
                </footer>
              </div>
            </motion.div>
          )}

        </div>
        )}
        {/* ============ END RIGHT COLUMN ============ */}

      </div>
      {/* End Two Column Layout */}

      </div>
    </div>
  );
};

export default ImageColorAnalyzer;