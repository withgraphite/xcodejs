import PBXBuildConfig from "./pbx_build_config";
import PBXObject from "./pbx_object";

export default class PBXBuildConfigList extends PBXObject {
  defaultConfigurationName() {
    return this._defn["defaultConfigurationName"];
  }

  defaultConfig() {
    const defaultName = this.defaultConfigurationName();
    return this.buildConfigs().filter(config => config.name() == defaultName)[0];
  }

  buildConfigs(): ReadonlyArray<PBXBuildConfig> {
    return this._defn["buildConfigurations"].map((buildConfigId: string) => {
      return new PBXBuildConfig(buildConfigId, this._proj);
    });
  }
}
