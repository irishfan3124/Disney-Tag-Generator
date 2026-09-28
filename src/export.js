import JSZip from 'jszip';
// Complete Bambu Studio project settings (Bambu Lab P2S, 0.20 mm Standard, Bambu PLA
// Basic), exported by MakerWorld. Bambu Studio ignores a project file that is only a
// partial settings list, so every export starts from this full set.
import BAMBU_SETTINGS from './bambu-project-settings.json' with { type: 'json' };

// meshes: [{ name, slot, positions, indices }] in millimetres, centred on the origin.

export function stl(meshes) {
  const triCount = meshes.reduce((n, m) => n + m.indices.length / 3, 0);
  const buf = new ArrayBuffer(84 + triCount * 50);
  const dv = new DataView(buf);
  dv.setUint32(80, triCount, true);
  let o = 84;
  for (const { positions: p, indices: ix } of meshes) {
    for (let t = 0; t < ix.length; t += 3) {
      const a = ix[t] * 3, b = ix[t + 1] * 3, c = ix[t + 2] * 3;
      const ux = p[b] - p[a], uy = p[b + 1] - p[a + 1], uz = p[b + 2] - p[a + 2];
      const vx = p[c] - p[a], vy = p[c + 1] - p[a + 1], vz = p[c + 2] - p[a + 2];
      let nx = uy * vz - uz * vy, ny = uz * vx - ux * vz, nz = ux * vy - uy * vx;
      const len = Math.hypot(nx, ny, nz) || 1;
      dv.setFloat32(o, nx / len, true); dv.setFloat32(o + 4, ny / len, true); dv.setFloat32(o + 8, nz / len, true);
      o += 12;
      for (const v of [a, b, c]) {
        dv.setFloat32(o, p[v], true); dv.setFloat32(o + 4, p[v + 1], true); dv.setFloat32(o + 8, p[v + 2], true);
        o += 12;
      }
      o += 2;
    }
  }
  return new Blob([buf], { type: 'model/stl' });
}

// One STL per filament, zipped — works with any slicer.
export async function stlZip(meshes, colors, baseName) {
  const zip = new JSZip();
  const bySlot = new Map();
  for (const m of meshes) bySlot.set(m.slot, [...(bySlot.get(m.slot) || []), m]);
  for (const [slot, list] of [...bySlot].sort((a, b) => a[0] - b[0])) {
    const hex = colors[slot - 1].replace('#', '');
    zip.file(`${baseName} - filament ${slot} (${hex}).stl`, stl(list));
  }
  return zip.generateAsync({ type: 'blob', compression: 'DEFLATE' });
}

const num = (v) => {
  const s = v.toFixed(4);
  return s.includes('.') ? s.replace(/\.?0+$/, '') : s;
};
const esc = (s) => s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
const uuid = () => crypto.randomUUID();

const NS =
  'xmlns="http://schemas.microsoft.com/3dmanufacturing/core/2015/02" ' +
  'xmlns:BambuStudio="http://schemas.bambulab.com/package/2021" ' +
  'xmlns:p="http://schemas.microsoft.com/3dmanufacturing/production/2015/06" requiredextensions="p"';

function meshXml(id, { positions: p, indices: ix }) {
  const out = [`  <object id="${id}" p:UUID="${uuid()}" type="model">\n   <mesh>\n    <vertices>\n`];
  for (let i = 0; i < p.length; i += 3) {
    out.push(`     <vertex x="${num(p[i])}" y="${num(p[i + 1])}" z="${num(p[i + 2])}"/>\n`);
  }
  out.push('    </vertices>\n    <triangles>\n');
  for (let t = 0; t < ix.length; t += 3) {
    out.push(`     <triangle v1="${ix[t]}" v2="${ix[t + 1]}" v3="${ix[t + 2]}"/>\n`);
  }
  out.push('    </triangles>\n   </mesh>\n  </object>\n');
  return out.join('');
}

/**
 * Multi-colour 3MF in the Bambu Studio / OrcaSlicer project layout: one object
 * made of several parts, each part assigned to a filament slot.
 */
export async function bambu3mf(meshes, { title, colors, bed, rotation, thumbnail }) {
  const zip = new JSZip();
  const asmId = meshes.length + 1;
  const identity = '1 0 0 0 1 0 0 0 1 0 0 0';
  const a = (rotation * Math.PI) / 180;
  const c = Math.cos(a), s = Math.sin(a);
  // The tag isn't symmetric top to bottom, so once it's turned its footprint is off
  // centre. Centre the turned footprint (not the origin) on the plate.
  let x0 = Infinity, x1 = -Infinity, y0 = Infinity, y1 = -Infinity;
  for (const { positions: p } of meshes) {
    for (let i = 0; i < p.length; i += 3) {
      const x = p[i] * c - p[i + 1] * s, y = p[i] * s + p[i + 1] * c;
      if (x < x0) x0 = x; if (x > x1) x1 = x;
      if (y < y0) y0 = y; if (y > y1) y1 = y;
    }
  }
  const tx = bed / 2 - (x0 + x1) / 2, ty = bed / 2 - (y0 + y1) / 2;
  const place = `${num(c)} ${num(s)} 0 ${num(-s)} ${num(c)} 0 0 0 1 ${num(tx)} ${num(ty)} 0`;

  zip.file(
    '[Content_Types].xml',
    `<?xml version="1.0" encoding="UTF-8"?>
<Types xmlns="http://schemas.openxmlformats.org/package/2006/content-types">
 <Default Extension="rels" ContentType="application/vnd.openxmlformats-package.relationships+xml"/>
 <Default Extension="model" ContentType="application/vnd.ms-package.3dmanufacturing-3dmodel+xml"/>
 <Default Extension="png" ContentType="image/png"/>
</Types>`,
  );
  zip.file(
    '_rels/.rels',
    `<?xml version="1.0" encoding="UTF-8"?>
<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships">
 <Relationship Target="/3D/3dmodel.model" Id="rel-1" Type="http://schemas.microsoft.com/3dmanufacturing/2013/01/3dmodel"/>${
   thumbnail
     ? `
 <Relationship Target="/Metadata/plate_1.png" Id="rel-2" Type="http://schemas.openxmlformats.org/package/2006/relationships/metadata/thumbnail"/>
 <Relationship Target="/Metadata/plate_1.png" Id="rel-4" Type="http://schemas.bambulab.com/package/2021/cover-thumbnail-middle"/>
 <Relationship Target="/Metadata/plate_1.png" Id="rel-5" Type="http://schemas.bambulab.com/package/2021/cover-thumbnail-small"/>`
     : ''
 }
</Relationships>`,
  );
  zip.file(
    '3D/_rels/3dmodel.model.rels',
    `<?xml version="1.0" encoding="UTF-8"?>
<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships">
 <Relationship Target="/3D/Objects/object_1.model" Id="rel-1" Type="http://schemas.microsoft.com/3dmanufacturing/2013/01/3dmodel"/>
</Relationships>`,
  );
  zip.file(
    '3D/Objects/object_1.model',
    `<?xml version="1.0" encoding="UTF-8"?>
<model unit="millimeter" xml:lang="en-US" ${NS}>
 <metadata name="BambuStudio:3mfVersion">1</metadata>
 <resources>
${meshes.map((m, i) => meshXml(i + 1, m)).join('')} </resources>
 <build/>
</model>`,
  );
  zip.file(
    '3D/3dmodel.model',
    `<?xml version="1.0" encoding="UTF-8"?>
<model unit="millimeter" xml:lang="en-US" ${NS}>
 <metadata name="Application">BambuStudio-${BAMBU_SETTINGS.version}</metadata>
 <metadata name="BambuStudio:3mfVersion">1</metadata>
 <metadata name="Title">${esc(title)}</metadata>
 <metadata name="Designer">Stroller Tag Generator</metadata>
 <metadata name="CreationDate">${new Date().toISOString().slice(0, 10)}</metadata>
 <resources>
  <object id="${asmId}" p:UUID="${uuid()}" type="model">
   <components>
${meshes
  .map((_, i) => `    <component p:path="/3D/Objects/object_1.model" objectid="${i + 1}" p:UUID="${uuid()}" transform="${identity}"/>`)
  .join('\n')}
   </components>
  </object>
 </resources>
 <build p:UUID="${uuid()}">
  <item objectid="${asmId}" p:UUID="${uuid()}" transform="${place}" printable="1"/>
 </build>
</model>`,
  );
  zip.file(
    'Metadata/model_settings.config',
    `<?xml version="1.0" encoding="UTF-8"?>
<config>
  <object id="${asmId}">
    <metadata key="name" value="${esc(title)}"/>
    <metadata key="extruder" value="${meshes[0].slot}"/>
${meshes
  .map(
    (m, i) => `    <part id="${i + 1}" subtype="normal_part">
      <metadata key="name" value="${esc(m.name)}"/>
      <metadata key="matrix" value="1 0 0 0 0 1 0 0 0 0 1 0 0 0 0 1"/>
      <metadata key="extruder" value="${m.slot}"/>
    </part>`,
  )
  .join('\n')}
  </object>
  <plate>
    <metadata key="plater_id" value="1"/>
    <metadata key="plater_name" value=""/>
    <metadata key="locked" value="false"/>${thumbnail ? '\n    <metadata key="thumbnail_file" value="Metadata/plate_1.png"/>' : ''}
    <model_instance>
      <metadata key="object_id" value="${asmId}"/>
      <metadata key="instance_id" value="0"/>
      <metadata key="identify_id" value="1"/>
    </model_instance>
  </plate>
  <assemble>
   <assemble_item object_id="${asmId}" instance_id="0" transform="${place}" offset="0 0 0"/>
  </assemble>
</config>`,
  );
  const used = Math.max(...meshes.map((m) => m.slot));
  zip.file('Metadata/project_settings.config', JSON.stringify(projectSettings(colors.slice(0, used)), null, 4));
  if (thumbnail) zip.file('Metadata/plate_1.png', thumbnail);
  return zip.generateAsync({
    type: 'blob',
    compression: 'DEFLATE',
    mimeType: 'application/vnd.ms-package.3dmanufacturing-3dmodel+xml',
  });
}

// Per-filament settings are arrays with one entry per filament. Resize them all to the
// number of filaments this tag uses and drop in its colours.
function projectSettings(colors) {
  const n = BAMBU_SETTINGS.filament_colour.length;
  const settings = {};
  for (const [key, value] of Object.entries(BAMBU_SETTINGS)) {
    settings[key] = Array.isArray(value) && value.length === n
      ? colors.map((_, i) => value[Math.min(i, n - 1)])
      : value;
  }
  settings.filament_colour = colors.map((c) => c.toUpperCase() + 'FF');
  return settings;
}
