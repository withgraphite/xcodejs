import { execSync } from "child_process";

export class Plist {
  _defn: { [key: string]: any };

  constructor(defn: {}) {
    this._defn = defn;
  }

  static fromFile(file: string) {
    const data = execSync("plutil -convert json -o - " + file);
    const defn = JSON.parse(data.toString());

    return new Plist(defn);
  }

  static mergeKeyFromOthers(key: string, values: any[]) {
    // Add specific key handlers here

    // No specific handler found, assuming they must all be identical
    const firstValue = values[0];
    const firstValueJSON = JSON.stringify(firstValue);
    if (
      !values.every((value) => {
        // This isn't entirely correct, JSON doesn't guarantee ordering of dictionary keys, but
        // works for now
        return JSON.stringify(value) === firstValueJSON;
      })
    ) {
      throw (
        "Different values detected for key '" +
        key +
        "', this key cannot be different"
      );
    }
    return values[0];
  }

  static fromOthers(plists: Plist[]) {
    const allKeys = new Set<string>();
    plists.forEach((plist) => {
      Object.keys(plist._defn).forEach((k) => {
        allKeys.add(k);
      });
    });

    const mergedDefn: { [key: string]: any } = {};
    allKeys.forEach((key) => {
      mergedDefn[key] = Plist.mergeKeyFromOthers(
        key,
        plists
          .map((plist) => {
            return plist._defn[key];
          })
          .filter((v) => {
            return v !== undefined;
          })
      );
    });

    return new Plist(mergedDefn);
  }

  public writeFile(file: string) {
    execSync("plutil -convert xml1 - -o " + file, {
      input: JSON.stringify(this._defn),
    });
  }
}
