import chalk from "chalk";
import * as fs from "fs-extra";
import convert from "xml-js";

export class XCWorkspace {
  _defn: Record<string, any>;

  constructor(defn: Record<string, any>) {
    this._defn = defn;
  }

  public allFiles(): string[] {
    return this._defn["Workspace"]["FileRef"].map(
      (fileRef: { _attributes: { location: string } }) => {
        if (!fileRef._attributes.location.startsWith("group:")) {
          console.log(
            chalk.yellow(
              "Error! Unknown format, XCWorkspace file ref does not start with 'group:'"
            )
          );
        }

        return fileRef._attributes.location.slice(6);
      }
    );
  }

  static fromFile(file: string) {
    const data = fs.readFileSync(file);
    const defn: any = convert.xml2js(data.toString(), { compact: true });

    return new XCWorkspace(defn);
  }
}
