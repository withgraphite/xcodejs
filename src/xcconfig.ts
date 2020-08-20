import * as fs from "fs-extra";
import path from "path";

const XCCONFIG_VAR_ASSIGNMENT = /(.*?) = (.*);?/;
const XCCONFIG_INCLUDE = /#include(\??) "(.*)"/;

export class XCConfig {
  _defn: { [key: string]: any };
  _path: string;

  constructor(defn: {}, path: string) {
    this._defn = defn;
    this._path = path;
  }

  static fromFile(file: string) {
    const data = fs.readFileSync(file);
    let defn: Record<string, any> = {};
    data
      .toString()
      .split("\n")
      .forEach((line) => {
        if (line.trim().length === 0 || line.startsWith("//")) {
          return;
        } else if (line.startsWith("#include")) {
          const includeParse = XCCONFIG_INCLUDE.exec(line);

          if (includeParse === null) {
            throw "Error! Not-understood include statement: '" + line + "'";
          }

          const includeFilePath = path.join(
            path.dirname(file),
            includeParse[2]
          );

          if (!fs.existsSync(includeFilePath)) {
            if (includeParse[1] !== "?") {
              throw "Error! Missing include: " + includeFilePath;
            }
          } else {
            const subFile = XCConfig.fromFile(includeFilePath);
            defn = {
              ...defn,
              ...subFile.values(),
            };
          }
        } else {
          const variableAssignment = XCCONFIG_VAR_ASSIGNMENT.exec(line);

          if (variableAssignment === null) {
            throw `Error! Not-understood line in xconfig (${file}): "${line}"`;
          }
          defn[variableAssignment[1]] = variableAssignment[2];
        }
      });

    return new XCConfig(defn, file);
  }

  public values() {
    return this._defn;
  }
}
