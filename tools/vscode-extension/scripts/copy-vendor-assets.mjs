import { copyFileSync, existsSync, mkdirSync } from "node:fs";
import { dirname, join } from "node:path";

const assets = [
  {
    from: join("node_modules", "cytoscape", "dist", "cytoscape.min.js"),
    to: join("media", "cytoscape.min.js"),
  },
];

for (const asset of assets) {
  if (!existsSync(asset.from)) {
    throw new Error(`Missing vendor asset: ${asset.from}. Run npm install first.`);
  }

  mkdirSync(dirname(asset.to), { recursive: true });
  copyFileSync(asset.from, asset.to);
}
