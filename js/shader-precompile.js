const COMPILE_POOL = 16;
const nextTask = () => (
  globalThis.scheduler?.yield
    ? globalThis.scheduler.yield()
    : new Promise((resolve) => setTimeout(resolve, 0))
);

/**
 * Compiles scene shaders behind the loading screen using overlapping compileAsync() workers
 * so individual jobs yield cleanly to the browser.
 */
export async function precompileShaders({
  renderer,
  scene,
  camera,
  renderPipeline,
  scenePass,
  sceneMRT,
  showLoadingStage,
  setLoadingProgress,
  loadingStatus,
  markInit
}) {
  await showLoadingStage('Preparing reflections and bloom...');
  // An empty frame first: it sets up the post-processing chain, which configures the scene pass's render target
  // (MSAA samples, depth format), so the pipelines compiled below are the very ones the scene pass asks for
  scene.visible = false;
  renderPipeline.render();
  scene.visible = true;
  markInit('postFX');

  // Every visible object with frustum culling off (like the warm-up frame, see the loop). Plain meshes that share
  // a material share its shader, so one job compiles them in turn (the first build serves the rest); every
  // instanced mesh gets a build of its own unless its chunks share a pipeline
  const culled = [];
  const jobs = [];
  const jobByMaterial = new Map();
  const pipelines = new Set();
  scene.traverseVisible((o) => {
    if (o.frustumCulled) {
      culled.push(o);
      o.frustumCulled = false;
    }
    if (!o.isMesh && !o.isLine && !o.isPoints && !o.isSprite) return;
    // Use the first visible chunk: the original representative may be in an inactive tree cell. Shadow stand-ins
    // only draw in the shadow maps (the warm-up frame compiles those).
    if (o.userData.shadowProxy) return;
    const pipeline = o.userData.sharesPipelineWith || o;
    if (pipelines.has(pipeline)) return;
    pipelines.add(pipeline);
    if (o.isInstancedMesh || Array.isArray(o.material)) {
      jobs.push([o]);
      return;
    }
    let job = jobByMaterial.get(o.material);
    if (!job) {
      job = [];
      jobByMaterial.set(o.material, job);
      jobs.push(job);
    }
    job.push(o);
  });

  await showLoadingStage(`Compiling scene shaders... 0 / ${jobs.length} batches`);
  setLoadingProgress(0);
  renderer.setRenderTarget(scenePass.renderTarget);
  renderer.setMRT(sceneMRT);
  const compile = async (object) => {
    // Each compile starts in a task of its own: compileAsync() keeps one precompilation state on the renderer,
    // which must not be mid-step for two of them in the same microtask checkpoint
    await nextTask();
    try {
      await renderer.compileAsync(object, camera, scene);
    } catch (e) {
      console.warn('[compile]', e); // the warm-up frame compiles it instead
    }
  };
  let next = 0;
  let done = 0;
  const worker = async () => {
    while (next < jobs.length) {
      const job = jobs[next++];
      for (const object of job) await compile(object);
      done++;
      if (loadingStatus) {
        loadingStatus.textContent = `Compiling scene shaders... ${done} / ${jobs.length} batches (${Math.round((done / jobs.length) * 100)}%)`;
      }
      setLoadingProgress(done / jobs.length);
    }
  };
  await Promise.all(Array.from({ length: COMPILE_POOL }, worker));
  renderer.setMRT(null);
  renderer.setRenderTarget(null);
  for (const o of culled) o.frustumCulled = true;
}
