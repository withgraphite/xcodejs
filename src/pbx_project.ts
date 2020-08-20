import chalk from "chalk";
import { execSync } from "child_process";
import * as path from "path";
import PBXBuildConfig from "./pbx_build_config";
import PBXGroup from "./pbx_group";
import PBXNativeTarget from "./pbx_native_target";
import PBXRootObject from "./pbx_root_object";
import { deepCopy, generateUUID } from "./utils";
import { XCConfig } from "./xcconfig";

type TMergedAppDetails = {
  plist: string;
  bundleId: string;
  frameworkName: string;
  frameworkExecutableName: string;
  entitlements: string;

  baseConfigurationReference: string | null;
  customBuildSettings: Record<string, any>;
};

function applyDefaultsToBuildSettings(
  buildConfig: PBXBuildConfig,
  defaults: Record<string, any>
) {
  const buildSettings = buildConfig.buildSettings();

  // merge inherited
  Object.keys(buildSettings).forEach((buildSettingKey) => {
    const targetSettingsValue = buildSettings[buildSettingKey];
    let rootSettingsValue = defaults[buildSettingKey];

    if (rootSettingsValue) {
      if (targetSettingsValue instanceof Array) {
        const newTargetSettings: string[] = [];
        for (const member of targetSettingsValue) {
          if (member === "$(inherited)") {
            if (rootSettingsValue instanceof Array) {
              newTargetSettings.push(...rootSettingsValue);
            } else {
              newTargetSettings.push(rootSettingsValue);
            }
          } else {
            newTargetSettings.push(member);
          }
        }
        buildSettings[buildSettingKey] = newTargetSettings;
      } else if (typeof targetSettingsValue === "string") {
        if (rootSettingsValue instanceof Array) {
          rootSettingsValue = rootSettingsValue.join(" ");
        }
        buildSettings[buildSettingKey] = targetSettingsValue.replace(
          /\$\(inherited\)/g,
          rootSettingsValue
        );
      }
    }
  });

  // merge rest
  buildConfig.overrideBuildSettings({
    ...defaults,
    ...buildSettings,
  });
}

export default class PBXProj {
  _defn: Record<string, any>;
  _srcRoot: string;

  constructor(defn: {}, srcRoot: string) {
    this._defn = defn;
    this._srcRoot = srcRoot;
  }

  // ***********
  // Convenience
  // ***********

  rootObject() {
    return new PBXRootObject(this._defn["rootObject"], this);
  }

  removeNode(id: string) {
    delete this._defn["objects"][id];
  }

  public appTargets() {
    return this.rootObject()
      .targets()
      .filter((target) => {
        return target.productType() === "com.apple.product-type.application";
      });
  }

  // *******
  // On-disk
  // *******

  static readFileSync(file: string) {
    const data = execSync("plutil -convert json -o - " + file, {
      maxBuffer: 1024 * 1024 * 1024,
    });
    const defn = JSON.parse(data.toString());

    return new PBXProj(defn, path.dirname(path.dirname(file)));
  }

  public writeFileSync(file: string, format: string = "xml1") {
    // Strangely, xcode can accept ANY format of the pbxproj (including JSON!)
    // just when you resave the project, it will get rewritten as a traditional one
    //
    // HOWEVER, on big projects, xcode craps out on JSON and doesn't convert /
    // greys out the save button. For that reason we export as XML

    // fs.writeFileSync(file, JSON.stringify(this._defn));

    execSync(`plutil -convert ${format} - -o ` + file, {
      input: JSON.stringify(this._defn),
    });
  }

  // *******
  // Updates
  // *******

  public duplicateTargetAndBuildSettings(target: PBXNativeTarget) {
    // literally dupe
    const newTargetID = generateUUID(Object.keys(this._defn["objects"]));
    this._defn["objects"][newTargetID] = {
      ...this._defn["objects"][target._id],
    };

    // update build configs to be unique
    const oldConfigListId = this._defn["objects"][newTargetID][
      "buildConfigurationList"
    ];

    const newConfigListID = generateUUID(Object.keys(this._defn["objects"]));
    this._defn["objects"][newConfigListID] = {
      ...this._defn["objects"][oldConfigListId],
    };

    this._defn["objects"][newTargetID][
      "buildConfigurationList"
    ] = newConfigListID;

    this._defn["objects"][newConfigListID]["buildConfigurations"] = this._defn[
      "objects"
    ][newConfigListID]["buildConfigurations"].map((buildConfigId: string) => {
      // Duplicate the build config
      const newBuildConfigId = generateUUID(Object.keys(this._defn["objects"]));
      this._defn["objects"][newBuildConfigId] = {
        ...this._defn["objects"][buildConfigId],
      };

      return newBuildConfigId;
    });

    // update product
    const oldProductId = this._defn["objects"][newTargetID]["productReference"];
    const newProductId = generateUUID(Object.keys(this._defn["objects"]));
    this._defn["objects"][newProductId] = {
      ...this._defn["objects"][oldProductId],
    };
    this._defn["objects"][newTargetID]["productReference"] = newProductId;

    // add product and target to project
    this.rootObject()._defn["targets"].push(newTargetID);
    const productRefGroupId = this.rootObject()._defn["productRefGroup"];

    // Note: The next line isn't entirely correct, technically the product could be put ANYWHERE
    this._defn["objects"][productRefGroupId]["children"].push(newProductId);

    return new PBXNativeTarget(newTargetID, this);
  }

  public stripAppTargetsExcept(name: string) {
    for (const target of this.rootObject().targets()) {
      const isApp =
        target.productType() === "com.apple.product-type.application";

      if (isApp && target.name() !== name) {
        // kill the target
        target.remove();

        // kill the target edge
        this.rootObject().removeTarget(target);
      }
    }
  }

  private patchPath(initialPath: string, filePathPrefix: string): string {
    if (initialPath.startsWith("${SRCROOT}")) {
      initialPath = initialPath.replace("${SRCROOT}", "");
    }
    if (initialPath.startsWith("$(SRCROOT)")) {
      initialPath = initialPath.replace("$(SRCROOT)", "");
    }
    return path.join("$(SRCROOT)", filePathPrefix, initialPath);
  }

  private patchInfoPlist(
    initialPath: string,
    filePathPrefix: string,
    buildConfig: PBXBuildConfig
  ) {
    const buildSettings = buildConfig.buildSettings();

    buildSettings["INFOPLIST_FILE"] = this.patchPath(
      initialPath,
      filePathPrefix
    );
  }

  private patchHeaderSearchPathsForApp(buildSettings: Record<string, any>) {
    // Apps are treated slightly differently than frameworks in how headers can be imported.
    // This comes across for things like the swift bridging header (ProductModuleName-Swift.h)
    // Which can be imported in the app as #import "Blah-Swift.h", but the same import fails
    // if you change the target into a framework
    //
    // We should probably research why this is, but for now I'm just adding a framework's public
    // headers to its own search path. This seems to resolve the issue.
    const newPath = "$(BUILT_PRODUCTS_DIR)/$(CONTENTS_FOLDER_PATH)/Headers";
    if (buildSettings["HEADER_SEARCH_PATHS"] instanceof Array) {
      buildSettings["HEADER_SEARCH_PATHS"].push(newPath);
    } else {
      buildSettings["HEADER_SEARCH_PATHS"] = newPath;
    }
  }

  private patchBuildConfigValuesForTarget(
    target: PBXNativeTarget,
    filePathPrefix: string
  ) {
    const buildConfigList = target.buildConfigurationList();

    for (const buildConfig of buildConfigList.buildConfigs()) {
      const buildSettings = buildConfig.buildSettings();

      if (buildSettings["MODULEMAP_FILE"]) {
        buildSettings["MODULEMAP_FILE"] = this.patchPath(
          buildSettings["MODULEMAP_FILE"],
          filePathPrefix
        );
      }
      if (buildSettings["PODS_ROOT"]) {
        buildSettings["PODS_ROOT"] = this.patchPath(
          buildSettings["PODS_ROOT"],
          filePathPrefix
        );
      }
      if (buildSettings["PODS_PODFILE_DIR_PATH"]) {
        buildSettings["PODS_PODFILE_DIR_PATH"] = this.patchPath(
          buildSettings["PODS_PODFILE_DIR_PATH"],
          filePathPrefix
        );
      }
      if (buildSettings["GCC_PREFIX_HEADER"]) {
        buildSettings["GCC_PREFIX_HEADER"] = this.patchPath(
          buildSettings["GCC_PREFIX_HEADER"],
          filePathPrefix
        );
      }

      if (buildSettings["FRAMEWORK_SEARCH_PATHS"]) {
        if (buildSettings["FRAMEWORK_SEARCH_PATHS"] instanceof Array) {
          buildSettings["FRAMEWORK_SEARCH_PATHS"] = buildSettings[
            "FRAMEWORK_SEARCH_PATHS"
          ].map((path: string) => {
            return path.replace(
              /\$\(PROJECT_DIR\)/g,
              "$(PROJECT_DIR)/" + filePathPrefix
            );
          });
        } else {
          buildSettings["FRAMEWORK_SEARCH_PATHS"] = buildSettings[
            "FRAMEWORK_SEARCH_PATHS"
          ].replace(/\$\(PROJECT_DIR\)/g, "$(PROJECT_DIR)/" + filePathPrefix);
        }
      }
      if (buildSettings["CODE_SIGN_ENTITLEMENTS"]) {
        buildSettings["CODE_SIGN_ENTITLEMENTS"] = this.patchPath(
          buildSettings["CODE_SIGN_ENTITLEMENTS"],
          filePathPrefix
        );
      }
      if (buildSettings["SYMROOT"]) {
        buildSettings["SYMROOT"] = this.patchPath(
          buildSettings["SYMROOT"],
          filePathPrefix
        );
      }
      if (buildSettings["SWIFT_OBJC_BRIDGING_HEADER"]) {
        buildSettings["SWIFT_OBJC_BRIDGING_HEADER"] =
          filePathPrefix + "/" + buildSettings["SWIFT_OBJC_BRIDGING_HEADER"];
      }
      if (buildSettings["INFOPLIST_FILE"]) {
        this.patchInfoPlist(
          buildSettings["INFOPLIST_FILE"],
          filePathPrefix,
          buildConfig
        );
      }
    }
  }

  private patchBuildPaths(target: PBXNativeTarget, filePathPrefix: string) {
    // Patch up the build paths to be correct
    for (const buildPhase of target.buildPhases()) {
      if (buildPhase.isa() === "PBXShellScriptBuildPhase") {
        buildPhase.setInputPaths(
          buildPhase.inputPaths().map((path: string) => {
            return path.replace("$(SRCROOT)", "$(SRCROOT)/" + filePathPrefix);
          })
        );

        buildPhase.setShellScript(
          buildPhase
            .shellScript()
            .replace(/\$\(SRCROOT\)/g, "$(SRCROOT)/" + filePathPrefix)
            .replace(/\$SRCROOT/g, "$SRCROOT/" + filePathPrefix)
            .replace(/\$\(SOURCE_ROOT\)/g, "$(SOURCE_ROOT)/" + filePathPrefix)
            .replace(/\$SOURCE_ROOT/g, "$SOURCE_ROOT/" + filePathPrefix)
            .replace(/\$\{PROJECT_DIR\}/g, "${PROJECT_DIR}/" + filePathPrefix)
        );
      }
    }
  }

  private copyOtherObjectsIntoSelf(other: PBXProj, filePathPrefix: string) {
    const otherRootObjID = other._defn["rootObject"];

    // Note: this does create some orphaned nodes, xcode seems to ignore them, so I'm fine
    // with it for now - eventually we should clean it up
    for (const id in other._defn["objects"]) {
      if (id in this._defn["objects"]) {
        // TODO: This will become a shoddy assumption soon, b/c if we're merging different
        // versions of the same project, it WILL have the same UUIDs; we should
        // prolly have some way to rename them and replace the UUIDs
        throw (
          "Duplicate UUIDs detected ('" +
          id +
          "')! Are you trying to merge a file into itself?"
        );
      }

      // Skip the main group, that's a PBXProject, and while xcode doesn't seem to care if
      // we have two, we don't have any use for it as an orphan node in the objects tree
      if (id === otherRootObjID) {
        continue;
      }
      this._defn["objects"][id] = deepCopy(other._defn["objects"][id]);

      // patch path as need be
      if (
        (this._defn["objects"][id]["isa"] === "PBXFileReference" ||
          this._defn["objects"][id]["isa"] === "PBXGroup") &&
        this._defn["objects"][id]["sourceTree"] === "SOURCE_ROOT"
      ) {
        if (this._defn["objects"][id]["path"]) {
          this._defn["objects"][id]["path"] =
            filePathPrefix + "/" + this._defn["objects"][id]["path"];
        }
      }
    }
  }

  private patchMergedAppTarget(
    target: PBXNativeTarget,
    frameworkStepId: string
  ): {
    frameworkName: string;
    frameworkExecutableName: string;
  } {
    // Update app to be framework
    target.setProductType("com.apple.product-type.framework");

    const productTarget = target.product();

    productTarget.set(
      "name",
      productTarget.get("name") || productTarget.get("path")
    );

    productTarget.set("explicitFileType", "wrapper.framework");

    // Add as a framework to the main project
    const buildFileId = generateUUID(Object.keys(this._defn["objects"]));
    this._defn["objects"][buildFileId] = {
      isa: "PBXBuildFile",
      fileRef: productTarget._id,
      settings: {
        ATTRIBUTES: ["CodeSignOnCopy", "RemoveHeadersOnCopy"],
      },
    };
    this._defn["objects"][frameworkStepId]["files"].push(buildFileId);

    // Not worth trying to rename the path, shared xcschemes seem to override this
    // (for example, even if we set it to *.framework, when xcode opens the wikipedia
    // example, it will rename it to Wikipedia.app)
    //
    // Beyond that, some tests seem to assume this is the build directory
    //
    // ALSO, earlier in the function that calls this one, we call another function which
    // reads the path and uses it to set the rpath of the framework
    const originalPath = productTarget.get("path");
    const pathParts = originalPath.split(".");
    pathParts.pop();
    const frameworkNameRaw = pathParts.join(".");

    // TODO: I should probably understand how the actual path for the dylib is computed,
    // but for now this seems to be working
    return {
      frameworkName: originalPath,
      frameworkExecutableName: frameworkNameRaw,
    };
  }

  private patchMergedTarget(target: PBXNativeTarget, filePathPrefix: string) {
    // TODO: This is a nasty hack so that the xcode file doesn't show as corrupted,
    // some leaf nodes have to have a pointer back to the root of the tree
    for (const dependency of target.dependencies()) {
      if (dependency.isa() === "PBXTargetDependency") {
        dependency.targetProxy().setContainerPortal(this.rootObject());
      }
    }

    this.patchBuildPaths(target, filePathPrefix);

    this.patchBuildConfigValuesForTarget(target, filePathPrefix);
  }

  public getApplicationBuildSetting(key: string) {
    // Just grab the version of the first buildConfig (usually just debug and release)
    return this.rootObject()
      .applicationTargets()[0]
      .buildConfigurationList()
      .buildConfigs()[0]
      .get("buildSettings")[key];
  }

  public setApplicationBuildSetting(key: string, value: string) {
    const appTargetBuildConfigs = this.rootObject()
      .applicationTargets()[0]
      .buildConfigurationList()
      .buildConfigs();
    for (const buildConfig of appTargetBuildConfigs) {
      this._defn["objects"][buildConfig._id]["buildSettings"][key] = value;
    }
  }

  public mergeTargets(
    other: PBXProj,
    newMainGroup: PBXGroup,
    filePathPrefix: string
  ): PBXNativeTarget[] {
    const appTargets: PBXNativeTarget[] = [];

    this.copyOtherObjectsIntoSelf(other, filePathPrefix);

    // Update OUR object to point to the embedded app as a new group
    const otherMainGroup = other.rootObject().mainGroup().updateProj(this);
    newMainGroup.addChildren(otherMainGroup.children());
    otherMainGroup.remove();

    // Note: this kinda relies on an abstraction leak, as those objects we're
    // "Adding" are grounded in a separate product, but their ID has been
    // duplicated into our project, so this works fine for now
    this.rootObject().addTargets(other.rootObject().targets());

    for (const target of other.rootObject().targets()) {
      target.updateProj(this);
      this.patchMergedTarget(target, filePathPrefix);

      if (target.productType() === "com.apple.product-type.application") {
        appTargets.push(target);
      }
    }

    return appTargets;
  }

  public convertAppToFramework(
    target: PBXNativeTarget,
    filePathPrefix: string,
    frameworkStepId: string
  ): TMergedAppDetails {
    const frameworkInfo = this.patchMergedAppTarget(target, frameworkStepId);

    const buildConfigList = target.buildConfigurationList();
    const defaultConfigurationName = buildConfigList.defaultConfigurationName();

    let defaultBuildConfigDetails: {
      bundleId: string;
      plist: string;
      entitlements: string;
      baseConfigurationReference: string | null;
      customBuildSettings: Record<string, any>;
    } | null = null;

    for (const buildConfig of buildConfigList.buildConfigs()) {
      const buildSettings = buildConfig.buildSettings();

      this.patchHeaderSearchPathsForApp(buildSettings);

      if (!buildSettings["WRAPPER_EXTENSION"]) {
        buildSettings["WRAPPER_EXTENSION"] = "app";
      }

      const searchPaths = buildSettings["LD_RUNPATH_SEARCH_PATHS"];
      if (searchPaths instanceof Array) {
        if (!searchPaths.includes("@executable_path/Frameworks")) {
          throw "Error! App runtime search paths don't include frameworks. This may indicate something is about to break.";
        }

        buildSettings["LD_RUNPATH_SEARCH_PATHS"] = searchPaths.map(
          (path: string) => {
            if (path === "@executable_path/Frameworks") {
              return (
                "@executable_path/Frameworks/" +
                target.product().get("path") +
                "/Frameworks"
              );
            }

            return path;
          }
        );
      } else if (typeof searchPaths === "string") {
        if (!searchPaths.includes("@executable_path/Frameworks")) {
          throw "Error! App runtime search paths don't include frameworks. This may indicate something is about to break.";
        }

        buildSettings["LD_RUNPATH_SEARCH_PATHS"] = searchPaths.replace(
          "@executable_path/Frameworks",
          "@executable_path/Frameworks/" +
            target.product().get("path") +
            "/Frameworks"
        );
      } else {
        throw "Error! App runtime search paths are some undefined type (or simply undefined). This is not expected!";
      }

      if (defaultConfigurationName === buildConfig.name()) {
        const plist = buildSettings["INFOPLIST_FILE"].replace(
          "$(SRCROOT)",
          this._srcRoot
        );
        const bundleId = buildSettings["PRODUCT_BUNDLE_IDENTIFIER"];

        // Note: right now we only need to code sign entitlements to get this to work,
        // but eventually we may want to move other things here (specifically,
        // DEVELOPMENT_TEAM and CODE_SIGN_IDENTITY)
        const entitlements = buildSettings["CODE_SIGN_ENTITLEMENTS"];

        defaultBuildConfigDetails = {
          plist,
          bundleId,
          entitlements,
          baseConfigurationReference: buildConfig.get(
            "baseConfigurationReference"
          ),
          // TODO: we need to extract the build settings, likely we can do this by
          // looking through the list of all xcode build settings (i.e. scraping
          // https://xcodebuildsettings.com/, recommended by https://nshipster.com/xcconfig/)
          // and then pulling out the non-canonical ones
          customBuildSettings: {},
        };
      }
    }

    if (!defaultBuildConfigDetails) {
      throw "Error! No default config found!";
    }

    return {
      frameworkName: frameworkInfo.frameworkName,
      frameworkExecutableName: frameworkInfo.frameworkExecutableName,
      plist: defaultBuildConfigDetails.plist,
      bundleId: defaultBuildConfigDetails.bundleId,
      entitlements: defaultBuildConfigDetails.entitlements,
      baseConfigurationReference:
        defaultBuildConfigDetails.baseConfigurationReference,
      customBuildSettings: defaultBuildConfigDetails.customBuildSettings,
    };
  }

  public flattenBuildConfigs() {
    // The way xcode reads build configs is first off the target, then
    // off the project if it is undefined. B/c we're removing the project
    // those fallbacks won't exist.
    //
    // To get around this we flatten the build configs before we merge.
    const rootBuildConfigLookup: Record<string, PBXBuildConfig> = {};
    this.rootObject()
      .buildConfigurationList()
      .buildConfigs()
      .forEach((buildConfig) => {
        rootBuildConfigLookup[buildConfig.name()] = buildConfig;
      });

    this.rootObject()
      .targets()
      .forEach((target) => {
        target
          .buildConfigurationList()
          .buildConfigs()
          .forEach((buildConfig) => {
            const baseConfigReference = buildConfig.baseConfigurationReference();
            if (baseConfigReference) {
              const xcconfig = XCConfig.fromFile(
                baseConfigReference.fullPath()
              );
              applyDefaultsToBuildSettings(buildConfig, xcconfig.values());
            }

            const rootConfig = rootBuildConfigLookup[buildConfig.name()];
            if (rootConfig) {
              const rootSettings = rootConfig.buildSettings();

              applyDefaultsToBuildSettings(buildConfig, rootSettings);

              // change base config ref
              const rootConfigReference = rootConfig.baseConfigurationReference();
              if (rootConfigReference) {
                const xcconfig = XCConfig.fromFile(
                  rootConfigReference.fullPath()
                );
                applyDefaultsToBuildSettings(buildConfig, xcconfig.values());
              }

              // TODO: theoretically we shoudln't need this (b/c we're merging it all in above),
              // but when you remove it duck duck go hits a permissions error with entitlements
              const rootBaseConfigReference = rootConfig.get(
                "baseConfigurationReference"
              );
              if (
                rootBaseConfigReference &&
                !buildConfig.get("baseConfigurationReference")
              ) {
                buildConfig.set(
                  "baseConfigurationReference",
                  rootBaseConfigReference
                );
              }
            }

            // TODO: All iOS Defaults whose routes we'll have to munge
            applyDefaultsToBuildSettings(buildConfig, {
              SYMROOT: "build",
            });
          });
      });
  }

  public addEntitlementsToBuildConfig(
    file: string,
    buildConfigId: string,
    baseConfigId: string | undefined,
    buildSettings: Record<string, any>
  ) {
    const buildConfig = new PBXBuildConfig(buildConfigId, this);

    buildConfig.set("baseConfigurationReference", baseConfigId);
    buildConfig.buildSettings()["CODE_SIGN_ENTITLEMENTS"] = file;

    buildConfig.overrideBuildSettings({
      ...buildSettings,
      ...buildConfig.buildSettings(),
    });
  }

  public createGroup(name: string, path?: string) {
    const uuid = generateUUID(Object.keys(this._defn["objects"]));
    this._defn["objects"][uuid] = {
      path: path || name,
      name: name,
      isa: "PBXGroup",
      children: [],
      sourceTree: "<group>",
    };

    const child = new PBXGroup(uuid, this);

    return child;
  }

  public containsNode(id: string) {
    return id in this._defn["objects"];
  }

  public genNewKeysExcluding(excludedKeys: string[]) {
    const keyMap: Record<string, string> = {};

    Object.keys(this._defn["objects"]).forEach((key) => {
      keyMap[key] = excludedKeys.includes(key)
        ? generateUUID(excludedKeys.concat(Object.keys(keyMap)))
        : key;
    });

    const potentialKey = (value: any, conservative: boolean) => {
      // Cocoapods seems to use 32char IDs (xcode uses 24)
      const keyMatch = /^[A-Z0-9]{24,32}$/;

      return (
        (value instanceof Array &&
          (value.length > 0 || !conservative) &&
          value.every((v) => keyMatch.test(v))) ||
        (typeof value === "string" && keyMatch.test(value))
      );
    };

    const replaceKey = (value: string[] | string) => {
      if (value instanceof Array) {
        return value.map((key) => {
          return keyMap[key];
        });
      } else {
        return keyMap[value];
      }
    };

    const newDefn: Record<string, any> = {};
    Object.keys(this._defn["objects"]).forEach((oldKey) => {
      const newKey = keyMap[oldKey];
      newDefn[newKey] = this._defn["objects"][oldKey];

      const isa = newDefn[newKey]["isa"];
      Object.keys(newDefn[newKey]).forEach((objectKey) => {
        const objectValue = newDefn[newKey][objectKey];
        if (
          (isa === "PBXProject" &&
            [
              "buildConfigurationList",
              "mainGroup",
              "productRefGroup",
              "targets",
            ].includes(objectKey)) ||
          (isa === "PBXGroup" && ["children"].includes(objectKey)) ||
          (isa === "PBXContainerItemProxy" &&
            ["containerPortal", "remoteGlobalIDString"].includes(objectKey)) ||
          (isa === "PBXNativeTarget" &&
            [
              "buildConfigurationList",
              "buildPhases",
              "productReference",
              "dependencies",
              "buildRules",
            ].includes(objectKey)) ||
          (isa === "PBXTargetDependency" &&
            ["target", "targetProxy"].includes(objectKey)) ||
          (isa === "XCConfigurationList" &&
            ["buildConfigurations"].includes(objectKey)) ||
          (isa === "PBXBuildFile" && ["fileRef"].includes(objectKey)) ||
          (isa === "PBXFrameworksBuildPhase" && ["file"].includes(objectKey)) ||
          (isa === "PBXSourcesBuildPhase" && ["files"].includes(objectKey)) ||
          (isa === "PBXResourcesBuildPhase" && ["files"].includes(objectKey)) ||
          (isa === "PBXCopyFilesBuildPhase" && ["files"].includes(objectKey)) ||
          (isa === "PBXReferenceProxy" && ["remoteRef"].includes(objectKey)) ||
          (isa === "PBXAggregateTarget" &&
            ["buildConfigurationList"].includes(objectKey)) ||
          (isa === "XCVersionGroup" &&
            ["currentVersion", "children"].includes(objectKey)) ||
          (isa === "PBXFrameworksBuildPhase" &&
            ["files"].includes(objectKey)) ||
          (isa === "XCBuildConfiguration" &&
            ["baseConfigurationReference"].includes(objectKey)) ||
          (isa === "PBXVariantGroup" && ["children"].includes(objectKey)) ||
          (isa === "PBXShellScriptBuildPhase" &&
            ["files", "outputFileListPaths", "inputFileListPaths"].includes(
              objectKey
            )) ||
          (isa === "PBXHeadersBuildPhase" && ["files"].includes(objectKey))
        ) {
          if (!potentialKey(objectValue, false)) {
            console.log(
              chalk.yellow(
                `Potential overzelous key match during key replacement! "${newKey}" ("${objectKey}" in "${isa}")`
              )
            );
          }

          newDefn[newKey][objectKey] = replaceKey(objectValue);
        } else if (potentialKey(objectValue, true)) {
          console.log(
            chalk.yellow(
              `Potential missed key during key replacement! "${newKey}" ("${objectKey}" in "${isa}")`
            )
          );
        }
      });
    });

    this._defn["objects"] = newDefn;
  }

  public allObjectKeys() {
    return Object.keys(this._defn["objects"]);
  }
}
