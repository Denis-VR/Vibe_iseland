import { test } from "node:test";
import assert from "node:assert/strict";
import { sceneResolution } from "../app/scene-quality.ts";
test("TV logical viewport can explicitly render a 4K frame", () => {
  assert.deepEqual(sceneResolution(960, 540, 2, "auto"), {width:1920, height:1080});
  assert.deepEqual(sceneResolution(960, 540, 2, "uhd"), {width:3840, height:2160});
});
test("large, portrait and invalid viewports stay within a bounded canvas", () => {
  for (const [w,h,dpr] of [[7680,4320,2],[390,844,3],[1470,891,2]]) {
    const r=sceneResolution(w,h,dpr,"uhd");
    assert.ok(r.width <=3840 && r.height<=3840);
    assert.ok(r.width*r.height<=8300000);
    assert.ok(Math.abs(r.width/r.height-w/h)<0.002);
  }
  assert.deepEqual(sceneResolution(0,0,2,"auto"),{width:1,height:1});
});
