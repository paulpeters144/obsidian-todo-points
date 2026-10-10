const { execSync } = require("child_process");
const fs = require("fs");
const path = require("path");

const root = path.resolve(__dirname, "..");

const RELEASE_FILES = ["main.js", "manifest.json", "styles.css"];

function run(cmd) {
	console.log(`> ${cmd}`);
	execSync(cmd, { cwd: root, stdio: "inherit" });
}

function runCapture(cmd) {
	return execSync(cmd, { cwd: root, encoding: "utf8" }).trim();
}

function fail(msg) {
	console.error(`\n[release] ERROR: ${msg}`);
	process.exit(1);
}

function readJson(file) {
	const abs = path.join(root, file);
	if (!fs.existsSync(abs)) {
		return null;
	}
	return JSON.parse(fs.readFileSync(abs, "utf8"));
}

function writeJson(file, data) {
	const abs = path.join(root, file);
	fs.writeFileSync(abs, JSON.stringify(data, null, "\t") + "\n");
}

function bumpVersion(version, type) {
	const match = /^(\d+)\.(\d+)\.(\d+)(?:-(.+))?$/.exec(version);
	if (!match) {
		fail(`cannot parse version "${version}"`);
	}
	let major = Number(match[1]);
	let minor = Number(match[2]);
	let patch = Number(match[3]);
	if (type === "major") {
		major += 1;
		minor = 0;
		patch = 0;
	} else if (type === "minor") {
		minor += 1;
		patch = 0;
	} else {
		patch += 1;
	}
	return `${major}.${minor}.${patch}`;
}

const type = process.argv[2] === "major" || process.argv[2] === "minor"
	? process.argv[2]
	: "patch";

const manifest = readJson("manifest.json");
if (!manifest) {
	fail("manifest.json not found");
}

const current = manifest.version;
const next = bumpVersion(current, type);

console.log(`[release] bumping version ${current} -> ${next} (${type})`);

manifest.version = next;
writeJson("manifest.json", manifest);

const pkg = readJson("package.json");
if (!pkg) {
	fail("package.json not found");
}
pkg.version = next;
writeJson("package.json", pkg);

const versions = readJson("versions.json") || {};
versions[next] = manifest.minAppVersion;
writeJson("versions.json", versions);

run("pnpm run build");

for (const file of RELEASE_FILES) {
	if (!fs.existsSync(path.join(root, file))) {
		fail(`expected build artifact missing: ${file}`);
	}
}

run("git add manifest.json package.json versions.json");
run(`git commit -m "chore: bump version to ${next}"`);
run(`git tag ${next}`);

const hasRemote = runCapture("git remote") !== "";
if (hasRemote) {
	const branch = runCapture("git rev-parse --abbrev-ref HEAD");
	run(`git push origin ${branch}`);
	run("git push origin --tags");

	try {
		execSync("gh --version", { cwd: root, stdio: "ignore" });
	} catch {
		fail("gh CLI not found or not on PATH; install it or create the GitHub release manually");
	}

	const assets = RELEASE_FILES.join(" ");
	run(`gh release create ${next} ${assets} --title ${next} --generate-notes`);
} else {
	console.warn("[release] no git remote configured; skipping push and GitHub release");
}

console.log(`\n[release] done. Published v${next}.`);
