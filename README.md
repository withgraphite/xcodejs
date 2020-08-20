# XCodeJS - DO NOT USE

XCodeJS is still under active development and should not be adopted. We are actively trying to make the APIs better and **WE WILL MAKE BREAKING CHANGES**.

## About

XCodeJS is a collection of utility functions to read and write to xcode projects. It is inspired by:

- https://github.com/apache/cordova-node-xcode
- https://github.com/CocoaPods/CocoaPods/tree/master/lib/cocoapods/xcode

It enables scripts to programatically modify files generated and read by xcode.

## Usage

Coming soon!

XCodeJS is still not stable and should not be used outside of Screenplay.

## Development

XCodeJS is written in TypeScript. To build a new distribution simply run `yarn build`.

Note: It is usually easiest to develop using `yarn link` (https://classic.yarnpkg.com/en/docs/cli/link/):

1. Git clone this repo to your code folder
2. Cd into that repo, run `yarn link`
3. Then go to the repo in which you intend to use this and run `yarn link "xcodejs"`

## Publishing

If you are a Screenplay employee and trying to bump the version:

1. Bump the version in `package.js` (using semver)
2. `git add --all && git commit`
3. `npm publish`

_(Note: At some point, we'll likely move this to CI/CD)_

## License

(c) Screenplay Studios Inc., 2020 - All Rights Reserved
