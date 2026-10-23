import fs from "node:fs";
import path from "node:path";

const files = ["analyses", "taxonomy", "brief"];

for (const name of files) {
  const source = path.join("src", "data", `${name}.json`);
  const target = path.join("src", "data", `${name}.js`);
  const value = JSON.parse(fs.readFileSync(source, "utf8"));
  fs.writeFileSync(
    target,
    `// Generated from ${name}.json by scripts/sync-data.js. Edit the JSON source, then run npm run sync:data.\nexport default ${JSON.stringify(value, null, 2)};\n`
  );
  console.log(`synced ${source} -> ${target}`);
}
