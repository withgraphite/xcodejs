import PBXObject from "./pbx_object";

export default class PBXBuildPhase extends PBXObject {
  inputPaths(): string[] {
    return this._defn["inputPaths"];
  }

  setInputPaths(inputPaths: string[]) {
    this._defn["inputPaths"] = inputPaths;
  }

  shellScript(): string {
    return this._defn["shellScript"];
  }

  setShellScript(shellScript: string) {
    this._defn["shellScript"] = shellScript;
  }
}
