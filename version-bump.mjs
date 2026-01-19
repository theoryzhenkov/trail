import { readFileSync, writeFileSync } from "fs";

const targetVersion = process.argv[2];

if (!targetVersion) {
	console.error("Usage: node version-bump.mjs <version>");
	console.error("Example: node version-bump.mjs 4.0.0");
	process.exit(1);
}

// Update package.json
const pkg = JSON.parse(readFileSync("package.json", "utf8"));
pkg.version = targetVersion;
writeFileSync("package.json", JSON.stringify(pkg, null, "\t"));

// Update manifest.json
const manifest = JSON.parse(readFileSync("manifest.json", "utf8"));
const { minAppVersion } = manifest;
manifest.version = targetVersion;
writeFileSync("manifest.json", JSON.stringify(manifest, null, "\t"));

// Update versions.json
const versions = JSON.parse(readFileSync("versions.json", "utf8"));
if (!versions[targetVersion]) {
	versions[targetVersion] = minAppVersion;
	writeFileSync("versions.json", JSON.stringify(versions, null, "\t"));
}

console.log(`Updated version to ${targetVersion} in package.json, manifest.json, and versions.json`);
