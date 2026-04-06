/**
 * Projector Database - India Available Models v3.0
 *
 * Comprehensive database of 17 India-available projector models
 * from the SOS Master Document v3.0, organized by category and price point.
 *
 * Sources: Manufacturer specs, verified for India market availability
 */

/**
 * Detailed specification interface for home theater projectors
 */
export interface ProjectorSpec {
  id: string;
  brand: string;
  model: string;
  specifications: {
    /** Throw ratio range for distance-to-image-size calculation */
    throwRatio: { min: number; max: number };
    /** Brightness in lumens (ANSI) */
    brightness: number;
    /** Native resolution */
    resolution: '1080p' | '4K';
    /** Contrast ratio specification */
    contrast: string;
    /** Optical lens shift capabilities (percentage of image height) */
    lensShift: {
      /** Vertical shift range from optical center */
      vertical: { min: number; max: number };
      /** Horizontal shift range from optical center */
      horizontal: { min: number; max: number };
    };
    /** Vertical offset relative to optical center (%) */
    offset: number;
    /** Physical dimensions and weight */
    dimensions: {
      width: number;   // meters
      depth: number;   // meters
      height: number;  // meters
      weight: number;  // kg
    };
  };
  installation: {
    /** Minimum and maximum ceiling distance from screen (meters) */
    minCeilingDistance: number;
    maxCeilingDistance: number;
    /** Electrical power requirement (watts) */
    powerRequirement: number;
    /** Operating noise level (dB) */
    noiseLevel: number;
  };
  pricing: {
    /** Maximum Suggested Retail Price in INR */
    msrp: number;
    /** Market category classification */
    category: 'budget' | 'mid-range' | 'premium' | 'reference';
  };
  /** Key features, technology notes, and special capabilities */
  notes: string;
}

/**
 * Master projector database - 17 India-available models
 */
export const projectorDatabase: ProjectorSpec[] = [
  // BUDGET TIER (< ₹1,00,000)
  {
    id: 'optoma-hd146x',
    brand: 'Optoma',
    model: 'HD146X',
    specifications: {
      throwRatio: { min: 1.47, max: 1.62 },
      brightness: 3600,
      resolution: '1080p',
      contrast: '25000:1',
      lensShift: {
        vertical: { min: 0, max: 0 },
        horizontal: { min: 0, max: 0 },
      },
      offset: 115,
      dimensions: {
        width: 0.31,
        depth: 0.23,
        height: 0.11,
        weight: 2.7,
      },
    },
    installation: {
      minCeilingDistance: 0.30,
      maxCeilingDistance: 8.0,
      powerRequirement: 295,
      noiseLevel: 26,
    },
    pricing: {
      msrp: 65000,
      category: 'budget',
    },
    notes: 'No lens shift with fixed offset. Precise ceiling mount required. DLP 1080p, 1.1x zoom. Entry-level reliable performance.',
  },
  {
    id: 'viewsonic-px701hd',
    brand: 'ViewSonic',
    model: 'PX701HD',
    specifications: {
      throwRatio: { min: 1.50, max: 1.65 },
      brightness: 3500,
      resolution: '1080p',
      contrast: '12000:1',
      lensShift: {
        vertical: { min: 0, max: 0 },
        horizontal: { min: 0, max: 0 },
      },
      offset: 96,
      dimensions: {
        width: 0.32,
        depth: 0.24,
        height: 0.12,
        weight: 2.9,
      },
    },
    installation: {
      minCeilingDistance: 0.30,
      maxCeilingDistance: 8.0,
      powerRequirement: 310,
      noiseLevel: 28,
    },
    pricing: {
      msrp: 85000,
      category: 'budget',
    },
    notes: 'No lens shift, standard ceiling mount. Best for 100-120" screens. DLP 1080p, 1.09x zoom, HDMI 2.0, hybrid mode.',
  },

  // MID-RANGE TIER (₹1-2.5L)
  {
    id: 'benq-tk860i',
    brand: 'BenQ',
    model: 'TK860i',
    specifications: {
      throwRatio: { min: 1.13, max: 1.47 },
      brightness: 3300,
      resolution: '4K',
      contrast: '50000:1 FOFO',
      lensShift: {
        vertical: { min: 0, max: 10 },
        horizontal: { min: 0, max: 0 },
      },
      offset: 100,
      dimensions: {
        width: 0.38,
        depth: 0.28,
        height: 0.13,
        weight: 4.2,
      },
    },
    installation: {
      minCeilingDistance: 0.30,
      maxCeilingDistance: 12.0,
      powerRequirement: 360,
      noiseLevel: 25,
    },
    pricing: {
      msrp: 167000,
      category: 'mid-range',
    },
    notes: 'Vertical shift +10% only, DLP 4K, 1.3x zoom, Android TV with eARC. Auto-keystone enabled.',
  },
  {
    id: 'benq-w2700i',
    brand: 'BenQ',
    model: 'W2700i',
    specifications: {
      throwRatio: { min: 1.13, max: 1.47 },
      brightness: 2000,
      resolution: '4K',
      contrast: '30000:1 dynamic iris',
      lensShift: {
        vertical: { min: 0, max: 10 },
        horizontal: { min: 0, max: 0 },
      },
      offset: 100,
      dimensions: {
        width: 0.38,
        depth: 0.28,
        height: 0.13,
        weight: 4.2,
      },
    },
    installation: {
      minCeilingDistance: 0.30,
      maxCeilingDistance: 12.0,
      powerRequirement: 310,
      noiseLevel: 26,
    },
    pricing: {
      msrp: 185000,
      category: 'mid-range',
    },
    notes: '95% DCI-P3 color gamut, dark room only. Android TV, ISF calibration certified, 1.3x zoom, dynamic iris.',
  },
  {
    id: 'epson-eh-tw6250',
    brand: 'Epson',
    model: 'EH-TW6250',
    specifications: {
      throwRatio: { min: 1.32, max: 2.15 },
      brightness: 2800,
      resolution: '4K',
      contrast: '35000:1',
      lensShift: {
        vertical: { min: -60, max: 60 },
        horizontal: { min: 0, max: 0 },
      },
      offset: 0,
      dimensions: {
        width: 0.30,
        depth: 0.23,
        height: 0.12,
        weight: 2.9,
      },
    },
    installation: {
      minCeilingDistance: 0.30,
      maxCeilingDistance: 15.0,
      powerRequirement: 230,
      noiseLevel: 24,
    },
    pricing: {
      msrp: 170000,
      category: 'mid-range',
    },
    notes: '3LCD no rainbow artifacts, ±60% vertical lens shift, 1.6x zoom, lightweight. Android TV, lamp life 4500/7500hr modes.',
  },
  {
    id: 'epson-eh-tw7100',
    brand: 'Epson',
    model: 'EH-TW7100',
    specifications: {
      throwRatio: { min: 1.32, max: 2.15 },
      brightness: 3000,
      resolution: '4K',
      contrast: '100000:1',
      lensShift: {
        vertical: { min: -60, max: 60 },
        horizontal: { min: -24, max: 24 },
      },
      offset: 0,
      dimensions: {
        width: 0.35,
        depth: 0.31,
        height: 0.15,
        weight: 7.3,
      },
    },
    installation: {
      minCeilingDistance: 0.30,
      maxCeilingDistance: 15.0,
      powerRequirement: 285,
      noiseLevel: 20,
    },
    pricing: {
      msrp: 278000,
      category: 'mid-range',
    },
    notes: '3LCD, full H+V lens shift (±60V, ±24H), quietest at 20dB. ISF certified, HDR10+HLG, 3D capable, Bluetooth connectivity.',
  },
  {
    id: 'xgimi-horizon-ultra',
    brand: 'XGIMI',
    model: 'Horizon Ultra',
    specifications: {
      throwRatio: { min: 1.20, max: 1.50 },
      brightness: 2300,
      resolution: '4K',
      contrast: '1200:1 native',
      lensShift: {
        vertical: { min: 0, max: 0 },
        horizontal: { min: 0, max: 0 },
      },
      offset: 0,
      dimensions: {
        width: 0.22,
        depth: 0.19,
        height: 0.14,
        weight: 4.0,
      },
    },
    installation: {
      minCeilingDistance: 0.20,
      maxCeilingDistance: 5.0,
      powerRequirement: 190,
      noiseLevel: 30,
    },
    pricing: {
      msrp: 165000,
      category: 'mid-range',
    },
    notes: 'Dual Light laser+LED hybrid, Dolby Vision, Netflix pre-installed. No optical shift, auto-keystone. Tabletop/short throw only.',
  },
  {
    id: 'xgimi-horizon-s-max',
    brand: 'XGIMI',
    model: 'Horizon S Max',
    specifications: {
      throwRatio: { min: 1.15, max: 1.50 },
      brightness: 3100,
      resolution: '4K',
      contrast: '1500:1 native',
      lensShift: {
        vertical: { min: 0, max: 0 },
        horizontal: { min: 0, max: 0 },
      },
      offset: 0,
      dimensions: {
        width: 0.24,
        depth: 0.21,
        height: 0.16,
        weight: 4.5,
      },
    },
    installation: {
      minCeilingDistance: 0.20,
      maxCeilingDistance: 5.0,
      powerRequirement: 220,
      noiseLevel: 30,
    },
    pricing: {
      msrp: 210000,
      category: 'mid-range',
    },
    notes: 'Highest brightness smart projector 2026. No optical shift, auto-keystone, Netflix, tabletop placement only.',
  },
  {
    id: 'optoma-uhd33',
    brand: 'Optoma',
    model: 'UHD33',
    specifications: {
      throwRatio: { min: 1.39, max: 2.22 },
      brightness: 3600,
      resolution: '4K',
      contrast: '1000000:1 dynamic',
      lensShift: {
        vertical: { min: 0, max: 0 },
        horizontal: { min: 0, max: 0 },
      },
      offset: 111,
      dimensions: {
        width: 0.31,
        depth: 0.22,
        height: 0.11,
        weight: 3.1,
      },
    },
    installation: {
      minCeilingDistance: 0.30,
      maxCeilingDistance: 10.0,
      powerRequirement: 300,
      noiseLevel: 28,
    },
    pricing: {
      msrp: 225000,
      category: 'mid-range',
    },
    notes: 'Highest brightness 4K at price point. DLP 4K, 1.6x zoom, supports 130"+ screens. 16ms gaming mode, dynamic contrast.',
  },
  {
    id: 'benq-gp520',
    brand: 'BenQ',
    model: 'GP520',
    specifications: {
      throwRatio: { min: 1.15, max: 1.50 },
      brightness: 2600,
      resolution: '4K',
      contrast: '3000000:1 dynamic',
      lensShift: {
        vertical: { min: 0, max: 0 },
        horizontal: { min: 0, max: 0 },
      },
      offset: 100,
      dimensions: {
        width: 0.22,
        depth: 0.19,
        height: 0.14,
        weight: 3.2,
      },
    },
    installation: {
      minCeilingDistance: 0.20,
      maxCeilingDistance: 5.0,
      powerRequirement: 180,
      noiseLevel: 28,
    },
    pricing: {
      msrp: 150000,
      category: 'mid-range',
    },
    notes: 'Multi-LED 4-color technology, 20000hr lamp life. Android TV, no optical shift. Ideal for tabletop/low-shelf placement.',
  },

  // PREMIUM TIER (₹2.5-6L)
  {
    id: 'epson-eh-ls11000w',
    brand: 'Epson',
    model: 'EH-LS11000W',
    specifications: {
      throwRatio: { min: 1.25, max: 2.04 },
      brightness: 2500,
      resolution: '4K',
      contrast: '2500000:1',
      lensShift: {
        vertical: { min: -96, max: 96 },
        horizontal: { min: -47, max: 47 },
      },
      offset: 0,
      dimensions: {
        width: 0.52,
        depth: 0.43,
        height: 0.20,
        weight: 12.0,
      },
    },
    installation: {
      minCeilingDistance: 0.30,
      maxCeilingDistance: 15.0,
      powerRequirement: 320,
      noiseLevel: 20,
    },
    pricing: {
      msrp: 450000,
      category: 'premium',
    },
    notes: '3LCD laser source, ±96%V ±47%H best flexibility available. Motorized all functions, 20000hr life. HDR10+HLG, ISF+THX certified.',
  },
  {
    id: 'benq-w4000i',
    brand: 'BenQ',
    model: 'W4000i',
    specifications: {
      throwRatio: { min: 1.50, max: 2.00 },
      brightness: 3200,
      resolution: '4K',
      contrast: '3000000:1 dynamic',
      lensShift: {
        vertical: { min: -30, max: 30 },
        horizontal: { min: 0, max: 0 },
      },
      offset: 100,
      dimensions: {
        width: 0.41,
        depth: 0.30,
        height: 0.14,
        weight: 5.9,
      },
    },
    installation: {
      minCeilingDistance: 0.30,
      maxCeilingDistance: 12.0,
      powerRequirement: 350,
      noiseLevel: 24,
    },
    pricing: {
      msrp: 300000,
      category: 'premium',
    },
    notes: 'DLP 4K lamp projector, ±30% vertical shift, Android TV with Netflix. Cinema color modes, 4-LED engine, 1.3x zoom.',
  },
  {
    id: 'sony-vpl-xw5000es',
    brand: 'Sony',
    model: 'VPL-XW5000ES',
    specifications: {
      throwRatio: { min: 1.38, max: 2.21 },
      brightness: 2000,
      resolution: '4K',
      contrast: '200000:1 native',
      lensShift: {
        vertical: { min: -71, max: 71 },
        horizontal: { min: -25, max: 25 },
      },
      offset: 0,
      dimensions: {
        width: 0.46,
        depth: 0.46,
        height: 0.20,
        weight: 13.1,
      },
    },
    installation: {
      minCeilingDistance: 0.30,
      maxCeilingDistance: 15.0,
      powerRequirement: 310,
      noiseLevel: 22,
    },
    pricing: {
      msrp: 500000,
      category: 'premium',
    },
    notes: 'True native 4K SXRD laser, X1 Ultimate processor, ±71%V ±25%H. Dark room only, 2000lm limitation. 20000hr laser, premium build.',
  },
  {
    id: 'lg-cinebeam-hu810pw',
    brand: 'LG',
    model: 'CineBeam HU810PW',
    specifications: {
      throwRatio: { min: 1.25, max: 1.67 },
      brightness: 2700,
      resolution: '4K',
      contrast: '2000000:1',
      lensShift: {
        vertical: { min: -60, max: 60 },
        horizontal: { min: -24, max: 24 },
      },
      offset: 0,
      dimensions: {
        width: 0.44,
        depth: 0.32,
        height: 0.15,
        weight: 7.9,
      },
    },
    installation: {
      minCeilingDistance: 0.30,
      maxCeilingDistance: 12.0,
      powerRequirement: 250,
      noiseLevel: 24,
    },
    pricing: {
      msrp: 280000,
      category: 'premium',
    },
    notes: 'RGB pure laser source, webOS platform, ±60%V ±24%H. AirPlay+Chromecast integrated, white aesthetic design.',
  },

  // REFERENCE TIER (> ₹6L)
  {
    id: 'sony-vpl-xw7000es',
    brand: 'Sony',
    model: 'VPL-XW7000ES',
    specifications: {
      throwRatio: { min: 1.35, max: 2.84 },
      brightness: 3200,
      resolution: '4K',
      contrast: '20000:1 native',
      lensShift: {
        vertical: { min: -85, max: 85 },
        horizontal: { min: -36, max: 36 },
      },
      offset: 0,
      dimensions: {
        width: 0.50,
        depth: 0.50,
        height: 0.22,
        weight: 14.0,
      },
    },
    installation: {
      minCeilingDistance: 0.30,
      maxCeilingDistance: 20.0,
      powerRequirement: 350,
      noiseLevel: 23,
    },
    pricing: {
      msrp: 1100000,
      category: 'reference',
    },
    notes: 'Sony flagship, native 4K SXRD, all motorized functions, 2.1x zoom. ±85%V ±36%H extreme flexibility, ACF lens, IMAX Enhanced. Control4/Crestron/Savant integration.',
  },
  {
    id: 'epson-eh-ls12000b',
    brand: 'Epson',
    model: 'EH-LS12000B',
    specifications: {
      throwRatio: { min: 1.35, max: 2.84 },
      brightness: 2700,
      resolution: '4K',
      contrast: '2500000:1',
      lensShift: {
        vertical: { min: -96, max: 96 },
        horizontal: { min: -47, max: 47 },
      },
      offset: 0,
      dimensions: {
        width: 0.52,
        depth: 0.47,
        height: 0.19,
        weight: 11.4,
      },
    },
    installation: {
      minCeilingDistance: 0.30,
      maxCeilingDistance: 15.0,
      powerRequirement: 358,
      noiseLevel: 19,
    },
    pricing: {
      msrp: 600000,
      category: 'reference',
    },
    notes: '3LCD laser, quietest at 19dB, widest shift ±96%V ±47%H. THX certified, all motorized controls, 20000hr lamp. 4K Pro-UHD processing.',
  },
  {
    id: 'jvc-dla-nz7',
    brand: 'JVC',
    model: 'DLA-NZ7',
    specifications: {
      throwRatio: { min: 1.36, max: 2.77 },
      brightness: 2200,
      resolution: '4K',
      contrast: '100000:1 native',
      lensShift: {
        vertical: { min: -80, max: 80 },
        horizontal: { min: -34, max: 34 },
      },
      offset: 0,
      dimensions: {
        width: 0.45,
        depth: 0.50,
        height: 0.18,
        weight: 17.0,
      },
    },
    installation: {
      minCeilingDistance: 0.30,
      maxCeilingDistance: 15.0,
      powerRequirement: 260,
      noiseLevel: 22,
    },
    pricing: {
      msrp: 1100000,
      category: 'reference',
    },
    notes: 'D-ILA LCoS native 4K, 100000:1 native contrast best in class. 8K e-shift, HDR10/HLG/HDR10+/Dolby Vision, Frame Adapt technology. Dark theater optimized.',
  },
];

/**
 * Retrieve a projector by its unique identifier
 * @param id - The projector ID (e.g., 'optoma-hd146x')
 * @returns The ProjectorSpec or undefined if not found
 */
export function getProjectorById(id: string): ProjectorSpec | undefined {
  return projectorDatabase.find(projector => projector.id === id);
}

/**
 * Get all projectors in a specific price category
 * @param category - Category: 'budget', 'mid-range', 'premium', or 'reference'
 * @returns Array of projectors matching the category
 */
export function getProjectorsByCategory(category: string): ProjectorSpec[] {
  return projectorDatabase.filter(
    projector => projector.pricing.category === category
  );
}

/**
 * Filter projectors by installation compatibility
 *
 * Calculates which projectors can accommodate a given screen width and throw distance.
 * Uses throw ratio to determine feasibility: image_width = throw_distance / throw_ratio
 *
 * @param screenWidthM - Desired screen width in meters
 * @param minThrowM - Minimum available throw distance in meters
 * @param maxThrowM - Maximum available throw distance in meters
 * @param minBrightness - Optional minimum brightness requirement in lumens
 * @returns Array of compatible projectors
 */
export function filterCompatibleProjectors(
  screenWidthM: number,
  minThrowM: number,
  maxThrowM: number,
  minBrightness?: number
): ProjectorSpec[] {
  return projectorDatabase.filter(projector => {
    // Calculate throw distance required for this screen width
    // At minimum throw ratio (closest focus): throw_dist = screen_width * min_ratio
    // At maximum throw ratio (farthest focus): throw_dist = screen_width * max_ratio
    const requiredMinThrow = screenWidthM * projector.specifications.throwRatio.min;
    const requiredMaxThrow = screenWidthM * projector.specifications.throwRatio.max;

    // Check if any part of projector's throw range overlaps with available space
    const throwRangeCompatible = requiredMinThrow <= maxThrowM && requiredMaxThrow >= minThrowM;

    // Check brightness if specified
    const brightnessOk =
      minBrightness === undefined || projector.specifications.brightness >= minBrightness;

    return throwRangeCompatible && brightnessOk;
  });
}
