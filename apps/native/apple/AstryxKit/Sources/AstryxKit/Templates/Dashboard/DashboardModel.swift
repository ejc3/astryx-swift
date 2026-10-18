import Foundation

/// The dashboard template's view model: a Swift mirror of `DashboardView` in
/// core/src/templates/dashboard/model.ts. Numbers are `Double` so JSON like `120` and `120.0`
/// both read.

/// The data palette's names; an unknown name draws as neutral.
enum DashDataColor: String, Decodable {
    case blue, orange, green, purple, neutral

    init(from decoder: Decoder) throws {
        let raw = try decoder.singleValueContainer().decode(String.self)
        self = DashDataColor(rawValue: raw) ?? .neutral
    }

    /// The theme token that paints this color.
    var token: String {
        self == .neutral ? "color-data-neutral" : "color-data-categorical-\(rawValue)"
    }
}

struct DashModel: Decodable {
    struct ActiveUsers: Decodable {
        struct Point: Decodable, Identifiable {
            let hour: Double
            let label: String
            let allUsers: Double
            let desktop: Double
            let mobile: Double
            var id: Double { hour }
        }
        struct Series: Decodable, Identifiable {
            let key: String
            let name: String
            let color: DashDataColor
            var id: String { key }
        }
        struct Tick: Decodable {
            let at: Double
            let label: String
        }
        let title: String
        let reloadLabel: String
        let points: [Point]
        let series: [Series]
        let xDomain: [Double]
        let xTicks: [Tick]
        let yDomain: [Double]
        let yTicks: [Double]
    }

    struct Metric: Decodable, Identifiable {
        let label: String
        let value: String
        let change: String
        let positive: Bool
        let caption: String
        let sparkline: [Double]
        var id: String { label }
    }

    struct Demographics: Decodable {
        struct Card: Decodable, Identifiable {
            struct Segment: Decodable, Identifiable {
                let label: String
                let value: Double
                let color: DashDataColor
                /// Its share of the bar to two decimals, without the percent sign: "38.00".
                let share: String
                var id: String { label }
            }
            let title: String
            let segments: [Segment]
            var id: String { title }
        }
        let title: String
        let moreLabel: String
        let cards: [Card]
    }

    struct PagesTable: Decodable {
        struct Headers: Decodable {
            let page: String
            let views: String
            let newUsers: String
            let avgTime: String
        }
        struct Row: Decodable, Identifiable {
            let id: String
            let page: String
            let views: Double
            let max: Double
            let barLabel: String
            let viewsLabel: String
            let newUsers: String
            let avgTime: String
        }
        let title: String
        let linkLabel: String
        let linkHref: String
        let headers: Headers
        let rows: [Row]
    }

    struct EventsTable: Decodable {
        struct Headers: Decodable {
            let event: String
            let count: String
            let users: String
            let newUsers: String
        }
        struct Row: Decodable, Identifiable {
            let id: String
            let event: String
            let count: Double
            let max: Double
            let barLabel: String
            let countLabel: String
            let usersLabel: String
            let newUsersLabel: String
        }
        let title: String
        let linkLabel: String
        let linkHref: String
        let headers: Headers
        let rows: [Row]
    }

    struct Engagement: Decodable {
        let title: String
        let moreLabel: String
        let pages: PagesTable
        let events: EventsTable
    }

    let activeUsers: ActiveUsers
    let metrics: [Metric]
    let demographics: Demographics
    let engagement: Engagement
}

extension DashModel.ActiveUsers.Point {
    /// The value of one series (`allUsers`, `desktop` or `mobile`) at this point.
    func value(for key: String) -> Double {
        switch key {
        case "allUsers": allUsers
        case "desktop": desktop
        case "mobile": mobile
        default: 0
        }
    }
}

/// One table, pages or events, as the shared table view draws it: a name, a bar with its
/// words, and the remaining columns with their headers.
struct DashTableData {
    struct Row: Identifiable {
        let id: String
        let name: String
        let bar: Double
        let max: Double
        let barLabel: String
        let valueLabel: String
        let extras: [String]
    }
    let title: String
    let linkLabel: String
    let nameHeader: String
    let barHeader: String
    let extraHeaders: [String]
    let rows: [Row]

    init(_ t: DashModel.PagesTable) {
        title = t.title
        linkLabel = t.linkLabel
        nameHeader = t.headers.page
        barHeader = t.headers.views
        extraHeaders = [t.headers.newUsers, t.headers.avgTime]
        rows = t.rows.map {
            Row(id: $0.id, name: $0.page, bar: $0.views, max: $0.max, barLabel: $0.barLabel, valueLabel: $0.viewsLabel, extras: [$0.newUsers, $0.avgTime])
        }
    }

    init(_ t: DashModel.EventsTable) {
        title = t.title
        linkLabel = t.linkLabel
        nameHeader = t.headers.event
        barHeader = t.headers.count
        extraHeaders = [t.headers.users, t.headers.newUsers]
        rows = t.rows.map {
            Row(id: $0.id, name: $0.event, bar: $0.count, max: $0.max, barLabel: $0.barLabel, valueLabel: $0.countLabel, extras: [$0.usersLabel, $0.newUsersLabel])
        }
    }
}
