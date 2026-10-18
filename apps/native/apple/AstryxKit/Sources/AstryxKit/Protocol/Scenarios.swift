import Foundation

/// The core's scenarios and the one playing (core/src/scenarios.ts). The kit draws the menu
/// and the playing bar from it; the host performs each step (it reads the step from the
/// snapshot itself, so its gestures and actions are not decoded here).
public struct ScenariosSnapshot: Decodable, Sendable {
    public struct Item: Decodable, Sendable, Identifiable {
        public let id: String
        public let title: String
        public let template: String
        public let steps: String
    }
    public struct Driver: Decodable, Sendable {
        public let value: String
        public let label: String
        public let description: String
    }
    public struct Playing: Decodable, Sendable {
        public struct Controls: Decodable, Sendable {
            public let pauseId: String
            public let resumeId: String
            public let stopId: String
            public let pauseLabel: String
            public let resumeLabel: String
            public let stopLabel: String
        }
        public let id: String
        public let title: String
        public let driver: String
        public let status: String
        public let progress: String
        public let caption: String
        public let controls: Controls
    }
    public let label: String
    public let list: [Item]
    public let drivers: [Driver]
    public let playing: Playing?
}
