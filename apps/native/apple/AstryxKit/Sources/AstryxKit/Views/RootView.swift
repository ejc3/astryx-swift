import SwiftUI

/// The whole app: a sidebar of the core's `nav`, the current screen, the toast and the dialog.
/// On a phone the split view collapses to a navigation stack.
///
/// With `web` and `stock` views (owned by the host), the toolbar also offers the core's
/// `surface` choice: the SwiftUI drawing, either web drawing, Astryx as it is today, or
/// several side by side when the window is large enough.
public struct RootView: View {
    @ObservedObject private var model: AppModel
    private let web: AnyView?
    private let webOwn: AnyView?
    private let stock: AnyView?
    @Environment(\.colorScheme) private var scheme
    @Environment(\.dynamicTypeSize) private var typeSize
    @Environment(\.scenePhase) private var scenePhase

    /// The SwiftUI drawing only.
    public init(model: AppModel) {
        self.model = model
        self.web = nil
        self.webOwn = nil
        self.stock = nil
    }

    /// The SwiftUI drawing, with the host's views of the other drawings: the web page on the
    /// shared core, the web page on a core of its own, and Astryx as it is today.
    public init(model: AppModel, web: AnyView, webOwn: AnyView, stock: AnyView) {
        self.model = model
        self.web = web
        self.webOwn = webOwn
        self.stock = stock
    }

    public var body: some View {
        Group {
            if let app = model.app {
                if let web, let webOwn, let stock {
                    GeometryReader { geo in
                        SurfaceRoot(app: app, size: geo.size, drawings: Drawings(web: web, webOwn: webOwn, stock: stock))
                    }
                } else {
                    AppShell(app: app, mode: .native, picker: nil, drawings: nil)
                }
            } else {
                ProgressView()
            }
        }
        .axTheme(model.theme, scheme: scheme, typeSize: typeSize)
        .environment(\.axSend, AXSender { [model] action in model.perform(action) })
        .alert(
            model.app?.dialog?.title ?? "",
            isPresented: Binding(get: { model.app?.dialog != nil }, set: { _ in }),
            presenting: model.app?.dialog
        ) { dialog in
            Button(dialog.confirm.label, role: dialog.confirm.variant == .destructive ? .destructive : nil) {
                model.perform(.press(id: dialog.confirm.id))
            }
            Button(dialog.cancel.label, role: .cancel) {
                model.perform(.press(id: dialog.cancel.id))
            }
        } message: { dialog in
            Text(dialog.text)
        }
        .onChange(of: scenePhase, initial: true) { _, phase in
            if phase == .active { model.startTicking() } else { model.stopTicking() }
        }
    }
}

// MARK: Surfaces

/// Which drawing, or drawings, of the screens are on display.
enum SurfaceMode: String {
    case native, web, webOwn, stock, compare, all

    /// Windows at least this wide (points) can show native and web side by side.
    static let compareFrom: CGFloat = 1100
    /// Windows at least this big can show all four drawings as a grid.
    static let allFrom = CGSize(width: 1400, height: 800)

    init(_ value: String?) { self = SurfaceMode(rawValue: value ?? "") ?? .native }

    func fits(_ size: CGSize) -> Bool {
        switch self {
        case .compare: size.width >= SurfaceMode.compareFrom
        case .all: size.width >= SurfaceMode.allFrom.width && size.height >= SurfaceMode.allFrom.height
        default: true
        }
    }

    /// Whether the SwiftUI drawing is on display (alone, or beside the web ones).
    var drawsNative: Bool { self == .native || self == .compare || self == .all }

    /// A side-by-side choice in a window too small for it draws as the SwiftUI drawing.
    func effective(_ size: CGSize) -> SurfaceMode { fits(size) ? self : .native }
}

/// The surface choice as a menu in the toolbar: a short label that fits any width (on a phone
/// only the icon), the options in the core's two groups (which drawing; how many at once).
/// Choosing sends `set` with the snapshot's `surface.id`. A side-by-side choice the window is
/// too small for is dimmed, with the core's reason under it, rather than left out.
struct SurfacePicker: View {
    let surface: AppSnapshot.SurfaceChoice
    let size: CGSize
    @Environment(\.axSend) private var send
    @Environment(\.axStatic) private var isStatic
    @Environment(\.horizontalSizeClass) private var sizeClass

    private var selection: String {
        SurfaceMode(surface.value).effective(size).rawValue
    }
    private var current: Option? {
        surface.options.first { $0.value == selection }
    }
    /// The options in the core's groups; one group without a title when the core gave none.
    private var sections: [(title: String?, options: [Option])] {
        guard let groups = surface.groups, !groups.isEmpty else { return [(nil, surface.options)] }
        return groups.map { group in
            (group.label, group.values.compactMap { value in surface.options.first { $0.value == value } })
        }
    }

    var body: some View {
        if isStatic {
            StaticSegmented(options: surface.options.filter { SurfaceMode($0.value).fits(size) }, value: selection)
        } else {
            let menu = Menu {
                ForEach(Array(sections.enumerated()), id: \.offset) { _, section in
                    Section {
                        ForEach(section.options, id: \.value) { row($0) }
                    } header: {
                        if let title = section.title { Text(title) }
                    }
                }
            } label: {
                Label(current?.label ?? surface.label, systemImage: "rectangle.on.rectangle")
            }
            .help(surface.label)
            .accessibilityLabel(surface.label)
            .accessibilityValue(current?.label ?? "")
            if sizeClass == .compact {
                menu.labelStyle(.iconOnly)
            } else {
                menu.labelStyle(.titleAndIcon)
            }
        }
    }

    private func row(_ option: Option) -> some View {
        let fits = SurfaceMode(option.value).fits(size)
        let chosen = option.value == selection
        let note = fits ? option.description : surface.unavailable
        return Button {
            send(.set(id: surface.id, value: .string(option.value)))
        } label: {
            if chosen { Label(option.label, systemImage: "checkmark") } else { Text(option.label) }
            if let note { Text(note) }
        }
        .disabled(!fits)
        .accessibilityAddTraits(chosen ? .isSelected : [])
    }
}

/// The views of the other drawings, given by the host.
struct Drawings {
    let web: AnyView
    let webOwn: AnyView
    let stock: AnyView
}

/// Chooses the layout for the surface and gives it the picker in its toolbar. Every drawing
/// sits in the same split view, so the sidebar and the navigation position stay when the
/// drawing changes.
private struct SurfaceRoot: View {
    let app: AppSnapshot
    let size: CGSize
    let drawings: Drawings

    var body: some View {
        if let surface = app.surface {
            AppShell(
                app: app,
                mode: SurfaceMode(surface.value).effective(size),
                picker: AnyView(SurfacePicker(surface: surface, size: size)),
                drawings: drawings
            )
        } else {
            AppShell(app: app, mode: .native, picker: nil, drawings: nil)
        }
    }
}

/// The non-native layouts: one drawing filling the window, or several side by side (two
/// columns, or a 2 by 2 grid), each under a caption of its option's label and description.
struct SurfaceLayout: View {
    let app: AppSnapshot
    let mode: SurfaceMode
    let web: AnyView
    let webOwn: AnyView
    let stock: AnyView
    /// The SwiftUI drawing brings a sidebar of its own (for rendering without a split view).
    /// In the app the split view's sidebar is the only one.
    var ownSidebar: Bool = true
    @Environment(\.ax) private var ax
    @Environment(\.horizontalSizeClass) private var sizeClass

    var body: some View {
        switch mode {
        case .native: cell(.native)
        case .web, .webOwn, .stock: cell(mode)
        case .compare:
            HStack(spacing: 0) {
                cell(.native)
                divider(vertical: true)
                cell(.web)
            }
        case .all:
            VStack(spacing: 0) {
                HStack(spacing: 0) {
                    cell(.native)
                    divider(vertical: true)
                    cell(.web)
                }
                divider(vertical: false)
                HStack(spacing: 0) {
                    cell(.webOwn)
                    divider(vertical: true)
                    cell(.stock)
                }
            }
        }
    }

    private func divider(vertical: Bool) -> some View {
        Rectangle().fill(ax.borderStrong)
            .frame(width: vertical ? 1 : nil, height: vertical ? nil : 1)
    }

    /// One drawing under its caption.
    private func cell(_ drawing: SurfaceMode) -> some View {
        // One drawing alone on a phone gives its caption's line to the page; the picker
        // says the same in its menu.
        let showsCaption = !(sizeClass == .compact && (mode == .web || mode == .webOwn || mode == .stock))
        return VStack(spacing: 0) {
            if showsCaption { caption(drawing) }
            // The drawing is an overlay of an empty box, so its own ideal size cannot stretch
            // the cell; the cell is what the layout gives it.
            Color.clear
                .frame(maxWidth: .infinity, maxHeight: .infinity)
                .modifier(WebExtendsUnderBars(extends: !showsCaption))
                .overlay(alignment: .topLeading) {
                    switch drawing {
                    case .web: web
                    case .webOwn: webOwn
                    case .stock: stock
                    default: NativeColumn(app: app, ownSidebar: ownSidebar)
                    }
                }
                .clipped()
        }
        .frame(maxWidth: .infinity, maxHeight: .infinity)
        .accessibilityElement(children: .contain)
        .accessibilityLabel(app.surface?.options.first { $0.value == drawing.rawValue }?.label ?? "")
    }

    private func caption(_ drawing: SurfaceMode) -> some View {
        let option = app.surface?.options.first { $0.value == drawing.rawValue }
        return HStack(spacing: ax.space(2)) {
            Text(option?.label ?? "")
                .font(ax.font("font-size-sm", 12, weight: "font-weight-semibold"))
                .foregroundStyle(ax.text)
            if let description = drawing == .stock ? (app.surface?.stockLabel ?? option?.description) : option?.description {
                Text(description)
                    .font(ax.fontSmall)
                    .foregroundStyle(ax.textSecondary)
                    .lineLimit(1)
            }
            Spacer(minLength: 0)
        }
        .padding(.horizontal, ax.space(3))
        .padding(.vertical, ax.space(1))
        .frame(maxWidth: .infinity, alignment: .leading)
        .background(ax.surface)
        .overlay(alignment: .bottom) { Rectangle().fill(ax.border).frame(height: 1) }
        .accessibilityElement(children: .combine)
    }
}

/// A web drawing alone on a phone runs to the display's edges, under the navigation bar and the
/// home indicator, as the SwiftUI drawing's scroll view does (HIG Layout: content extends to the
/// edges, bars float over it). The page insets itself by `env(safe-area-inset-*)` (it sets
/// `viewport-fit=cover`) and scrolls under the bars.
private struct WebExtendsUnderBars: ViewModifier {
    let extends: Bool

    func body(content: Content) -> some View {
        #if os(iOS)
        if extends {
            content.ignoresSafeArea(.container, edges: [.top, .bottom])
        } else {
            content
        }
        #else
        content
        #endif
    }
}

/// The SwiftUI drawing as one column of a side-by-side layout: the screen, and with
/// `ownSidebar` a narrow sidebar before it (for rendering without a split view).
struct NativeColumn: View {
    let app: AppSnapshot
    var ownSidebar: Bool = true
    @Environment(\.axSend) private var send
    @Environment(\.axStatic) private var isStatic

    var body: some View {
        HStack(spacing: 0) {
            if ownSidebar {
                Group {
                    if isStatic {
                        StaticSidebar(app: app)
                    } else {
                        SidebarView(app: app, selection: Binding(
                            get: { app.current },
                            set: { if $0 != app.current { send(.navigate(screen: $0)) } }
                        ))
                    }
                }
                .frame(width: 190)
            }
            ScreenView(app: app, inlineToolbar: ownSidebar, scrolls: !isStatic, largeTitle: false)
        }
        .frame(maxWidth: .infinity, maxHeight: .infinity)
    }
}

/// The split view proper, below the theme and the sender: the sidebar of the core's `nav`
/// and, for whichever drawing is on display, the detail. Its toolbar offers the scenarios and
/// the surface choice when the host gave web views.
private struct AppShell: View {
    let app: AppSnapshot
    let mode: SurfaceMode
    /// The surface picker, when the host gave web views.
    let picker: AnyView?
    let drawings: Drawings?
    @Environment(\.ax) private var ax
    @Environment(\.axSend) private var send

    var body: some View {
        NavigationSplitView {
            SidebarView(app: app, selection: Binding(
                get: { app.current },
                set: { if $0 != app.current { send(.navigate(screen: $0)) } }
            ))
            #if os(macOS)
            .navigationSplitViewColumnWidth(min: 200, ideal: 240, max: 320)
            #endif
        } detail: {
            SurfaceDetail(app: app, mode: mode, drawings: drawings)
                .safeAreaInset(edge: .bottom, spacing: 0) {
                    BottomStack(app: app, showsToast: mode.drawsNative, showsScenarios: drawings != nil)
                }
                .toolbar {
                    if picker != nil, let scenarios = app.scenarios {
                        ToolbarItem(placement: .primaryAction) { ScenarioMenu(scenarios: scenarios) }
                    }
                    if let picker {
                        ToolbarItem(placement: .primaryAction) { picker }
                    }
                }
        }
        .tint(ax.accent)
    }
}

/// The detail column: the SwiftUI screen, one web drawing, or several side by side.
private struct SurfaceDetail: View {
    let app: AppSnapshot
    let mode: SurfaceMode
    let drawings: Drawings?

    var body: some View {
        if let drawings, mode != .native {
            let layout = SurfaceLayout(app: app, mode: mode, web: drawings.web, webOwn: drawings.webOwn, stock: drawings.stock, ownSidebar: false)
            if mode.drawsNative {
                // The SwiftUI column sets the title and the toolbar.
                layout
            } else {
                layout.modifier(ScreenTitle(screen: app.screen, large: false))
            }
        } else {
            ScreenView(app: app, inlineToolbar: false)
        }
    }
}

/// What sits above the content's bottom edge, in one stack so nothing covers anything: the
/// toast, then the scenario bar. It is a safe-area inset, so the page scrolls clear of it.
private struct BottomStack: View {
    let app: AppSnapshot
    let showsToast: Bool
    let showsScenarios: Bool
    @Environment(\.accessibilityReduceMotion) private var reduceMotion

    var body: some View {
        let toast = showsToast ? app.toast : nil
        let playing = showsScenarios ? app.scenarios?.playing : nil
        let appear: AnyTransition = reduceMotion ? .opacity : .move(edge: .bottom).combined(with: .opacity)
        VStack(spacing: 8) {
            if let toast {
                ToastView(toast: toast)
                    .id(toast.id)
                    .transition(appear)
            }
            if let playing {
                ScenarioBar(playing: playing)
                    .transition(appear)
            }
        }
        .padding(.horizontal, 16)
        .padding(.bottom, toast != nil || playing != nil ? 8 : 0)
        .animation(reduceMotion ? .easeInOut(duration: 0.15) : .snappy, value: toast?.id)
        .animation(reduceMotion ? .easeInOut(duration: 0.15) : .snappy, value: playing != nil)
    }
}

/// One nav entry: icon, label and the core's badge.
private struct SidebarRow: View {
    let item: NavItem
    let selected: Bool
    @Environment(\.ax) private var ax
    /// Increased on the selected row of a focused sidebar, which the system fills with the accent
    /// color: there the row's content goes to the system's on-accent style, as in Finder and Mail.
    @Environment(\.backgroundProminence) private var prominence

    private var onAccent: Bool { prominence == .increased }

    var body: some View {
        HStack(spacing: ax.space(3)) {
            Image(systemName: item.icon.symbol)
                .frame(width: ax.fontSize("font-size-lg", 17) * 1.3)
                .foregroundStyle(onAccent ? AnyShapeStyle(.primary) : AnyShapeStyle(selected ? ax.accent : ax.iconSecondary))
            Text(item.label)
                .font(ax.fontLabel)
                .foregroundStyle(onAccent ? AnyShapeStyle(.primary) : AnyShapeStyle(ax.text))
            Spacer(minLength: ax.space(2))
            if let badge = item.badge {
                Text(badge)
                    .font(ax.font("font-size-xs", 10, weight: "font-weight-semibold"))
                    .foregroundStyle(onAccent ? AnyShapeStyle(.primary) : AnyShapeStyle(ax.tone(.accent).text))
                    .padding(.horizontal, ax.space(2))
                    .padding(.vertical, ax.hair)
                    .background(Capsule().fill(onAccent ? AnyShapeStyle(.quaternary) : AnyShapeStyle(ax.accentMuted)))
            }
        }
        .accessibilityElement(children: .combine)
        .accessibilityLabel(item.accessibilityLabel ?? item.label)
        .accessibilityValue(Text(item.badge ?? ""))
    }
}

/// The nav list: icon, label and the core's badge for each screen.
struct SidebarView: View {
    let app: AppSnapshot
    @Binding var selection: String
    @Environment(\.ax) private var ax

    var body: some View {
        List(selection: Binding<String?>(get: { selection }, set: { if let v = $0 { selection = v } })) {
            ForEach(app.navSections, id: \.title) { group in
                Section(group.title) {
                    ForEach(group.items) { item in
                        SidebarRow(item: item, selected: item.id == selection).tag(item.id)
                    }
                }
            }
        }
        .listStyle(.sidebar)
        .modifier(SidebarBackground())
        .safeAreaInset(edge: .bottom, spacing: 0) {
            // Signing in to sync, when this app can (the core says so).
            if let account = app.account, account.available {
                // Over the list's last rows when it scrolls: the system's bar material, as a toolbar has.
                AccountFooter(account: account)
                    .background(.bar)
            }
        }
        .navigationTitle(app.appName)
    }
}

/// Before the glass design the sidebar is painted with the theme's surface; with it the system's
/// own sidebar (glass, floating above the content) is left alone.
private struct SidebarBackground: ViewModifier {
    @Environment(\.ax) private var ax

    func body(content: Content) -> some View {
        if #available(iOS 26, macOS 26, *) {
            content
        } else {
            content.scrollContentBackground(.hidden).background(ax.surface)
        }
    }
}

/// The same rows without a List, for rendering a window to an image (a List draws nothing
/// without a window).
struct StaticSidebar: View {
    let app: AppSnapshot
    @Environment(\.ax) private var ax

    var body: some View {
        VStack(alignment: .leading, spacing: ax.space(1)) {
            Text(app.appName)
                .font(ax.fontStrong)
                .foregroundStyle(ax.text)
                .padding(.horizontal, ax.space(3))
                .padding(.bottom, ax.space(3))
            ForEach(app.navSections, id: \.title) { group in
                Text(group.title)
                    .font(ax.font("font-size-sm", 12, weight: "font-weight-semibold"))
                    .foregroundStyle(ax.textSecondary)
                    .padding(.horizontal, ax.space(3))
                    .padding(.top, ax.space(3))
                ForEach(group.items) { item in
                    SidebarRow(item: item, selected: item.id == app.current)
                        .padding(.horizontal, ax.space(3))
                        .padding(.vertical, ax.space(2))
                        .background(RoundedRectangle(cornerRadius: ax.radiusElement, style: .continuous).fill(item.id == app.current ? ax.accentMuted : .clear))
                }
            }
            Spacer(minLength: 0)
        }
        .padding(ax.space(3))
        .frame(maxHeight: .infinity, alignment: .top)
        .background(ax.surface)
    }
}

/// The title and subtitle of a screen, in the window's or the navigation bar's own title
/// (the subtitle where the system has one: iOS and macOS 26 and the Mac before). `large` asks
/// for the large title that collapses as the page scrolls.
struct ScreenTitle: ViewModifier {
    let screen: Screen
    var large: Bool = false
    /// The page draws the title and subtitle itself (at accessibility sizes, where the
    /// navigation bar's subtitle cannot wrap), so the bar keeps no title of its own.
    var pageDrawsTitle: Bool = false

    func body(content: Content) -> some View {
        #if os(macOS)
        content
            .navigationTitle(screen.title)
            .navigationSubtitle(screen.subtitle)
        #else
        if #available(iOS 26, *) {
            if pageDrawsTitle {
                content
                    .navigationTitle(screen.title)
                    .toolbarTitleDisplayMode(.inline)
                    .toolbar(removing: .title)
            } else {
                content
                    .navigationTitle(screen.title)
                    .navigationSubtitle(screen.subtitle)
                    .toolbarTitleDisplayMode(large ? .large : .inline)
            }
        } else {
            content
                .navigationTitle(screen.title)
                .navigationBarTitleDisplayMode(.inline)
        }
        #endif
    }
}

/// The current screen: its toolbar and body, under the title in the navigation bar (the page
/// draws its own heading only where the system title is not enough: before the glass design,
/// and when rendering without a window). The toast is not here but in the bottom stack.
/// `inlineToolbar` draws the toolbar buttons in the header instead of the window toolbar,
/// for rendering without a window.
struct ScreenView: View {
    let app: AppSnapshot
    var inlineToolbar: Bool
    var scrolls: Bool = true
    /// The width to lay out in, when known (rendering without a window); else it is measured.
    var fixedWidth: CGFloat? = nil
    /// Ask for the large title (the screen is the detail's own scroll view).
    var largeTitle: Bool = true
    @Environment(\.ax) private var ax
    @Environment(\.axSend) private var send
    @Environment(\.dynamicTypeSize) private var typeSize
    @Environment(\.horizontalSizeClass) private var sizeClass

    /// On a phone the bar has room for short words; an action with a long one goes in a menu at
    /// the bar's trailing end, with its words and glyph (an icon alone does not say it).
    private var overflowButtons: [ButtonNode] {
        #if os(iOS)
        guard sizeClass == .compact else { return [] }
        return app.screen.toolbar.filter { ToolbarButton.isLong($0) }
        #else
        return []
        #endif
    }
    private var barButtons: [ButtonNode] {
        let overflow = Set(overflowButtons.map(\.id))
        return app.screen.toolbar.filter { !overflow.contains($0.id) }
    }

    /// Whether the navigation bar carries the title: it does wherever there is a bar (not in a
    /// picture with no window), unless the page draws it itself at accessibility sizes, where the
    /// bar's subtitle cannot wrap.
    private var barShowsTitle: Bool {
        if inlineToolbar { return false }
        #if os(iOS)
        if #available(iOS 26, *), typeSize.isAccessibilitySize { return false }
        #endif
        return true
    }

    /// Whether the bar's subtitle carries the subtitle too (iOS and macOS 26, and the Mac before).
    private var barShowsSubtitle: Bool {
        guard barShowsTitle else { return false }
        #if os(macOS)
        return true
        #else
        if #available(iOS 26, *) { return !typeSize.isAccessibilitySize }
        return false
        #endif
    }

    /// The page draws a heading only for what the bar does not say: a page header that repeats
    /// the navigation title is left out (the title in the bar is the heading), and the subtitle
    /// is drawn where the bar has none (before the glass design on a phone) or cannot wrap it.
    private var showsHeader: Bool { !barShowsTitle || !barShowsSubtitle }
    private var headerShowsTitle: Bool { !barShowsTitle }

    var body: some View {
        Group {
            if let fixedWidth {
                page(width: fixedWidth, height: 800)
            } else {
                GeometryReader { geo in page(width: geo.size.width, height: geo.size.height) }
            }
        }
        // The page is the surface, white in the light themes, as the web's content area is: the
        // translucent tokens (bubbles, columns, chips) then come out as they do there.
        .background(ax.surface)
        // "How it works": the selected box's panel, as the screen's inspector.
        .modifier(DiagramInspector(screenBody: app.screen.body))
        // A screen that scrolls inside itself (the AI chat) has no scroll view for a large title to
        // collapse with: its title is the inline one.
        .modifier(ScreenTitle(screen: app.screen, large: largeTitle && scrolls && !bodyScrollsItself, pageDrawsTitle: !inlineToolbar && typeSize.isAccessibilitySize))
        .toolbar {
            if !inlineToolbar {
                ToolbarItemGroup(placement: .primaryAction) {
                    ForEach(barButtons, id: \.id) { button in
                        ToolbarButton(node: button)
                    }
                    if !overflowButtons.isEmpty {
                        ToolbarOverflowMenu(nodes: overflowButtons)
                    }
                }
            }
        }
    }

    /// A refactored template draws its own page, with its own padding (each Astryx template sets
    /// its own); the other screens get the page's 24 pt, 16 on a phone.
    private var bodyIsTemplate: Bool {
        if case .template = app.screen.body { return true }
        return false
    }

    /// A template that scrolls inside itself (the AI chat: its conversation scrolls above a pinned
    /// composer, as the web's ChatLayout does) is given the window's height and no outer scroll.
    private var bodyScrollsItself: Bool {
        // The chat (a conversation above a pinned composer), the inbox (one list under its masthead)
        // and the kanban board (columns under a pinned toolbar) size themselves to the window.
        if case .template(let node) = app.screen.body { return ["chat", "inbox", "kanban"].contains(node.template) }
        return false
    }

    @ViewBuilder
    private func page(width: CGFloat, height: CGFloat) -> some View {
        let gutter = width < 600 ? ax.space(4) : ax.space(6)
        let pad = bodyIsTemplate ? 0 : gutter
        let content = VStack(alignment: .leading, spacing: ax.space(6)) {
            if showsHeader {
                // Above a template, which pads itself, the header keeps the page's gutter.
                header
                    .padding(.horizontal, bodyIsTemplate ? gutter : 0)
                    .padding(.top, bodyIsTemplate ? gutter : 0)
            }
            NodeView(node: app.screen.body)
        }
        .padding(pad)
        .frame(maxWidth: .infinity, alignment: .topLeading)
        .environment(\.axWidth, width - 2 * pad)
        .environment(\.axHeight, height)

        if scrolls && bodyScrollsItself {
            content.frame(maxWidth: .infinity, maxHeight: .infinity, alignment: .top)
        } else if scrolls {
            // The reader lets a node bring one of its views into sight (the diagram's selected box, above its sheet).
            ScrollViewReader { proxy in
                ScrollView {
                    content.environment(\.axScrollTo, { id in withAnimation { proxy.scrollTo(id, anchor: UnitPoint(x: 0.5, y: 0.25)) } })
                }
                .axCaptureScroll()
                .modifier(HardTopEdge(applies: !bodyIsTemplate))
            }
        } else {
            content.fixedSize(horizontal: false, vertical: true).frame(maxHeight: .infinity, alignment: .top)
        }
    }

    private var header: some View {
        HStack(alignment: .top, spacing: ax.space(4)) {
            VStack(alignment: .leading, spacing: ax.space(1)) {
                if headerShowsTitle {
                    Text(app.screen.title)
                        .font(ax.heading(1))
                        .foregroundStyle(ax.text)
                        .lineLimit(4)
                        .minimumScaleFactor(0.5)
                        .fixedSize(horizontal: false, vertical: true)
                        .accessibilityAddTraits(.isHeader)
                }
                // Wraps between words at any size; a word longer than the screen shrinks to fit
                // before it would be broken in two.
                Text(app.screen.subtitle)
                    .font(ax.fontBase)
                    .foregroundStyle(ax.textSecondary)
                    .lineLimit(8)
                    .minimumScaleFactor(0.5)
                    .fixedSize(horizontal: false, vertical: true)
            }
            Spacer(minLength: 0)
            if inlineToolbar {
                HStack(spacing: ax.space(2)) {
                    ForEach(app.screen.toolbar, id: \.id) { AXButton(node: $0) }
                }
            }
        }
    }
}

/// A toolbar button of the screen, as the platform's own button: it shows its words (an icon
/// alone does not say "Follow" or "Today"), and a primary action is the prominent style. On a
/// phone's bar the words stand alone, without the glyph, to fit; only a plus, the standard Add
/// symbol, stays an icon. Every one is also a command in the menu bar (see `AstryxCommands`).
struct ToolbarButton: View {
    let node: ButtonNode
    @Environment(\.ax) private var ax
    @Environment(\.axSend) private var send
    @Environment(\.horizontalSizeClass) private var sizeClass

    /// More words than a phone's bar has room for: these go in the overflow menu.
    static func isLong(_ node: ButtonNode) -> Bool {
        node.label.count > 14
    }


    private var compact: Bool {
        #if os(macOS)
        false
        #else
        sizeClass == .compact
        #endif
    }

    var body: some View {
        let button = Button(role: node.variant == .destructive ? .destructive : nil) {
            send(.press(id: node.id))
        } label: {
            if let icon = node.icon {
                Label(node.label, systemImage: icon.symbol)
            } else {
                Text(node.label)
            }
        }
        .help(node.label)
        .disabled(node.disabled ?? false)
        .tint(node.variant == .destructive ? ax.danger : ax.accent)
        // On a phone's bar the words alone: a glyph rarely says the action ("+" reads as Add, not
        // Follow or Invite), and the words are what the web page shows.
        if !compact {
            styled(button.labelStyle(.titleAndIcon))
        } else {
            styled(button.labelStyle(.titleOnly))
        }
    }

    @ViewBuilder
    private func styled(_ button: some View) -> some View {
        if node.variant == .primary {
            button.buttonStyle(.borderedProminent)
        } else {
            button
        }
    }
}

/// A phone's bar menu for the actions whose words are too long for the bar: each with its words
/// and glyph, as a menu item.
private struct ToolbarOverflowMenu: View {
    let nodes: [ButtonNode]
    @Environment(\.axSend) private var send

    var body: some View {
        Menu {
            ForEach(nodes, id: \.id) { node in
                Button(role: node.variant == .destructive ? .destructive : nil) {
                    send(.press(id: node.id))
                } label: {
                    if let icon = node.icon {
                        Label(node.label, systemImage: icon.symbol)
                    } else {
                        Text(node.label)
                    }
                }
                .disabled(node.disabled ?? false)
            }
        } label: {
            Image(systemName: "ellipsis.circle")
        }
        // The menu has no title of its own: it is named for what it holds.
        .accessibilityLabel(nodes.map(\.label).joined(separator: ", "))
    }
}

/// The toast: a dark pill with the core's words and its action. It is announced to VoiceOver
/// when it appears. With an action (Undo) it stays until it is used or closed; without one it
/// dismisses itself after a few seconds (longer with VoiceOver on) by sending `dismissToast`.
struct ToastView: View {
    let toast: ToastInfo
    @Environment(\.ax) private var ax
    @Environment(\.axSend) private var send
    @Environment(\.accessibilityVoiceOverEnabled) private var voiceOver

    /// What is said: the tone in a word, since the dot is only a color, then the text.
    private var spoken: String {
        [toast.toneLabel, toast.text].compactMap { $0 }.joined(separator: ". ")
    }

    var body: some View {
        HStack(spacing: ax.space(3)) {
            Circle()
                .fill(ax.tone(toast.tone == .neutral ? .accent : toast.tone).solid)
                .frame(width: 8, height: 8)
                .accessibilityHidden(true)
            Text(toast.text)
                .font(ax.fontBase)
                .foregroundStyle(ax.page)
                .accessibilityLabel(spoken)
            if let action = toast.action {
                Button {
                    send(.press(id: action.id))
                } label: {
                    Text(action.label)
                        .font(ax.fontStrong)
                        .foregroundStyle(ax.page)
                        .underline()
                        .frame(minWidth: chromeTarget, minHeight: chromeTarget)
                        .contentShape(Rectangle())
                }
                .buttonStyle(.plain)
                if let dismiss = toast.dismissLabel {
                    Button {
                        send(.dismissToast)
                    } label: {
                        Image(systemName: "xmark")
                            .font(ax.fontSmall)
                            .foregroundStyle(ax.page)
                            .frame(minWidth: chromeTarget, minHeight: chromeTarget)
                            .contentShape(Rectangle())
                    }
                    .buttonStyle(.plain)
                    .accessibilityLabel(dismiss)
                }
            }
        }
        .padding(.leading, ax.space(4))
        .padding(.trailing, toast.action == nil ? ax.space(4) : ax.space(2))
        .padding(.vertical, toast.action == nil ? ax.space(3) : ax.space(1))
        .background(
            RoundedRectangle(cornerRadius: ax.radiusContainer, style: .continuous)
                .fill(ax.color("color-background-inverted"))
                .shadow(color: ax.shadow, radius: 12, y: 4)
        )
        .accessibilityElement(children: .contain)
        .task(id: toast.id) {
            AccessibilityNotification.Announcement(spoken).post()
            // A toast with an action stays: a timer would take the action away from anyone
            // who needs longer to reach it.
            guard toast.action == nil else { return }
            try? await Task.sleep(for: .seconds(voiceOver ? 10 : 4))
            if !Task.isCancelled { await MainActor.run { send(.dismissToast) } }
        }
    }
}

/// The smallest tappable side the platform's guidelines ask for: 44 points on a touch screen.
var chromeTarget: CGFloat {
    #if os(iOS)
    44
    #else
    28
    #endif
}

/// `-AXScrollY <points>` (screen captures): the page opens scrolled that far, so a capture can see
/// below the fold without a pointer. Off unless the argument is given.
extension View {
    @ViewBuilder
    func axCaptureScroll() -> some View {
        let y = UserDefaults.standard.double(forKey: "AXScrollY")
        if #available(iOS 18, macOS 15, *), y > 0 {
            modifier(AXCaptureScroll(y: y))
        } else {
            self
        }
    }
}

@available(iOS 18, macOS 15, *)
private struct AXCaptureScroll: ViewModifier {
    let y: Double
    @State private var position = ScrollPosition()

    func body(content: Content) -> some View {
        content
            .scrollPosition($position)
            .task {
                try? await Task.sleep(for: .seconds(1))
                position.scrollTo(y: y)
            }
    }
}

/// On iOS and macOS 26 a page of text scrolls under the title bar behind a hard edge, so the
/// title never sits over sharp words (HIG, Scroll views: the hard style for bars with text).
/// Templates keep the system's default, as their stock pages do.
private struct HardTopEdge: ViewModifier {
    let applies: Bool

    func body(content: Content) -> some View {
        if #available(iOS 26, macOS 26, *), applies {
            content.scrollEdgeEffectStyle(.hard, for: .top)
        } else {
            content
        }
    }
}
