"""Verify only the local MF deliverables; no network or product imports."""
from pathlib import Path
from collections import deque
import hashlib
import json
import xml.etree.ElementTree as ET
import numpy as np
from PIL import Image

ROOT = Path(__file__).resolve().parent
NS = {'svg': 'http://www.w3.org/2000/svg'}

def components(mask):
    seen = np.zeros(mask.shape, dtype=bool)
    groups = []
    for y, x in np.argwhere(mask):
        if seen[y, x]:
            continue
        seen[y, x] = True
        queue = deque([(int(y), int(x))])
        n = 0
        while queue:
            yy, xx = queue.popleft()
            n += 1
            for dy, dx in ((1, 0), (-1, 0), (0, 1), (0, -1)):
                ny, nx = yy + dy, xx + dx
                if 0 <= ny < mask.shape[0] and 0 <= nx < mask.shape[1] and mask[ny, nx] and not seen[ny, nx]:
                    seen[ny, nx] = True
                    queue.append((ny, nx))
        groups.append(n)
    return sorted(groups, reverse=True)

def edge(mask):
    padded = np.pad(mask, 1)
    interior = mask & padded[:-2, 1:-1] & padded[2:, 1:-1] & padded[1:-1, :-2] & padded[1:-1, 2:]
    return np.argwhere(mask & ~interior)

def nearest_distances(a, b):
    return np.sqrt(((a[:, None, :] - b[None, :, :]) ** 2).sum(axis=2).min(axis=1))

master = ET.parse(ROOT / 'manovaflow-mf.svg').getroot()
inverse = ET.parse(ROOT / 'manovaflow-mf-inverse.svg').getroot()
master_paths = [p.attrib['d'] for p in master.findall('svg:path', NS)]
inverse_paths = [p.attrib['d'] for p in inverse.findall('svg:path', NS)]
provenance = json.loads((ROOT / 'render-provenance.json').read_text(encoding='utf-8'))
assert hashlib.sha256((ROOT / 'manovaflow-mf.svg').read_bytes()).hexdigest() == provenance['masterSha256']
assert hashlib.sha256((ROOT / 'manovaflow-mf-inverse.svg').read_bytes()).hexdigest() == provenance['inverseSha256']
assert len(master_paths) == 2 and master_paths == inverse_paths
assert not master.findall('.//svg:image', NS)
assert not master.findall('.//svg:script', NS)
assert all('href' not in k for e in master.iter() for k in e.attrib)

alpha_results = {}
for name in ('manovaflow-mf-transparent.png', 'manovaflow-mf-inverse-transparent.png', 'manovaflow-mf-32.png', 'manovaflow-mf-inverse-32.png'):
    im = Image.open(ROOT / name)
    assert im.mode == 'RGBA', (name, im.mode)
    alpha = np.array(im)[:, :, 3]
    assert alpha.min() == 0 and alpha.max() == 255
    assert np.any((alpha > 0) & (alpha < 255))
    assert all(alpha[y, x] == 0 for y, x in ((0, 0), (0, -1), (-1, 0), (-1, -1)))
    alpha_results[name] = {
        'mode': im.mode, 'size': list(im.size), 'alphaMin': int(alpha.min()), 'alphaMax': int(alpha.max()),
        'transparentPixels': int((alpha == 0).sum()), 'opaquePixels': int((alpha == 255).sum()),
        'partialAlphaPixels': int(((alpha > 0) & (alpha < 255)).sum()),
        'componentsAtAlpha128': components(alpha >= 128),
    }

source = np.array(Image.open(ROOT / 'reference-selected-mf.png').convert('RGB'))
source_mask = source[:, :, 0] < 120
rendered = Image.open(ROOT / 'manovaflow-mf-transparent.png').resize((350, 250), Image.Resampling.LANCZOS)
rgba = np.array(rendered)
rendered_mask = rgba[:, :, 3] >= 128
iou = float((source_mask & rendered_mask).sum() / (source_mask | rendered_mask).sum())
ea, eb = edge(source_mask), edge(rendered_mask)
dist = np.r_[nearest_distances(ea, eb), nearest_distances(eb, ea)]
interior = source_mask & rendered_mask
for _ in range(3):
    p = np.pad(interior, 1)
    interior &= p[:-2, 1:-1] & p[2:, 1:-1] & p[1:-1, :-2] & p[1:-1, 2:]
delta = np.abs(source.astype(float) - rgba[:, :, :3].astype(float))[interior]
source_bbox = [int(v) for v in (*np.argwhere(source_mask).min(axis=0)[::-1], *np.argwhere(source_mask).max(axis=0)[::-1])]
render_bbox = [int(v) for v in (*np.argwhere(rendered_mask).min(axis=0)[::-1], *np.argwhere(rendered_mask).max(axis=0)[::-1])]

def luminance(rgb):
    c = np.array(rgb) / 255
    c = np.where(c <= .04045, c / 12.92, ((c + .055) / 1.055) ** 2.4)
    return c @ np.array([.2126, .7152, .0722])

contrast = {}
for name, bg in (('manovaflow-mf-transparent.png', (248, 246, 242)), ('manovaflow-mf-inverse-transparent.png', (8, 29, 60))):
    a = np.array(Image.open(ROOT / name))
    fg = luminance(a[:, :, :3][a[:, :, 3] == 255])
    b = luminance(bg)
    ratios = (np.maximum(fg, b) + .05) / (np.minimum(fg, b) + .05)
    contrast[name] = {'minimumOpaqueFillContrast': float(ratios.min()), 'background': list(bg)}

result = {
    'reference': 'Large upper-center symbol, 02 / LIGATURE; original shortlist crop',
    'alpha': alpha_results,
    'vector': {'pathCount': len(master_paths), 'geometryIdenticalAcrossColorVariants': True, 'noEmbeddedRasterOrExternalResources': True, 'masterHashesMatchRenderProvenance':True},
    'fidelity': {'maskThresholdReferenceRed':120, 'maskThresholdRenderAlpha':128, 'maskIoU':iou,
        'boundaryMeanDistanceSourcePixels':float(dist.mean()), 'boundary95PercentileSourcePixels':float(np.quantile(dist,.95)),
        'boundaryMaxDistanceSourcePixels':float(dist.max()), 'sourceMaskBBoxInCrop':source_bbox, 'renderMaskBBoxInCrop':render_bbox,
        'interiorRgbMeanAbsoluteErrorPerChannel': delta.mean(axis=0).tolist(), 'interiorRgbMeanAbsoluteError':float(delta.mean()),
        'sourceComponents':components(source_mask), 'renderedComponents':components(rendered_mask)},
    'contrast':contrast,
    'checks': {'alphaReal':True,'sameGeometry':True,'maskIoUAtLeast98Percent':iou >= .98,
        'twoSeparateComponentsAt32px':len(alpha_results['manovaflow-mf-32.png']['componentsAtAlpha128']) == 2,
        'darkVariantAtLeast3To1':contrast['manovaflow-mf-inverse-transparent.png']['minimumOpaqueFillContrast'] >= 3},
}
(ROOT / 'verification.json').write_text(json.dumps(result, indent=2)+'\n', encoding='utf-8')
print(json.dumps(result, indent=2))
assert all(result['checks'].values()), result['checks']
