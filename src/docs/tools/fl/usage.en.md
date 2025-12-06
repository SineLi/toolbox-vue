## Overview
This tool provides an all-in-one flow for fluorescence/colorimetric photo processing: template-based crop, strip merging, and color analysis.

## Quick start

### Start from a single photo

<center>
<img src='src/docs/tools/fl/img/1.png' style="max-width:75%;max-height:240px">
</center>

After you photograph each cuvette, you usually need to crop the cuvette out of every shot and stitch them into one image. That’s tedious—this tool can auto-detect, crop, and merge for you.

#### 1. Upload a template image

Upload a template that contains the target object’s key features; avoid over-cropping. For example, manually crop one clear cuvette from your series of photos. A good template looks like this:
<center>
<a href='src/docs/tools/fl/img/2.png' target="_blank" rel="noopener">
<img src='src/docs/tools/fl/img/2.png' style="max-width:50%;max-height:240px">
</a>
</center>

#### 2. Upload images to process

Upload a batch of photos taken in similar conditions (similar angle, consistent target size). The tool will find the target in each image based on the template and crop it out.
<center>
<a href='src/docs/tools/fl/img/3.png' target="_blank" rel="noopener">
<img src='src/docs/tools/fl/img/3.png' style="max-width:75%;max-height:240px">
</a>
</center>
You can upload multiple images at once; after all are processed you’ll be taken to the merge panel automatically.

#### 3. Merge the cropped images

In the merge panel you can set spacing between tiles, frame size, and add labels (e.g., concentrations). Background and label colors are configurable.
*Note: after adjusting parameters, click **Regenerate** to refresh the preview.*
When merging looks right, download the stitched image or proceed to color analysis.
<center>
<a href='src/docs/tools/fl/img/4.jpg' target="_blank" rel="noopener">
<img src='src/docs/tools/fl/img/4.jpg' style="max-width:100%;max-height:240px">
</a>
</center>

### Analyze colors on the merged strip directly

On the color analysis panel, pick sampling regions on the merged image and assign labels (or x-axis values). After entering a color formula, the tool calculates each point’s response and plots it. For each sampling area, 10 random pixels are averaged and the standard deviation is recorded. You can set the `Random seed` under Sampling (default `42`).
In `Sample list`, the index becomes the x-axis when plotting; if numeric, you can use a scatter plot with automatic linear regression. In `Regression`, `Weighting` controls how point errors are handled: `Direct` uses 1/σ, and `Instrument` uses 1/e^σ.
<center>
<a href='src/docs/tools/fl/img/5.png' target="_blank" rel="noopener">
<img src='src/docs/tools/fl/img/5.png' style="max-width:100%;max-height:240px">

<a href='src/docs/tools/fl/img/6.png' target="_blank" rel="noopener">
<img src='src/docs/tools/fl/img/6.png' style="max-width:100%;max-height:240px">
</a>
</center>

<a href='src/docs/tools/fl/example/example.zip'>***Click here***</a> to download sample data and try the flow.

---

## FAQ

### Why is auto-detection/cropping inaccurate?
It needs a clean background and a complete template. Over-cropped templates, complex backgrounds, or large rotations can break detection. If you still want automation, pre-crop the targets to remove clutter first.

### Why is auto-cropping slow?
Browser performance limits the pipeline; processing is done sequentially and can’t fully utilize device resources yet.
