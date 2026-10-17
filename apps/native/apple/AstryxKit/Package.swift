// swift-tools-version: 6.0
import PackageDescription

// The SwiftUI half of Astryx Native. It draws a screen the TypeScript core computed and
// sends Actions back; it knows nothing of the core beyond the JSON in Protocol/. It has no
// dependencies, so `swift build` and `swift test` work on a Mac with only Xcode, and the
// macOS and iOS hosts share it unchanged.
let package = Package(
    name: "AstryxKit",
    platforms: [.iOS(.v17), .macOS(.v14)],
    products: [.library(name: "AstryxKit", targets: ["AstryxKit"])],
    targets: [
        .target(name: "AstryxKit"),
        .testTarget(
            name: "AstryxKitTests",
            dependencies: ["AstryxKit"],
            resources: [.copy("Fixtures")]
        ),
    ]
)
