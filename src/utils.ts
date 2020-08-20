import { execSync } from "child_process";
import * as path from "path";
import * as uuid from "uuid";

export function deepCopy(obj: {}) {
  // I don't like it either, but this remains one of the fastest ways to
  // deep copy an obj in JS
  return JSON.parse(JSON.stringify(obj));
}

export function generateUUID(allUUIDs: string[]): string {
  const id = uuid.v4().replace(/-/g, "").substr(0, 24).toUpperCase();

  if (allUUIDs.indexOf(id) >= 0) {
    return generateUUID(allUUIDs);
  } else {
    return id;
  }
}

export function patchPath(initialPath: string, filePathPrefix: string): string {
  const rootPathTokens = ["$(SRCROOT)", "$SRCROOT", "$(PROJECT_DIR)"];
  const firstComponent = initialPath.split("/")[0];
  if (rootPathTokens.indexOf(firstComponent) > -1) {
    return initialPath.replace(
      firstComponent,
      `${firstComponent}/${filePathPrefix}`
    );
  }
  return `${"$(SRCROOT)"}/${filePathPrefix}/${initialPath}`;
}

export function getBundleIdentifierForFrameworkPath(
  frameworkPath: string
): string {
  const plistPath = path.join(frameworkPath, "Info.plist");
  const plistData = execSync("plutil -convert json -o - " + plistPath, {
    maxBuffer: 1024 * 1024 * 1024,
  });
  const plistJson = JSON.parse(plistData.toString());
  return plistJson["CFBundleIdentifier"];
}
