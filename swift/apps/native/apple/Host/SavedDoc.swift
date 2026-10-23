import Foundation

/// The saved doc on this device (docs/SYNC.md): what the person made or changed, as the core
/// last sent it, kept in Application Support. Signed out, this is the only copy; signed in,
/// Zero keeps its own and this stays as the signed-out copy.
enum SavedDoc {
    /// Set by `-AXFreshDoc YES`: start from the sample data and leave the kept doc alone.
    nonisolated(unsafe) static var isReadOnly = false

    private static let queue = DispatchQueue(label: "astryx.saved-doc")

    private static var file: URL? {
        guard let base = try? FileManager.default.url(for: .applicationSupportDirectory, in: .userDomainMask, appropriateFor: nil, create: true) else { return nil }
        let dir = base.appendingPathComponent("AstryxSwift", isDirectory: true)
        try? FileManager.default.createDirectory(at: dir, withIntermediateDirectories: true)
        return dir.appendingPathComponent("doc.json")
    }

    /// The kept doc as JSON, or nil; the core checks whatever it gets.
    static func read() -> Any? {
        guard let file, let data = try? Data(contentsOf: file) else { return nil }
        return try? JSONSerialization.jsonObject(with: data)
    }

    /// Replaces the kept doc, off the main thread, atomically: a crash leaves the old or the new one.
    static func write(_ json: String) {
        guard !isReadOnly, let file, let data = json.data(using: .utf8) else { return }
        queue.async { try? data.write(to: file, options: [.atomic, .completeFileProtectionUntilFirstUserAuthentication]) }
    }

    /// This install's id seed, made once from the system's random source: new records are "<seed>-<n>".
    static var seed: String {
        let key = "AXSeed"
        if let kept = UserDefaults.standard.string(forKey: key), kept.count >= 8 { return kept }
        let alphabet = Array("abcdefghijklmnopqrstuvwxyz0123456789")
        var generator = SystemRandomNumberGenerator()
        let made = String((0..<12).map { _ in alphabet.randomElement(using: &generator)! })
        UserDefaults.standard.set(made, forKey: key)
        return made
    }
}
