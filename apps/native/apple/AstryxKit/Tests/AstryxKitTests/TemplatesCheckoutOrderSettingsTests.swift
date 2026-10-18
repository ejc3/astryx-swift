import ImageIO
import SwiftUI
import UniformTypeIdentifiers
import XCTest
@testable import AstryxKit

/// The checkout, order and settings templates: each fixture (and each state the core can reach
/// that is worth drawing) decodes into the template's typed model, and each is drawn to a PNG
/// at phone width (393) and in a Mac window (1280 by 800), light and dark, into `$AX_SHOTS`.
///
/// ImageRenderer draws a TextField, Toggle, Picker or ScrollView as an empty box, so the
/// screens are drawn with `axStatic`, which swaps those for plain stand-ins; the native
/// controls themselves are judged by the iOS Simulator build and the running app.
@MainActor
final class TemplatesCheckoutOrderSettingsTests: XCTestCase {
    private var directory: URL? {
        guard let path = ProcessInfo.processInfo.environment["AX_SHOTS"], !path.isEmpty else { return nil }
        return URL(fileURLWithPath: path, isDirectory: true)
    }

    /// The fixture's snapshot, with the template's view replaced by `view` (a JSON object) if given.
    private func app(_ template: String, view: String? = nil) throws -> AppSnapshot {
        var json = try XCTUnwrap(JSONSerialization.jsonObject(with: Library.data("template-\(template)")) as? [String: Any])
        if let view {
            var screen = try XCTUnwrap(json["screen"] as? [String: Any])
            var body = try XCTUnwrap(screen["body"] as? [String: Any])
            body["view"] = try JSONSerialization.jsonObject(with: Data(view.utf8))
            screen["body"] = body
            json["screen"] = screen
        }
        return try JSONDecoder().decode(AppSnapshot.self, from: JSONSerialization.data(withJSONObject: json))
    }

    private func templateView(_ app: AppSnapshot) throws -> JSONValue {
        guard case .template(let node) = app.screen.body else {
            XCTFail("the screen body is not a template node")
            throw XCTSkip("not a template")
        }
        return node.view
    }

    // MARK: Decoding

    func testFixturesDecode() throws {
        let checkout = try templateView(app("checkout")).decode(CheckoutModel.self)
        XCTAssertEqual(checkout.steps.map(\.label), ["Cart", "Shipping", "Delivery", "Payment"])
        XCTAssertEqual(checkout.items.count, 3)
        XCTAssertEqual(checkout.items.first?.qty, 2)
        XCTAssertEqual(checkout.summary.total, "$332.64")
        XCTAssertEqual(checkout.actions.nextLabel, "Continue")
        XCTAssertNil(checkout.firstInvalidField)

        let order = try templateView(app("order")).decode(OrderModel.self)
        XCTAssertEqual(order.number, "#1001")
        XCTAssertEqual(order.products.count, 5)
        XCTAssertEqual(COSPart.join(order.products[0].unit), "$89.00 \u{D7} 1")
        XCTAssertEqual(order.summary.last?.strong, true)
        XCTAssertNil(order.summary.last?.note)
        XCTAssertEqual(order.activity[2].changes?.count, 2)
        XCTAssertNil(order.activity[2].reactions)
        XCTAssertEqual(order.customer.count, 5)

        let settings = try templateView(app("settings")).decode(SettingsModel.self)
        XCTAssertEqual(settings.navItems.map(\.label), ["Profile", "Account", "Members", "Billing", "Invoices", "API"])
        XCTAssertEqual(settings.navItems.filter(\.isSelected).map(\.label), ["Profile"])
        XCTAssertEqual(settings.searchItems.count, 8)
        XCTAssertNil(settings.search)
        XCTAssertEqual(settings.username, "nicol43")
    }

    func testVariantsDecode() throws {
        XCTAssertFalse(variantViews.isEmpty)
        for (name, json) in variantViews {
            let view = try JSONDecoder().decode(JSONValue.self, from: Data(json.utf8))
            switch name.prefix(while: { $0 != "-" }) {
            case "checkout": _ = try view.decode(CheckoutModel.self)
            case "order": _ = try view.decode(OrderModel.self)
            case "settings": _ = try view.decode(SettingsModel.self)
            default: XCTFail("unknown variant \(name)")
            }
        }
        let errors = try JSONDecoder().decode(JSONValue.self, from: Data(try XCTUnwrap(variantViews["checkout-shipping-errors2"]).utf8))
            .decode(CheckoutModel.self)
        XCTAssertEqual(errors.step, 1)
        XCTAssertEqual(errors.firstInvalidField, "email")
        XCTAssertEqual(errors.errors.count, 7)
        XCTAssertEqual(errors.steps.map(\.hasError), [false, true, false, false])
        XCTAssertNotNil(errors.actions.blocked)
        let promo = try JSONDecoder().decode(JSONValue.self, from: Data(try XCTUnwrap(variantViews["checkout-promo"]).utf8))
            .decode(CheckoutModel.self)
        XCTAssertEqual(promo.promo.status?.type, "success")
        XCTAssertNotNil(promo.summary.promoLabel)
        let search = try JSONDecoder().decode(JSONValue.self, from: Data(try XCTUnwrap(variantViews["settings-search"]).utf8))
            .decode(SettingsModel.self)
        XCTAssertEqual(search.search?.label, "Change password")
        XCTAssertTrue(search.twoFactor)
    }

    /// The action ids the drawings send are the ones each model's `reduce` accepts (listed in the
    /// head comment of each model.ts), prefixed with the template id.
    func testActionIds() {
        XCTAssertEqual(
            Action.set(id: CheckoutSender.id("qty:mug"), value: .number(3)).json,
            #"{"id":"tpl.checkout.qty:mug","type":"set","value":3}"#
        )
        XCTAssertEqual(
            Action.set(id: CheckoutSender.id("isGift"), value: .bool(true)).json,
            #"{"id":"tpl.checkout.isGift","type":"set","value":true}"#
        )
    }

    // MARK: Pictures

    private func png<V: View>(_ view: V, width: CGFloat, height: CGFloat?) throws -> Data {
        let renderer = ImageRenderer(content: view)
        renderer.scale = 2
        renderer.proposedSize = ProposedViewSize(width: width, height: height)
        let image = try XCTUnwrap(renderer.cgImage)
        let data = NSMutableData()
        let destination = try XCTUnwrap(CGImageDestinationCreateWithData(data, UTType.png.identifier as CFString, 1, nil))
        CGImageDestinationAddImage(destination, image, nil)
        XCTAssertTrue(CGImageDestinationFinalize(destination))
        return data as Data
    }

    private func phone(_ app: AppSnapshot, _ theme: ResolvedTheme, _ scheme: ColorScheme, typeSize: DynamicTypeSize = .large) -> some View {
        ScreenView(app: app, inlineToolbar: true, scrolls: false, fixedWidth: 393)
            .frame(width: 393)
            .fixedSize(horizontal: false, vertical: true)
            .axTheme(theme, scheme: scheme, typeSize: typeSize)
            .environment(\.colorScheme, scheme)
            .environment(\.dynamicTypeSize, typeSize)
            .environment(\.axStatic, true)
    }

    /// Sidebar and screen in a 1280 by 800 window.
    private func mac(_ app: AppSnapshot, _ theme: ResolvedTheme, _ scheme: ColorScheme) -> some View {
        HStack(spacing: 0) {
            StaticSidebar(app: app).frame(width: 240, height: 800)
            Rectangle().fill(Color.gray.opacity(0.25)).frame(width: 1)
            ScreenView(app: app, inlineToolbar: true, scrolls: false, fixedWidth: 1039)
                .frame(width: 1039, height: 800, alignment: .top)
                .clipped()
        }
        .frame(width: 1280, height: 800)
        .clipped()
        .axTheme(theme, scheme: scheme, typeSize: .large)
        .environment(\.colorScheme, scheme)
        .environment(\.axStatic, true)
    }

    /// The same window as tall as the screen is, to see all of it.
    private func macTall(_ app: AppSnapshot, _ theme: ResolvedTheme, _ scheme: ColorScheme) -> some View {
        ScreenView(app: app, inlineToolbar: true, scrolls: false, fixedWidth: 1039)
            .frame(width: 1039)
            .fixedSize(horizontal: false, vertical: true)
            .axTheme(theme, scheme: scheme, typeSize: .large)
            .environment(\.colorScheme, scheme)
            .environment(\.axStatic, true)
    }

    func testRendersEveryTemplate() throws {
        guard let directory else { throw XCTSkip("AX_SHOTS is not set") }
        try FileManager.default.createDirectory(at: directory, withIntermediateDirectories: true)
        // AX_ONLY narrows a run to the pictures whose name contains it, for quick iteration.
        let only = ProcessInfo.processInfo.environment["AX_ONLY"] ?? ""
        var written = 0
        func write(_ make: @autoclosure () throws -> Data, _ name: String) throws {
            guard only.isEmpty || name.contains(only) else { return }
            let data = try make()
            try data.write(to: directory.appendingPathComponent(name + ".png"))
            XCTAssertGreaterThan(data.count, 2_000, name)
            written += 1
        }
        let astryx = try Library.theme("theme-astryx")
        let schemes: [(String, ColorScheme)] = [("light", .light), ("dark", .dark)]

        // The fixtures as the core hands them over.
        for template in ["checkout", "order", "settings"] {
            let snapshot = try app(template)
            for (label, scheme) in schemes {
                try write(try png(phone(snapshot, astryx, scheme), width: 393, height: nil), "\(template).astryx.phone.\(label)")
                try write(try png(mac(snapshot, astryx, scheme), width: 1280, height: 800), "\(template).astryx.mac.\(label)")
                try write(try png(macTall(snapshot, astryx, scheme), width: 1039, height: nil), "\(template).astryx.mactall.\(label)")
            }
        }
        // States worth drawing.
        for (name, json) in variantViews.sorted(by: { $0.key < $1.key }) {
            let template = String(name.prefix(while: { $0 != "-" }))
            let snapshot = try app(template, view: json)
            for (label, scheme) in schemes {
                try write(try png(phone(snapshot, astryx, scheme), width: 393, height: nil), "\(name).astryx.phone.\(label)")
                try write(try png(macTall(snapshot, astryx, scheme), width: 1039, height: nil), "\(name).astryx.mactall.\(label)")
            }
        }
        // The largest Dynamic Type size, the layout that most needs to hold.
        for template in ["checkout", "order", "settings"] {
            try write(try png(phone(try app(template), astryx, .light, typeSize: .accessibility3), width: 393, height: nil), "\(template).astryx.phone.axl")
        }
        if only.isEmpty { XCTAssertEqual(written, 3 * 6 + variantViews.count * 4 + 3) }
    }

    /// The order panel as the sheet shows it on a narrow window (a sheet cannot be drawn to an image).
    func testRendersOrderPanel() throws {
        guard let directory else { throw XCTSkip("AX_SHOTS is not set") }
        let only = ProcessInfo.processInfo.environment["AX_ONLY"] ?? ""
        guard only.isEmpty || "order.panel".contains(only) || only == "order" else { return }
        let astryx = try Library.theme("theme-astryx")
        let model = try templateView(app("order")).decode(OrderModel.self)
        for (label, scheme) in [("light", ColorScheme.light), ("dark", .dark)] {
            let view = OrderPanelContent(model: model)
                .padding(16)
                .frame(width: 393, alignment: .topLeading)
                .background(Color.clear)
                .fixedSize(horizontal: false, vertical: true)
                .axTheme(astryx, scheme: scheme, typeSize: .large)
                .environment(\.colorScheme, scheme)
                .environment(\.axStatic, true)
                .background(scheme == .dark ? Color.black : Color.white)
            try png(view, width: 393, height: nil).write(to: directory.appendingPathComponent("order.panel.astryx.phone.\(label).png"))
        }
    }
}

/// Views the core computed for states worth drawing (core/src/templates/<id>/model.ts, driven through its
/// `reduce`), with the product picture's data URI shortened. Keyed by name.
private let variantViews: [String: String] = [
    "checkout-promo": #"""
{"step":0,"isLastStep":false,"isComplete":false,"focusTicket":0,"steps":[{"label":"Cart","icon":"cart","hasError":false},{"label":"Shipping","icon":"pin","hasError":false},{"label":"Delivery","icon":"truck","hasError":false},{"label":"Payment","icon":"card","hasError":false}],"errors":{},"items":[{"id":"mug","name":"Speckled Stoneware Mug","variant":"Hand-thrown · 12 oz","src":"placeholder","qty":2,"isLimited":false,"priceEach":"$78.00","lineTotal":"$156.00"},{"id":"plate","name":"Stoneware Dinner Plate","variant":"Reactive glaze · 10 in","src":"placeholder","qty":1,"isLimited":false,"priceEach":"$72.00","lineTotal":"$72.00"},{"id":"bowl","name":"Cereal Bowl","variant":"Speckled clay · 6 in","src":"placeholder","qty":1,"isLimited":true,"priceEach":"$80.00","lineTotal":"$80.00"}],"summary":{"itemCount":"4 items","trigger":"Order summary · $271.06","subtotal":"$308.00","promoLabel":"CLAY20 · 20% off","discount":"−$61.60","deliveryLabel":"Standard","shipping":"$4.95","tax":"$19.71","total":"$271.06","freeShippingTitle":"$53.60 away from free standard shipping"},"actions":{"blocked":null,"backLabel":"Continue shopping","nextLabel":"Continue"},"promo":{"value":"clay20","status":{"type":"success","message":"CLAY20 · 20% off applied."}},"shipping":{"email":"","firstName":"","lastName":"","country":"us","address":"","apartment":"","city":"","state":"","postalCode":"","countries":[{"value":"us","label":"United States"},{"value":"ca","label":"Canada"},{"value":"uk","label":"United Kingdom"}],"states":["California","Illinois","Massachusetts","New York","Oregon","Texas","Washington"],"hasState":true,"postalLabel":"ZIP code","postalPlaceholder":"10001"},"delivery":{"value":"standard","options":[{"value":"standard","label":"Standard","window":"3–7 business days","price":"$4.95"},{"value":"expedited","label":"Expedited","window":"1–2 business days","price":"$9.95"},{"value":"overnight","label":"Overnight","window":"Next business day by 5pm","price":"$24.95"}],"isGift":false,"note":"","noteLabel":"Delivery instructions","notePlaceholder":"Leave with the neighbour at number 14.","noteDescription":"Passed to the carrier where they support it."},"payment":{"cardNumber":"","cardName":"","expiry":"","cvc":"","billingMatches":true},"confirmation":"This local example completed an order for $271.06. No payment was sent."}
"""#,
    "checkout-promo-bad": #"""
{"step":0,"isLastStep":false,"isComplete":false,"focusTicket":0,"steps":[{"label":"Cart","icon":"cart","hasError":false},{"label":"Shipping","icon":"pin","hasError":false},{"label":"Delivery","icon":"truck","hasError":false},{"label":"Payment","icon":"card","hasError":false}],"errors":{},"items":[{"id":"mug","name":"Speckled Stoneware Mug","variant":"Hand-thrown · 12 oz","src":"placeholder","qty":2,"isLimited":false,"priceEach":"$78.00","lineTotal":"$156.00"},{"id":"plate","name":"Stoneware Dinner Plate","variant":"Reactive glaze · 10 in","src":"placeholder","qty":1,"isLimited":false,"priceEach":"$72.00","lineTotal":"$72.00"},{"id":"bowl","name":"Cereal Bowl","variant":"Speckled clay · 6 in","src":"placeholder","qty":1,"isLimited":true,"priceEach":"$80.00","lineTotal":"$80.00"}],"summary":{"itemCount":"4 items","trigger":"Order summary · $332.64","subtotal":"$308.00","promoLabel":null,"discount":"−$0.00","deliveryLabel":"Standard","shipping":"Free","tax":"$24.64","total":"$332.64","freeShippingTitle":null},"actions":{"blocked":null,"backLabel":"Continue shopping","nextLabel":"Continue"},"promo":{"value":"nope","status":{"type":"warning","message":"Press Apply to check this code."}},"shipping":{"email":"","firstName":"","lastName":"","country":"us","address":"","apartment":"","city":"","state":"","postalCode":"","countries":[{"value":"us","label":"United States"},{"value":"ca","label":"Canada"},{"value":"uk","label":"United Kingdom"}],"states":["California","Illinois","Massachusetts","New York","Oregon","Texas","Washington"],"hasState":true,"postalLabel":"ZIP code","postalPlaceholder":"10001"},"delivery":{"value":"standard","options":[{"value":"standard","label":"Standard","window":"3–7 business days","price":"Free"},{"value":"expedited","label":"Expedited","window":"1–2 business days","price":"$9.95"},{"value":"overnight","label":"Overnight","window":"Next business day by 5pm","price":"$24.95"}],"isGift":false,"note":"","noteLabel":"Delivery instructions","notePlaceholder":"Leave with the neighbour at number 14.","noteDescription":"Passed to the carrier where they support it."},"payment":{"cardNumber":"","cardName":"","expiry":"","cvc":"","billingMatches":true},"confirmation":"This local example completed an order for $332.64. No payment was sent."}
"""#,
    "checkout-shipping-errors": #"""
{"step":1,"isLastStep":false,"isComplete":false,"focusTicket":1,"steps":[{"label":"Cart","icon":"cart","hasError":false},{"label":"Shipping","icon":"pin","hasError":true},{"label":"Delivery","icon":"truck","hasError":false},{"label":"Payment","icon":"card","hasError":false}],"errors":{"email":"Enter an email address for order updates.","firstName":"Required","lastName":"Required","address":"Required","city":"Required","state":"Required","postalCode":"Enter a 5-digit ZIP code, with an optional 4-digit suffix."},"items":[{"id":"mug","name":"Speckled Stoneware Mug","variant":"Hand-thrown · 12 oz","src":"placeholder","qty":2,"isLimited":false,"priceEach":"$78.00","lineTotal":"$156.00"},{"id":"plate","name":"Stoneware Dinner Plate","variant":"Reactive glaze · 10 in","src":"placeholder","qty":1,"isLimited":false,"priceEach":"$72.00","lineTotal":"$72.00"},{"id":"bowl","name":"Cereal Bowl","variant":"Speckled clay · 6 in","src":"placeholder","qty":1,"isLimited":true,"priceEach":"$80.00","lineTotal":"$80.00"}],"summary":{"itemCount":"4 items","trigger":"Order summary · $332.64","subtotal":"$308.00","promoLabel":null,"discount":"−$0.00","deliveryLabel":"Standard","shipping":"Free","tax":"$24.64","total":"$332.64","freeShippingTitle":null},"actions":{"blocked":"7 problems above need fixing first.","backLabel":"Back","nextLabel":"Continue"},"promo":{"value":"","status":null},"shipping":{"email":"","firstName":"","lastName":"","country":"us","address":"","apartment":"","city":"","state":"","postalCode":"12","countries":[{"value":"us","label":"United States"},{"value":"ca","label":"Canada"},{"value":"uk","label":"United Kingdom"}],"states":["California","Illinois","Massachusetts","New York","Oregon","Texas","Washington"],"hasState":true,"postalLabel":"ZIP code","postalPlaceholder":"10001"},"delivery":{"value":"standard","options":[{"value":"standard","label":"Standard","window":"3–7 business days","price":"Free"},{"value":"expedited","label":"Expedited","window":"1–2 business days","price":"$9.95"},{"value":"overnight","label":"Overnight","window":"Next business day by 5pm","price":"$24.95"}],"isGift":false,"note":"","noteLabel":"Delivery instructions","notePlaceholder":"Leave with the neighbour at number 14.","noteDescription":"Passed to the carrier where they support it."},"payment":{"cardNumber":"","cardName":"","expiry":"","cvc":"","billingMatches":true},"confirmation":"This local example completed an order for $332.64. No payment was sent."}
"""#,
    "checkout-shipping-errors2": #"""
{"step":1,"isLastStep":false,"isComplete":false,"focusTicket":1,"steps":[{"label":"Cart","icon":"cart","hasError":false},{"label":"Shipping","icon":"pin","hasError":true},{"label":"Delivery","icon":"truck","hasError":false},{"label":"Payment","icon":"card","hasError":false}],"errors":{"email":"Enter an email address for order updates.","firstName":"Required","lastName":"Required","address":"Required","city":"Required","state":"Required","postalCode":"Enter a 5-digit ZIP code, with an optional 4-digit suffix."},"items":[{"id":"mug","name":"Speckled Stoneware Mug","variant":"Hand-thrown · 12 oz","src":"placeholder","qty":2,"isLimited":false,"priceEach":"$78.00","lineTotal":"$156.00"},{"id":"plate","name":"Stoneware Dinner Plate","variant":"Reactive glaze · 10 in","src":"placeholder","qty":1,"isLimited":false,"priceEach":"$72.00","lineTotal":"$72.00"},{"id":"bowl","name":"Cereal Bowl","variant":"Speckled clay · 6 in","src":"placeholder","qty":1,"isLimited":true,"priceEach":"$80.00","lineTotal":"$80.00"}],"summary":{"itemCount":"4 items","trigger":"Order summary · $332.64","subtotal":"$308.00","promoLabel":null,"discount":"−$0.00","deliveryLabel":"Standard","shipping":"Free","tax":"$24.64","total":"$332.64","freeShippingTitle":null},"actions":{"blocked":"7 problems above need fixing first.","backLabel":"Back","nextLabel":"Continue"},"promo":{"value":"","status":null},"shipping":{"email":"","firstName":"","lastName":"","country":"us","address":"","apartment":"","city":"","state":"","postalCode":"","countries":[{"value":"us","label":"United States"},{"value":"ca","label":"Canada"},{"value":"uk","label":"United Kingdom"}],"states":["California","Illinois","Massachusetts","New York","Oregon","Texas","Washington"],"hasState":true,"postalLabel":"ZIP code","postalPlaceholder":"10001"},"delivery":{"value":"standard","options":[{"value":"standard","label":"Standard","window":"3–7 business days","price":"Free"},{"value":"expedited","label":"Expedited","window":"1–2 business days","price":"$9.95"},{"value":"overnight","label":"Overnight","window":"Next business day by 5pm","price":"$24.95"}],"isGift":false,"note":"","noteLabel":"Delivery instructions","notePlaceholder":"Leave with the neighbour at number 14.","noteDescription":"Passed to the carrier where they support it."},"payment":{"cardNumber":"","cardName":"","expiry":"","cvc":"","billingMatches":true},"confirmation":"This local example completed an order for $332.64. No payment was sent."}
"""#,
    "checkout-shipping": #"""
{"step":1,"isLastStep":false,"isComplete":false,"focusTicket":0,"steps":[{"label":"Cart","icon":"cart","hasError":false},{"label":"Shipping","icon":"pin","hasError":false},{"label":"Delivery","icon":"truck","hasError":false},{"label":"Payment","icon":"card","hasError":false}],"errors":{},"items":[{"id":"mug","name":"Speckled Stoneware Mug","variant":"Hand-thrown · 12 oz","src":"placeholder","qty":2,"isLimited":false,"priceEach":"$78.00","lineTotal":"$156.00"},{"id":"plate","name":"Stoneware Dinner Plate","variant":"Reactive glaze · 10 in","src":"placeholder","qty":1,"isLimited":false,"priceEach":"$72.00","lineTotal":"$72.00"},{"id":"bowl","name":"Cereal Bowl","variant":"Speckled clay · 6 in","src":"placeholder","qty":1,"isLimited":true,"priceEach":"$80.00","lineTotal":"$80.00"}],"summary":{"itemCount":"4 items","trigger":"Order summary · $332.64","subtotal":"$308.00","promoLabel":null,"discount":"−$0.00","deliveryLabel":"Standard","shipping":"Free","tax":"$24.64","total":"$332.64","freeShippingTitle":null},"actions":{"blocked":null,"backLabel":"Back","nextLabel":"Continue"},"promo":{"value":"","status":null},"shipping":{"email":"ada@example.com","firstName":"Ada","lastName":"Lovelace","country":"us","address":"12 Analytical Way","apartment":"","city":"Portland","state":"Oregon","postalCode":"97201","countries":[{"value":"us","label":"United States"},{"value":"ca","label":"Canada"},{"value":"uk","label":"United Kingdom"}],"states":["California","Illinois","Massachusetts","New York","Oregon","Texas","Washington"],"hasState":true,"postalLabel":"ZIP code","postalPlaceholder":"10001"},"delivery":{"value":"standard","options":[{"value":"standard","label":"Standard","window":"3–7 business days","price":"Free"},{"value":"expedited","label":"Expedited","window":"1–2 business days","price":"$9.95"},{"value":"overnight","label":"Overnight","window":"Next business day by 5pm","price":"$24.95"}],"isGift":false,"note":"","noteLabel":"Delivery instructions","notePlaceholder":"Leave with the neighbour at number 14.","noteDescription":"Passed to the carrier where they support it."},"payment":{"cardNumber":"","cardName":"","expiry":"","cvc":"","billingMatches":true},"confirmation":"This local example completed an order for $332.64. No payment was sent."}
"""#,
    "checkout-delivery-gift": #"""
{"step":2,"isLastStep":false,"isComplete":false,"focusTicket":1,"steps":[{"label":"Cart","icon":"cart","hasError":false},{"label":"Shipping","icon":"pin","hasError":false},{"label":"Delivery","icon":"truck","hasError":false},{"label":"Payment","icon":"card","hasError":false}],"errors":{},"items":[{"id":"mug","name":"Speckled Stoneware Mug","variant":"Hand-thrown · 12 oz","src":"placeholder","qty":2,"isLimited":false,"priceEach":"$78.00","lineTotal":"$156.00"},{"id":"plate","name":"Stoneware Dinner Plate","variant":"Reactive glaze · 10 in","src":"placeholder","qty":1,"isLimited":false,"priceEach":"$72.00","lineTotal":"$72.00"},{"id":"bowl","name":"Cereal Bowl","variant":"Speckled clay · 6 in","src":"placeholder","qty":1,"isLimited":true,"priceEach":"$80.00","lineTotal":"$80.00"}],"summary":{"itemCount":"4 items","trigger":"Order summary · $342.59","subtotal":"$308.00","promoLabel":null,"discount":"−$0.00","deliveryLabel":"Expedited","shipping":"$9.95","tax":"$24.64","total":"$342.59","freeShippingTitle":null},"actions":{"blocked":null,"backLabel":"Back","nextLabel":"Continue"},"promo":{"value":"","status":null},"shipping":{"email":"ada@example.com","firstName":"Ada","lastName":"Lovelace","country":"us","address":"12 Analytical Way","apartment":"","city":"Portland","state":"Oregon","postalCode":"97201","countries":[{"value":"us","label":"United States"},{"value":"ca","label":"Canada"},{"value":"uk","label":"United Kingdom"}],"states":["California","Illinois","Massachusetts","New York","Oregon","Texas","Washington"],"hasState":true,"postalLabel":"ZIP code","postalPlaceholder":"10001"},"delivery":{"value":"expedited","options":[{"value":"standard","label":"Standard","window":"3–7 business days","price":"Free"},{"value":"expedited","label":"Expedited","window":"1–2 business days","price":"$9.95"},{"value":"overnight","label":"Overnight","window":"Next business day by 5pm","price":"$24.95"}],"isGift":true,"note":"Happy birthday!","noteLabel":"Gift message","notePlaceholder":"Happy birthday — hope these get plenty of use.","noteDescription":"Printed on a card. Prices are left off the packing slip."},"payment":{"cardNumber":"","cardName":"","expiry":"","cvc":"","billingMatches":true},"confirmation":"This local example completed an order for $342.59. No payment was sent."}
"""#,
    "checkout-payment-errors": #"""
{"step":3,"isLastStep":true,"isComplete":false,"focusTicket":1,"steps":[{"label":"Cart","icon":"cart","hasError":false},{"label":"Shipping","icon":"pin","hasError":false},{"label":"Delivery","icon":"truck","hasError":false},{"label":"Payment","icon":"card","hasError":true}],"errors":{"cardNumber":"Enter the full card number.","cardName":"Enter the name printed on the card.","expiry":"Use MM/YY.","cvc":"3 or 4 digits."},"items":[{"id":"mug","name":"Speckled Stoneware Mug","variant":"Hand-thrown · 12 oz","src":"placeholder","qty":2,"isLimited":false,"priceEach":"$78.00","lineTotal":"$156.00"},{"id":"plate","name":"Stoneware Dinner Plate","variant":"Reactive glaze · 10 in","src":"placeholder","qty":1,"isLimited":false,"priceEach":"$72.00","lineTotal":"$72.00"},{"id":"bowl","name":"Cereal Bowl","variant":"Speckled clay · 6 in","src":"placeholder","qty":1,"isLimited":true,"priceEach":"$80.00","lineTotal":"$80.00"}],"summary":{"itemCount":"4 items","trigger":"Order summary · $332.64","subtotal":"$308.00","promoLabel":null,"discount":"−$0.00","deliveryLabel":"Standard","shipping":"Free","tax":"$24.64","total":"$332.64","freeShippingTitle":null},"actions":{"blocked":"4 problems above need fixing first.","backLabel":"Back","nextLabel":"Pay $332.64"},"promo":{"value":"","status":null},"shipping":{"email":"ada@example.com","firstName":"Ada","lastName":"Lovelace","country":"us","address":"12 Analytical Way","apartment":"","city":"Portland","state":"Oregon","postalCode":"97201","countries":[{"value":"us","label":"United States"},{"value":"ca","label":"Canada"},{"value":"uk","label":"United Kingdom"}],"states":["California","Illinois","Massachusetts","New York","Oregon","Texas","Washington"],"hasState":true,"postalLabel":"ZIP code","postalPlaceholder":"10001"},"delivery":{"value":"standard","options":[{"value":"standard","label":"Standard","window":"3–7 business days","price":"Free"},{"value":"expedited","label":"Expedited","window":"1–2 business days","price":"$9.95"},{"value":"overnight","label":"Overnight","window":"Next business day by 5pm","price":"$24.95"}],"isGift":false,"note":"","noteLabel":"Delivery instructions","notePlaceholder":"Leave with the neighbour at number 14.","noteDescription":"Passed to the carrier where they support it."},"payment":{"cardNumber":"4242 42","cardName":"","expiry":"","cvc":"","billingMatches":false},"confirmation":"This local example completed an order for $332.64. No payment was sent."}
"""#,
    "checkout-complete": #"""
{"step":3,"isLastStep":true,"isComplete":true,"focusTicket":0,"steps":[{"label":"Cart","icon":"cart","hasError":false},{"label":"Shipping","icon":"pin","hasError":false},{"label":"Delivery","icon":"truck","hasError":false},{"label":"Payment","icon":"card","hasError":false}],"errors":{},"items":[{"id":"mug","name":"Speckled Stoneware Mug","variant":"Hand-thrown · 12 oz","src":"placeholder","qty":2,"isLimited":false,"priceEach":"$78.00","lineTotal":"$156.00"},{"id":"plate","name":"Stoneware Dinner Plate","variant":"Reactive glaze · 10 in","src":"placeholder","qty":1,"isLimited":false,"priceEach":"$72.00","lineTotal":"$72.00"},{"id":"bowl","name":"Cereal Bowl","variant":"Speckled clay · 6 in","src":"placeholder","qty":1,"isLimited":true,"priceEach":"$80.00","lineTotal":"$80.00"}],"summary":{"itemCount":"4 items","trigger":"Order summary · $332.64","subtotal":"$308.00","promoLabel":null,"discount":"−$0.00","deliveryLabel":"Standard","shipping":"Free","tax":"$24.64","total":"$332.64","freeShippingTitle":null},"actions":{"blocked":null,"backLabel":"Back","nextLabel":"Pay $332.64"},"promo":{"value":"","status":null},"shipping":{"email":"ada@example.com","firstName":"Ada","lastName":"Lovelace","country":"us","address":"12 Analytical Way","apartment":"","city":"Portland","state":"Oregon","postalCode":"97201","countries":[{"value":"us","label":"United States"},{"value":"ca","label":"Canada"},{"value":"uk","label":"United Kingdom"}],"states":["California","Illinois","Massachusetts","New York","Oregon","Texas","Washington"],"hasState":true,"postalLabel":"ZIP code","postalPlaceholder":"10001"},"delivery":{"value":"standard","options":[{"value":"standard","label":"Standard","window":"3–7 business days","price":"Free"},{"value":"expedited","label":"Expedited","window":"1–2 business days","price":"$9.95"},{"value":"overnight","label":"Overnight","window":"Next business day by 5pm","price":"$24.95"}],"isGift":false,"note":"","noteLabel":"Delivery instructions","notePlaceholder":"Leave with the neighbour at number 14.","noteDescription":"Passed to the carrier where they support it."},"payment":{"cardNumber":"4242 4242 4242 4242","cardName":"Ada L","expiry":"12/29","cvc":"123","billingMatches":true},"confirmation":"This local example completed an order for $332.64. No payment was sent."}
"""#,
    "checkout-empty": #"""
{"step":0,"isLastStep":false,"isComplete":false,"focusTicket":1,"steps":[{"label":"Cart","icon":"cart","hasError":true},{"label":"Shipping","icon":"pin","hasError":false},{"label":"Delivery","icon":"truck","hasError":false},{"label":"Payment","icon":"card","hasError":false}],"errors":{"items":"Your cart is empty."},"items":[],"summary":{"itemCount":"0 items","trigger":"Order summary · $4.95","subtotal":"$0.00","promoLabel":null,"discount":"−$0.00","deliveryLabel":"Standard","shipping":"$4.95","tax":"$0.00","total":"$4.95","freeShippingTitle":"$300.00 away from free standard shipping"},"actions":{"blocked":"One problem above needs fixing first.","backLabel":"Continue shopping","nextLabel":"Continue"},"promo":{"value":"","status":null},"shipping":{"email":"","firstName":"","lastName":"","country":"us","address":"","apartment":"","city":"","state":"","postalCode":"","countries":[{"value":"us","label":"United States"},{"value":"ca","label":"Canada"},{"value":"uk","label":"United Kingdom"}],"states":["California","Illinois","Massachusetts","New York","Oregon","Texas","Washington"],"hasState":true,"postalLabel":"ZIP code","postalPlaceholder":"10001"},"delivery":{"value":"standard","options":[{"value":"standard","label":"Standard","window":"3–7 business days","price":"$4.95"},{"value":"expedited","label":"Expedited","window":"1–2 business days","price":"$9.95"},{"value":"overnight","label":"Overnight","window":"Next business day by 5pm","price":"$24.95"}],"isGift":false,"note":"","noteLabel":"Delivery instructions","notePlaceholder":"Leave with the neighbour at number 14.","noteDescription":"Passed to the carrier where they support it."},"payment":{"cardNumber":"","cardName":"","expiry":"","cvc":"","billingMatches":true},"confirmation":"This local example completed an order for $4.95. No payment was sent."}
"""#,
    "order-panel-hidden": #"""
{"tab":"timeline","sidePanel":false,"panelDialog":false,"number":"#1001","itemCount":5,"customerName":"Jane Doe","status":"Unfulfilled","date":"02/23/2026","flag":"Needs attention","products":[{"name":"Solstice Mug","image":"placeholder","lines":["Glaze: Snow","Finish: Matte"],"amount":"$89.00","unit":["$89.00"," ","×"," ",1]},{"name":"Ember Bowl","image":"placeholder","lines":["Glaze: Sage","Size: 6 in"],"amount":"$84.00","unit":["$42.00"," ","×"," ",2]},{"name":"Terra Cup","image":"placeholder","lines":["Glaze: Oat","Size: 14 in"],"amount":"$65.00","unit":["$65.00"," ","×"," ",1]},{"name":"Dawn Plate Set","image":"placeholder","lines":["Glaze: Charcoal","Capacity: 3 oz"],"amount":"$102.00","unit":["$34.00"," ","×"," ",3]},{"name":"Kiln Salad Bowl","image":"placeholder","lines":["Glaze: Snow","Height: 8 in"],"amount":"$78.00","unit":["$78.00"," ","×"," ",1]}],"summary":[{"label":"Subtotal","note":[5," items"],"amount":"$418.00","strong":false},{"label":"Discount","note":["New customer code: NEW15"],"amount":"– $15.00","strong":false},{"label":"Shipping","note":["Free shipping (0.0lbs) USPS"],"amount":"$0.00","strong":false},{"label":"Tax","note":["Sales tax (8.25%)"],"amount":"$33.25","strong":false},{"label":"Total","note":null,"amount":"$436.25","strong":true}],"paidBy":{"label":"Paid by customer","note":"Visa ...7482","amount":"$436.25"},"activity":[{"user":"Jane Doe","text":"placed order #1001","changes":null,"reactions":2,"time":"Feb 23 at 9:12 AM"},{"user":"Alex Rivera","text":"Customer requested gift wrapping for the mug & plate set. I've added a note to the packing slip — warehouse team should wrap in recycled kraft paper.","changes":null,"reactions":3,"time":"Feb 23 at 10:45 AM"},{"user":"System","text":"has several information changes","changes":["Payment verified via Visa ...7482","Fraud check passed — low risk"],"reactions":null,"time":"Feb 23 at 11:30 AM"},{"user":"Alex Rivera","text":"marked order as ready for fulfillment","changes":null,"reactions":1,"time":"Feb 23 at 2:15 PM"}],"notes":"Customer is a repeat buyer — 3rd order this quarter. Prefers snow and oat glazes. Requested gift wrapping for the mug set. Ships to a residential address in CA.","customer":[{"label":"Name","value":"Jane Doe"},{"label":"Address","value":"321 Smith Road, CA 38238"},{"label":"Phone","value":"234-"},{"label":"Email","value":"janedoe@email.com"},{"label":"Billing Address","value":"Same as shipping address"}],"fraud":{"risk":15,"recommendation":"Recommendation: Fulfill order","detail":"There is a low chance that you will receive a chargeback on this order."}}
"""#,
    "order-dialog": #"""
{"tab":"customer","sidePanel":true,"panelDialog":true,"number":"#1001","itemCount":5,"customerName":"Jane Doe","status":"Unfulfilled","date":"02/23/2026","flag":"Needs attention","products":[{"name":"Solstice Mug","image":"placeholder","lines":["Glaze: Snow","Finish: Matte"],"amount":"$89.00","unit":["$89.00"," ","×"," ",1]},{"name":"Ember Bowl","image":"placeholder","lines":["Glaze: Sage","Size: 6 in"],"amount":"$84.00","unit":["$42.00"," ","×"," ",2]},{"name":"Terra Cup","image":"placeholder","lines":["Glaze: Oat","Size: 14 in"],"amount":"$65.00","unit":["$65.00"," ","×"," ",1]},{"name":"Dawn Plate Set","image":"placeholder","lines":["Glaze: Charcoal","Capacity: 3 oz"],"amount":"$102.00","unit":["$34.00"," ","×"," ",3]},{"name":"Kiln Salad Bowl","image":"placeholder","lines":["Glaze: Snow","Height: 8 in"],"amount":"$78.00","unit":["$78.00"," ","×"," ",1]}],"summary":[{"label":"Subtotal","note":[5," items"],"amount":"$418.00","strong":false},{"label":"Discount","note":["New customer code: NEW15"],"amount":"– $15.00","strong":false},{"label":"Shipping","note":["Free shipping (0.0lbs) USPS"],"amount":"$0.00","strong":false},{"label":"Tax","note":["Sales tax (8.25%)"],"amount":"$33.25","strong":false},{"label":"Total","note":null,"amount":"$436.25","strong":true}],"paidBy":{"label":"Paid by customer","note":"Visa ...7482","amount":"$436.25"},"activity":[{"user":"Jane Doe","text":"placed order #1001","changes":null,"reactions":2,"time":"Feb 23 at 9:12 AM"},{"user":"Alex Rivera","text":"Customer requested gift wrapping for the mug & plate set. I've added a note to the packing slip — warehouse team should wrap in recycled kraft paper.","changes":null,"reactions":3,"time":"Feb 23 at 10:45 AM"},{"user":"System","text":"has several information changes","changes":["Payment verified via Visa ...7482","Fraud check passed — low risk"],"reactions":null,"time":"Feb 23 at 11:30 AM"},{"user":"Alex Rivera","text":"marked order as ready for fulfillment","changes":null,"reactions":1,"time":"Feb 23 at 2:15 PM"}],"notes":"Customer is a repeat buyer — 3rd order this quarter. Prefers snow and oat glazes. Requested gift wrapping for the mug set. Ships to a residential address in CA.","customer":[{"label":"Name","value":"Jane Doe"},{"label":"Address","value":"321 Smith Road, CA 38238"},{"label":"Phone","value":"234-"},{"label":"Email","value":"janedoe@email.com"},{"label":"Billing Address","value":"Same as shipping address"}],"fraud":{"risk":15,"recommendation":"Recommendation: Fulfill order","detail":"There is a low chance that you will receive a chargeback on this order."}}
"""#,
    "settings-search": #"""
{"navItems":[{"label":"Profile","isSelected":false},{"label":"Account","isSelected":true},{"label":"Members","isSelected":false},{"label":"Billing","isSelected":false},{"label":"Invoices","isSelected":false},{"label":"API","isSelected":false}],"searchItems":[{"id":"1","label":"Username"},{"id":"2","label":"First name"},{"id":"3","label":"Last name"},{"id":"4","label":"Email address"},{"id":"5","label":"Change password"},{"id":"6","label":"Data Export Access"},{"id":"7","label":"Allow Admin to Add Members"},{"id":"8","label":"Two-Factor Authentication"}],"search":{"id":"5","label":"Change password"},"username":"nicol43","firstName":"Stephanie","lastName":"Nicol","email":"stephanie_nicol@mail.com","currentPw":"password123","newPw":"password123","confirmPw":"password123","dataExport":false,"adminMembers":false,"twoFactor":true}
"""#,
]
