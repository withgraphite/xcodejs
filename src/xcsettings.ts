import { execSync } from "child_process";

export class XCSettings {
  _defn: Record<string, any>;

  constructor(defn: Record<string, any>) {
    this._defn = defn;
  }

  static fromFile(file: string) {
    const data = execSync("plutil -convert json -o - " + file, {
      maxBuffer: 1024 * 1024 * 1024,
    });
    const defn = JSON.parse(data.toString());

    return new XCSettings(defn);
  }
}
