const { execSync } = require("child_process")
const path = require("path")

try {
	const rootDir = path.resolve(__dirname, "..")
	const output = execSync("pnpm m ls --depth -1 --json", {
		encoding: "utf8",
		cwd: rootDir,
	})

	const packages = (output.match(/\[\s*{[^]*?}\s*\]/g) || []).map((jsonArray) => JSON.parse(jsonArray)[0].name)

	if (!packages.length) {
		throw new Error("No packages found in workspace")
	}

	console.log(packages.join("\n"))
} catch (e) {
	console.error("Error listing packages:", e.message)
	process.exit(1)
}
