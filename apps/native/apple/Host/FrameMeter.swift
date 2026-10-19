import Foundation
import QuartzCore
#if os(macOS)
import AppKit
#else
import UIKit
#endif

/// A frame-rate meter, on with `-AXFrameMeter YES`. Each second it prints one line to standard
/// error: how many display refreshes the main thread served, how many came late (more than 1.5
/// refresh intervals after the one before: a frame the app could not draw in time), the longest
/// gap, and how many snapshots arrived from the core. A display link fires on the main run loop,
/// so a main thread busy decoding or laying out shows here as missing and late frames.
@MainActor
final class FrameMeter: NSObject {
    static let shared = FrameMeter()

    private var link: CADisplayLink?
    private var last: CFTimeInterval = 0
    private var windowStart: CFTimeInterval = 0
    private var frames = 0
    private var late = 0
    private var worst: CFTimeInterval = 0
    private var snapshots = 0
    private var interval: CFTimeInterval = 1.0 / 60

    func start() {
        guard link == nil else { return }
        #if os(macOS)
        guard let screen = NSScreen.main else { return }
        let link = screen.displayLink(target: self, selector: #selector(tick(_:)))
        interval = 1.0 / Double(max(screen.maximumFramesPerSecond, 1))
        #else
        let link = CADisplayLink(target: self, selector: #selector(tick(_:)))
        interval = 1.0 / Double(max(UIScreen.main.maximumFramesPerSecond, 1))
        #endif
        let fastest = Float(1 / interval)
        link.preferredFrameRateRange = CAFrameRateRange(minimum: fastest, maximum: fastest, preferred: fastest)
        link.add(to: .main, forMode: .common)
        self.link = link
        report("refresh \(Int((1 / interval).rounded())) Hz")
    }

    private var handling: CFTimeInterval = 0
    private var handlingWorst: CFTimeInterval = 0
    private var bytes = 0

    /// One snapshot from the core reached the drawing: its size, and how long the host took to hand
    /// it to the drawings (decoding into the model and passing it to the web panes).
    func noteSnapshot(bytes count: Int, seconds: CFTimeInterval) {
        guard link != nil else { return }
        snapshots += 1; bytes += count; handling += seconds; handlingWorst = max(handlingWorst, seconds)
    }

    @objc private func tick(_ link: CADisplayLink) {
        let now = link.timestamp
        if last > 0 {
            let gap = now - last
            if gap > interval * 1.5 { late += 1 }
            worst = max(worst, gap)
        } else {
            windowStart = now
        }
        last = now
        frames += 1
        if now - windowStart >= 1 {
            let seconds = now - windowStart
            report(String(format: "fps %.0f  late %d  worst %.1f ms  snapshots %d  %d kB  handling %.1f ms (worst %.1f)",
                          Double(frames) / seconds, late, worst * 1000, snapshots, bytes / 1024,
                          handling * 1000, handlingWorst * 1000))
            windowStart = now; frames = 0; late = 0; worst = 0; snapshots = 0
            bytes = 0; handling = 0; handlingWorst = 0
        }
    }

    private func report(_ line: String) {
        FileHandle.standardError.write(Data("AXFrameMeter \(line)\n".utf8))
    }
}
