import * as THREE from 'three/webgpu';
import { pass, mrt, output, normalView, positionView, metalness, roughness, vec2, vec3, smoothstep } from 'three/tsl';
import { ssr } from 'three/addons/tsl/display/SSRNode.js';
import { createPostProcessing } from './post-processing.js';

/**
 * Builds the TSL RenderPipeline with optional Half-Res Screen Space Reflections (SSRNode),
 * Bloom, and Filmic Color Grading.
 */
export function createRenderPipeline({ renderer, scene, camera, quality }) {
  let renderPipeline;
  let scenePass;
  let colorGrade;
  let ssrPass = null;
  let sceneMRT = null;

  if (!quality.reflections) {
    scenePass = pass(scene, camera);
    scenePass.renderTarget.storeMultisampledColorBuffer = false;
    scenePass.renderTarget.storeMultisampledDepthBuffer = false;
    scenePass.renderTarget.resolveDepthBuffer = false;
    colorGrade = createPostProcessing(renderer, scenePass.getTextureNode('output'), vec3(0), { bloom: quality.bloom });
    renderPipeline = new THREE.RenderPipeline(renderer, colorGrade.outputNode);
  } else {
    scenePass = pass(scene, camera);
    // The multisampled colour attachments (output, normal, metalRough) only need resolving, never storing: discarding
    // them spares the GPU writing 3 x 4 samples per pixel to memory every frame (transient, memoryless attachments where
    // the browser supports them). The multisampled depth stays stored: SSR reads it.
    scenePass.renderTarget.storeMultisampledColorBuffer = false;
    const ssrFade = smoothstep(360.0, 180.0, positionView.z.negate());
    const maxSSRRoughness = 0.75;
    sceneMRT = mrt({
      output: output,
      normal: normalView,
      metalRough: vec2(roughness.lessThan(maxSSRRoughness).select(metalness.mul(ssrFade), 0), roughness)
    });
    sceneMRT.setBlendMode('normal', new THREE.BlendMode(THREE.MaterialBlending));
    sceneMRT.setBlendMode('metalRough', new THREE.BlendMode(THREE.MaterialBlending));
    scenePass.setMRT(sceneMRT);

    const scenePassColor = scenePass.getTextureNode('output');
    const scenePassDepth = scenePass.getTextureNode('depth');
    const scenePassNormal = scenePass.getTextureNode('normal');
    const scenePassMetalRough = scenePass.getTextureNode('metalRough');

    ssrPass = ssr(scenePassColor, scenePassDepth, scenePassNormal, {
      metalnessNode: scenePassMetalRough.r,
      roughnessNode: scenePassMetalRough.g,
      camera
    });
    ssrPass.resolutionScale = 0.5;
    ssrPass.blurQuality = 1;
    ssrPass.maxDistance.value = 42;
    ssrPass.thickness.value = 0.85;
    // Fewer coarse steps, then refine detected hits to keep reflection edges precise.
    ssrPass.quality.value = 0.25;
    ssrPass.binaryRefine = true;
    ssrPass.intensity.value = 0.50;
    ssrPass.screenEdgeFadeBlack = true;

    // Roughness mip blur must not spread reflections back onto matte or nonreflective surfaces.
    const reflectionMask = scenePassMetalRough.r.greaterThan(0).select(smoothstep(maxSSRRoughness, 0.55, scenePassMetalRough.g), 0);
    const reflections = ssrPass.mul(reflectionMask);
    colorGrade = createPostProcessing(renderer, scenePassColor, reflections);
    renderPipeline = new THREE.RenderPipeline(renderer, colorGrade.outputNode);
  }

  return { renderPipeline, scenePass, colorGrade, ssrPass, sceneMRT };
}
