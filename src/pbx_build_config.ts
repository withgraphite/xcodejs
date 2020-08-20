import PBXFileReference from "./pbx_file_reference";
import PBXObject from "./pbx_object";

export default class PBXBuildConfig extends PBXObject {
  buildSettings(): Record<string, any> {
    return this._defn["buildSettings"];
  }

  overrideBuildSettings(value: Record<string, any>) {
    this._defn["buildSettings"] = value;
  }

  name(): string {
    return this._defn["name"];
  }

  baseConfigurationReference(): PBXFileReference | null {
    if (this._defn["baseConfigurationReference"]) {
      return new PBXFileReference(
        this._defn["baseConfigurationReference"],
        this._proj
      );
    }

    return null;
  }
}
