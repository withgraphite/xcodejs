Inspired by https://github.com/apache/cordova-node-xcode/, although that seems a little too usage specific for us. (Also https://github.com/CocoaPods/CocoaPods/tree/master/lib/cocoapods/xcode)

In order to better debug, sometimes I like to make the build pbxproj into JSON:
`plutil -convert json build/intercut.xcodeproj/project.pbxproj`

(You will lose some helpful comments though)
