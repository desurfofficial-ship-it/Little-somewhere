import * as THREE from 'three';

export interface WaterShaderUniforms {
  uTime: { value: number };
  uRain: { value: number };
  uWinter: { value: number };
  uWind: { value: number };
  uDusk: { value: number };
  uSplashPos: { value: THREE.Vector3 };
  uSplashAge: { value: number };
}

export function getWaterShaderUniforms(
  mat: THREE.Material | undefined,
): WaterShaderUniforms | undefined {
  return mat?.userData?.waterUniforms as WaterShaderUniforms | undefined;
}

function createBaseUniforms(): WaterShaderUniforms {
  return {
    uTime: { value: 0 },
    uRain: { value: 0 },
    uWinter: { value: 0 },
    uWind: { value: 0.2 },
    uDusk: { value: 0 },
    uSplashPos: { value: new THREE.Vector3(0, 0, 0) },
    uSplashAge: { value: 99 },
  };
}

function bindUniforms(
  shader: THREE.WebGLProgramParametersWithUniforms,
  uniforms: WaterShaderUniforms,
): void {
  shader.uniforms.uTime = uniforms.uTime;
  shader.uniforms.uRain = uniforms.uRain;
  shader.uniforms.uWinter = uniforms.uWinter;
  shader.uniforms.uWind = uniforms.uWind;
  shader.uniforms.uDusk = uniforms.uDusk;
  shader.uniforms.uSplashPos = uniforms.uSplashPos;
  shader.uniforms.uSplashAge = uniforms.uSplashAge;
}

/**
 * Storybook Mirror Pond PBR water material enhanced via onBeforeCompile:
 * - Animated current caustics & gentle breeze shimmer
 * - Shoreline depth gradient & lapping foam lip
 * - Stochastic raindrop ripple rings when weather is light_rain
 * - Interactive stone-skip splash ripple wave from uSplashPos
 * - Winter crystalline ice sheen & dusk amber lantern reflections
 */
export function createStorybookPondWaterMaterial(): THREE.MeshStandardMaterial {
  const uniforms = createBaseUniforms();
  const mat = new THREE.MeshStandardMaterial({
    color: '#6BB8C9',
    roughness: 0.12,
    metalness: 0.15,
    transparent: true,
    opacity: 0.84,
  });
  mat.userData.waterUniforms = uniforms;
  mat.customProgramCacheKey = () => 'storybook_pond_water_v1';

  mat.onBeforeCompile = (shader) => {
    bindUniforms(shader, uniforms);

    shader.vertexShader = shader.vertexShader
      .replace(
        '#include <common>',
        `#include <common>
        uniform float uTime;
        uniform float uWind;
        uniform float uWinter;
        varying vec3 vPondPos;`,
      )
      .replace(
        '#include <begin_vertex>',
        `#include <begin_vertex>
        vPondPos = position;
        float bob = (1.0 - uWinter) * (0.004 + 0.004 * uWind) * sin(position.x * 1.9 + uTime * 2.2) * cos(position.y * 2.1 - uTime * 1.7);
        transformed.z += bob;`,
      );

    shader.fragmentShader = shader.fragmentShader
      .replace(
        '#include <common>',
        `#include <common>
        uniform float uTime;
        uniform float uRain;
        uniform float uWinter;
        uniform float uWind;
        uniform float uDusk;
        uniform vec3 uSplashPos;
        uniform float uSplashAge;
        varying vec3 vPondPos;

        float pondHash(vec2 p) {
          return fract(sin(dot(p, vec2(127.1, 311.7))) * 43758.5453123);
        }`,
      )
      .replace(
        '#include <color_fragment>',
        `#include <color_fragment>
        // Shape coordinates: x spans ~ -5.2..3.5, y spans ~ -2.1..2.1
        vec2 pw = vPondPos.xy;
        float flowT = uTime * (0.45 + 0.35 * uWind) * (1.0 - 0.82 * uWinter);

        // Layered caustics drifting softly toward bridge culvert (-X)
        float c1 = sin(pw.x * 2.4 + flowT * 1.5 + sin(pw.y * 2.1 - flowT));
        float c2 = cos(pw.y * 2.9 - flowT * 1.2 + cos(pw.x * 1.7 + flowT * 0.9));
        float caustic = smoothstep(0.32, 0.96, 0.5 + 0.25 * (c1 + c2));

        // Depth coloration: warmer sandy-teal near outer shores, richer turquoise-teal in center basin
        float edgeMetric = length(vec2((pw.x - 0.2) * 0.27, pw.y * 0.49));
        float shallowMask = smoothstep(0.55, 1.05, edgeMetric);
        vec3 deepTeal = vec3(0.24, 0.56, 0.66);
        vec3 shallowAqua = vec3(0.56, 0.80, 0.84);
        diffuseColor.rgb = mix(deepTeal, shallowAqua, shallowMask * 0.65);
        diffuseColor.rgb = mix(diffuseColor.rgb, vec3(0.84, 0.96, 0.98), caustic * 0.26 * (1.0 - 0.6 * uWinter));

        // Gentle shoreline lapping highlight
        float shoreWave = 0.5 + 0.5 * sin(edgeMetric * 18.0 - uTime * 2.4);
        float shoreFoam = smoothstep(0.86, 1.02, edgeMetric) * shoreWave * (1.0 - 0.5 * uWinter);
        diffuseColor.rgb = mix(diffuseColor.rgb, vec3(0.92, 0.97, 0.98), shoreFoam * 0.42);

        // Stochastic raindrop ripple rings across pond grid
        if (uRain > 0.02) {
          vec2 cellUv = fract(pw * 1.45) - 0.5;
          vec2 cellId = floor(pw * 1.45);
          float h = pondHash(cellId);
          float rProg = fract(uTime * 0.85 + h);
          float dist = length(cellUv);
          float ring = smoothstep(0.055, 0.0, abs(dist - rProg * 0.44)) * (1.0 - rProg);
          diffuseColor.rgb += vec3(0.36, 0.46, 0.50) * ring * uRain * (1.0 - uWinter);
        }

        // Interactive skip-stone expanding ripple rings from uSplashPos (local x, -z)
        if (uSplashAge < 3.0) {
          float sDist = length(pw - vec2(uSplashPos.x, -uSplashPos.z));
          float waveR = uSplashAge * 1.45;
          float sFade = exp(-uSplashAge * 0.92);
          float sRing1 = smoothstep(0.16, 0.0, abs(sDist - waveR));
          float sRing2 = smoothstep(0.13, 0.0, abs(sDist - max(0.0, waveR - 0.38))) * 0.8;
          float sRing3 = smoothstep(0.11, 0.0, abs(sDist - max(0.0, waveR - 0.74))) * 0.55;
          diffuseColor.rgb = mix(diffuseColor.rgb, vec3(0.97, 1.0, 1.0), clamp((sRing1 + sRing2 + sRing3) * sFade, 0.0, 0.94));
        }

        // Winter frost & luminous pale ice edge
        if (uWinter > 0.01) {
          float frostPattern = 0.5 + 0.5 * sin(pw.x * 5.2 + sin(pw.y * 4.7));
          vec3 iceColor = mix(vec3(0.76, 0.89, 0.94), vec3(0.92, 0.96, 0.99), smoothstep(0.55, 1.0, edgeMetric) * 0.7 + frostPattern * 0.2);
          diffuseColor.rgb = mix(diffuseColor.rgb, iceColor, uWinter * 0.72);
          diffuseColor.a = mix(diffuseColor.a, 0.90, uWinter * 0.6);
        }`,
      )
      .replace(
        '#include <roughnessmap_fragment>',
        `#include <roughnessmap_fragment>
        roughnessFactor = mix(roughnessFactor, 0.28, uWinter * 0.75);`,
      )
      .replace(
        '#include <emissivemap_fragment>',
        `#include <emissivemap_fragment>
        // Warm golden lantern shimmer on pond near south-east pier & bridge
        if (uDusk > 0.02) {
          vec2 lanternPier = vec2(0.55, -1.75);
          vec2 lanternBridge = vec2(-3.55, -1.75);
          float g1 = exp(-dot(vPondPos.xy - lanternPier, vPondPos.xy - lanternPier) * 0.65);
          float g2 = exp(-dot(vPondPos.xy - lanternBridge, vPondPos.xy - lanternBridge) * 0.75);
          float shimmer = 0.7 + 0.3 * sin(vPondPos.x * 6.0 + uTime * 3.1);
          totalEmissiveRadiance += vec3(1.0, 0.64, 0.24) * (g1 + g2 * 0.85) * shimmer * uDusk * 0.42;
        }`,
      );
  };

  return mat;
}

/**
 * Storybook Mossy Fountain basin & catch-bowl water material with radial spout splash ripples.
 */
export function createStorybookFountainWaterMaterial(): THREE.MeshStandardMaterial {
  const uniforms = createBaseUniforms();
  const mat = new THREE.MeshStandardMaterial({
    color: '#6BB8C8',
    roughness: 0.11,
    metalness: 0.16,
    transparent: true,
    opacity: 0.86,
  });
  mat.userData.waterUniforms = uniforms;
  mat.customProgramCacheKey = () => 'storybook_fountain_water_v1';

  mat.onBeforeCompile = (shader) => {
    bindUniforms(shader, uniforms);

    shader.vertexShader = shader.vertexShader
      .replace(
        '#include <common>',
        `#include <common>
        varying vec3 vFountainPos;`,
      )
      .replace(
        '#include <begin_vertex>',
        `#include <begin_vertex>
        vFountainPos = position;`,
      );

    shader.fragmentShader = shader.fragmentShader
      .replace(
        '#include <common>',
        `#include <common>
        uniform float uTime;
        uniform float uWinter;
        uniform float uDusk;
        uniform vec3 uSplashPos;
        uniform float uSplashAge;
        varying vec3 vFountainPos;`,
      )
      .replace(
        '#include <color_fragment>',
        `#include <color_fragment>
        vec2 fp = vFountainPos.xy;
        float rCenter = length(fp);
        float t = uTime * (1.0 - 0.75 * uWinter);

        // Central cascade ring + 4 cardinal spout splash centers at (+/- 1.20, 0), (0, +/- 1.20)
        float waveC = 0.5 + 0.5 * sin(rCenter * 18.0 - t * 5.2);
        float dN = length(fp - vec2(0.0, 1.20));
        float dS = length(fp - vec2(0.0, -1.20));
        float dE = length(fp - vec2(1.20, 0.0));
        float dW = length(fp - vec2(-1.20, 0.0));
        float cardinalSplash =
          (0.5 + 0.5 * sin(dN * 20.0 - t * 6.4)) * exp(-dN * 2.8) +
          (0.5 + 0.5 * sin(dS * 20.0 - t * 6.4)) * exp(-dS * 2.8) +
          (0.5 + 0.5 * sin(dE * 20.0 - t * 6.4)) * exp(-dE * 2.8) +
          (0.5 + 0.5 * sin(dW * 20.0 - t * 6.4)) * exp(-dW * 2.8);

        float rippleFoam = smoothstep(0.62, 0.98, waveC * 0.55 + cardinalSplash * 0.85);
        vec3 baseWater = mix(vec3(0.34, 0.67, 0.75), vec3(0.56, 0.84, 0.90), smoothstep(0.2, 1.9, rCenter));
        diffuseColor.rgb = mix(baseWater, vec3(0.92, 0.98, 1.0), rippleFoam * 0.42);

        // Coin-wish extra burst ring localized to uSplashPos inside the basin
        if (uSplashAge < 2.2) {
          float wishDist = length(fp - vec2(uSplashPos.x, -uSplashPos.z));
          float wishR = uSplashAge * 1.45;
          float wishWave = smoothstep(0.14, 0.0, abs(wishDist - wishR)) * exp(-uSplashAge * 1.35);
          diffuseColor.rgb = mix(diffuseColor.rgb, vec3(1.0, 0.95, 0.80), wishWave * 0.78);
        }

        if (uWinter > 0.01) {
          diffuseColor.rgb = mix(diffuseColor.rgb, vec3(0.84, 0.94, 0.98), uWinter * 0.42);
        }`,
      )
      .replace(
        '#include <emissivemap_fragment>',
        `#include <emissivemap_fragment>
        if (uDusk > 0.02) {
          float duskRim = smoothstep(0.5, 1.85, length(vFountainPos.xy));
          totalEmissiveRadiance += vec3(0.95, 0.66, 0.28) * duskRim * uDusk * 0.25;
        }`,
      );
  };

  return mat;
}

/**
 * Translucent aerated streaming water material for fountain spout jets & upper overflow cascades.
 */
export function createStorybookWaterStreamMaterial(): THREE.MeshStandardMaterial {
  const uniforms = createBaseUniforms();
  const mat = new THREE.MeshStandardMaterial({
    color: '#CEF1F8',
    roughness: 0.1,
    metalness: 0.1,
    transparent: true,
    opacity: 0.74,
    depthWrite: false,
    side: THREE.DoubleSide,
  });
  mat.userData.waterUniforms = uniforms;
  mat.customProgramCacheKey = () => 'storybook_fountain_stream_v1';

  mat.onBeforeCompile = (shader) => {
    bindUniforms(shader, uniforms);

    shader.vertexShader = shader.vertexShader
      .replace(
        '#include <common>',
        `#include <common>
        varying vec2 vStreamUv;`,
      )
      .replace(
        '#include <begin_vertex>',
        `#include <begin_vertex>
        vStreamUv = uv;`,
      );

    shader.fragmentShader = shader.fragmentShader
      .replace(
        '#include <common>',
        `#include <common>
        uniform float uTime;
        uniform float uDusk;
        varying vec2 vStreamUv;`,
      )
      .replace(
        '#include <color_fragment>',
        `#include <color_fragment>
        float streak1 = 0.5 + 0.5 * sin(vStreamUv.x * 26.0 - uTime * 11.5);
        float streak2 = 0.5 + 0.5 * sin(vStreamUv.x * 14.0 + vStreamUv.y * 8.0 - uTime * 8.0);
        float foamBand = smoothstep(0.35, 0.95, streak1 * 0.65 + streak2 * 0.35);
        diffuseColor.rgb = mix(vec3(0.55, 0.84, 0.91), vec3(0.96, 0.99, 1.0), foamBand * 0.75);
        diffuseColor.a = mix(0.52, 0.88, foamBand);`,
      )
      .replace(
        '#include <emissivemap_fragment>',
        `#include <emissivemap_fragment>
        totalEmissiveRadiance += vec3(0.75, 0.94, 0.98) * 0.14 + vec3(0.95, 0.70, 0.35) * uDusk * 0.16;`,
      );
  };

  return mat;
}
